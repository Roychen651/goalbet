import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';

export interface GroupEvent {
  id: string;
  group_id: string;
  user_id: string;
  event_type: 'PREDICTION_LOCKED' | 'WON_COINS' | 'LEADERBOARD_CLIMB';
  match_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // joined from profiles
  username?: string;
  avatar_url?: string | null;
  // joined from matches
  home_team?: string;
  away_team?: string;
  home_team_badge?: string | null;
  away_team_badge?: string | null;
}

export function useGroupEvents() {
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();

  const fetchEvents = useCallback(async () => {
    if (!user || !activeGroupId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('group_events')
        .select('*, profiles(username, avatar_url), matches(home_team, away_team, home_team_badge, away_team_badge)')
        .eq('group_id', activeGroupId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[useGroupEvents] fetch failed:', error.message);
        throw error;
      }

      const mapped: GroupEvent[] = (data ?? []).map((row: Record<string, unknown>) => {
        const profile = row.profiles as { username?: string; avatar_url?: string | null } | null;
        const match = row.matches as { home_team?: string; away_team?: string; home_team_badge?: string | null; away_team_badge?: string | null } | null;
        return {
          id: row.id as string,
          group_id: row.group_id as string,
          user_id: row.user_id as string,
          event_type: row.event_type as GroupEvent['event_type'],
          match_id: row.match_id as string | null,
          metadata: (row.metadata ?? {}) as Record<string, unknown>,
          created_at: row.created_at as string,
          username: profile?.username ?? 'Unknown',
          avatar_url: profile?.avatar_url ?? null,
          home_team: match?.home_team,
          away_team: match?.away_team,
          home_team_badge: match?.home_team_badge,
          away_team_badge: match?.away_team_badge,
        };
      });
      setEvents(mapped);
    } catch (err) {
      console.error('[useGroupEvents]', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, activeGroupId]);

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Realtime subscription — re-fetch on new inserts
  useEffect(() => {
    if (!activeGroupId) return;

    const channel = supabase
      .channel(`group_events_${activeGroupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_events',
          filter: `group_id=eq.${activeGroupId}`,
        },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeGroupId, fetchEvents]);

  return { events, loading, refetch: fetchEvents };
}
