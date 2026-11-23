import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Predictor {
  user_id: string;
  username: string;
  avatar_url: string | null;
  // Visual De-cluttering Phase 2 — Crowd Sentiment bar. Added alongside the
  // existing social fields, never replacing them. Privacy is NOT a new
  // client-side decision here: migration 037's RLS already hides another
  // member's entire predictions row (not just this one column) while a
  // match is status='NS' — the own-row-visible / other-rows-hidden
  // enforcement already happens server-side before this ever reaches the
  // client, exactly as it did before this field existed. The consuming
  // component still gates rendering on match.status !== 'NS' as a second,
  // belt-and-suspenders check (never rely on RLS alone for a privacy UI
  // decision, the same discipline rule 4.5 already applies to the write
  // side) — but the real enforcement is the unchanged RLS policy.
  predicted_outcome: string | null;
}

// Returns a Map<matchId, Predictor[]> — who has predicted on each match in
// this group, plus (Phase 2) their predicted_outcome for the Crowd
// Sentiment bar. Values for OTHER members pre-kickoff never leave the
// server at all — see the Predictor interface comment above.
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
      .select('match_id, user_id, predicted_outcome, profiles(username, avatar_url)')
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
            predicted_outcome: (row as unknown as { predicted_outcome: string | null }).predicted_outcome,
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
