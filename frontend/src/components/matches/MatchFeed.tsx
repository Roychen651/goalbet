import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Match, Prediction } from '../../lib/supabase';
import { MatchCard } from './MatchCard';
import { EmptyState } from '../ui/EmptyState';
import { PageLoader, MatchCardSkeleton } from '../ui/LoadingSpinner';
import { LIVE_STATUSES, FINISHED_STATUSES } from '../../lib/constants';
import { useLangStore } from '../../stores/langStore';

interface MatchFeedProps {
  matches: Match[];
  predictions: Map<string, Prediction>;
  predictorsByMatch?: Map<string, { user_id: string; username: string; avatar_url: string | null }[]>;
  loading: boolean;
  activeTab: 'all' | 'upcoming' | 'live' | 'completed';
}

// Returns true for any match that is in progress (including stalled NS past kickoff)
function isLiveMatch(m: Match, now: number): boolean {
  return LIVE_STATUSES.includes(m.status) || (m.status === 'NS' && new Date(m.kickoff_time).getTime() < now);
}

// Stable ISO date key (YYYY-MM-DD) for sorting
function dateKey(kickoffTime: string): string {
  return kickoffTime.slice(0, 10);
}

// Human-readable date label — respects app language
function dateLabel(kickoffTime: string, lang: 'en' | 'he'): string {
  return new Date(kickoffTime).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export function MatchFeed({
  matches, predictions, predictorsByMatch, loading, activeTab,
}: MatchFeedProps) {
  const { t, lang } = useLangStore();

  const groupedByDate = useMemo(() => {
    const now = Date.now();

    // ── 1. Filter by tab ──────────────────────────────────────────────────────
    let filtered: Match[];
    if (activeTab === 'upcoming') {
      filtered = matches.filter(m => m.status === 'NS' && new Date(m.kickoff_time).getTime() >= now);
    } else if (activeTab === 'live') {
      filtered = matches.filter(m => isLiveMatch(m, now));
    } else if (activeTab === 'completed') {
      filtered = matches.filter(m => FINISHED_STATUSES.includes(m.status));
    } else {
      // All tab: exclude finished — they have their own "Results" tab
      filtered = matches.filter(m => !FINISHED_STATUSES.includes(m.status));
    }

    // ── 2. Group by date ──────────────────────────────────────────────────────
    const groups = new Map<string, Match[]>(); // key = "YYYY-MM-DD"
    for (const match of filtered) {
      const key = dateKey(match.kickoff_time);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(match);
    }

    // ── 3. Sort within each day ───────────────────────────────────────────────
    for (const [, dayMatches] of groups) {
      dayMatches.sort((a, b) => {
        const aLive = isLiveMatch(a, now);
        const bLive = isLiveMatch(b, now);
        // Live before non-live
        if (aLive !== bLive) return aLive ? -1 : 1;
        // Within same bucket: predicted first
        const aPred = predictions.has(a.id) ? 0 : 1;
        const bPred = predictions.has(b.id) ? 0 : 1;
        if (aPred !== bPred) return aPred - bPred;
        // Then by kickoff time — descending in Results tab (latest match first), ascending otherwise
        const tA = new Date(a.kickoff_time).getTime();
        const tB = new Date(b.kickoff_time).getTime();
        if (tA !== tB) return activeTab === 'completed' ? tB - tA : tA - tB;
        return a.league_id - b.league_id;
      });
    }

    // ── 4. Sort dates ─────────────────────────────────────────────────────────
    // Results tab: newest day first. All others: oldest (today) first.
    const sortedKeys = [...groups.keys()].sort((a, b) =>
      activeTab === 'completed' ? b.localeCompare(a) : a.localeCompare(b)
    );

    return sortedKeys.map(key => ({
      key,
      label: dateLabel(groups.get(key)![0].kickoff_time, lang),
      matches: groups.get(key)!,
    }));
  }, [matches, activeTab, predictions]);

  if (loading) {
    // Show skeleton cards for live/all tabs; full page loader elsewhere
    if (activeTab === 'live' || activeTab === 'all') {
      return (
        <div className="space-y-3 px-0 py-2">
          {[1, 2, 3].map(i => <MatchCardSkeleton key={i} />)}
        </div>
      );
    }
    return <PageLoader />;
  }

  if (groupedByDate.length === 0) {
    if (activeTab === 'live') return <EmptyState icon="📡" title={t('noLiveMatches')} description={t('noLiveDesc')} />;
    if (activeTab === 'upcoming') return <EmptyState icon="📅" title={t('noMatches')} description={t('noUpcomingDesc')} />;
    return <EmptyState icon="📅" title={t('noMatches')} description={t('noMatchesDesc')} />;
  }

  return (
    <div className="space-y-2">
      {groupedByDate.map(({ key, label, matches: dayMatches }) => {
        const now = Date.now();
        const liveMatches = dayMatches.filter(m => isLiveMatch(m, now));
        const nonLiveMatches = dayMatches.filter(m => !isLiveMatch(m, now));
        const hasBothSections = activeTab !== 'live' && liveMatches.length > 0 && nonLiveMatches.length > 0;

        return (
          <section key={key}>
            {/* Sticky date header */}
            <div className="match-date-header sticky top-[105px] sm:top-[44px] z-10 -mx-4 px-4 py-1.5 mb-3 flex items-center gap-3">
              <span className="text-accent-green text-[11px] uppercase tracking-[0.18em] font-bold shrink-0">
                {label}
              </span>
              <div className="flex-1 h-px bg-accent-green/20" />
            </div>

            {/* Live section (only shown in All tab when there are also upcoming matches) */}
            {hasBothSections && (
              <>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="w-2 h-2 rounded-full bg-accent-green shrink-0 shadow-[0_0_6px_rgba(0,255,135,0.8)] animate-pulse" />
                  <span className="text-accent-green text-[11px] uppercase tracking-[0.16em] font-bold">
                    {t('liveNow')}
                  </span>
                </div>
                <div className="space-y-3 mb-3">
                  {liveMatches.map((match, i) => (
                    <MatchCardItem
                      key={match.id}
                      match={match}
                      index={i}
                      predictions={predictions}
                      predictorsByMatch={predictorsByMatch}
                    />
                  ))}
                </div>
                {/* Section divider — Upcoming */}
                <div className="flex items-center gap-3 my-4 px-1">
                  <div className="flex-1 h-px bg-border-subtle" />
                  <span className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border border-border-subtle">
                    {t('upcoming')}
                  </span>
                  <div className="flex-1 h-px bg-border-subtle" />
                </div>
                <div className="space-y-3">
                  {nonLiveMatches.map((match, i) => (
                    <MatchCardItem
                      key={match.id}
                      match={match}
                      index={i}
                      predictions={predictions}
                      predictorsByMatch={predictorsByMatch}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Single section (all matches same type, or live/results/upcoming tabs) */}
            {!hasBothSections && (
              <div className="space-y-3">
                {dayMatches.map((match, i) => (
                  <MatchCardItem
                    key={match.id}
                    match={match}
                    index={i}
                    predictions={predictions}
                    predictorsByMatch={predictorsByMatch}
                  />
                ))}
              </div>
            )}

            {/* Bottom spacing between days */}
            <div className="h-4" />
          </section>
        );
      })}
    </div>
  );
}

// Single match card wrapped in animation
function MatchCardItem({
  match, index, predictions, predictorsByMatch,
}: {
  match: Match;
  index: number;
  predictions: Map<string, Prediction>;
  predictorsByMatch?: Map<string, { user_id: string; username: string; avatar_url: string | null }[]>;
}) {
  const cardProps = {
    match,
    prediction: predictions.get(match.id),
    predictors: predictorsByMatch?.get(match.id),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-24px' }}
      transition={{ duration: 0.22, ease: 'easeOut' as const, delay: Math.min(index * 0.04, 0.2) }}
    >
      <MatchCard {...cardProps} />
    </motion.div>
  );
}
