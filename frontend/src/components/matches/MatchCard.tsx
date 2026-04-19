import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Match, Prediction } from '../../lib/supabase';
import { GlassCard } from '../ui/GlassCard';
import { MatchStatusBadge } from './MatchStatusBadge';
import { LockedPrediction } from './PredictionForm';
import { MatchTimeline } from './MatchTimeline';
import { MatchStats } from './MatchStats';
import { MatchRosters } from './MatchRosters';
import { Avatar } from '../ui/Avatar';
import { AIScoutCard } from '../ui/AIScoutCard';
import { HTAnalystCard } from '../ui/HTAnalystCard';
import { cn, formatKickoffTime, getLiveClock, calcLiveBreakdown, calcBreakdown, isMatchLocked } from '../../lib/utils';
import { CoinIcon } from '../ui/CoinIcon';
import { LIVE_STATUSES, FINISHED_STATUSES, FOOTBALL_LEAGUES, LEAGUE_ESPN_SLUG } from '../../lib/constants';
import { useLangStore } from '../../stores/langStore';
import type { TranslationKey } from '../../lib/i18n';
import { useLiveClock } from '../../hooks/useLiveClock';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';

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

// ── ESPN phase translation for Hebrew ─────────────────────────────────────────
const PHASE_HE: Record<string, string> = {
  'Quarterfinals': 'רבע גמר',
  'Quarterfinal': 'רבע גמר',
  'Quarter-Finals': 'רבע גמר',
  'Semifinals': 'חצי גמר',
  'Semifinal': 'חצי גמר',
  'Semi-Finals': 'חצי גמר',
  'Final': 'גמר',
  'Round of 16': 'שמינית גמר',
  'Round of 32': 'סיבוב 32',
  'Group Stage': 'שלב הבתים',
  'Knockout Round Playoffs': 'פלייאוף נוקאאוט',
  'Playoff Round': 'סיבוב פלייאוף',
  'League Phase': 'שלב הליגה',
  '1st Leg': 'מחזור 1',
  '2nd Leg': 'מחזור 2',
  '1ST LEG': 'מחזור 1',
  '2ND LEG': 'מחזור 2',
};
function translatePhase(phase: string, lang: string): string {
  if (lang !== 'he') return phase;
  return PHASE_HE[phase] ?? phase;
}

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
  // Sprint 17
  weather:          { temp: number | null; condition: string | null } | null;
  referee:          string | null;
  competitionPhase: string | null;
  // Sprint 18
  predictor:   { homeWinPct: number; drawPct: number; awayWinPct: number } | null;
  homeRank:    number | null;
  awayRank:    number | null;
  broadcast:   string | null;
  aggregate:   { phase: string | null; title: string; leg: number; homeAgg: number; awayAgg: number; hasAgg: boolean } | null;
}

