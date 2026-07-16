/**
 * MatchStats — Comparative horizontal stat bars for Live / FT matches.
 *
 * Extracts `boxscore.teams[].statistics` from ESPN summary.
 * Each stat row: [Home Value] [Comparative Bar] [Away Value]
 * Winning side tinted accent-green/ice-blue; losing side muted glass.
 * Gracefully hidden when no boxscore data is available.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LEAGUE_ESPN_SLUG, LIVE_STATUSES } from '../../lib/constants';
import { useLangStore } from '../../stores/langStore';
import type { Match } from '../../lib/supabase';
import { AIScoutCard } from '../ui/AIScoutCard';
import { fetchMatchStats, type StatRow } from '../../lib/matchBoxscore';

// ── Stat Bar ─────────────────────────────────────────────────────────────────

function StatBar({ stat }: { stat: StatRow }) {
  const { t } = useLangStore();
  const total = stat.home + stat.away || 1;
  const homePct = (stat.home / total) * 100;
  const awayPct = (stat.away / total) * 100;
  const homeWins = stat.home > stat.away;
  const awayWins = stat.away > stat.home;
  const tied = stat.home === stat.away;

  return (
    <div className="space-y-1">
      {/* Label + values */}
      <div className="flex items-center justify-between">
        <span className={cn(
          'text-xs tabular-nums font-bold w-10 text-start',
          homeWins ? 'text-accent-green' : 'text-text-muted',
        )}>
          {stat.pct ? `${stat.home}%` : stat.home}
        </span>
        <span className="text-[10px] text-text-muted/60 uppercase tracking-wider font-barlow">
          {t(stat.label)}
        </span>
        <span className={cn(
          'text-xs tabular-nums font-bold w-10 text-end',
          awayWins ? 'text-accent-green' : 'text-text-muted',
        )}>
          {stat.pct ? `${stat.away}%` : stat.away}
        </span>
      </div>

      {/* Comparative bar */}
      <div className="flex items-center gap-0.5 h-[6px]">
        {/* Home bar — grows from right */}
        <div className="flex-1 flex justify-end">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${homePct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' as const }}
            className={cn(
              'h-full rounded-s-full',
              homeWins
                ? 'bg-accent-green shadow-[0_0_8px_rgba(189,232,245,0.25)]'
                : tied ? 'bg-text-muted/30' : 'bg-text-muted/20',
            )}
          />
        </div>
        {/* Away bar — grows from left */}
        <div className="flex-1">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${awayPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' as const }}
            className={cn(
              'h-full rounded-e-full',
              awayWins
                ? 'bg-accent-green shadow-[0_0_8px_rgba(189,232,245,0.25)]'
                : tied ? 'bg-text-muted/30' : 'bg-text-muted/20',
            )}
          />
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="space-y-1.5">
          <div className="flex justify-between">
            <div className="w-6 h-3 rounded bg-white/6 animate-pulse" />
            <div className="w-16 h-3 rounded bg-white/6 animate-pulse" />
            <div className="w-6 h-3 rounded bg-white/6 animate-pulse" />
          </div>
          <div className="flex gap-0.5 h-[6px]">
            <div className="flex-1 rounded-s-full bg-white/6 animate-pulse" />
            <div className="flex-1 rounded-e-full bg-white/6 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function MatchStats({ match }: { match: Match }) {
  const { t, lang } = useLangStore();
  const postMatchSummary = (lang === 'he' && match.ai_post_match_summary_he) || match.ai_post_match_summary;
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<StatRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Live matches: ESPN's boxscore stats keep changing while the match is in
  // progress. A fetch-once-on-open guard (the previous behavior) froze
  // possession/corners/shots at whatever ESPN returned the instant the panel
  // was first expanded — often 0%/0 near kickoff, before ESPN's boxscore has
  // populated — and never updated again for the rest of the match, even
  // though the score kept moving. Re-fetch every 30s (matching the app's
  // existing live-poll cadence, e.g. AppShell's score sync) while the panel
  // is open and the match is actually live; a finished match still fetches
  // exactly once.
  useEffect(() => {
    if (!open) return;
    if (!LEAGUE_ESPN_SLUG[match.league_id]) return;

    let cancelled = false;
    // Only the initial fetch shows the skeleton — a background refresh on a
    // live match swaps the numbers in place. Flashing the skeleton every 30s
    // over stats that are already on screen would be worse than the stale
    // data it replaces.
    const load = (isInitial: boolean) => {
      if (isInitial) setLoading(true);
      fetchMatchStats(match.external_id, match.league_id)
        .then(rows => { if (!cancelled) setStats(rows); })
        .catch(() => { if (!cancelled) setStats([]); })
        .finally(() => { if (!cancelled && isInitial) setLoading(false); });
    };

    load(true);

    let interval: ReturnType<typeof setInterval> | undefined;
    if (LIVE_STATUSES.includes(match.status)) {
      interval = setInterval(() => load(false), 30_000);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [open, match.external_id, match.league_id, match.status]);

  const hasSummary = !!postMatchSummary && match.status === 'FT';
  const hasEspn = !!LEAGUE_ESPN_SLUG[match.league_id];
  const noStatsAvailable = hasEspn && stats !== null && stats.length === 0 && !loading;

  // Hide entirely only when there's neither a summary nor usable ESPN stats.
  if (!hasSummary && !hasEspn) return null;
  if (!hasSummary && noStatsAvailable) return null;

  return (
    <div className="mt-3 border-t border-white/5 pt-3 space-y-3">
      {hasSummary && (
        <AIScoutCard title="aiScoutPostMatchTitle" text={postMatchSummary} tone="post" />
      )}
      {hasEspn && !noStatsAvailable && (
      <>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-2 py-1 rounded-xl hover:bg-white/3 transition-colors group"
      >
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-white/30 group-hover:text-white/50 transition-colors">
          <BarChart3 size={12} className="opacity-50" />
          {t('matchStats')}
        </span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' as const }}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-200',
            'border border-border-subtle',
            open
              ? 'bg-[rgba(73,136,196,0.18)] text-text-primary'
              : 'bg-transparent text-text-muted group-hover:bg-[rgba(73,136,196,0.10)] group-hover:text-text-primary',
          )}
        >
          <ChevronDown size={14} strokeWidth={2.5} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="match-stats"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="pt-3 pb-2 px-1 space-y-3">
              {loading && <StatsSkeleton />}
              {stats && stats.length > 0 && !loading && (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.06 } },
                  }}
                  className="space-y-3"
                >
                  {stats.map(stat => (
                    <motion.div
                      key={stat.key}
                      variants={{
                        hidden: { opacity: 0, y: 6 },
                        visible: { opacity: 1, y: 0 },
                      }}
                    >
                      <StatBar stat={stat} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}
    </div>
  );
}
