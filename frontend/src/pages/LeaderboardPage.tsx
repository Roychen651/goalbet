import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLeaderboard, LeaderboardType } from '../hooks/useLeaderboard';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useLangStore } from '../stores/langStore';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { UserMatchHistoryModal } from '../components/leaderboard/UserMatchHistoryModal';
import { GlassCard } from '../components/ui/GlassCard';
import { cn } from '../lib/utils';
import { LeaderboardEntryWithProfile } from '../lib/supabase';

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

  // Check if last_week_points field exists in data
  const hasLastWeekField = entries.length > 0 && 'last_week_points' in entries[0];

  const TABS: { key: LeaderboardType; label: string }[] = [
    { key: 'total', label: t('allTime') },
    { key: 'weekly', label: t('thisWeek') },
    { key: 'lastWeek', label: t('lastWeek') },
  ];

  const getPoints = (entry: LeaderboardEntryWithProfile) => {
    if (type === 'weekly') return entry.weekly_points;
    if (type === 'lastWeek') return (entry as unknown as Record<string, unknown>)['last_week_points'] as number ?? entry.weekly_points;
    return entry.total_points;
  };

  // Resolve type prop for LeaderboardTable (only supports 'total' | 'weekly')
  const tableType: 'total' | 'weekly' = type === 'lastWeek' ? 'weekly' : type;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-bebas text-2xl tracking-wider text-white">{t('leaderboard')}</h1>
        {activeGroup && <p className="text-text-muted text-xs">{activeGroup.name}</p>}
      </div>

      {/* Toggle */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setType(tab.key)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150',
              type === tab.key
                ? 'bg-accent-green text-bg-base shadow-glow-green-sm'
                : 'text-text-muted hover:text-white'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Your rank summary */}
      {currentUserEntry && (
        <GlassCard variant="elevated" className="p-4 grid grid-cols-4 gap-2">
          {[
            { label: t('yourRank'), value: `#${currentUserEntry.rank}`, highlight: true, sub: undefined },
            { label: t('points'), value: getPoints(currentUserEntry), sub: 'total' },
            {
              label: 'Hit Rate',
              value: currentUserEntry.predictions_made > 0
                ? `${currentUserEntry.correct_predictions}/${currentUserEntry.predictions_made}`
                : '—',
              sub: 'correct · picks',
            },
            { label: t('streak'), value: currentUserEntry.current_streak > 0 ? `🔥${currentUserEntry.current_streak}` : '—', sub: 'in a row' },
          ].map(item => (
            <div key={item.label} className="text-center">
              <div className="text-text-muted text-[10px] uppercase tracking-wider mb-1">{item.label}</div>
              <div className={cn('font-bebas text-xl sm:text-2xl', item.highlight ? 'text-accent-green text-glow-green' : 'text-white')}>
                {item.value}
              </div>
              {item.sub && <div className="text-white/25 text-[9px] mt-0.5 leading-tight">{item.sub}</div>}
            </div>
          ))}
        </GlassCard>
      )}

      {/* Last week coming soon notice */}
      {type === 'lastWeek' && !hasLastWeekField && entries.length > 0 && (
        <GlassCard className="p-4 text-center">
          <p className="text-text-muted text-sm">Coming soon — will track from next Monday</p>
        </GlassCard>
      )}

      <LeaderboardTable
        entries={entries}
        loading={loading}
        currentUserId={user?.id}
        type={tableType}
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
