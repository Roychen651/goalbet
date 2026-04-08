import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Match, Prediction } from '../../lib/supabase';
import { GlassCard } from '../ui/GlassCard';
import { MatchStatusBadge } from './MatchStatusBadge';
import { PredictionForm, PredictionData } from './PredictionForm';
import { MatchTimeline } from './MatchTimeline';
import { Avatar } from '../ui/Avatar';
import { cn, formatKickoffTime, getLiveClock, calcLiveBreakdown, calcBreakdown } from '../../lib/utils';
import { CoinIcon } from '../ui/CoinIcon';
import { LIVE_STATUSES, FINISHED_STATUSES, FOOTBALL_LEAGUES, LEAGUE_ESPN_SLUG } from '../../lib/constants';
import { useLangStore } from '../../stores/langStore';
import type { TranslationKey } from '../../lib/i18n';
import { useLiveClock } from '../../hooks/useLiveClock';
import { useAuthStore } from '../../stores/authStore';

const LEAGUE_ACCENT: Record<number, string> = {
  4346: '#1a4fa8', // Champions League (UEFA Blue)
  4399: '#e05a1e', // Europa League (Orange)
  4877: '#2da562', // Conference League (Teal)
  4328: '#c01c28', // Premier League (Crimson)
  4335: '#a51f22', // La Liga (Red)
  4331: '#242424', // Bundesliga (Dark Charcoal)
  4332: '#004c99', // Serie A (Blue)
  4334: '#002654', // Ligue 1 (Deep Blue)
  9001: '#002654', // FA Cup
  9002: '#002654', // League Cup
  9003: '#a51f22', // Copa del Rey
};

// ── ESPN Tactical Intel ───────────────────────────────────────────────────────

interface EspnMatchInfo {
  homeForm:   string | null;   // e.g. "WLDWW" (oldest→newest)
  awayForm:   string | null;
  homeRecord: string | null;   // e.g. "12-4-2"
  awayRecord: string | null;
  venue:      string | null;
  attendance: number | null;
  h2h:        { homeWins: number; draws: number; awayWins: number } | null;
  odds:       { homeWin: number; draw: number; awayWin: number } | null;
}

const ESPN_INFO_EMPTY: EspnMatchInfo = {
  homeForm: null, awayForm: null,
  homeRecord: null, awayRecord: null,
  venue: null, attendance: null,
  h2h: null, odds: null,
};

