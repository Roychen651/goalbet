import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';

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

  useEffect(() => {
    if (!user || !activeGroupId) return;
    supabase
      .from('leaderboard')
      .select('total_points')
      .eq('user_id', user.id)
      .eq('group_id', activeGroupId)
      .single()
      .then(({ data }) => {
        if (data) setCurrentPoints(data.total_points);
      });
  }, [user?.id, activeGroupId]);

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
