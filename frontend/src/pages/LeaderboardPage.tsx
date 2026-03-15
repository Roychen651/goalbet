import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useLangStore } from '../stores/langStore';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { UserMatchHistoryModal } from '../components/leaderboard/UserMatchHistoryModal';
import { GlassCard } from '../components/ui/GlassCard';
import { cn } from '../lib/utils';

type LeaderboardType = 'total' | 'weekly';

interface SelectedUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

export function LeaderboardPage() {
  const [type, setType] = useState<LeaderboardType>('total');
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const { entries, loading } = useLeaderboard(type);
  const { user } = useAuthStore();
  const { groups, activeGroupId } = useGroupStore();
  const { t } = useLangStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const currentUserEntry = entries.find(e => e.user_id === user?.id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-bebas text-2xl tracking-wider text-white">{t('leaderboard')}</h1>
        {activeGroup && <p className="text-text-muted text-xs">{activeGroup.name}</p>}
      </div>

      {/* Toggle */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {(['total', 'weekly'] as const).map(tt => (
          <button
            key={tt}
            onClick={() => setType(tt)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150',
              type === tt
                ? 'bg-accent-green text-bg-base shadow-glow-green-sm'
                : 'text-text-muted hover:text-white'
            )}
          >
            {tt === 'total' ? t('allTime') : t('thisWeek')}
          </button>
        ))}
      </div>

      {/* Your rank summary */}
      {currentUserEntry && (
        <GlassCard variant="elevated" className="p-4 grid grid-cols-4 gap-2">
          {[
            { label: t('yourRank'), value: `#${currentUserEntry.rank}`, highlight: true },
            { label: t('points'), value: type === 'weekly' ? currentUserEntry.weekly_points : currentUserEntry.total_points },
            { label: t('accuracy'), value: currentUserEntry.predictions_made > 0 ? `${Math.round((currentUserEntry.correct_predictions / currentUserEntry.predictions_made) * 100)}%` : '—' },
            { label: t('streak'), value: currentUserEntry.current_streak > 0 ? `🔥${currentUserEntry.current_streak}` : '—' },
          ].map(item => (
            <div key={item.label} className="text-center">
              <div className="text-text-muted text-xs uppercase tracking-wider mb-1">{item.label}</div>
              <div className={cn('font-bebas text-2xl', item.highlight ? 'text-accent-green text-glow-green' : 'text-white')}>
                {item.value}
              </div>
            </div>
          ))}
        </GlassCard>
      )}

      <LeaderboardTable
        entries={entries}
        loading={loading}
        currentUserId={user?.id}
        type={type}
        onUserClick={(entry) => setSelectedUser({ user_id: entry.user_id, username: entry.username, avatar_url: entry.avatar_url ?? null })}
      />

      <AnimatePresence>
        {selectedUser && activeGroupId && (
          <UserMatchHistoryModal
            user={selectedUser}
            groupId={activeGroupId}
            onClose={() => setSelectedUser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
