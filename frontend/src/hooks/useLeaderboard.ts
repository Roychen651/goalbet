import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, LeaderboardEntryWithProfile } from '../lib/supabase';
import { useGroupStore } from '../stores/groupStore';

type LeaderboardType = 'total' | 'weekly';

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

      const sortField = type === 'weekly' ? 'weekly_points' : 'total_points';
      const sorted = [...(data || [])]
        .sort((a, b) => (b[sortField] as number) - (a[sortField] as number))
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