const ESPN_INFO_EMPTY: EspnMatchInfo = {
  homeForm: null, awayForm: null,
  homeRecord: null, awayRecord: null,
  venue: null, attendance: null,
  h2h: null, odds: null,
  weather: null, referee: null, competitionPhase: null,
  predictor: null, homeRank: null, awayRank: null,
  broadcast: null, aggregate: null,
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
    // ESPN soccer: comp.odds is always empty. Odds live in pickcenter[0].
    let odds: EspnMatchInfo['odds'] = null;
    const toImpl = (ml: number) =>
      ml > 0 ? 100 / (ml + 100) : Math.abs(ml) / (Math.abs(ml) + 100);
    const pickCenter = (data.pickcenter as Record<string, unknown>[]) ?? [];
    if (pickCenter.length > 0) {
      const pc = pickCenter[0] as Record<string, unknown>;
      const hO = (pc.homeTeamOdds as Record<string, unknown>) ?? {};
      const aO = (pc.awayTeamOdds as Record<string, unknown>) ?? {};
      const dO = (pc.drawOdds as Record<string, unknown>) ?? {};
      const hml = typeof hO.moneyLine === 'number' ? hO.moneyLine as number : null;
      const aml = typeof aO.moneyLine === 'number' ? aO.moneyLine as number : null;
      // drawOdds can be { moneyLine: 230 } or just the moneyLine value
      const rawDml = dO.moneyLine;
      const dml = typeof rawDml === 'number' ? rawDml : null;
      if (hml !== null && aml !== null && dml !== null) {
        const rH = toImpl(hml), rA = toImpl(aml), rD = toImpl(dml);
        const s = rH + rA + rD || 1;
        odds = { homeWin: rH / s, draw: rD / s, awayWin: rA / s };
      }
    }

    // ── Head-to-Head ──────────────────────────────────────────
    let h2h: EspnMatchInfo['h2h'] = null;
    const homeId = String(((homeComp.team as Record<string, unknown>)?.id) ?? '');
    const awayId = String(((awayComp.team as Record<string, unknown>)?.id) ?? '');
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

    // ── Weather ───────────────────────────────────────────────
    const weatherObj = (gameInfo.weather as Record<string, unknown>) ?? {};
    let weather: EspnMatchInfo['weather'] = null;
    if (weatherObj && Object.keys(weatherObj).length > 0) {
      const temp = typeof weatherObj.temperature === 'number'
        ? Math.round((weatherObj.temperature as number - 32) * 5 / 9) // °F → °C
        : null;
      const condition = typeof weatherObj.displayValue === 'string' && weatherObj.displayValue
        ? weatherObj.displayValue as string
        : null;
      if (temp !== null || condition) weather = { temp, condition };
    }

    // ── Referee ───────────────────────────────────────────────
    const officials = ((data.boxscore as Record<string, unknown>)?.officials as Record<string, unknown>[]) ?? [];
    const refObj = officials[0] as Record<string, unknown> | undefined;
    const referee = refObj
      ? (typeof refObj.displayName === 'string' && refObj.displayName) ||
        (typeof refObj.fullName === 'string' && refObj.fullName) || null
      : null;

    // ── Competition Phase ─────────────────────────────────────
    const compNotes = (comp.notes as Record<string, unknown>[]) ?? [];
    const compNote = compNotes[0] ?? {};
    const compType = (comp.type as Record<string, unknown>) ?? {};
    const competitionPhase =
      (typeof compNote.headline === 'string' && compNote.headline) ||
      (typeof compType.text === 'string' && compType.text) ||
      null;

    // ── Aggregate (series score — knockout legs) ──────────────
    // ESPN returns series as an array. Each entry has competitors[].aggregateScore.
    // For 2nd legs: "summary" string is present. For 1st legs: build from aggregateScore.
    // Stored as structured data so it can be translated at render time.
    const compSeriesArr = (comp.series as Record<string, unknown>[]) ?? [];
    const seriesObj = compSeriesArr[0] as Record<string, unknown> | undefined;
    let aggregate: EspnMatchInfo['aggregate'] = null;
    if (seriesObj) {
      // Always build structured data so we can translate at render time.
      // ESPN's .summary is English-only — never use it directly.
      // seriesObj.title = round name ("Quarterfinals"), NOT the leg description.
      // competitionPhase (from notes/headline) = leg description ("1ST LEG") — don't use for phase.
      const seriesComps = (seriesObj.competitors as Record<string, unknown>[]) ?? [];
      const leg = typeof seriesObj.leg === 'number' ? seriesObj.leg : null;
      const roundName = typeof seriesObj.title === 'string' ? seriesObj.title : '';
      if (leg !== null) {
        const s0 = seriesComps.length === 2 && typeof seriesComps[0].aggregateScore === 'number' ? seriesComps[0].aggregateScore as number : 0;
        const s1 = seriesComps.length === 2 && typeof seriesComps[1].aggregateScore === 'number' ? seriesComps[1].aggregateScore as number : 0;
        const hasAgg = s0 + s1 > 0 || leg >= 2;
        aggregate = { phase: roundName || null, title: roundName, leg, homeAgg: s0, awayAgg: s1, hasAgg };
      }
    }

    // ── Win Predictor (from odds-derived implied probabilities) ─
    // ESPN's data.predictor is not available for soccer. Instead, derive
    // win probabilities from odds (already computed above).
    let predictor: EspnMatchInfo['predictor'] = null;
    if (odds) {
      const homeWinPct = Math.round(odds.homeWin * 100);
      const drawPct = Math.round(odds.draw * 100);
      const awayWinPct = Math.round(odds.awayWin * 100);
      if (homeWinPct + drawPct + awayWinPct > 0) {
        predictor = { homeWinPct, drawPct, awayWinPct };
      }
    }

    // ── Standings Rank ────────────────────────────────────────
    // Rank is derived from standings.groups[0].standings.entries[] position.
    // The entry index+1 IS the league position.
    let homeRank: number | null = null;
    let awayRank: number | null = null;
    const standingsObj = (data.standings as Record<string, unknown>) ?? {};
    const standingsGroups = (standingsObj.groups as Record<string, unknown>[]) ?? [];
    if (standingsGroups.length > 0) {
      const entries = ((standingsGroups[0].standings as Record<string, unknown>)?.entries as Record<string, unknown>[]) ?? [];
      for (let i = 0; i < entries.length; i++) {
        const entryId = String(entries[i].id ?? '');
        if (entryId === homeId) homeRank = i + 1;
        if (entryId === awayId) awayRank = i + 1;
        if (homeRank !== null && awayRank !== null) break;
      }
    }

    // ── Broadcast ─────────────────────────────────────────────
    const broadcastsArr = (data.broadcasts as Record<string, unknown>[]) ?? [];
    let broadcast: string | null = null;
    if (broadcastsArr.length > 0) {
      const b = broadcastsArr[0] as Record<string, unknown>;
      const mediaShort = String((b.media as Record<string, unknown>)?.shortName ?? '').trim();
      const namesArr = (b.names as string[]) ?? [];
      broadcast = mediaShort || namesArr[0] || null;
      if (broadcast === '') broadcast = null;
    }

    return {
      homeForm, awayForm, homeRecord, awayRecord, venue, attendance,
      h2h, odds, weather, referee, competitionPhase,
      predictor, homeRank, awayRank, broadcast, aggregate,
    };
  } catch {
    return ESPN_INFO_EMPTY;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: Match;
  prediction?: Prediction;
  predictors?: { user_id: string; avatar_url: string | null; username: string }[];
}

