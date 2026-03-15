import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Predictor {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

// Returns a Map<matchId, Predictor[]> — who has predicted on each match in this group.
// Only fetches user_id + profile (not the actual prediction values) for privacy.
export function useGroupMatchPredictions(
  matchIds: string[],
  groupId: string | null,
): Map<string, Predictor[]> {
  const [predictorsByMatch, setPredictorsByMatch] = useState<Map<string, Predictor[]>>(new Map());

  useEffect(() => {
    if (!groupId || matchIds.length === 0) {
      setPredictorsByMatch(new Map());
      return;
    }

    supabase
      .from('predictions')
      .select('match_id, user_id, profiles(username, avatar_url)')
      .in('match_id', matchIds)
      .eq('group_id', groupId)
      .then(({ data }) => {
        const map = new Map<string, Predictor[]>();
        for (const row of data ?? []) {
          const profile = (row as unknown as { profiles: { username: string; avatar_url: string | null } | null }).profiles;
          if (!profile) continue;
          const entry: Predictor = {
            user_id: row.user_id,
            username: profile.username,
            avatar_url: profile.avatar_url,
          };
          const existing = map.get(row.match_id) ?? [];
          existing.push(entry);
          map.set(row.match_id, existing);
        }
        setPredictorsByMatch(map);
      });
  }, [matchIds.join(','), groupId]);

  return predictorsByMatch;
}
