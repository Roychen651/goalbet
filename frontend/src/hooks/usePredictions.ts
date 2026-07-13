import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

// Stable empty reference so consumers don't re-render when there are no predictions.
const EMPTY: Map<string, Prediction> = new Map();

type PredictionMap = Map<string, Prediction>;

// Everything the mutation lifecycle needs, computed once in savePrediction so the
// callbacks never depend on (possibly stale) render-time closures.
interface SaveVars {
  input: PredictionInput;
  userId: string;
  groupId: string;
  newCost: number;
  oldCost: number;
  isEdit: boolean;
  queryKey: readonly unknown[];
}

interface SaveContext {
  previousMap: PredictionMap | undefined;
  previousCoins: number;
}

// Build a fully-typed optimistic row from the input, layered over the existing
// row when editing.
function buildOptimistic(vars: SaveVars, existing: Prediction | undefined): Prediction {
  const base: Prediction = existing ?? {
    id: `optimistic-${vars.input.match_id}`,
    user_id: vars.userId,
    match_id: vars.input.match_id,
    group_id: vars.groupId,
    predicted_outcome: null,
    predicted_home_score: null,
    predicted_away_score: null,
    predicted_halftime_outcome: null,
    predicted_halftime_home: null,
    predicted_halftime_away: null,
    predicted_btts: null,
    predicted_over_under: null,
    points_earned: 0,
    streak_bonus_earned: 0,
    halftime_pts_earned: null,
    predicted_corners: null,
    coins_bet: 0,
    is_resolved: false,
    created_at: new Date().toISOString(),
  };
  return {
    ...base,
    predicted_outcome: vars.input.predicted_outcome ?? null,
    predicted_home_score: vars.input.predicted_home_score ?? null,
    predicted_away_score: vars.input.predicted_away_score ?? null,
    predicted_halftime_outcome: vars.input.predicted_halftime_outcome ?? null,
    predicted_halftime_home: vars.input.predicted_halftime_home ?? null,
    predicted_halftime_away: vars.input.predicted_halftime_away ?? null,
    predicted_btts: vars.input.predicted_btts ?? null,
    predicted_over_under: vars.input.predicted_over_under ?? null,
    predicted_corners: vars.input.predicted_corners ?? null,
    coins_bet: vars.newCost,
  };
}

