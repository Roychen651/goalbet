import { useState, useEffect, useCallback } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useRealtimeSubscription, useRealtimeReconnect } from '../components/providers/RealtimeProvider';

export interface GroupEvent {
  id: string;
  group_id: string;
  user_id: string | null;
  event_type: 'PREDICTION_LOCKED' | 'WON_COINS' | 'LEADERBOARD_CLIMB' | 'AI_BANTER' | 'MICRO_BANTER'
    | 'POOL_CONTRIBUTION' | 'BATTLE_PROGRESS'; // V5 Sprint 36
  match_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // joined from profiles
  username?: string;
  avatar_url?: string | null;
  // V4 Sprint 24 — populated once the profiles join in useGroupEvents'
  // fetch query selects gender alongside username/avatar_url. Always
  // undefined until then; tg() resolves that to the honest "unspecified"
  // phrasing, not a silent male default.
  gender?: 'male' | 'female' | 'unspecified' | null;
  // V5 Sprint 37 — joined alongside username/avatar_url/gender, feeds
  // ActivityFeed's CosmeticAvatar so equipped frames/halos/badges show up
  // on human event cards, not just the leaderboard and profile page.
  active_cosmetics?: Profile['active_cosmetics'] | null;
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
        .select('*, profiles(username, avatar_url, gender, active_cosmetics), matches(home_team, away_team, home_team_badge, away_team_badge)')
        .eq('group_id', activeGroupId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[useGroupEvents] fetch failed:', error.message);
        throw error;
      }

      const mapped: GroupEvent[] = (data ?? []).map((row: Record<string, unknown>) => {
        const profile = row.profiles as { username?: string; avatar_url?: string | null; gender?: 'male' | 'female' | 'unspecified' | null; active_cosmetics?: Profile['active_cosmetics'] | null } | null;
        const match = row.matches as { home_team?: string; away_team?: string; home_team_badge?: string | null; away_team_badge?: string | null } | null;
        return {
          id: row.id as string,
          group_id: row.group_id as string,
          user_id: row.user_id as string | null,
          event_type: row.event_type as GroupEvent['event_type'],
          match_id: row.match_id as string | null,
          metadata: (row.metadata ?? {}) as Record<string, unknown>,
          created_at: row.created_at as string,
          username: profile?.username ?? 'Unknown',
          avatar_url: profile?.avatar_url ?? null,
          gender: profile?.gender ?? 'unspecified',
          active_cosmetics: profile?.active_cosmetics ?? null,
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

  // V5 Sprint 35 — this table's Realtime binding now lives on
  // RealtimeProvider's shared Group Channel. Payload content is ignored
  // (matches the pre-Sprint-35 behavior exactly) — a new event always needs
  // the profiles/matches join, which a Realtime payload never carries.
  useRealtimeSubscription('group_events', () => fetchEvents());

  // A dropped-then-recovered channel could have missed an INSERT entirely
  // (Realtime doesn't replay missed events on reconnect) — reconcile with a
  // fresh fetch the moment the underlying channel comes back.
  useRealtimeReconnect(() => fetchEvents());

  return { events, loading, refetch: fetchEvents };
}
