import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useRealtimeSubscription, useRealtimeReconnect } from '../components/providers/RealtimeProvider';

const STORAGE_KEY = 'goalbet_last_seen_points';

function getLastSeen(): number {
  return parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
}

function setLastSeen(pts: number) {
  localStorage.setItem(STORAGE_KEY, String(pts));
}

interface NewPointsAlert {
  hasNew: boolean;
  newPoints: number;
  markAsSeen: () => void;
}

export function useNewPointsAlert(): NewPointsAlert {
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const [currentPoints, setCurrentPoints] = useState<number | null>(null);
  const [lastSeen, setLastSeenState] = useState(getLastSeen());

  const fetchCurrentPoints = useCallback(async () => {
    if (!user || !activeGroupId) return;
    const { data } = await supabase
      .from('leaderboard')
      .select('total_points')
      .eq('user_id', user.id)
      .eq('group_id', activeGroupId)
      .single();
    if (data) setCurrentPoints(data.total_points);
  }, [user?.id, activeGroupId]);

  useEffect(() => { fetchCurrentPoints(); }, [fetchCurrentPoints]);

  // A dropped-then-recovered channel could have missed the UPDATE entirely
  // — reconcile with a fresh fetch the moment the underlying channel comes
  // back.
  useRealtimeReconnect(() => fetchCurrentPoints());

  // V5 Sprint 35 — this table's Realtime binding now lives on
  // RealtimeProvider's shared Group Channel (folded together with
  // useLeaderboard.ts's own binding — see CLAUDE.md §50). That channel's
  // filter is group_id-scoped, not user_id-scoped like this hook's old
  // standalone channel was — so both the event-type filter (old channel
  // only ever bound `event: 'UPDATE'`) and the own-row check now have to
  // happen client-side. This also fixes a latent bug the old user_id-only
  // filter had: it could fire (and corrupt `currentPoints`) for a
  // leaderboard row in a group the user wasn't currently viewing, since
  // nothing scoped it to activeGroupId server-side. The shared channel can
  // only ever fire for the active group.
  useRealtimeSubscription('leaderboard', (payload) => {
    if (payload.eventType !== 'UPDATE') return;
    const row = payload.new as { user_id?: string; total_points?: number };
    if (row.user_id !== user?.id || row.total_points === undefined) return;
    setCurrentPoints(row.total_points);
  });

  const hasNew = currentPoints !== null && currentPoints > lastSeen;
  const newPoints = hasNew ? currentPoints - lastSeen : 0;

  const markAsSeen = () => {
    if (currentPoints !== null) {
      setLastSeen(currentPoints);
      setLastSeenState(currentPoints);
    }
  };

  return { hasNew, newPoints, markAsSeen };
}
