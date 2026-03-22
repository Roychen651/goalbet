import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLeaderboard, LeaderboardType } from '../hooks/useLeaderboard';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useLangStore } from '../stores/langStore';
import { supabase } from '../lib/supabase';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { UserMatchHistoryModal } from '../components/leaderboard/UserMatchHistoryModal';
import { H2HModal, H2HUser } from '../components/leaderboard/H2HModal';
import { GlassCard } from '../components/ui/GlassCard';
import { InfoTip } from '../components/ui/InfoTip';
import { cn } from '../lib/utils';
import { LeaderboardEntryWithProfile } from '../lib/supabase';

interface SelectedUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

// Sun–Sat week boundaries in ms
function getWeekBoundsMs(type: 'weekly' | 'lastWeek'): { start: number; end: number | null } {
  const now = new Date();
  const dow = now.getUTCDay(); // 0=Sun
  const thisSunday = new Date(now);
  thisSunday.setUTCDate(now.getUTCDate() - dow);
  thisSunday.setUTCHours(0, 0, 0, 0);

  if (type === 'weekly') {
    return { start: thisSunday.getTime(), end: null };
  } else {
    const lastSunday = new Date(thisSunday);
    lastSunday.setUTCDate(thisSunday.getUTCDate() - 7);
    return { start: lastSunday.getTime(), end: thisSunday.getTime() - 1 };
  }
}

export function LeaderboardPage() {
  const [type, setType] = useState<LeaderboardType>('total');
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [h2hFriend, setH2hFriend] = useState<H2HUser | null>(null);
  const [periodStats, setPeriodStats] = useState<{ made: number; correct: number } | null>(null);
  const { entries, loading } = useLeaderboard(type);
  const { user } = useAuthStore();
  const { groups, activeGroupId } = useGroupStore();
  const { t } = useLangStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const currentUserEntry = entries.find(e => e.user_id === user?.id);

  // Fetch period-specific predictions for the stats card hit rate
  useEffect(() => {
    if (!user?.id || !activeGroupId) return;

    if (type === 'total') {
      setPeriodStats(null); // use leaderboard row values
      return;
    }

    const { start, end } = getWeekBoundsMs(type);

    supabase
      .from('predictions')
      .select('id, points_earned, predicted_outcome, match:matches(kickoff_time, home_score, away_score, status)')
      .eq('user_id', user.id)
      .eq('group_id', activeGroupId)
      .eq('is_resolved', true)
      .then(({ data }) => {
        const preds = (data ?? []).filter(p => {
          const match = p.match as unknown as { kickoff_time: string } | null;
          const kickoff = new Date(match?.kickoff_time ?? 0).getTime();
          return kickoff >= start && (end === null || kickoff <= end);
        });
        // Hit rate counts only Full Time Result predictions that were correct
        const correct = preds.filter(p => {
          const match = p.match as unknown as { home_score: number; away_score: number; status: string } | null;
          if (!match || match.status !== 'FT' || !p.predicted_outcome) return false;
          const actual = match.home_score > match.away_score ? 'H' : match.home_score < match.away_score ? 'A' : 'D';
          return (p.predicted_outcome as string) === actual;
        }).length;
        setPeriodStats({ made: preds.length, correct });
      });
  }, [user?.id, activeGroupId, type]);

  const TABS: { key: LeaderboardType; label: string }[] = [
    { key: 'total', label: t('allTime') },
    { key: 'weekly', label: t('thisWeek') },
    { key: 'lastWeek', label: t('lastWeek') },
  ];

  const getPoints = (entry: LeaderboardEntryWithProfile) => {
    if (type === 'weekly') return entry.weekly_points;
    if (type === 'lastWeek') return entry.last_week_points ?? 0;
    return entry.total_points;
  };

  const pointsSub = type === 'weekly' ? t('thisWeek').toLowerCase()
    : type === 'lastWeek' ? t('lastWeek').toLowerCase()
    : t('allTime').toLowerCase();

  // Hit rate: period-specific when on weekly/lastWeek, all-time on total
  const hitMade = periodStats !== null ? periodStats.made : (currentUserEntry?.predictions_made ?? 0);
  const hitCorrect = periodStats !== null ? periodStats.correct : (currentUserEntry?.correct_predictions ?? 0);
  const hitDisplay = hitMade > 0 ? `${hitCorrect}/${hitMade}` : '—';
  const hitPct = hitMade > 0 ? `${Math.round(hitCorrect / hitMade * 100)}%` : null;

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

      {/* Your rank summary — fully period-aware */}
      {currentUserEntry && (
        <GlassCard variant="elevated" className="p-4 grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="flex items-center justify-center text-text-muted text-[10px] uppercase tracking-wider mb-1 gap-0.5">
              {t('yourRank')}
              <InfoTip text={t('infoRank')} />
            </div>
            <div className="font-bebas text-xl sm:text-2xl text-accent-green text-glow-green">
              #{currentUserEntry.rank}
            </div>
            <div className="text-white/25 text-[9px] mt-0.5 leading-tight">{pointsSub}</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center text-text-muted text-[10px] uppercase tracking-wider mb-1 gap-0.5">
              {t('points')}
              <InfoTip text={t('infoPoints')} />
            </div>
            <div className="font-bebas text-xl sm:text-2xl text-white">
              {getPoints(currentUserEntry)}
            </div>
            <div className="text-white/25 text-[9px] mt-0.5 leading-tight">{pointsSub}</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center text-text-muted text-[10px] uppercase tracking-wider mb-1 gap-0.5">
              {t('hitRate')}
              <InfoTip text={t('infoHitRate')} />
            </div>
            <div className="font-bebas text-xl sm:text-2xl text-white">{hitDisplay}</div>
            <div className="text-white/25 text-[9px] mt-0.5 leading-tight">
              {hitPct ?? (periodStats !== null ? pointsSub : t('allTimeLabel'))}
            </div>
          </div>
        </GlassCard>
      )}

      <LeaderboardTable
        entries={entries}
        loading={loading}
        currentUserId={user?.id}
        type={type}
        onUserClick={(entry) => {
          if (entry.user_id === user?.id) {
            // Own row → show personal match history
            setSelectedUser({ user_id: entry.user_id, username: entry.username, avatar_url: entry.avatar_url ?? null });
          } else {
            // Another user → H2H comparison
            setH2hFriend({ user_id: entry.user_id, username: entry.username, avatar_url: entry.avatar_url ?? null, weekly_points: entry.weekly_points ?? 0, total_points: entry.total_points, last_week_points: entry.last_week_points ?? 0 });
          }
        }}
      />

      <AnimatePresence>
        {selectedUser && activeGroupId && (
          <UserMatchHistoryModal
            user={selectedUser}
            groupId={activeGroupId}
            type={type}
            onClose={() => setSelectedUser(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {h2hFriend && activeGroupId && currentUserEntry && (
          <H2HModal
            me={{
              user_id: currentUserEntry.user_id,
              username: currentUserEntry.username,
              avatar_url: currentUserEntry.avatar_url ?? null,
              weekly_points: currentUserEntry.weekly_points ?? 0,
              total_points: currentUserEntry.total_points,
              last_week_points: currentUserEntry.last_week_points ?? 0,
            }}
            friend={h2hFriend}
            groupId={activeGroupId}
            onClose={() => setH2hFriend(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