function MatchCardCore({ match, prediction, predictors = [] }: MatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { t, lang } = useLangStore();
  const rtl = lang === 'he';
  const { user, profile } = useAuthStore();
  const enableLiveAnimations = useUIStore(s => s.enableLiveAnimations);
  const isSyncing = useUIStore(s => s.isSyncing);
  const openPredictionModal = useUIStore(s => s.openPredictionModal);

  // Track previous scores for safe score-flip animation + goal flash
  const prevScoreRef = useRef<{ home: number | null; away: number | null } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const scoreChanged =
    prevScoreRef.current !== null &&
    (prevScoreRef.current.home !== match.home_score || prevScoreRef.current.away !== match.away_score);
  // Update ref after reading the diff
  useEffect(() => {
    // Trigger goal flash on the card when score changes during live match
    if (scoreChanged && enableLiveAnimations && LIVE_STATUSES.includes(match.status) && cardRef.current) {
      cardRef.current.classList.add('goal-flash');
      setTimeout(() => cardRef.current?.classList.remove('goal-flash'), 1500);
    }
    prevScoreRef.current = { home: match.home_score, away: match.away_score };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.home_score, match.away_score]);

  // ── Tactical intel: fetched eagerly on mount for NS upcoming matches ────────
  const [espnInfo, setEspnInfo] = useState<EspnMatchInfo | null>(null);
  const espnFetchedRef = useRef(false);
  useEffect(() => {
    if (espnFetchedRef.current) return;
    if (match.status !== 'NS') return;
    if (!LEAGUE_ESPN_SLUG[match.league_id]) return;
    espnFetchedRef.current = true;
    let cancelled = false;
    fetchEspnMatchInfo(match.external_id, match.league_id)
      .then(info => { if (!cancelled) setEspnInfo(info); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [match.external_id, match.league_id, match.status]);
  // Re-render every 20s so countdown ("6m", "1h 6m", etc.) stays accurate.
  // This does NOT refetch data — expanded state is preserved.
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
    ? t('secsAgo').replace('{0}', String(updatedAgoSecs))
    : t('minsAgo').replace('{0}', String(Math.floor(updatedAgoSecs / 60)));
  const hasPrediction = !!prediction;
  const { date, time, countdown, lockCountdown } = formatKickoffTime(match.kickoff_time);
  // True when kickoff is within the next 5 minutes
  const startingSoon = !isLive && !isAET && !isFinished && !isPastKickoffNS && (() => {
    const diffMs = new Date(match.kickoff_time).getTime() - Date.now();
    return diffMs > 0 && diffMs < 30 * 60 * 1000;
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
    <div ref={cardRef}>
    <GlassCard
      as="article"
      variant={cardVariant}
      leagueAccent={LEAGUE_ACCENT[match.league_id]}
      className="overflow-hidden"
      breathing={enableLiveAnimations && isInProgress}
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
              isSyncing={isSyncing}
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
            rank={espnInfo?.homeRank}
          />

          <div className="flex-1 flex flex-col items-center">
            {isLive || isAET || isFinished || (isPastKickoffNS && match.home_score !== null) ? (
              <div className="flex flex-col items-center gap-0.5">
                {/* Safe score flipper: animate only on genuine live score changes, not initial render or bulk sync */}
                {(() => {
                  const shouldFlip = enableLiveAnimations && scoreChanged && LIVE_STATUSES.includes(match.status);
                  return (
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={`${match.home_score}-${match.away_score}`}
                        initial={shouldFlip ? { y: -20, opacity: 0, scale: 1.3 } : false}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={shouldFlip ? { y: 20, opacity: 0, scale: 0.8 } : undefined}
                        transition={shouldFlip
                          ? { type: 'spring', stiffness: 200, damping: 18, mass: 0.8 }
                          : { duration: 0 }
                        }
                        className="text-2xl font-bebas tracking-widest"
                      >
                        <span className={homeLeading ? 'text-accent-green' : awayLeading ? 'text-white/50' : 'text-white'}>{match.home_score ?? 0}</span>
                        <span className="text-white/40"> — </span>
                        <span className={awayLeading ? 'text-accent-green' : homeLeading ? 'text-white/50' : 'text-white'}>{match.away_score ?? 0}</span>
                      </motion.span>
                    </AnimatePresence>
                  );
                })()}
                {isInProgress && liveClock && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'text-xs font-bold tracking-wider animate-pulse',
                        ['ET1', 'ET2', 'AET', 'PEN'].includes(match.status) ? 'text-amber-400' : 'text-accent-green'
                      )}
                    >
                      {liveClock}
                    </span>
                    {match.status === 'ET1' && (
                      <span className="text-[9px] text-amber-400/60 font-semibold uppercase tracking-widest">{t('firstET')}</span>
                    )}
                    {match.status === 'ET2' && (
                      <span className="text-[9px] text-amber-400/60 font-semibold uppercase tracking-widest">{t('secondET')}</span>
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
                <span className="text-xl font-bebas tracking-widest text-accent-green animate-pulse">
                  — —
                </span>
                <span className="text-[10px] text-accent-green/70 animate-pulse">
                  {liveClock ?? t('live_status')}
                </span>
                <span className="text-[9px] text-white/25">↻ {updatedAgoLabel}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                {/* League logo — dark variant by default, light variant in html.light */}
                {leagueEspnId !== null ? (<>
                  <img
                    src={`https://a.espncdn.com/i/leaguelogos/soccer/500-dark/${leagueEspnId}.png`}
                    className="w-5 h-5 object-contain league-logo-dark"
                    alt={match.league_name}
                    title={match.league_name}
                    width={20}
                    height={20}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <img
                    src={`https://a.espncdn.com/i/leaguelogos/soccer/500/${leagueEspnId}.png`}
                    className="w-5 h-5 object-contain league-logo-light"
                    alt={match.league_name}
                    title={match.league_name}
                    width={20}
                    height={20}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </>) : leagueBadge ? (
                  <span className="text-sm leading-none" title={match.league_name}>{leagueBadge}</span>
                ) : null}
                <span className="text-text-muted text-[10px]">{date}</span>
                <span className="text-white font-bold text-base font-display leading-none">{time}</span>
                {startingSoon ? (
                  <span className="text-accent-orange text-[10px] font-display font-semibold animate-pulse">
                    {t('startingSoon')}
                  </span>
                ) : countdown ? (
                  <span className="text-accent-green/60 text-[10px] font-display">{countdown}</span>
                ) : null}
                {/* Lock countdown */}
                {!isLive && !isAET && !isFinished && !isPastKickoffNS && lockCountdown && (
                  <span className="text-orange-400/70 text-[9px] font-display flex items-center gap-0.5">
                    <span>🔒</span>
                    <span>{lockCountdown}</span>
                  </span>
                )}
                {/* Aggregate / knockout stage */}
                {espnInfo?.aggregate && (
                  <span className="text-accent-orange text-[11px] sm:text-xs font-display font-semibold mt-0.5 truncate max-w-[240px]">
                    {`${espnInfo.aggregate.phase ? translatePhase(espnInfo.aggregate.phase, lang) + ' · ' : ''}${t('legLabel').replace('{0}', String(espnInfo.aggregate.leg))}${espnInfo.aggregate.hasAgg ? ` (${t('aggLabel').replace('{0}', String(espnInfo.aggregate.homeAgg)).replace('{1}', String(espnInfo.aggregate.awayAgg))})` : ''}`}
                  </span>
                )}
              </div>
            )}
            {/* ET / Penalty match info for finished matches */}
            {isFinished && wentToET && (
              <div className="flex flex-col items-center gap-0.5 mt-1">
                {match.regulation_home != null &&
                  (match.regulation_home !== match.home_score || match.regulation_away !== match.away_score) ? (
                  <span className="text-amber-400/80 text-[10px] font-semibold">
                    90′: {match.regulation_home}–{match.regulation_away}
                  </span>
                ) : (
                  <span className="text-amber-400/50 text-[9px] uppercase tracking-widest">a.e.t.</span>
                )}
                {wentToPens && (
                  match.penalty_home !== null && match.penalty_away !== null ? (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-amber-300 text-[11px] font-bold tracking-wider mt-0.5"
                    >
                      {t('pens')}: {match.penalty_home}–{match.penalty_away}
                    </motion.span>
                  ) : (
                    <span className="text-amber-400/70 text-[10px] font-semibold uppercase tracking-wider">
                      {t('penaltyShootout')}
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
          </div>

          <TeamBlock
            name={match.away_team}
            badge={match.away_team_badge}
            score={isLive || isFinished ? match.away_score : null}
            isWinner={awayWon}
            isLeading={awayLeading}
            redCards={(isLive || isFinished) ? (match.red_cards_away ?? 0) : 0}
            rank={espnInfo?.awayRank}
            right
          />
        </div>

        {/* Win Probability — compact single-row bar */}
        {espnInfo?.predictor && (
          <div className="mt-2.5 px-0.5 relative">
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col items-start shrink-0">
                <span className="font-display text-[11px] font-bold text-accent-green tabular-nums leading-none">
                  {espnInfo.predictor.homeWinPct}%
                </span>
                <span className="text-[9px] text-text-muted/50 font-display leading-none truncate max-w-[55px]">
                  {match.home_team.split(' ').slice(-1)[0]}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex h-[5px] rounded-full overflow-hidden">
                  <div className="h-full bg-accent-green rounded-s-full" style={{ width: `${espnInfo.predictor.homeWinPct}%` }} />
                  <div className="h-full bg-white/10" style={{ width: `${espnInfo.predictor.drawPct}%` }} />
                  <div className="h-full bg-accent-orange rounded-e-full" style={{ width: `${espnInfo.predictor.awayWinPct}%` }} />
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="font-display text-[11px] font-bold text-accent-orange tabular-nums leading-none">
                  {espnInfo.predictor.awayWinPct}%
                </span>
                <span className="text-[9px] text-text-muted/50 font-display leading-none truncate max-w-[55px]">
                  {match.away_team.split(' ').slice(-1)[0]}
                </span>
              </div>
            </div>
            {espnInfo.predictor.drawPct > 0 && (
              <p className="absolute left-0 right-0 text-center text-[9px] text-text-muted/45 font-display uppercase tracking-wide leading-none mt-0.5">
                {t('draw')} {espnInfo.predictor.drawPct}%
              </p>
            )}
            {espnInfo.predictor.drawPct > 0 && <div className="h-3" />}
          </div>
        )}

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
                  {/* AI Scout pre-match insight — NS only, first thing users see */}
                  {match.status === 'NS' && ((lang === 'he' && match.ai_pre_match_insight_he) || match.ai_pre_match_insight) && (
                    <div className="mb-3">
                      <AIScoutCard
                        title="aiScoutPreMatchTitle"
                        text={(lang === 'he' && match.ai_pre_match_insight_he) || match.ai_pre_match_insight}
                        tone="pre"
                      />
                    </div>
                  )}
                  {/* HT Broadcast Ticker — live tactical read at half time */}
                  {match.status === 'HT' && ((lang === 'he' && match.ai_ht_insight_he) || match.ai_ht_insight) && (
                    <div className="mb-3">
                      <HTAnalystCard
                        text={(lang === 'he' && match.ai_ht_insight_he) || match.ai_ht_insight}
                      />
                    </div>
                  )}
                  {/* Tactical intel — form, H2H, venue (NS upcoming only) */}
                  {!isFinished && !isLive && !isAET && espnInfo && (
                    <TacticalIntelSection
                      info={espnInfo}
                      homeName={match.home_team}
                      awayName={match.away_team}
                    />
                  )}
                  {/* Prediction: locked view inline, or button to open modal */}
                  {isMatchLocked(match.kickoff_time) || match.status !== 'NS' ? (
                    <LockedPrediction match={match} prediction={prediction} resolved={prediction?.is_resolved ?? false} />
                  ) : (
                    <button
                      onClick={() => openPredictionModal(match.id)}
                      className={cn(
                        'w-full py-2 rounded-xl text-sm font-display font-semibold transition-all duration-200 border',
                        hasPrediction
                          ? 'bg-white/4 border-white/10 text-text-muted hover:bg-white/8 hover:text-text-primary'
                          : 'bg-accent-green/10 border-accent-green/25 text-accent-green hover:bg-accent-green/18',
                      )}
                    >
                      {hasPrediction ? `✏️ ${t('updatePrediction')}` : t('lockInPrediction')}
                    </button>
                  )}
                  {/* Coin result — shown for finished resolved predictions */}
                  {isFinished && prediction?.is_resolved && (prediction?.coins_bet ?? 0) > 0 && (
                    <MatchCoinSummary coinsBet={prediction.coins_bet ?? 0} pointsEarned={prediction.points_earned ?? 0} />
                  )}
                  {/* Match Center — Stats, Timeline, Rosters (Live + FT) */}
                  {(isFinished || isLive) && <MatchStats match={match} />}
                  {isFinished && <MatchTimeline match={match} />}
                  {(isFinished || isLive) && <MatchRosters match={match} />}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
    </div>
  );
}

// ─── MatchCard (public export) ────────────────────────────────────────────────
// Border glow on hover — CSS transition only, no motion overhead.
// Dark/light colours via CSS vars. No effect on touch devices.
// ─────────────────────────────────────────────────────────────────────────────
export function MatchCard(props: MatchCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl match-card-hover">
      <MatchCardCore {...props} />
    </div>
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
  const { t } = useLangStore();
  const wentToET = match.regulation_home != null || match.went_to_penalties;
  if (!wentToET || match.home_score === null) return null;

  const wentToPens = match.went_to_penalties;
  const etGoals =
    match.regulation_home != null &&
    (match.regulation_home !== match.home_score || match.regulation_away !== match.away_score);

  return (
    <div className="mb-3 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
      <p className="text-amber-400/60 text-[9px] uppercase tracking-widest mb-2">{t('extraTime')}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50">{t('ninetyMinResult')}</span>
          <span className="text-white/80 font-semibold tabular-nums">
            {match.regulation_home ?? match.home_score} – {match.regulation_away ?? match.away_score}
          </span>
        </div>
        {etGoals && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">{t('aetResult')}</span>
            <span className="text-amber-300 font-semibold tabular-nums">
              {match.home_score} – {match.away_score}
            </span>
          </div>
        )}
        {wentToPens && (
          <div className="flex items-center justify-between text-xs border-t border-amber-500/15 pt-1 mt-1">
            <span className="text-amber-300/80">{t('penaltyShootout')}</span>
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

      {/* Match Center — Stats, Timeline, Rosters */}
      <MatchStats match={match} />
      <MatchTimeline match={match} />
      <MatchRosters match={match} />
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

function FormDots({ form, t }: { form: string | null; t: (k: TranslationKey) => string }) {
  if (!form) return null;
  const chars = form.slice(-5).split(''); // oldest → newest, left → right
  const last = chars.length - 1;
  return (
    <div className="flex items-center gap-1">
      {/* Oldest label */}
      <span className="text-[7px] text-white/15 uppercase tracking-wider shrink-0">{t('formOld')}</span>
      {chars.map((c, i) => {
        const isNewest = i === last;
        const colorClass = c === 'W'
          ? 'bg-emerald-400'
          : c === 'L'
          ? 'bg-red-400'
          : 'bg-yellow-400';
        const glowClass = c === 'W'
          ? 'shadow-[0_0_6px_rgba(52,211,153,0.8)]'
          : c === 'L'
          ? 'shadow-[0_0_6px_rgba(248,113,113,0.8)]'
          : 'shadow-[0_0_6px_rgba(250,204,21,0.8)]';
        return (
          <span
            key={i}
            title={c === 'W' ? 'Win' : c === 'L' ? 'Loss' : 'Draw'}
            className={cn(
              'rounded-full shrink-0 transition-all',
              colorClass,
              isNewest ? `w-2.5 h-2.5 ${glowClass} ring-1 ring-white/20` : 'w-2 h-2 opacity-70',
            )}
          />
        );
      })}
      {/* Newest label + arrow */}
      <span className="text-[7px] text-white/25 uppercase tracking-wider shrink-0 font-semibold">
        {t('formNew')}
      </span>
    </div>
  );
}

function TacticalIntelSection({ info, homeName, awayName }: {
  info: EspnMatchInfo;
  homeName: string;
  awayName: string;
}) {
  const { t, lang } = useLangStore();
  const rtl = lang === 'he';

  const homeShort = homeName.split(' ').pop() || homeName;
  const awayShort = awayName.split(' ').pop() || awayName;
  const hasForm = info.homeForm || info.awayForm || info.homeRecord || info.awayRecord;
  const h2hTotal = info.h2h ? info.h2h.homeWins + info.h2h.draws + info.h2h.awayWins : 0;

  const hasAny = hasForm || info.h2h || info.venue || info.referee || info.weather ||
    info.competitionPhase;
  if (!hasAny) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' as const }}
      className="mb-3 space-y-1.5"
    >
      {/* Predictor bar + aggregate are on the closed card — not duplicated here */}

      {/* ── Form + Record (with rank badge) ── */}
      {hasForm && (
        <div className="rounded-xl border border-border-subtle bg-white/[0.02] p-2.5">
          <p className="font-barlow text-[9px] uppercase tracking-widest text-text-muted/60 mb-2">
            {t('teamFormLast5')}
          </p>
          <div className="space-y-2">
            {([
              { name: homeShort, form: info.homeForm, record: info.homeRecord },
              { name: awayShort, form: info.awayForm, record: info.awayRecord },
            ] as const).map(({ name, form, record }) => (
              <div key={name} className="flex items-center gap-2 min-w-0">
                <span className="font-barlow text-[11px] text-text-muted shrink-0 truncate w-[62px]">{name}</span>
                {form ? (
                  <FormDots form={form} t={t} />
                ) : (
                  <span className="text-[10px] text-white/20 italic">{t('noData')}</span>
                )}
                {record && (
                  <span className="ms-auto font-mono text-[10px] text-white/25 tabular-nums shrink-0">{record}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-white/5">
            {[
              { color: 'bg-emerald-400', label: t('formWin') },
              { color: 'bg-yellow-400',  label: t('formDraw') },
              { color: 'bg-red-400',     label: t('formLoss') },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', color)} />
                <span className="font-barlow text-[9px] text-white/25">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── H2H ── */}
      {info.h2h && h2hTotal >= 3 && (
        <div className="rounded-xl border border-border-subtle bg-white/[0.02] p-2.5">
          <p className="font-barlow text-[9px] uppercase tracking-widest text-text-muted/60 mb-2">
            {t('h2hLastN').replace('{0}', String(h2hTotal))}
          </p>
          <div className="grid grid-cols-3 gap-1 text-center">
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-barlow text-[10px] text-text-muted truncate w-full text-center px-1">{homeShort}</span>
              <span className="font-bebas text-2xl leading-none text-accent-green">{info.h2h.homeWins}</span>
              <span className="font-barlow text-[8px] uppercase tracking-widest text-white/25">{t('wins')}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-barlow text-[10px] text-text-muted">{t('draws')}</span>
              <span className="font-bebas text-2xl leading-none text-yellow-400/80">{info.h2h.draws}</span>
              <span className="font-barlow text-[8px] uppercase tracking-widest text-white/25">—</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-barlow text-[10px] text-text-muted truncate w-full text-center px-1">{awayShort}</span>
              <span className="font-bebas text-2xl leading-none text-red-400/80">{info.h2h.awayWins}</span>
              <span className="font-barlow text-[8px] uppercase tracking-widest text-white/25">{t('wins')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Venue ── */}
      {info.venue && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-border-subtle bg-white/[0.02]">
          <span className="text-[12px] shrink-0">🏟</span>
          <span className="font-barlow text-[11px] text-text-muted truncate">{info.venue}</span>
          {info.attendance && (
            <span className="ms-auto text-[10px] text-white/25 tabular-nums shrink-0 font-mono">
              {info.attendance.toLocaleString()} {t('fans')}
            </span>
          )}
        </div>
      )}

      {/* ── Referee ── */}
      {info.referee && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-border-subtle bg-white/[0.02]">
          <span className="text-[12px] shrink-0">🟨</span>
          <span className="font-barlow text-[10px] uppercase tracking-wider text-text-muted/50 shrink-0">
            {t('referee')}
          </span>
          <span className="font-barlow text-[11px] text-text-primary/70 truncate">{info.referee}</span>
        </div>
      )}

      {/* ── Weather ── */}
      {info.weather && (info.weather.temp !== null || info.weather.condition) && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-border-subtle bg-white/[0.02]">
          <span className="text-[12px] shrink-0">🌤</span>
          {info.weather.temp !== null && (
            <span className="font-barlow text-[11px] text-text-muted shrink-0">{info.weather.temp}°C</span>
          )}
          {info.weather.condition && (
            <span className="font-barlow text-[11px] text-text-muted/55 truncate">{info.weather.condition}</span>
          )}
        </div>
      )}

      {/* ── Competition Phase — only when aggregate doesn't already cover it ── */}
      {info.competitionPhase && !info.aggregate && (
        <div className="flex items-center justify-center px-2 py-1 rounded-lg border border-border-subtle bg-white/[0.02]">
          <span className="font-display text-[10px] sm:text-[11px] uppercase tracking-wide text-text-muted/50 font-medium">
            {translatePhase(info.competitionPhase, lang)}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function TeamBlock({ name, badge, score, isWinner, isLeading, right, redCards = 0, rank }: {
  name: string; badge: string | null; score: number | null;
  isWinner: boolean; isLeading?: boolean; right?: boolean; redCards?: number; rank?: number | null;
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
            width={36}
            height={36}
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
      <div className="flex flex-col items-center gap-0">
        <span className={cn(
          'text-center text-xs font-barlow font-bold leading-tight transition-colors duration-300',
          highlight ? 'text-accent-green' : 'text-text-muted',
        )}>
          {shortName}
        </span>
        {rank != null && (
          <span className="text-[9px] text-text-muted/50 font-mono tabular-nums leading-none mt-0.5 bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px]">
            #{rank}
          </span>
        )}
      </div>
    </div>
  );
}
