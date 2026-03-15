import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, LeaderboardEntryWithProfile } from '../lib/supabase';
import { useGroupStore } from '../stores/groupStore';

export type LeaderboardType = 'total' | 'weekly' | 'lastWeek';

export function useLeaderboard(type: LeaderboardType = 'total') {
  const [entries, setEntries] = useState<LeaderboardEntryWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeGroupId } = useGroupStore();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    if (!activeGroupId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Use the helper function we defined in migrations
      const { data, error } = await supabase
        .rpc('get_group_leaderboard', { p_group_id: activeGroupId });

      if (error) throw error;

      let sortField: keyof LeaderboardEntryWithProfile;
      if (type === 'weekly') {
        sortField = 'weekly_points';
      } else if (type === 'lastWeek') {
        // Use last_week_points if available, otherwise fall back to weekly_points
        const sample = (data || [])[0] as Record<string, unknown> | undefined;
        sortField = (sample && 'last_week_points' in sample)
          ? 'last_week_points' as keyof LeaderboardEntryWithProfile
          : 'weekly_points';
      } else {
        sortField = 'total_points';
      }

      const sorted = [...(data || [])]
        .sort((a, b) => {
          const aVal = (a as Record<string, unknown>)[sortField as string] as number ?? 0;
          const bVal = (b as Record<string, unknown>)[sortField as string] as number ?? 0;
          return bVal - aVal;
        })
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

      setEntries(sorted as LeaderboardEntryWithProfile[]);
    } finally {
      setLoading(false);
    }
  }, [activeGroupId, type]);

  const subscribeToLeaderboard = useCallback(() => {
    if (!activeGroupId) return;

    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    channelRef.current = supabase
      .channel(`leaderboard-${activeGroupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leaderboard',
        filter: `group_id=eq.${activeGroupId}`,
      }, () => {
        // Re-fetch on any leaderboard change
        fetchLeaderboard();
      })
      .subscribe();
  }, [activeGroupId, fetchLeaderboard]);

  useEffect(() => {
    fetchLeaderboard();
    subscribeToLeaderboard();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchLeaderboard();
        subscribeToLeaderboard();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [fetchLeaderboard, subscribeToLeaderboard]);

  return { entries, loading, refetch: fetchLeaderboard };
}
