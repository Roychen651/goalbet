import { useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { LeaderboardEntryWithProfile } from '../../lib/supabase';
import { LeaderboardRow } from './LeaderboardRow';
import { GlassCard } from '../ui/GlassCard';
import { PageLoader } from '../ui/LoadingSpinner';
import { EmptyState } from '../ui/EmptyState';
import { useLangStore } from '../../stores/langStore';
import type { PeriodStatsMap, RecentPrediction } from '../../pages/LeaderboardPage';

interface LeaderboardTableProps {
  entries: LeaderboardEntryWithProfile[];
  loading: boolean;
  currentUserId: string | undefined;
  type: 'total' | 'weekly' | 'lastWeek';
  onUserClick?: (entry: LeaderboardEntryWithProfile) => void;
  /** Period-filtered stats per user_id. null on 'total' tab. */
  periodStatsMap?: PeriodStatsMap | null;
  /** Last-5-resolved-predictions (matchId + points) per user_id. */
  sparklineMap?: Map<string, RecentPrediction[]>;
  /** Weekly rank delta per user_id (positive = moved up). 'weekly' tab only. */
  rankDeltaMap?: Map<string, number>;
  /** V4 Sprint 23 — notification "View Standings" deep link (?highlight=<user_id>).
   *  Seeds the initially-expanded row so a rank_drop notification's CTA lands
   *  directly on the user's own recap instead of a flat, unremarkable table. */
  initialHighlightUserId?: string | null;
  /** V5 Sprint 40 — active group id, forwarded to LeaderboardRow's Scout
   *  Report lazy fetch (get_player_scout_report's shared-group guard). */
  groupId?: string | null;
}

export function LeaderboardTable({ entries, loading, currentUserId, type, onUserClick, periodStatsMap, sparklineMap, rankDeltaMap, initialHighlightUserId, groupId }: LeaderboardTableProps) {
  const { t } = useLangStore();
  // Sprint 21 — which row's lightweight in-place preview is open, if any.
  // Deliberately separate from onUserClick's modal-opening row click — the
  // existing own-row/other-row modal split (UserMatchHistoryModal/H2HModal)
  // stays exactly as-is; this is an additional, smaller affordance, not a
  // replacement for it.
  const [expandedUserId, setExpandedUserId] = useState<string | null>(initialHighlightUserId ?? null);

  if (loading) return <PageLoader />;
  if (entries.length === 0) {
    return <EmptyState icon="🏆" title={t('noLeaderboardData')} description={t('noLeaderboardDesc')} />;
  }

  return (
    // V5 Sprint 42 — edgeGradient (Sprint 19's variable-opacity masked
    // border) was already used on MatchCard/SyndicatePoolCard/BattleMeter
    // but never on the Leaderboard's own outer card. This element is
    // static (no whileHover/whileTap/drag on it — only the ROWS inside get
    // `layout`), so it's the same safe, untransformed-element shape as
    // MatchCard's own usage, not the transform+backdrop-filter WebKit trap
    // (§21/§34) a moving element would risk.
    <GlassCard variant="default" edgeGradient className="overflow-hidden">
      {/* Table header */}
      <div className="flex items-center px-4 py-2 border-b border-white/8 text-[11px] text-text-muted uppercase tracking-widest font-barlow">
        <span className="w-7 text-center shrink-0">#</span>
        <span className="flex-1 ms-3">{t('playerLabel')}</span>
        <span className="text-end">{t('pts')}</span>
      </div>

      {/* Rows — LayoutGroup + `layout` on each row means a sort-order change
          (a prediction resolving, a tab switch, live points shifting rank)
          animates rows sliding to their new position via Framer's FLIP
          measurement, instead of the list silently re-rendering in the new
          order with no visual continuity. */}
      <LayoutGroup id="leaderboard-rows">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        >
          {entries.map((entry) => (
            <motion.div
              key={entry.user_id}
              layout
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
                },
              }}
              whileHover={{ scale: 1.005 }}
              transition={{ layout: { type: 'spring', stiffness: 380, damping: 32 }, duration: 0.18, ease: 'easeOut' as const }}
            >
              <LeaderboardRow
                entry={entry}
                isCurrentUser={entry.user_id === currentUserId}
                type={type}
                periodStat={periodStatsMap ? periodStatsMap.get(entry.user_id) ?? null : null}
                onClick={onUserClick ? () => onUserClick(entry) : undefined}
                recentPredictions={sparklineMap?.get(entry.user_id)}
                rankDelta={rankDeltaMap?.get(entry.user_id)}
                expanded={expandedUserId === entry.user_id}
                onToggleExpand={() => setExpandedUserId(prev => prev === entry.user_id ? null : entry.user_id)}
                groupId={groupId}
              />
            </motion.div>
          ))}
        </motion.div>
      </LayoutGroup>
    </GlassCard>
  );
}
