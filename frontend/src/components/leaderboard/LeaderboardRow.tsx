import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { LeaderboardEntryWithProfile, supabase } from '../../lib/supabase';
import { Avatar } from '../ui/Avatar';
import { LeaderboardRowSparkline } from './LeaderboardRowSparkline';
import { cn } from '../../lib/utils';
import { haptic } from '../../lib/haptics';
import { interpolateDiverging } from '../../lib/oklch';
import { useLangStore } from '../../stores/langStore';
import type { PeriodStat, RecentPrediction } from '../../pages/LeaderboardPage';

interface BetSlipMatch {
  home_team: string;
  away_team: string;
  home_team_badge: string | null;
  away_team_badge: string | null;
}

interface LeaderboardRowProps {
  entry: LeaderboardEntryWithProfile;
  isCurrentUser: boolean;
  type: 'total' | 'weekly' | 'lastWeek';
  /** Period-filtered stats for this user. null on 'total' tab or when missing. */
  periodStat?: PeriodStat | null;
  onClick?: () => void;
  /** Last-5-resolved-predictions (matchId + points), oldest -> newest. */
  recentPredictions?: RecentPrediction[];
  /** Weekly rank delta (positive = moved up). Only rendered on the 'weekly' tab. */
  rankDelta?: number;
  /** Whether this row's lightweight in-place preview is open. */
  expanded?: boolean;
  /** Toggles the preview — a separate tap target from `onClick`'s modal. */
  onToggleExpand?: () => void;
}

const PODIUM_STYLES: Record<number, { ring: string; shadow: string; avatarSize: 'md' | 'lg' | 'xl'; bg: string }> = {
  1: { ring: 'ring-2 ring-amber-400/70', shadow: 'drop-shadow-[0_0_14px_rgba(232,160,32,0.35)]', avatarSize: 'xl', bg: 'bg-amber-500/5' },
  2: { ring: 'ring-2 ring-slate-300/60', shadow: 'drop-shadow-[0_0_10px_rgba(200,200,200,0.25)]', avatarSize: 'lg', bg: 'bg-white/5' },
  3: { ring: 'ring-2 ring-amber-700/60', shadow: 'drop-shadow-[0_0_8px_rgba(180,100,50,0.25)]', avatarSize: 'lg', bg: 'bg-orange-900/10' },
};

