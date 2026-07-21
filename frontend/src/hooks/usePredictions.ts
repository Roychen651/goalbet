import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Prediction } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useCoinsStore } from '../stores/coinsStore';
import { calcPredictionCost, type ParlayTierKey } from '../lib/constants';

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
  is_parlay?: boolean;
  parlay_linked_tiers?: ParlayTierKey[] | null;
}

// Stable empty reference so consumers don't re-render when there are no predictions.
const EMPTY: Map<string, Prediction> = new Map();

// V5 Sprint 35 Commit 3 — race-hardening for a `predictions` Realtime
// channel that does NOT exist yet (deliberately deferred — see CLAUDE.md
// §50 for the exact verification required before RealtimeProvider is ever
// extended to bind this table). Built now, unused until that channel
// ships, so the guard is already in place the moment it's needed instead
// of being an afterthought bolted on under time pressure later.
//
// Module-level (not per-hook-instance): `usePredictions()` can be mounted
// several times simultaneously with different `matchIds` args (e.g.
// HomePage's whole feed vs. a single expanded PredictionForm), each with
// its own independent TanStack query-cache entry — a Set scoped to one
// hook instance couldn't answer "is *any* submission for this match
// in-flight right now" for a payload a completely different instance
// might receive.
const pendingSubmitMatchIds = new Set<string>();

/**
 * True while an optimistic submit_prediction mutation for this match is
 * between onMutate and onSettled. A future `predictions` Realtime handler
 * MUST check this before merging/invalidating anything for a given
 * match_id — an out-of-order payload arriving mid-mutation must defer to
 * the mutation's own onSuccess/onError reconcile (which always has the
 * authoritative RPC response) rather than racing it with a second,
 * independent write to the same cache entry. This is rule 4.4's "never
 * trust a partial Realtime payload" taken one step further: don't even
 * apply a FULL payload if a known-more-authoritative write is already in
 * flight for the same row.
 */
export function isPredictionSubmitInFlight(matchId: string): boolean {
  return pendingSubmitMatchIds.has(matchId);
}

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
    is_parlay: false,
    parlay_linked_tiers: null,
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
    is_parlay: vars.input.is_parlay ?? false,
    parlay_linked_tiers: vars.input.parlay_linked_tiers ?? null,
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
      pendingSubmitMatchIds.add(vars.input.match_id);
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

    // ── The real work: ONE authoritative RPC — cost, balance, and the
    // prediction row are all computed/written server-side in a single
    // transaction (migration 040). The client no longer writes to
    // `predictions` directly, and never supplies a cost the server trusts. ──
    mutationFn: async (vars) => {
      const coinsStore = useCoinsStore.getState();

      const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_prediction', {
        p_user_id: vars.userId,
        p_group_id: vars.groupId,
        p_match_id: vars.input.match_id,
        p_predicted_outcome: vars.input.predicted_outcome ?? null,
        p_predicted_home_score: vars.input.predicted_home_score ?? null,
        p_predicted_away_score: vars.input.predicted_away_score ?? null,
        p_predicted_corners: vars.input.predicted_corners ?? null,
        p_predicted_btts: vars.input.predicted_btts ?? null,
        p_predicted_over_under: vars.input.predicted_over_under ?? null,
        p_is_parlay: vars.input.is_parlay ?? false,
        p_parlay_linked_tiers: vars.input.parlay_linked_tiers ?? null,
      });

      if (rpcError) {
        if (rpcError.message?.includes('locked 15 minutes')) {
          throw new Error('Predictions are locked once the match starts');
        }
        throw rpcError;
      }

      const result = rpcResult as { success: boolean; balance?: number; error?: string; prediction?: Prediction } | null;

      if (!result?.success) {
        if (result?.error === 'insufficient_coins') {
          throw new Error('Not enough coins to place this prediction');
        }
        throw new Error(result?.error ?? 'Prediction submission failed');
      }

      // Authoritative balance from the server overwrites the optimistic guess.
      if (result.balance != null) coinsStore.setCoins(result.balance);

      if (!result.prediction) throw new Error('Prediction submission returned no row');
      return result.prediction;
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
      //
      // SECURITY HOTFIX (pre-Sprint-47) — this metadata object must NEVER
      // contain predicted_outcome/predicted_home_score/predicted_away_score/
      // predicted_btts/predicted_over_under/predicted_corners. group_events
      // has no kickoff-time RLS gate (unlike predictions, migration 037) —
      // useGroupEvents.ts fetches `select('*', ...)` into every group
      // member's browser filtered only by group_id, so any pick value
      // written here was readable by every other member (via devtools/
      // network inspection, even though ActivityFeed.tsx's renderer never
      // displayed it) for any not-yet-kicked-off match — a real, live leak
      // completely bypassing the predictions table's RLS wall via this
      // parallel, un-gated copy of the same data. tiers_count/coins_bet/
      // is_parlay/parlay_linked_tiers are all safe (they reveal nothing
      // about WHAT was predicted, only how much was staked and how many
      // tiers) — keep those, never re-add the six removed fields.
      supabase
        .from('group_events')
        .insert({
          group_id: vars.groupId,
          user_id: vars.userId,
          event_type: 'PREDICTION_LOCKED',
          match_id: vars.input.match_id,
          metadata: {
            // V6 Sprint 47 — the source prediction's own id, needed so a
            // group member can Tail this pick via submit_copied_prediction()
            // without the client ever reading the source row's actual pick
            // values (which stay RLS-hidden pre-kickoff, migration 037 — the
            // whole point of Blind Tail, §63). An id reveals nothing about
            // WHAT was predicted, the same safety class as coins_bet/
            // tiers_count below.
            prediction_id: data.id,
            coins_bet: data.coins_bet, // authoritative — from the RPC's own row, not the optimistic guess
            is_parlay: data.is_parlay,
            parlay_linked_tiers: data.parlay_linked_tiers,
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
    onSettled: (_data, _error, vars) => {
      setSaving(null);
      pendingSubmitMatchIds.delete(vars.input.match_id);
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