async function fetchEspnMatchInfo(externalId: string, leagueId: number): Promise<EspnMatchInfo> {
  const slug = LEAGUE_ESPN_SLUG[leagueId];
  if (!slug) return ESPN_INFO_EMPTY;

  const eventId = externalId.replace(/^espn_/, '');
  if (!eventId || !/^\d+$/.test(eventId)) return ESPN_INFO_EMPTY;

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`
    );
    if (!res.ok) return ESPN_INFO_EMPTY;
    const data = await res.json() as Record<string, unknown>;

    // ── Competitors ──────────────────────────────────────────
    const comp = ((data.header as Record<string, unknown>)
      ?.competitions as Record<string, unknown>[])?.[0] ?? {};
    const competitors = (comp.competitors as Record<string, unknown>[]) ?? [];
    const homeComp = (competitors.find(c => c.homeAway === 'home') ?? {}) as Record<string, unknown>;
    const awayComp = (competitors.find(c => c.homeAway === 'away') ?? {}) as Record<string, unknown>;

    // ── Form ─────────────────────────────────────────────────
    const homeForm = typeof homeComp.form === 'string' && homeComp.form ? homeComp.form : null;
    const awayForm = typeof awayComp.form === 'string' && awayComp.form ? awayComp.form : null;

    // ── Records ──────────────────────────────────────────────
    const pickRecord = (recs: Record<string, unknown>[]) => {
      const r = recs.find(x => String(x.type ?? '').toLowerCase().includes('total')) ?? recs[0];
      return typeof r?.summary === 'string' ? r.summary : null;
    };
    const homeRecord = pickRecord((homeComp.records as Record<string, unknown>[]) ?? []);
    const awayRecord = pickRecord((awayComp.records as Record<string, unknown>[]) ?? []);

    // ── Venue ─────────────────────────────────────────────────
    const gameInfo = (data.gameInfo as Record<string, unknown>) ?? {};
    const venueObj = ((gameInfo.venue ?? comp.venue) as Record<string, unknown>) ?? {};
    const venue = typeof venueObj.fullName === 'string' && venueObj.fullName ? venueObj.fullName : null;
    const attendance = typeof gameInfo.attendance === 'number' ? gameInfo.attendance as number : null;

    // ── Odds → normalised implied probability ─────────────────
    let odds: EspnMatchInfo['odds'] = null;
    const oddsArr = (comp.odds as Record<string, unknown>[]) ?? [];
    if (oddsArr.length > 0) {
      const o = oddsArr[0] as Record<string, unknown>;
      const hO = (o.homeTeamOdds as Record<string, unknown>) ?? {};
      const aO = (o.awayTeamOdds as Record<string, unknown>) ?? {};
      const dO = (o.drawOdds     as Record<string, unknown>) ?? {};

      // Try pre-computed winPercentage (ESPN returns 0–100)
      const hw = typeof hO.winPercentage === 'number' ? (hO.winPercentage as number) / 100 : null;
      const aw = typeof aO.winPercentage === 'number' ? (aO.winPercentage as number) / 100 : null;
      const dw = typeof dO.winPercentage === 'number' ? (dO.winPercentage as number) / 100 : null;

      if (hw !== null && aw !== null && dw !== null) {
        const s = hw + aw + dw || 1;
        odds = { homeWin: hw / s, draw: dw / s, awayWin: aw / s };
      } else {
        // Fallback: American moneyLine → implied probability
        const toImpl = (ml: number) =>
          ml > 0 ? 100 / (ml + 100) : Math.abs(ml) / (Math.abs(ml) + 100);
        const hml = typeof hO.moneyLine === 'number' ? hO.moneyLine as number : null;
        const aml = typeof aO.moneyLine === 'number' ? aO.moneyLine as number : null;
        const dml = typeof dO.moneyLine === 'number' ? dO.moneyLine as number : null;
        if (hml !== null && aml !== null && dml !== null) {
          const rH = toImpl(hml), rA = toImpl(aml), rD = toImpl(dml);
          const s = rH + rA + rD || 1;
          odds = { homeWin: rH / s, draw: rD / s, awayWin: rA / s };
        }
      }
    }

    // ── Head-to-Head ──────────────────────────────────────────
    let h2h: EspnMatchInfo['h2h'] = null;
    const homeId = String(((homeComp.team as Record<string, unknown>)?.id) ?? '');
    const h2hGames = (data.headToHeadGames as Record<string, unknown>[]) ?? [];
    if (h2hGames.length > 0 && homeId) {
      const last5 = h2hGames.slice(0, 5);
      let homeWins = 0, draws = 0, awayWins = 0;
      for (const game of last5) {
        const gc = (game.competitors as Record<string, unknown>[]) ?? [];
        const winner = gc.find(c => c.winner === true);
        if (!winner) {
          draws++;
        } else {
          const wId = String(((winner.team as Record<string, unknown>)?.id) ?? '');
          if (wId === homeId) homeWins++; else awayWins++;
        }
      }
      h2h = { homeWins, draws, awayWins };
    }

    return { homeForm, awayForm, homeRecord, awayRecord, venue, attendance, h2h, odds };
  } catch {
    return ESPN_INFO_EMPTY;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: Match;
  prediction?: Prediction;
  predictors?: { user_id: string; avatar_url: string | null; username: string }[];
  onSavePrediction: (data: PredictionData) => Promise<void>;
  savingMatchId: string | null;
}

export function MatchCard({ match, prediction, predictors = [], onSavePrediction, savingMatchId }: MatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLangStore();
  const { user, profile } = useAuthStore();

  // ── Tactical intel: fetched once on expand for NS upcoming matches ──────────
  const [espnInfo, setEspnInfo] = useState<EspnMatchInfo | null>(null);
  const espnFetchedRef = useRef(false);
  useEffect(() => {
    if (!expanded || espnFetchedRef.current) return;
    if (match.status !== 'NS') return;
    if (!LEAGUE_ESPN_SLUG[match.league_id]) return;
    espnFetchedRef.current = true;
    let cancelled = false;
    fetchEspnMatchInfo(match.external_id, match.league_id)
      .then(info => { if (!cancelled) setEspnInfo(info); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [expanded, match.external_id, match.league_id, match.status]);
  // Re-render every 20s so countdown ("6m", "1h 6m", etc.) stays accurate.
  // This does NOT refetch data — PredictionForm and expanded state are preserved.
  useLiveClock(20_000);
  const isLive = LIVE_STATUSES.includes(match.status);
  const isFinished = FINISHED_STATUSES.includes(match.status);
  // AET = after extra time ended, brief pause before penalty result
  const isAET = match.status === 'AET';
  // NS match that has passed kickoff — backend hasn't updated status yet
  const isPastKickoffNS = match.status === 'NS' && new Date(match.kickoff_time).getTime() < Date.now();
  const isInProgress = isLive || isAET || isPastKickoffNS;
  const liveClock = isInProgress ? getLiveClock(match) : null;
  // "refreshed X ago" — how stale is the DB data
  const updatedAgoSecs = Math.floor((Date.now() - new Date(match.updated_at).getTime()) / 1000);
  const updatedAgoLabel = updatedAgoSecs < 60
    ? `${updatedAgoSecs}s ago`
    : `${Math.floor(updatedAgoSecs / 60)}m ago`;
  const hasPrediction = !!prediction;
  const { date, time, countdown, lockCountdown } = formatKickoffTime(match.kickoff_time);
  // True when kickoff is within the next 5 minutes
  const startingSoon = !isLive && !isAET && !isFinished && !isPastKickoffNS && (() => {
    const diffMs = new Date(match.kickoff_time).getTime() - Date.now();
    return diffMs > 0 && diffMs < 5 * 60 * 1000;
  })();
  const leagueInfo = FOOTBALL_LEAGUES.find(l => l.id === match.league_id);
  const leagueBadge = leagueInfo?.badge;
  const leagueEspnId = leagueInfo?.espnLogoId ?? null;

  // ET/PEN detection for finished matches
  const wentToET = isFinished && (match.regulation_home != null || match.went_to_penalties);
  const wentToPens = isFinished && match.went_to_penalties;

  // We rely on actual ESPN status codes (ET1/ET2/AET/PEN) from the DB.
  // Wall-clock heuristics were removed because they trigger false positives for league games
  // in 90-minute stoppage time (e.g. a game at 98' has a wall-clock age of ~113 min,
  // which exceeds the 110-min ET1 threshold and incorrectly showed "1ST ET").
  // Real knockout ET games send STATUS_FIRST_HALF_OVERTIME / STATUS_SECOND_HALF_OVERTIME
  // from ESPN which correctly map to ET1/ET2 in the DB.

  // Leading team during live — used for score + team highlighting
  const homeLeading = isInProgress && match.home_score !== null && match.away_score !== null && match.home_score > match.away_score;
  const awayLeading = isInProgress && match.home_score !== null && match.away_score !== null && match.away_score > match.home_score;

  // Winner for finished matches: ET score may be tied (decided by pens), use penalty scores to break tie
  const homeWonOnPens = wentToPens && match.penalty_home !== null && match.penalty_away !== null && match.penalty_home > match.penalty_away;
  const awayWonOnPens = wentToPens && match.penalty_home !== null && match.penalty_away !== null && match.penalty_away > match.penalty_home;
  const homeWon = isFinished && match.home_score !== null && match.away_score !== null && (match.home_score > match.away_score || homeWonOnPens);
  const awayWon = isFinished && match.home_score !== null && match.away_score !== null && (match.away_score > match.home_score || awayWonOnPens);

  // Predicted live cards get a blue glow — visually distinct from unpredicted live (green)
  const cardVariant = isInProgress
    ? (hasPrediction ? 'live-predicted' : 'live')
    : 'default';

  return (
    <GlassCard
      as="article"
      variant={cardVariant}
      leagueAccent={LEAGUE_ACCENT[match.league_id]}
      className="overflow-hidden"
      interactive
    >
      {/* Card header */}
      <button
        className="w-full p-4 text-start group hover:bg-white/3 transition-colors duration-150 rounded-t-2xl"
        onClick={() => setExpanded(prev => !prev)}
      >
        {/* League + status row */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-text-muted text-xs truncate me-2">
            {match.league_name}
            {match.round && ` · R${match.round}`}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {hasPrediction && isFinished && prediction?.is_resolved && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1"
              >
                {(prediction.points_earned ?? 0) > 0 ? (
                  <span className="flex items-center gap-1 bg-accent-green/12 border border-accent-green/25 rounded-full px-2 py-0.5 text-accent-green text-xs font-bold">
                    +{prediction.points_earned} {t('pts')}
                  </span>
                ) : (
                  <span className="text-white/25 text-xs">0 {t('pts')}</span>
                )}
                {(prediction.coins_bet ?? 0) > 0 && (
                  <MatchCoinBadge coinsBet={prediction.coins_bet ?? 0} pointsEarned={prediction.points_earned ?? 0} />
                )}
              </motion.div>
            )}
            {hasPrediction && isInProgress && prediction && (() => {
              // If already resolved (e.g. ET started → 90-min score locked), show final pts
              if (prediction.is_resolved) {
                return (prediction.points_earned ?? 0) > 0 ? (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1 bg-accent-green/12 border border-accent-green/25 rounded-full px-2 py-0.5 text-accent-green text-xs font-bold"
                  >
                    +{prediction.points_earned} {t('pts')}
                  </motion.span>
                ) : (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-white/25 text-xs"
                  >
                    0 {t('pts')}
                  </motion.span>
                );
              }
              const tiers = calcLiveBreakdown(prediction, match);
              const livePts = tiers ? tiers.filter(r => r.earned && !r.pending).reduce((s, r) => s + r.pts, 0) : 0;
              return livePts > 0 ? (
                <motion.span
                  key={livePts}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1 bg-blue-500/12 border border-blue-500/25 rounded-full px-2 py-0.5 text-blue-400 text-xs font-bold"
                >
                  +{livePts} {t('pts')}
                </motion.span>
              ) : (
                <motion.span
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1 text-accent-green text-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                  {t('predicted')}
                </motion.span>
              );
            })()}
            {hasPrediction && !isFinished && !isInProgress && (
              <motion.span
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 text-accent-green text-xs"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                {t('predicted')}
              </motion.span>
            )}
            <MatchStatusBadge
              status={
                isPastKickoffNS ? 'DELAYED'
                : wentToPens ? 'PEN'
                : wentToET ? 'AET'            // finished after ET (no pens) → "AET"
                : isAET ? 'ET_HT'            // live break between ET halves → "AET HT"
                : match.status
              }
            />
          </div>
        </div>

        {/* Teams + score */}
        <div className="flex items-center gap-3">
          <TeamBlock
            name={match.home_team}
            badge={match.home_team_badge}
            score={isLive || isFinished ? match.home_score : null}
            isWinner={homeWon}
            isLeading={homeLeading}
            redCards={(isLive || isFinished) ? (match.red_cards_home ?? 0) : 0}
          />

          <div className="flex-1 flex flex-col items-center">
            {isLive || isAET || isFinished || (isPastKickoffNS && match.home_score !== null) ? (
              <div className="flex flex-col items-center gap-0.5">
                <motion.span
                  key={`${match.home_score}-${match.away_score}`}
                  initial={{ scale: 1.15 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="text-2xl font-bebas tracking-widest"
                >
                  <span className={homeLeading ? 'text-accent-green' : awayLeading ? 'text-white/50' : 'text-white'}>{match.home_score ?? 0}</span>
                  <span className="text-white/40"> — </span>
                  <span className={awayLeading ? 'text-accent-green' : homeLeading ? 'text-white/50' : 'text-white'}>{match.away_score ?? 0}</span>
                </motion.span>
                {isInProgress && liveClock && (
                  <div className="flex items-center gap-1.5">
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                      className={cn(
                        'text-xs font-bold tracking-wider',
                        ['ET1', 'ET2', 'AET', 'PEN'].includes(match.status) ? 'text-amber-400' : 'text-accent-green'
                      )}
                    >
                      {liveClock}
                    </motion.span>
                    {match.status === 'ET1' && (
                      <span className="text-[9px] text-amber-400/60 font-semibold uppercase tracking-widest">1st ET</span>
                    )}
                    {match.status === 'ET2' && (
                      <span className="text-[9px] text-amber-400/60 font-semibold uppercase tracking-widest">2nd ET</span>
                    )}
                  </div>
                )}
                {isInProgress && (
                  <span className="text-[9px] text-white/25 mt-0.5">
                    ↻ {updatedAgoLabel}
                  </span>
                )}
              </div>
            ) : isPastKickoffNS ? (
              // Kicked off but backend hasn't polled ESPN yet
              <div className="flex flex-col items-center gap-1">
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="text-xl font-bebas tracking-widest text-accent-green"
                >
                  — —
                </motion.span>
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="text-[10px] text-accent-green/70"
                >
                  {liveClock ?? t('live_status')}
                </motion.span>
                <span className="text-[9px] text-white/25">↻ {updatedAgoLabel}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                {leagueEspnId !== null ? (
                  <img
                    src={`https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/${leagueEspnId}.png&h=80&w=80`}
                    className="w-6 h-6 object-contain mb-0.5"
                    alt={match.league_name}
                    title={match.league_name}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      if (img.nextSibling === null && leagueBadge) {
                        const span = document.createElement('span');
                        span.textContent = leagueBadge;
                        span.className = 'text-base leading-none mb-0.5';
                        img.parentNode?.appendChild(span);
                      }
                    }}
                  />
                ) : leagueBadge ? (
                  <span className="text-base leading-none mb-0.5" title={match.league_name}>{leagueBadge}</span>
                ) : null}
                <span className="text-text-muted text-xs">{date}</span>
                <span className="text-white font-semibold text-sm">{time}</span>
                {startingSoon ? (
                  <motion.span
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="text-accent-green text-xs font-semibold"
                  >
                    {t('startingNow')}
                  </motion.span>
                ) : countdown ? (
                  <span className="text-accent-green text-xs">{countdown}</span>
                ) : null}
              </div>
            )}
            {/* ET / Penalty match info for finished matches */}
            {isFinished && wentToET && (
              <div className="flex flex-col items-center gap-0.5 mt-1">
                {match.regulation_home != null &&
                  (match.regulation_home !== match.home_score || match.regulation_away !== match.away_score) ? (
                  /* ET goals changed the score — show the 90-min result */
                  <span className="text-amber-400/80 text-[10px] font-semibold">
                    90′: {match.regulation_home}–{match.regulation_away}
                  </span>
                ) : (
                  /* No ET goals — clarify the score above is after 120 min */
                  <span className="text-amber-400/50 text-[9px] uppercase tracking-widest">a.e.t.</span>
                )}
                {wentToPens && (
                  match.penalty_home !== null && match.penalty_away !== null ? (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-amber-300 text-[11px] font-bold tracking-wider mt-0.5"
                    >
                      Pens: {match.penalty_home}–{match.penalty_away}
                    </motion.span>
                  ) : (
                    <span className="text-amber-400/70 text-[10px] font-semibold uppercase tracking-wider">
                      Penalty Shootout
                    </span>
                  )
                )}
              </div>
            )}
            {/* Corners — show count when available (live or finished, any card) */}
            {match.corners_total != null && (isInProgress || isFinished) && (
              <span className="text-blue-400/70 text-[10px] mt-0.5">
                🚩 {match.corners_total} {t('corners')}
              </span>
            )}
            {/* Lock countdown — shown only for upcoming matches not yet locked */}
            {!isLive && !isAET && !isFinished && !isPastKickoffNS && lockCountdown && (
              <span className="text-orange-400/80 text-[10px] mt-0.5 flex items-center gap-0.5">
                <span>🔒</span>
                <span>{lockCountdown}</span>
              </span>
            )}
          </div>

          <TeamBlock
            name={match.away_team}
            badge={match.away_team_badge}
            score={isLive || isFinished ? match.away_score : null}
            isWinner={awayWon}
            isLeading={awayLeading}
            redCards={(isLive || isFinished) ? (match.red_cards_away ?? 0) : 0}
            right
          />
        </div>

        {/* Predictors row — who has predicted */}
        {predictors.length > 0 && !isFinished && (
          <div className="flex items-center gap-1.5 mt-2.5">
            <div className="flex -space-x-1.5">
              {predictors.slice(0, 5).map(p => (
                <div
                  key={p.user_id}
                  className="rounded-full border border-bg-base shrink-0 overflow-hidden"
                  title={p.username}
                >
                  <Avatar
                    src={p.user_id === user?.id ? (profile?.avatar_url ?? p.avatar_url) : p.avatar_url}
                    name={p.username}
                    size="sm"
                  />
                </div>
              ))}
              {predictors.length > 5 && (
                <div className="w-5 h-5 rounded-full border border-bg-base bg-white/10 flex items-center justify-center text-[8px] text-white/50">
                  +{predictors.length - 5}
                </div>
              )}
            </div>
            <span className="text-white/30 text-[10px]">{t('predicted')}</span>
          </div>
        )}

        {/* Expand chevron */}
        <div className="flex justify-center mt-2">
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' as const }}
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-200',
              'border border-border-subtle',
              expanded
                ? 'bg-[rgba(73,136,196,0.18)] text-text-primary'
                : 'bg-transparent text-text-muted group-hover:bg-[rgba(73,136,196,0.10)] group-hover:text-text-primary',
            )}
          >
            <ChevronDown size={14} strokeWidth={2.5} />
          </motion.div>
        </div>
      </button>

      {/* Prediction form / match stats — animated */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="prediction-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-white/5 pt-3">
              {isFinished && !hasPrediction ? (
                <MatchActualStats match={match} />
              ) : prediction?.is_resolved && isInProgress ? (
                <ResolvedETPanel prediction={prediction} match={match} />
              ) : (
                <>
                  {/* ET/PEN result block — shown for ALL finished AET/PEN cards */}
                  {isFinished && <ETSummaryBlock match={match} />}
                  {/* Tactical intel — form, H2H, venue (NS upcoming only) */}
                  {!isFinished && !isLive && !isAET && espnInfo && (
                    <TacticalIntelSection
                      info={espnInfo}
                      homeName={match.home_team}
                      awayName={match.away_team}
                    />
                  )}
                  <PredictionForm
                    match={match}
                    existingPrediction={prediction}
                    onSave={async (data) => { await onSavePrediction(data); setExpanded(false); }}
                    saving={savingMatchId === match.id}
                    odds={espnInfo?.odds ?? undefined}
                  />
                  {/* Coin result — shown for finished resolved predictions */}
                  {isFinished && prediction?.is_resolved && (prediction?.coins_bet ?? 0) > 0 && (
                    <MatchCoinSummary coinsBet={prediction.coins_bet ?? 0} pointsEarned={prediction.points_earned ?? 0} />
                  )}
                  {isFinished && <MatchTimeline match={match} />}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

function tierLabel(key: string, t: (k: TranslationKey) => string): string {
  switch (key) {
    case 'result': return t('result');
    case 'score': return t('exactScore');
    case 'ht': return t('halfTime');
    case 'corners': return t('corners');
    case 'btts': return t('btts');
    case 'ou': return t('overUnder');
    default: return key;
  }
}

// Shown when prediction was resolved at 90' but match is still in ET/PEN
function ResolvedETPanel({ prediction, match }: { prediction: Prediction; match: Match }) {
  const { t } = useLangStore();
  const regHome = match.regulation_home ?? match.home_score;
  const regAway = match.regulation_away ?? match.away_score;
  // Build a fake FT match at the 90-min score so calcBreakdown works
  const fakeMatch = { ...match, status: 'FT', home_score: regHome, away_score: regAway };
  const breakdown = calcBreakdown(prediction, fakeMatch as Match);

  return (
    <div className="space-y-2">
      {/* Resolved banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${
          prediction.points_earned > 0
            ? 'bg-accent-green/10 border-accent-green/20'
            : 'bg-white/4 border-white/8'
        }`}
      >
        <div className="flex flex-col">
          <span className="text-[10px] text-amber-400/70 font-semibold uppercase tracking-widest">{t('lockedAt90')}</span>
          <span className="text-xs text-white/50 mt-0.5 tabular-nums">{regHome} — {regAway}</span>
        </div>
        <span className={`text-xl font-bebas tracking-wide ${prediction.points_earned > 0 ? 'text-accent-green' : 'text-white/25'}`}>
          {prediction.points_earned > 0 ? `+${prediction.points_earned}` : '0'} <span className="text-sm">{t('pts')}</span>
        </span>
      </motion.div>
      {/* Per-tier breakdown */}
      {breakdown && (
        <div className="space-y-1">
          {breakdown.map((tier, i) => (
            <motion.div
              key={tier.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${
                tier.earned ? 'bg-accent-green/8 border border-accent-green/15' : 'bg-white/3 border border-white/5'
              }`}
            >
              <span className={`flex items-center gap-1.5 ${tier.earned ? 'text-accent-green' : 'text-text-muted opacity-60'}`}>
                <span>{tier.earned ? '✓' : '✗'}</span>
                <span>{tierLabel(tier.key, t)}</span>
              </span>
              <span className={`font-bold tabular-nums ${tier.earned ? 'text-accent-green' : 'text-white/25'}`}>
                {tier.earned ? `+${tier.pts}` : '0'}
              </span>
            </motion.div>
          ))}
          {/* Coin result for ET-resolved predictions */}
          {(prediction.coins_bet ?? 0) > 0 && (
            <MatchCoinSummary coinsBet={prediction.coins_bet ?? 0} pointsEarned={prediction.points_earned ?? 0} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared ET/PEN result block — shown on all finished AET/PEN cards ──────────
function ETSummaryBlock({ match }: { match: Match }) {
  const wentToET = match.regulation_home != null || match.went_to_penalties;
  if (!wentToET || match.home_score === null) return null;

  const wentToPens = match.went_to_penalties;
  const etGoals =
    match.regulation_home != null &&
    (match.regulation_home !== match.home_score || match.regulation_away !== match.away_score);

  return (
    <div className="mb-3 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
      <p className="text-amber-400/60 text-[9px] uppercase tracking-widest mb-2">Extra Time</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50">90′ Result</span>
          <span className="text-white/80 font-semibold tabular-nums">
            {match.regulation_home ?? match.home_score} – {match.regulation_away ?? match.away_score}
          </span>
        </div>
        {etGoals && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">120′ (a.e.t.)</span>
            <span className="text-amber-300 font-semibold tabular-nums">
              {match.home_score} – {match.away_score}
            </span>
          </div>
        )}
        {wentToPens && (
          <div className="flex items-center justify-between text-xs border-t border-amber-500/15 pt-1 mt-1">
            <span className="text-amber-300/80">Penalty Shootout</span>
            <span className="text-amber-300 font-bold tabular-nums text-sm">
              {match.penalty_home !== null ? `${match.penalty_home} – ${match.penalty_away}` : '—'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchActualStats({ match }: { match: Match }) {
  const { t } = useLangStore();
  if (match.home_score === null || match.away_score === null) return null;

  // For scoring purposes use regulation score; display the actual full-time (ET) score
  const scoringHome = match.regulation_home ?? match.home_score;
  const scoringAway = match.regulation_away ?? match.away_score;
  const btts = scoringHome > 0 && scoringAway > 0;
  const totalGoals = scoringHome + scoringAway;
  const isOver = totalGoals > 2.5;
  const cornersTotal = match.corners_total;
  const cornersBucket = cornersTotal !== null && cornersTotal !== undefined
    ? cornersTotal <= 9 ? t('cornersUnder9') : cornersTotal === 10 ? t('cornersTen') : t('cornersOver11')
    : null;

  return (
    <div className="space-y-1.5">
      {/* ET / Penalty summary — reuses shared block */}
      <ETSummaryBlock match={match} />

      <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">{t('matchStats')}</p>
      {[
        { label: t('btts'), value: btts ? t('yes') : t('no'), positive: btts },
        { label: t('goals'), value: `${totalGoals} (${isOver ? t('over25') : t('under25')})`, positive: isOver },
        ...(cornersBucket ? [{ label: t('corners'), value: `${cornersTotal} — ${cornersBucket}`, positive: true }] : []),
      ].map(s => (
        <div key={s.label} className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs bg-white/3 border border-white/5">
          <span className="text-white/40">{s.label}</span>
          <span className="text-white/70 font-semibold">{s.value}</span>
        </div>
      ))}

      {/* Match timeline — goals, cards, subs */}
      <MatchTimeline match={match} />
    </div>
  );
}

/** Compact amber coin badge for the card header — shows coins earned back (always positive framing) */
function MatchCoinBadge({ coinsBet, pointsEarned }: { coinsBet: number; pointsEarned: number }) {
  const coinsBack = pointsEarned * 2;
  const profit = coinsBack > coinsBet;
  return (
    <span className={`flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 border ${
      profit ? 'bg-amber-400/12 border-amber-400/25' : 'bg-white/4 border-white/10'
    }`}>
      <CoinIcon size={10} />
      <span className={`font-bebas text-sm leading-none ${profit ? 'text-amber-400' : 'text-white/28'}`}>
        {coinsBack > 0 ? `+${coinsBack}` : '0'}
      </span>
    </span>
  );
}

/** Expanded coin economy row — staked / back / net */
function MatchCoinSummary({ coinsBet, pointsEarned }: { coinsBet: number; pointsEarned: number }) {
  const { t } = useLangStore();
  const coinsBack = pointsEarned * 2;
  const net = coinsBack - coinsBet;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mt-1 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 flex items-center justify-between gap-2"
    >
      <div className="flex items-center gap-1.5">
        <CoinIcon size={13} />
        <span className="text-[10px] uppercase tracking-widest font-semibold text-amber-400/45">{t('coinsLabel')}</span>
      </div>
      <div className="flex items-center gap-2.5 text-xs">
        <div className="flex items-center gap-1 text-white/35">
          <span>{t('stakedLabel')}</span>
          <span className="font-bold tabular-nums">−{coinsBet}</span>
        </div>
        <div className="w-px h-3 bg-white/10 shrink-0" />
        <div className="flex items-center gap-1 text-white/35">
          <span>{t('backLabel')}</span>
          <span className={`font-bold tabular-nums ${coinsBack > 0 ? 'text-amber-400/70' : ''}`}>+{coinsBack}</span>
        </div>
        {net > 0 && (
          <>
            <div className="w-px h-3 bg-white/10 shrink-0" />
            <div className="flex items-center gap-0.5 font-bold tabular-nums text-emerald-400">
              <span className="text-[10px] font-normal opacity-60">{t('profitLabel')}</span>
              <span>+{net}</span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Tactical Intel components ────────────────────────────────────────────────

function FormDots({ form }: { form: string | null }) {
  if (!form) return null;
  const chars = form.slice(-5).split(''); // oldest → newest, left → right
  return (
    <div className="flex items-center gap-0.5">
      {chars.map((c, i) => (
        <span
          key={i}
          title={c === 'W' ? 'Win' : c === 'L' ? 'Loss' : 'Draw'}
          className={cn(
            'w-2 h-2 rounded-full shrink-0',
            c === 'W'
              ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.7)]'
              : c === 'L'
              ? 'bg-red-400 shadow-[0_0_4px_rgba(248,113,113,0.7)]'
              : 'bg-yellow-400 shadow-[0_0_4px_rgba(250,204,21,0.7)]',
          )}
        />
      ))}
    </div>
  );
}

function TacticalIntelSection({ info, homeName, awayName }: {
  info: EspnMatchInfo;
  homeName: string;
  awayName: string;
}) {
  const { lang } = useLangStore();
  const he = lang === 'he';

  const homeShort = homeName.split(' ').pop() || homeName;
  const awayShort = awayName.split(' ').pop() || awayName;
  const hasForm = info.homeForm || info.awayForm || info.homeRecord || info.awayRecord;
  const h2hTotal = info.h2h ? info.h2h.homeWins + info.h2h.draws + info.h2h.awayWins : 0;

  if (!hasForm && !info.h2h && !info.venue) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' as const }}
      className="mb-3 space-y-1.5"
    >
      {/* Form + Record */}
      {hasForm && (
        <div className="rounded-xl border border-border-subtle bg-white/[0.02] p-2.5">
          <p className="font-barlow text-[9px] uppercase tracking-widest text-text-muted/60 mb-2">
            {he ? 'פורמה · 5 משחקים אחרונים' : 'Team Form · Last 5'}
          </p>
          <div className="space-y-2">
            {([
              { name: homeShort, form: info.homeForm, record: info.homeRecord },
              { name: awayShort, form: info.awayForm, record: info.awayRecord },
            ] as const).map(({ name, form, record }) => (
              <div key={name} className="flex items-center gap-2">
                <span className="font-barlow text-[11px] text-text-muted w-[68px] shrink-0 truncate">{name}</span>
                {form ? (
                  <FormDots form={form} />
                ) : (
                  <span className="text-[10px] text-white/20 italic">
                    {he ? 'אין נתונים' : 'no data'}
                  </span>
                )}
                {record && (
                  <span className="ms-auto font-mono text-[10px] text-white/25 tabular-nums shrink-0">
                    {record}
                  </span>
                )}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-white/5">
            {[
              { color: 'bg-emerald-400', label: he ? 'נצח' : 'Win' },
              { color: 'bg-yellow-400',  label: he ? 'תיקו' : 'Draw' },
              { color: 'bg-red-400',     label: he ? 'הפסד' : 'Loss' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', color)} />
                <span className="font-barlow text-[9px] text-white/25">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* H2H — 3-column scoreboard for clarity */}
      {info.h2h && h2hTotal > 0 && (
        <div className="rounded-xl border border-border-subtle bg-white/[0.02] p-2.5">
          <p className="font-barlow text-[9px] uppercase tracking-widest text-text-muted/60 mb-2">
            {he ? `עימותים ישירים · ${h2hTotal} אחרונים` : `Head to Head · Last ${h2hTotal}`}
          </p>
          <div className="grid grid-cols-3 gap-1 text-center">
            {/* Home wins */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-barlow text-[10px] text-text-muted truncate w-full text-center px-1">{homeShort}</span>
              <span className="font-bebas text-2xl leading-none text-accent-green">{info.h2h.homeWins}</span>
              <span className="font-barlow text-[8px] uppercase tracking-widest text-white/25">{he ? 'נצחונות' : 'Wins'}</span>
            </div>
            {/* Draws */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-barlow text-[10px] text-text-muted">{he ? 'תיקו' : 'Draws'}</span>
              <span className="font-bebas text-2xl leading-none text-yellow-400/80">{info.h2h.draws}</span>
              <span className="font-barlow text-[8px] uppercase tracking-widest text-white/25">—</span>
            </div>
            {/* Away wins */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-barlow text-[10px] text-text-muted truncate w-full text-center px-1">{awayShort}</span>
              <span className="font-bebas text-2xl leading-none text-red-400/80">{info.h2h.awayWins}</span>
              <span className="font-barlow text-[8px] uppercase tracking-widest text-white/25">{he ? 'נצחונות' : 'Wins'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Venue */}
      {info.venue && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-border-subtle bg-white/[0.02]">
          <span className="text-[12px] shrink-0">🏟</span>
          <span className="font-barlow text-[11px] text-text-muted truncate">{info.venue}</span>
          {info.attendance && (
            <span className="ms-auto text-[10px] text-white/25 tabular-nums shrink-0 font-mono">
              {info.attendance.toLocaleString()} {he ? 'אוהדים' : 'fans'}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function TeamBlock({ name, badge, score, isWinner, isLeading, right, redCards = 0 }: {
  name: string; badge: string | null; score: number | null;
  isWinner: boolean; isLeading?: boolean; right?: boolean; redCards?: number;
}) {
  const shortName = name.length > 12 ? name.split(' ').pop() || name : name;
  const highlight = isWinner || isLeading;
  const cardCount = Math.min(redCards, 3); // cap at 3 for layout safety
  return (
    <div className={cn('flex flex-col items-center gap-1 w-[80px]')}>
      <div className="relative">
        {badge ? (
          <img
            src={badge}
            alt={name}
            className={cn(
              'w-9 h-9 object-contain transition-all duration-200',
              highlight && 'drop-shadow-[0_0_8px_rgba(0,255,135,0.5)] scale-105',
            )}
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-base">⚽</div>
        )}
        {/* Red cards — shown in top-right corner of badge when > 0 */}
        {cardCount > 0 && (
          <div className="absolute -top-1 -right-1 flex gap-[2px]">
            {Array.from({ length: cardCount }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: i * 0.08 }}
                className="w-2.5 h-3.5 rounded-[2px] bg-red-600 shadow-[0_0_5px_rgba(220,38,38,0.7)] border border-red-400/40"
              />
            ))}
          </div>
        )}
      </div>
      <span className={cn(
        'text-center text-xs font-barlow font-bold leading-tight transition-colors duration-300',
        highlight ? 'text-accent-green' : 'text-text-muted',
      )}>
        {shortName}
      </span>
    </div>
  );
}
