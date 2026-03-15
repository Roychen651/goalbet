import { motion } from 'framer-motion';
import { LeaderboardEntryWithProfile } from '../../lib/supabase';
import { LeaderboardRow } from './LeaderboardRow';
import { PageLoader } from '../ui/LoadingSpinner';
import { EmptyState } from '../ui/EmptyState';
import { useLangStore } from '../../stores/langStore';

interface LeaderboardTableProps {
  entries: LeaderboardEntryWithProfile[];
  loading: boolean;
  currentUserId: string | undefined;
  type: 'total' | 'weekly' | 'lastWeek';
  onUserClick?: (entry: LeaderboardEntryWithProfile) => void;
}

export function LeaderboardTable({ entries, loading, currentUserId, type, onUserClick }: LeaderboardTableProps) {
  const { t } = useLangStore();

  if (loading) return <PageLoader />;
  if (entries.length === 0) {
    return <EmptyState icon="🏆" title={t('noLeaderboardData')} description={t('noLeaderboardDesc')} />;
  }

  return (
    <motion.div
      className="space-y-1"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      {entries.map((entry, i) => (
        <motion.div
          key={entry.user_id}
          variants={{
            hidden: { opacity: 0, x: -24, scale: 0.97 },
            show: {
              opacity: 1,
              x: 0,
              scale: 1,
              transition: { type: 'spring', stiffness: 90, damping: 18 },
            },
          }}
          whileHover={{ scale: 1.01, x: 2 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <LeaderboardRow
            entry={entry}
            isCurrentUser={entry.user_id === currentUserId}
            type={type}
            onClick={onUserClick ? () => onUserClick(entry) : undefined}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