export function LeaderboardRow({ entry, isCurrentUser, type, periodStat, onClick, recentPredictions, rankDelta, expanded, onToggleExpand }: LeaderboardRowProps) {
  const { t } = useLangStore();
  const reduceMotion = useReducedMotion();
  // Points / picks / accuracy: on period tabs read EVERY number from periodStat so the
  // row, KPI card, and Insights always agree. Fall back to the entry row only on the
  // 'total' tab. Never read entry.weekly_points / entry.last_week_points here — those
  // can be stale cached DB values during the refetch transient.
  const periodActive = type !== 'total';
  const points = periodActive
    ? (periodStat?.pts ?? 0)
    : entry.total_points;
  const picksMade = periodActive ? (periodStat?.made ?? 0) : entry.predictions_made;
  const picksCorrect = periodActive ? (periodStat?.correct ?? 0) : entry.correct_predictions;
  const accuracy = picksMade > 0
    ? Math.round((picksCorrect / picksMade) * 100)
    : 0;
  const podium = PODIUM_STYLES[entry.rank];

  // Sprint 21 — lazy bet-slip detail. Fetches team names/badges for the SAME
  // matchIds the sparkline already knows about, only once, only when this
  // row's preview is actually opened — the eager batched fetch in
  // LeaderboardPage.tsx stays cheap (points only) for every row in the
  // table, and this per-row detail is paid for only by rows a user actually
  // expands.
  const [betSlipMatches, setBetSlipMatches] = useState<Map<string, BetSlipMatch> | null>(null);
  const betSlipFetchedRef = useRef(false);
  useEffect(() => {
    if (!expanded || betSlipFetchedRef.current || !recentPredictions || recentPredictions.length === 0) return;
    betSlipFetchedRef.current = true;
    const matchIds = recentPredictions.map(p => p.matchId);
    let cancelled = false;
    supabase
      .from('matches')
      .select('id, home_team, away_team, home_team_badge, away_team_badge')
      .in('id', matchIds)
      .then(({ data }) => {
        if (cancelled) return;
        setBetSlipMatches(new Map((data ?? []).map((m) => [m.id as string, m as BetSlipMatch])));
      });
    return () => { cancelled = true; };
  }, [expanded, recentPredictions]);

  return (
    <div className={cn(
      'border-b border-white/5 last:border-b-0',
      isCurrentUser ? 'bg-accent-green/8' : podium ? podium.bg : '',
    )}>
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-all duration-200',
        onClick && 'cursor-pointer',
        !isCurrentUser && !podium && 'hover:bg-white/4',
      )}
    >
      <div className="w-7 flex flex-col items-center shrink-0">
        {entry.rank === 1 ? (
          <span className="text-lg">🥇</span>
        ) : entry.rank === 2 ? (
          <span className="text-lg">🥈</span>
        ) : entry.rank === 3 ? (
          <span className="text-lg">🥉</span>
        ) : (
          <span className="text-text-muted text-sm font-mono font-semibold tabular-nums">{entry.rank}</span>
        )}
        {/* Rank delta — 'weekly' tab only, no badge when unchanged. Color
            comes from interpolateDiverging (lib/oklch.ts), which resolves
            the live --arena-cold/hot tokens via getComputedStyle — never a
            hardcoded second copy of those numbers. Low-alpha background via
            color-mix, the same technique Toast.tsx already established for
            "a resolved color at low opacity, blended into the surface."
            Logical gap/flex order means it mirrors correctly in RTL with
            zero direction-specific code. */}
        {type === 'weekly' && typeof rankDelta === 'number' && rankDelta !== 0 && (() => {
          const deltaColor = interpolateDiverging(rankDelta > 0 ? 1 : 0).color;
          return (
            <span
              className="mt-0.5 inline-flex items-center gap-0.5 px-1 rounded-full text-[9px] font-mono font-bold tabular-nums leading-tight whitespace-nowrap"
              style={{
                color: deltaColor,
                background: `color-mix(in oklch, ${deltaColor} 16%, var(--color-bg-card))`,
              }}
            >
              {rankDelta > 0 ? '▲' : '▼'} {Math.abs(rankDelta)}
            </span>
          );
        })()}
      </div>

      {/* Prestige gold halo — #1 only. Exactly one instance ever renders per
          leaderboard (unlike a match feed where a "live clock" style effect
          could repeat dozens of times), so a Framer Motion loop is the right
          tool here, not a CSS keyframe — the "many simultaneous instances"
          cost concern that drives CSS-only choices elsewhere doesn't apply
          to a single #1 row. Reuses --risk-gold (Sprint 20) rather than a
          third gold token. */}
      <div className="relative isolate shrink-0">
        {entry.rank === 1 && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -z-10 -inset-3 rounded-full blur-lg"
            style={{ background: 'radial-gradient(circle, var(--risk-gold) 0%, transparent 70%)' }}
            animate={reduceMotion ? { opacity: 0.55 } : { opacity: [0.4, 0.75, 0.4], scale: [1, 1.1, 1] }}
            transition={reduceMotion ? undefined : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <Avatar
          src={entry.avatar_url}
          name={entry.username}
          size={podium ? podium.avatarSize : 'md'}
          className={cn(podium?.ring, podium?.shadow)}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn('font-semibold text-sm truncate', isCurrentUser ? 'text-accent-green' : 'text-white')}>
            {entry.username}{isCurrentUser && ` (${t('you')})`}
          </span>
          {recentPredictions && recentPredictions.length >= 2 && (
            <LeaderboardRowSparkline points={recentPredictions.map(p => p.points)} className="shrink-0" />
          )}
          {entry.weekly_points > 15 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent-orange/10 text-accent-orange border border-accent-orange/20 leading-none whitespace-nowrap">
              {t('badgeHot')} 🔥
            </span>
          )}
          {accuracy >= 65 && picksMade >= 5 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent-green/10 text-accent-green border border-accent-green/20 leading-none whitespace-nowrap">
              {t('badgeSniper')} 🎯
            </span>
          )}
          {entry.current_streak >= 3 && (
            <span
              title={t('streakTooltip').replace('{0}', String(entry.current_streak))}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/25 leading-none whitespace-nowrap tabular-nums"
            >
              🔥 {entry.current_streak}
            </span>
          )}
        </div>
        <div className="text-text-muted text-xs mt-0.5">
          {picksMade} {t('picks')} · {picksMade > 0 ? `${accuracy}%` : '—'} {t('accurate')}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="text-end min-w-[56px]">
          {(entry.live_points ?? 0) > 0 ? (
            <>
              {/* Confirmed pts + live potential, clearly labelled */}
              <div className="flex items-baseline gap-1 justify-end">
                <span className={cn('font-bebas tracking-wider text-xl', entry.rank === 1 ? 'text-accent-green text-glow-green' : 'text-white')}>
                  {points}
                </span>
                <span className="text-blue-400 font-bebas text-base">+{entry.live_points}</span>
              </div>
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 animate-pulse" />
                <span className="text-blue-400 text-[10px] font-medium">{entry.live_points} {t('ptsLiveLabel')}</span>
              </div>
            </>
          ) : (
            <>
              <div className={cn('font-mono font-bold tabular-nums tracking-wider text-xl', entry.rank === 1 ? 'text-accent-green text-glow-green' : 'text-white')}>
                {points}
              </div>
              <div className="text-text-muted text-xs">{points} {t('pts')}</div>
            </>
          )}
        </div>
        {onToggleExpand && (
          <button
            onClick={(e) => { e.stopPropagation(); haptic('selection'); onToggleExpand(); }}
            aria-label={t('leaderboardExpandRow')}
            aria-expanded={!!expanded}
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-text-muted hover:text-white hover:bg-white/8 transition-colors"
          >
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2, ease: 'easeInOut' as const }}>
              <ChevronDown size={14} />
            </motion.div>
          </button>
        )}
        {onClick && <span className="text-white/20 text-xs">›</span>}
      </div>
    </div>

    {/* In-place preview — separate from the modals onClick opens (own row:
        UserMatchHistoryModal, other row: H2HModal, both untouched). A
        lighter, faster peek: streak/accuracy recap + the last 5 resolved
        predictions as mini team-badge pairs (mandate: "recent 5 bet slips
        with mini team icons"), colored by whether that pick earned points.
        stopPropagation so interacting inside the preview never also
        triggers the row's modal-opening onClick. */}
    <AnimatePresence initial={false}>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className="overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 pb-3 pt-1 ms-10 space-y-2.5">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted">{t('bentoCurrentStreak')}</span>
                <span className="font-mono font-semibold tabular-nums text-orange-400">🔥 {entry.current_streak}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted">{t('badgeSniper')}</span>
                <span className="font-mono font-semibold tabular-nums text-accent-green">
                  {picksMade > 0 ? `${accuracy}%` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted">{t('bestStreakLabel')}</span>
                <span className="font-mono font-semibold tabular-nums text-white/80">🏅 {entry.best_streak}</span>
              </div>
            </div>

            {recentPredictions && recentPredictions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {recentPredictions.map((p) => {
                  const match = betSlipMatches?.get(p.matchId);
                  const won = p.points > 0;
                  return (
                    <div
                      key={p.matchId}
                      title={match ? `${match.home_team} vs ${match.away_team} · +${p.points}` : undefined}
                      className={cn(
                        'flex items-center gap-1 px-1.5 py-1 rounded-lg border shrink-0',
                        won ? 'bg-accent-green/8 border-accent-green/20' : 'bg-white/3 border-white/8',
                      )}
                    >
                      {match ? (
                        <>
                          {match.home_team_badge ? (
                            <img src={match.home_team_badge} alt={match.home_team} width={14} height={14} className="w-3.5 h-3.5 object-contain" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full bg-white/10 shrink-0" />
                          )}
                          <span className="text-white/20 text-[9px]">–</span>
                          {match.away_team_badge ? (
                            <img src={match.away_team_badge} alt={match.away_team} width={14} height={14} className="w-3.5 h-3.5 object-contain" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full bg-white/10 shrink-0" />
                          )}
                        </>
                      ) : (
                        <span className="w-8 h-3.5 rounded bg-white/5 animate-pulse" />
                      )}
                      <span className={cn('text-[9px] font-mono font-bold tabular-nums', won ? 'text-accent-green' : 'text-text-muted/50')}>
                        {won ? `+${p.points}` : '0'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
}
