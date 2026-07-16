import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
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
// them onto exactly TWO multiplexed channels:
//
//   • Group Channel (`goalbet-group-${activeGroupId}`) — group_members,
//     coin_transactions, leaderboard (Commit 1), group_events,
//     micro_prediction_questions (Commit 2). Re-subscribes on group switch.
//   • User Channel (`goalbet-user-${user.id}`) — notifications,
//     micro_prediction_bets (Commit 2). Persists across group switches —
//     these signals must still land while the user is viewing a DIFFERENT
//     group (a notification about group B must arrive while looking at
//     group A). Folding them into the group-keyed channel would silently
//     drop cross-group signals — see CLAUDE.md §50 for the full reasoning.
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

type RealtimeTable =
  | 'leaderboard'
  | 'group_events'
  | 'micro_prediction_questions'
  | 'notifications'
  | 'micro_prediction_bets';
type RealtimeHandler = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;

interface RealtimeContextValue {
  subscribe: (table: RealtimeTable, handler: RealtimeHandler) => () => void;
}

const RECONNECT_EVENT = 'goalbet:realtime-reconnected';

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/**
 * Register a handler for one table's postgres_changes payloads on the
 * shared Group/User Channel (whichever one actually carries that table —
 * the caller doesn't need to know or care which). Registering/unregistering
 * a handler is a ref-map mutation inside RealtimeProvider, never a React
 * state update — a caller re-rendering (or passing a fresh handler closure
 * every render, as most callers will) never rebinds the underlying
 * Supabase channel. Only mount/unmount and a `table` change re-run this
 * effect.
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

/**
 * Fires `handler` whenever a Realtime channel recovers from a genuine drop
 * (CHANNEL_ERROR/TIMED_OUT/CLOSED → SUBSCRIBED) — a mobile browser freezing
 * the WebSocket on screen-lock/backgrounding being the most common real
 * case (CLAUDE.md §50). Never fires on the initial mount subscribe (that's
 * not a recovery) or on a clean group switch (a new channel's first
 * SUBSCRIBED is a fresh channel, not a reconnect). Each consumer decides
 * for itself what "reconcile" means — a TanStack `invalidateQueries`, or
 * (for the hand-rolled hooks migrated in this sprint) just calling its own
 * existing fetch function again, exactly like `useMatches.ts` already does
 * for the unrelated `goalbet:synced` event.
 */
export function useRealtimeReconnect(handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const onReconnect = () => handlerRef.current();
    window.addEventListener(RECONNECT_EVENT, onReconnect);
    return () => window.removeEventListener(RECONNECT_EVENT, onReconnect);
  }, []);
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

  // Per-channel "was this channel ever in a dropped state since its last
  // clean (re)subscribe" flag. `goalbet:realtime-reconnected` fires only on
  // the SUBSCRIBED transition that follows a genuine drop — never on the
  // very first subscribe of a freshly (re)created channel (a plain mount or
  // a group switch), since neither of those is a "recovery."
  const hadDroppedRef = useRef<{ group: boolean; user: boolean }>({ group: false, user: false });

  const handleChannelStatus = useCallback((channelKey: 'group' | 'user') => {
    return (status: REALTIME_SUBSCRIBE_STATES) => {
      if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
        if (hadDroppedRef.current[channelKey]) {
          hadDroppedRef.current[channelKey] = false;
          window.dispatchEvent(new Event(RECONNECT_EVENT));
        }
      } else if (
        status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
        status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
        status === REALTIME_SUBSCRIBE_STATES.CLOSED
      ) {
        hadDroppedRef.current[channelKey] = true;
      }
    };
  }, []);

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
      // group_events — folds useGroupEvents.ts's own `group_events_*`
      // channel in. INSERT-only (matches the pre-Sprint-35 filter exactly);
      // useGroupEvents.ts's handler ignores payload content and just
      // re-fetches the last 50 events (it needs the profiles/matches join,
      // which a Realtime payload never carries).
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_events', filter: `group_id=eq.${activeGroupId}` },
        (payload) => dispatch('group_events', payload as RealtimePostgresChangesPayload<Record<string, unknown>>),
      )
      // micro_prediction_questions — folds useMicroPrediction.ts's own
      // `micro-questions-*` channel in. event: '*' matches the old filter;
      // the consumer re-fetches the active question regardless of payload
      // content, same as before.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'micro_prediction_questions', filter: `group_id=eq.${activeGroupId}` },
        (payload) => dispatch('micro_prediction_questions', payload as RealtimePostgresChangesPayload<Record<string, unknown>>),
      )
      .subscribe(handleChannelStatus('group'));

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeGroupId, dispatch, handleChannelStatus]);

  // ── User Channel — mounted once per logged-in user, survives group
  // switches. Holds the signals that must still land while the user is
  // looking at a DIFFERENT group than the one a notification/bet-result
  // actually belongs to — see the file-header comment for why these can't
  // share the Group Channel. Torn down only on logout (user → null).
  useEffect(() => {
    if (!user) return;

    const channel: RealtimeChannel = supabase
      .channel(`goalbet-user-${user.id}`)
      // notifications — folds useNotifications.ts's own
      // `notifications:{user}:{instanceId}` channel in. That per-instance
      // suffix existed specifically to avoid channel-name collisions when
      // Sidebar and TopBar both mount simultaneously (CSS-toggled by
      // breakpoint, not conditionally rendered) — the shared registry's
      // Set<handler> supports multiple simultaneous listeners on the same
      // table natively, so that workaround is no longer needed at all.
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => dispatch('notifications', payload as RealtimePostgresChangesPayload<Record<string, unknown>>),
      )
      // micro_prediction_bets — folds useMicroPrediction.ts's own
      // `micro-bet-results-*` channel in. UPDATE-only, matching the old
      // filter (settleBets sets settled_at exactly once per bet via its
      // own atomic claim, so this row only ever receives one UPDATE in its
      // lifetime — see the original comment preserved in
      // useMicroPrediction.ts).
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'micro_prediction_bets', filter: `user_id=eq.${user.id}` },
        (payload) => dispatch('micro_prediction_bets', payload as RealtimePostgresChangesPayload<Record<string, unknown>>),
      )
      .subscribe(handleChannelStatus('user'));

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, dispatch, handleChannelStatus]);

  const value: RealtimeContextValue = { subscribe: subscribeFn };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