export function usePredictions(matchIds?: string[]) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null); // matchId currently saving
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();

  const matchIdsKey = matchIds && matchIds.length > 0 ? [...matchIds].join(',') : '';
  const enabled = !!user && !!activeGroupId;

  const query = useQuery({
    queryKey: ['predictions', user?.id ?? null, activeGroupId ?? null, matchIdsKey],
    queryFn: async (): Promise<PredictionMap> => {
      if (!user || !activeGroupId) return EMPTY;
      let q = supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user.id)
        .eq('group_id', activeGroupId);
      if (matchIds && matchIds.length > 0) q = q.in('match_id', matchIds);
      const { data, error } = await q;
      if (error) throw error;
      const map: PredictionMap = new Map();
      for (const p of data ?? []) map.set(p.match_id, p as Prediction);
      return map;
    },
    enabled,
    staleTime: 30_000,
  });

  const { refetch: rqRefetch } = query;

  const mutation = useMutation<Prediction, Error, SaveVars, SaveContext>({
    // ── Optimistic: instant UI, before any network ──────────────────────────
    onMutate: async (vars) => {
      setSaving(vars.input.match_id);
      await queryClient.cancelQueries({ queryKey: vars.queryKey });

      const previousMap = queryClient.getQueryData<PredictionMap>(vars.queryKey);
      const previousCoins = useCoinsStore.getState().coins;

      // Optimistically write the prediction into the cache…
      const existing = previousMap?.get(vars.input.match_id);
      const nextMap = new Map(previousMap ?? EMPTY);
      nextMap.set(vars.input.match_id, buildOptimistic(vars, existing));
      queryClient.setQueryData(vars.queryKey, nextMap);

      // …and deduct the stake instantly (delta between new and old cost).
      useCoinsStore.getState().adjustCoins(-(vars.newCost - vars.oldCost));

      return { previousMap, previousCoins };
    },

    // ── The real work: coin RPC then prediction upsert (unchanged logic) ────
    mutationFn: async (vars) => {
      const coinsStore = useCoinsStore.getState();

      if (vars.newCost > 0 || vars.oldCost > 0) {
        const rpcName = vars.isEdit ? 'adjust_prediction_bet' : 'place_prediction_bet';
        const rpcArgs = vars.isEdit
          ? { p_user_id: vars.userId, p_group_id: vars.groupId, p_match_id: vars.input.match_id, p_old_cost: vars.oldCost, p_new_cost: vars.newCost }
          : { p_user_id: vars.userId, p_group_id: vars.groupId, p_match_id: vars.input.match_id, p_cost: vars.newCost };

        const { data: coinResult } = await supabase.rpc(rpcName, rpcArgs);
        const result = coinResult as { success: boolean; balance?: number; error?: string } | null;

        if (result && !result.success) {
          if (result.error === 'insufficient_coins') {
            throw new Error('Not enough coins to place this prediction');
          }
          throw new Error(result.error ?? 'Coin deduction failed');
        }
        // Authoritative balance from the server overwrites the optimistic guess.
        if (result?.balance != null) coinsStore.setCoins(result.balance);
      }

      const payload = {
        user_id: vars.userId,
        match_id: vars.input.match_id,
        group_id: vars.groupId,
        predicted_outcome: vars.input.predicted_outcome ?? null,
        predicted_home_score: vars.input.predicted_home_score ?? null,
        predicted_away_score: vars.input.predicted_away_score ?? null,
        predicted_halftime_outcome: vars.input.predicted_halftime_outcome ?? null,
        predicted_halftime_home: vars.input.predicted_halftime_home ?? null,
        predicted_halftime_away: vars.input.predicted_halftime_away ?? null,
        predicted_corners: vars.input.predicted_corners ?? null,
        predicted_btts: vars.input.predicted_btts ?? null,
        predicted_over_under: vars.input.predicted_over_under ?? null,
        coins_bet: vars.newCost,
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
      return data as Prediction;
    },

    // ── Rollback: restore both the cache snapshot and the coin balance ──────
    onError: (_err, vars, ctx) => {
      if (!ctx) return;
      queryClient.setQueryData(vars.queryKey, ctx.previousMap);
      useCoinsStore.getState().setCoins(ctx.previousCoins);
    },

    // ── Reconcile the cache with the authoritative saved row ────────────────
    onSuccess: (data, vars) => {
      queryClient.setQueryData<PredictionMap>(vars.queryKey, (old) => {
        const next = new Map(old ?? EMPTY);
        next.set(data.match_id, data);
        return next;
      });

      // Fire-and-forget: locker-room activity event.
      supabase
        .from('group_events')
        .insert({
          group_id: vars.groupId,
          user_id: vars.userId,
          event_type: 'PREDICTION_LOCKED',
          match_id: vars.input.match_id,
          metadata: {
            predicted_outcome: vars.input.predicted_outcome ?? null,
            predicted_home_score: vars.input.predicted_home_score ?? null,
            predicted_away_score: vars.input.predicted_away_score ?? null,
            predicted_btts: vars.input.predicted_btts ?? null,
            predicted_over_under: vars.input.predicted_over_under ?? null,
            predicted_corners: vars.input.predicted_corners ?? null,
            coins_bet: vars.newCost,
            tiers_count: [
              vars.input.predicted_outcome,
              (vars.input.predicted_home_score != null && vars.input.predicted_away_score != null) ? true : null,
              vars.input.predicted_corners,
              vars.input.predicted_btts,
              vars.input.predicted_over_under,
            ].filter(Boolean).length,
          },
        })
        .then(({ error: evtErr }) => {
          if (evtErr) console.warn('[usePredictions] group_event insert failed:', evtErr.message);
        });
    },

    // ── Always: clear saving + pull DB source of truth ──────────────────────
    onSettled: () => {
      setSaving(null);
      queryClient.invalidateQueries({ queryKey: ['predictions'] });
    },
  });

  const { mutateAsync } = mutation;

  // Public API — identical signature to the previous bespoke hook.
  const savePrediction = useCallback(async (input: PredictionInput): Promise<void> => {
    if (!user || !activeGroupId) throw new Error('Not authenticated');
    const queryKey = ['predictions', user.id, activeGroupId, matchIdsKey] as const;
    const currentMap = queryClient.getQueryData<PredictionMap>(queryKey);
    const existing = currentMap?.get(input.match_id);
    await mutateAsync({
      input,
      userId: user.id,
      groupId: activeGroupId,
      newCost: calcPredictionCost(input),
      oldCost: existing?.coins_bet ?? 0,
      isEdit: !!existing,
      queryKey,
    });
  }, [user, activeGroupId, matchIdsKey, queryClient, mutateAsync]);

  const refetch = useCallback(async () => {
    await rqRefetch();
  }, [rqRefetch]);

  const predictions = query.data ?? EMPTY;
  const loading = enabled && query.isLoading;

  return { predictions, loading, saving, savePrediction, refetch };
}
