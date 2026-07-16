import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useCoinsStore } from '../../stores/coinsStore';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';

// V5 Sprint 35 — "The Realtime Hub". Before this sprint, 8 independent
// Supabase Realtime channels existed across 7 files (App.tsx's coins
// channel, useLeaderboard.ts, useNewPointsAlert.ts, useGroupEvents.ts,
// useNotifications.ts, useMicroPrediction.ts x2). This provider consolidates
// the GROUP-SCOPED subset of those signals (the ones that filter on
// group_id and correctly re-key on group switch) onto one multiplexed
// channel. A separate, deliberately NOT-yet-created "User Channel" (Sprint
// 35 Commit 2) will hold the genuinely user-scoped signals (notifications,
// micro_prediction_bets results) that must survive a group switch — see
// CLAUDE.md §50 for why those two scopes can't share one channel.
//
// `matches`/World Cup Realtime (useMatches.ts, useWorldCupMatches.ts) are
// deliberately OUT of scope. They're league-scoped, not group-scoped, and
// useMatches.ts already runs a subtle, already-correct two-path model
// (merge-not-replace on UPDATE per rule 4.4, invalidate on INSERT). Folding
// them into a group-keyed provider would be pure regression risk for zero
// benefit — see §50.
//
// `predictions` is deliberately NOT bound here either, despite already
// sitting in the `supabase_realtime` publication (migration 003) — see
// CLAUDE.md §50's documented prerequisite before that table is ever added.

type RealtimeTable = 'leaderboard';
type RealtimeHandler = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;

interface RealtimeContextValue {
  subscribe: (table: RealtimeTable, handler: RealtimeHandler) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/**
 * Register a handler for one table's postgres_changes payloads on the
 * shared Group Channel. Registering/unregistering a handler is a ref-map
 * mutation inside RealtimeProvider, never a React state update — a caller
 * re-rendering (or passing a fresh handler closure every render, as most
 * callers will) never rebinds the underlying Supabase channel. Only
 * mount/unmount and a `table` change re-run this effect.
 */
export function useRealtimeSubscription(table: RealtimeTable, handler: RealtimeHandler) {
  const ctx = useContext(RealtimeContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(table, (payload) => handlerRef.current(payload));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, table]);
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();

  // A table → Set<handler> registry. Mutated directly (never via setState)
  // so registering/unregistering a consumer is O(1) and causes zero
  // re-renders anywhere in the tree — the whole point of the selector
  // pattern mandate 4 in this sprint's blueprint asked for.
  const registryRef = useRef<Map<RealtimeTable, Set<RealtimeHandler>>>(new Map());

  const subscribeFn = useCallback((table: RealtimeTable, handler: RealtimeHandler) => {
    let set = registryRef.current.get(table);
    if (!set) {
      set = new Set();
      registryRef.current.set(table, set);
    }
    set.add(handler);
    return () => { registryRef.current.get(table)?.delete(handler); };
  }, []);

  const dispatch = useCallback((table: RealtimeTable, payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
    registryRef.current.get(table)?.forEach((h) => h(payload));
  }, []);

  // Sprint 17's coin-deposit sensory coalescing state — ported verbatim
  // from App.tsx's AppInitializer, not rewritten. Leading edge (sound +
  // haptic fire the instant the first deposit in a burst lands) / trailing
  // edge (the toast waits 500ms so several resolutions landing in the same
  // sync tick report one combined total instead of stacking toasts) — see
  // CLAUDE.md §32.
  const pendingCoinDeltaRef = useRef(0);
  const coinCoalesceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Group Channel — re-subscribes whenever the active group changes ──────
  useEffect(() => {
    if (!user || !activeGroupId) return;

    const channel: RealtimeChannel = supabase
      .channel(`goalbet-group-${activeGroupId}`)
      // group_members — the user's own coin balance changed in this group
      // (cron deposit, admin adjust, bet stake/refund). Client-side own-row
      // check — Realtime doesn't support compound filters on one
      // subscription. Per rule 4.4, always re-fetch, never trust the
      // (possibly partial) payload directly.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'group_members', filter: `group_id=eq.${activeGroupId}` },
        (payload) => {
          if ((payload.new as { user_id?: string }).user_id !== user.id) return;
          useCoinsStore.getState().fetchCoins(user.id, activeGroupId);
        },
      )
      // coin_transactions — a real deposit landed. Identical coalescing
      // sequence to the pre-Sprint-35 App.tsx implementation.
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'coin_transactions', filter: `group_id=eq.${activeGroupId}` },
        (payload) => {
          const row = payload.new as { user_id?: string; type?: string; amount?: number };
          if (row.user_id !== user.id || !row.amount || row.amount <= 0) return;

          pendingCoinDeltaRef.current += row.amount;
          if (coinCoalesceTimerRef.current) return; // a window is already open — just accumulate

          haptic('coin_drop');
          playSound('coin_chime');

          coinCoalesceTimerRef.current = setTimeout(() => {
            const total = pendingCoinDeltaRef.current;
            pendingCoinDeltaRef.current = 0;
            coinCoalesceTimerRef.current = null;
            if (total > 0) {
              const { t } = useLangStore.getState();
              useUIStore.getState().addToast(t('coinsDepositToast').replace('{0}', String(total)), 'success');
            }
          }, 500);
        },
      )
      // leaderboard — folds two pre-Sprint-35 channels into one binding:
      // useLeaderboard.ts's own `leaderboard-${activeGroupId}` channel
      // (event: '*', re-fetches the whole list on any row change) AND
      // useNewPointsAlert.ts's separate `leaderboard-alert-*` channel
      // (event: 'UPDATE' only, own-row points delta). Both subscribed to
      // the exact same table before this sprint — see CLAUDE.md §50.
      // Dispatched as-is; each consumer decides for itself what it needs
      // from the payload (useLeaderboard.ts ignores payload content
      // entirely and just re-fetches; useNewPointsAlert.ts filters to
      // UPDATE + its own user_id). Scoping this to group_id (not user_id,
      // as useNewPointsAlert.ts's old filter did) also fixes a latent bug:
      // the old user_id-only filter meant a leaderboard row changing in a
      // group the user WASN'T currently viewing could still fire and
      // corrupt "current points for the active group" state. This binding
      // can only ever fire for the active group.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard', filter: `group_id=eq.${activeGroupId}` },
        (payload) => dispatch('leaderboard', payload as RealtimePostgresChangesPayload<Record<string, unknown>>),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeGroupId, dispatch]);

  const value: RealtimeContextValue = { subscribe: subscribeFn };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
