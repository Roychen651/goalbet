import { useState, useEffect, useCallback } from 'react';
import { supabase, Prediction } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';

interface PredictionInput {
  match_id: string;
  predicted_outcome?: 'H' | 'D' | 'A' | null;
  predicted_home_score?: number | null;
  predicted_away_score?: number | null;
  predicted_halftime_outcome?: 'H' | 'D' | 'A' | null;
  predicted_halftime_home?: number | null;
  predicted_halftime_away?: number | null;
  predicted_corners?: 'under9' | 'ten' | 'over11' | null;
  predicted_btts?: boolean | null;
  predicted_over_under?: 'over' | 'under' | null;
}

export function usePredictions(matchIds?: string[]) {
  const [predictions, setPredictions] = useState<Map<string, Prediction>>(new Map());
  const [saving, setSaving] = useState<string | null>(null); // matchId currently saving
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();

  const fetchPredictions = useCallback(async () => {
    if (!user || !activeGroupId) {
      setPredictions(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user.id)
        .eq('group_id', activeGroupId);

      if (matchIds && matchIds.length > 0) {
        query = query.in('match_id', matchIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const map = new Map<string, Prediction>();
      for (const p of data || []) {
        map.set(p.match_id, p);
      }
      setPredictions(map);
    } finally {
      setLoading(false);
    }
  }, [user?.id, activeGroupId, matchIds?.join(',')]);

  const savePrediction = useCallback(async (input: PredictionInput): Promise<void> => {
    if (!user || !activeGroupId) throw new Error('Not authenticated');

    setSaving(input.match_id);
    try {
      const payload = {
        user_id: user.id,
        match_id: input.match_id,
        group_id: activeGroupId,
        predicted_outcome: input.predicted_outcome ?? null,
        predicted_home_score: input.predicted_home_score ?? null,
        predicted_away_score: input.predicted_away_score ?? null,
        predicted_halftime_outcome: input.predicted_halftime_outcome ?? null,
        predicted_halftime_home: input.predicted_halftime_home ?? null,
        predicted_halftime_away: input.predicted_halftime_away ?? null,
        predicted_corners: input.predicted_corners ?? null,
        predicted_btts: input.predicted_btts ?? null,
        predicted_over_under: input.predicted_over_under ?? null,
      };

      const { data, error } = await supabase
        .from('predictions')
        .upsert(payload, { onConflict: 'user_id,match_id,group_id' })
        .select()
        .single();

      if (error) {
        // Check if it's a "locked after kickoff" error from the DB trigger
        if (error.message?.includes('locked after kickoff')) {
          throw new Error('Predictions are locked once the match starts');
        }
        throw error;
      }

      if (data) {
        // Optimistic update
        setPredictions(prev => new Map(prev).set(data.match_id, data));
      }
    } finally {
      setSaving(null);
    }
  }, [user?.id, activeGroupId]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  return { predictions, loading, saving, savePrediction, refetch: fetchPredictions };
}
