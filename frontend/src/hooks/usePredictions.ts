import { useState, useEffect, useCallback } from 'react';
import { supabase, Prediction } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useCoinsStore } from '../stores/coinsStore';
import { calcPredictionCost } from '../lib/constants';

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
      // ── Coin accounting ────────────────────────────────────────────────────
      const coinsStore = useCoinsStore.getState();
      const newCost = calcPredictionCost(input);
      const existing = predictions.get(input.match_id);
      const oldCost = existing?.coins_bet ?? 0;
      const isEdit = !!existing;

      if (newCost > 0 || oldCost > 0) {
        const rpcName = isEdit ? 'adjust_prediction_bet' : 'place_prediction_bet';
        const rpcArgs = isEdit
          ? { p_user_id: user.id, p_group_id: activeGroupId, p_match_id: input.match_id, p_old_cost: oldCost, p_new_cost: newCost }
          : { p_user_id: user.id, p_group_id: activeGroupId, p_match_id: input.match_id, p_cost: newCost };

        // Optimistic deduction so UI feels instant
        coinsStore.adjustCoins(-(newCost - oldCost));

        const { data: coinResult } = await supabase.rpc(rpcName, rpcArgs);
        const result = coinResult as { success: boolean; balance?: number; error?: string } | null;

        if (result && !result.success) {
          // Rollback optimistic change
          coinsStore.adjustCoins(newCost - oldCost);
          if (result.error === 'insufficient_coins') {
            throw new Error('Not enough coins to place this prediction');
          }
          throw new Error(result.error ?? 'Coin deduction failed');
        }
        if (result?.balance != null) {
          // Authoritative balance from server
          coinsStore.setCoins(result.balance);
        }
      }
      // ── End coin accounting ─────────────────────────────────────────────────

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
        coins_bet: newCost,
      };

      const { data, error } = await supabase
        .from('predictions')
        .upsert(payload, { onConflict: 'user_id,match_id,group_id' })
        .select()
        .single();

      if (error) {
        if (error.message?.includes('locked after kickoff') || error.message?.includes('locked 15 minutes')) {
          throw new Error('Predictions are locked once the match starts');
        }
        throw error;
      }

      if (data) {
        setPredictions(prev => new Map(prev).set(data.match_id, data));

        // Fire-and-forget: insert activity event for the locker room feed
        supabase
          .from('group_events')
          .insert({
            group_id: activeGroupId,
            user_id: user.id,
            event_type: 'PREDICTION_LOCKED',
            match_id: input.match_id,
            metadata: {
              predicted_outcome: input.predicted_outcome ?? null,
              coins_bet: newCost,
            },
          })
          .then(); // swallow — activity feed is non-critical
      }
    } finally {
      setSaving(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeGroupId, predictions]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  return { predictions, loading, saving, savePrediction, refetch: fetchPredictions };
}
