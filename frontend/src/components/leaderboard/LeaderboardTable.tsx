import { motion } from 'framer-motion';
import { LeaderboardEntryWithProfile } from '../../lib/supabase';
import { LeaderboardRow } from './LeaderboardRow';
import { GlassCard } from '../ui/GlassCard';
import { PageLoader } from '../ui/LoadingSpinner';
import { EmptyState } from '../ui/EmptyState';
import { useLangStore } from '../../stores/langStore';
import type { PeriodStatsMap } from '../../pages/LeaderboardPage';

interface LeaderboardTableProps {
  entries: LeaderboardEntryWithProfile[];
  loading: boolean;
  currentUserId: string | undefined;
  type: 'total' | 'weekly' | 'lastWeek';
  onUserClick?: (entry: LeaderboardEntryWithProfile) => void;
  /** Period-filtered stats per user_id. null on 'total' tab. */
  periodStatsMap?: PeriodStatsMap | null;
}

export function LeaderboardTable({ entries, loading, currentUserId, type, onUserClick, periodStatsMap }: LeaderboardTableProps) {
  const { t } = useLangStore();

  if (loading) return <PageLoader />;
  if (entries.length === 0) {
    return <EmptyState icon="🏆" title={t('noLeaderboardData')} description={t('noLeaderboardDesc')} />;
  }

  return (
    <GlassCard variant="default" className="overflow-hidden">
      {/* Table header */}
      <div className="flex items-center px-4 py-2 border-b border-white/8 text-[11px] text-text-muted uppercase tracking-widest font-barlow">
        <span className="w-7 text-center shrink-0">#</span>
        <span className="flex-1 ms-3">{t('playerLabel')}</span>
        <span className="text-end">{t('pts')}</span>
      </div>

      {/* Rows */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        {entries.map((entry) => (
          <motion.div
            key={entry.user_id}
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
              },
            }}
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.18, ease: 'easeOut' as const }}
          >
            <LeaderboardRow
              entry={entry}
              isCurrentUser={entry.user_id === currentUserId}
              type={type}
              periodStat={periodStatsMap ? periodStatsMap.get(entry.user_id) ?? null : null}
              onClick={onUserClick ? () => onUserClick(entry) : undefined}
            />
          </motion.div>
        ))}
      </motion.div>
    </GlassCard>
  );
}
