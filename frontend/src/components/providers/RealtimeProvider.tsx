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
import type { Gender } from '../../lib/i18n';

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
//
// V5 Sprint 36 Hotfix — `syndicate_pools`/`group_battles` added to the
// Group Channel. Both are group_id-scoped (a pool/battle belongs to one or
// two groups, never a single user), so they follow the exact same "Group
// Channel, not User Channel" placement as `leaderboard`/`group_events`/
// `micro_prediction_questions` above. This is what makes
// SyndicatePoolCard/BattleMeter genuinely live for every group member —
// Commit 4 shipped them fetch-once/refetch-after-own-mutation only,
// deliberately deferring this wiring (see CLAUDE.md §51).
//
// `pool_contributions` is deliberately NOT bound directly — it has no
// `group_id` column of its own (only `pool_id`), so Realtime's single-
// equality `filter` syntax can't scope it to the active group without an
// unfiltered, app-wide subscription. `contribute_to_pool()` (migration 055)
// already bumps `syndicate_pools.total_staked` on every contribution — a
// group_id-filtered `syndicate_pools` UPDATE binding fires on exactly that
// signal, which is what SyndicatePoolCard's single `fetchPool()` function
// already re-fetches both the pool row AND its contributor list from, so
// no separate `pool_contributions` binding is needed to keep the
// contributor bar live.
//
// V5 Sprint 39 — "The Live Lobby": a genuinely different Realtime
// primitive rides the SAME Group Channel object from here on —
// `broadcast`, not `postgres_changes`. Floating micro-reactions on a live
// Match Center are intentionally EPHEMERAL: never written to Postgres,
// never persisted anywhere, gone the instant every viewer's browser tab
// forgets them. `channel.send({type:'broadcast', event, payload})` /
// `channel.on('broadcast', {event}, cb)` is a structurally different API
// from everything else in this file (no `schema`/`table`/`eventType`/
// `new`/`old` — just a bare `{event, payload}` envelope), so it cannot
// ride the existing `RealtimeTable`/`registryRef` machinery, which is
// typed strictly for `RealtimePostgresChangesPayload`. Rather than expose
// the raw channel object to consumers (which would create a real
// cross-component effect-ordering hazard — a MatchCard's own effect could
// run either before or after this provider's own Group Channel
// recreation on a group switch, React doesn't guarantee which), broadcast
// gets its OWN registry (`broadcastRegistryRef`, keyed by `matchId` — see
// below), mirroring `registryRef`'s exact shape. The registry itself is a
// stable `useRef` that survives every channel churn untouched; only the
// registered `.on('broadcast', ...)` binding lives inside the Group
// Channel's own effect, registered atomically alongside every
// `postgres_changes` binding in the same chain, so there's no ordering
// hazard to reason about at all. Self-echo (`config.broadcast.self`) is
// deliberately left at its default `false` — a sender renders its own
// particle/ticker line optimistically at tap time (useLiveReactions.ts),
// it never needs to hear its own broadcast come back. See CLAUDE.md §53.
export interface LiveReactionPayload {
  chip: string;
  username: string;
  gender: Gender;
  matchId: string;
  ts: number;
  clientNonce: string;
}
const LIVE_REACTION_EVENT = 'live_reaction';

// V6 Sprint 47 — "Tactical Copy-Betting & Live Duels": a SECOND broadcast
// event type, distinct from `live_reaction`. Negotiation-only (offer /
// counter / accept / reject / cancel) — like reactions, nothing here is
// ever written to Postgres; unlike reactions, a duel's ACCEPTANCE moves
// real coins, which is exactly why it does NOT happen inside this
// envelope. The actual escrow (Commit 3's `lock_duel_wager`-style RPCs)
// is always a real, auth.uid()-checked, single-party-debit call made
// independently by EACH side from their own session — never inferred
// from a broadcast payload, which is client-authored and unverifiable
// (a spoofed `fromUserId` could otherwise be used to fabricate an offer
// nobody actually made — the same class of hole rule 4.11 already closed
// once for coin-spending RPCs, §11/§27). This envelope is purely the
// matchmaking layer: "who wants to duel, on what terms" — the moment
// real money is at stake, control hands off to a real DB write.
export type DuelMessageType = 'offer' | 'counter' | 'accept' | 'reject' | 'cancel';

export interface DuelChallengePayload {
  type: DuelMessageType;
  duelNonce: string; // client-generated — correlates offer → counter/accept/reject/cancel across the negotiation
  fromUserId: string;
  fromUsername: string;
  toUserId: string | null; // null = open challenge to the whole group; otherwise a targeted reply
  matchId: string;
  stake: number;
  side: 'home' | 'away'; // which side the SENDER of this message is backing
  ts: number;
  clientNonce: string;
}
const DUEL_CHALLENGE_EVENT = 'duel_challenge';

// A broadcast handler is generic over its own payload shape — the
// registry itself doesn't need to know or care whether it's dispatching
// a LiveReactionPayload or a DuelChallengePayload, only that both carry a
// `matchId` string used for the composite registry key below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BroadcastHandler<T = any> = (payload: T) => void;

function genNonce(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Composite key so the SAME matchId can carry independent registries per
// event type — a MatchCard listening for `live_reaction` on match X must
// never also receive `duel_challenge` messages for match X, and vice
// versa, even though both ride the identical underlying channel object.
function broadcastKey(matchId: string, event: string): string {
  return `${matchId}:${event}`;
}

type RealtimeTable =
  | 'leaderboard'
  | 'group_events'
  | 'micro_prediction_questions'
  | 'notifications'
  | 'micro_prediction_bets'
  | 'syndicate_pools'
  | 'group_battles';
type RealtimeHandler = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;

interface RealtimeContextValue {
  subscribe: (table: RealtimeTable, handler: RealtimeHandler) => () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscribeBroadcast: (matchId: string, event: string, handler: BroadcastHandler<any>) => () => void;
  sendReaction: (payload: Omit<LiveReactionPayload, 'ts' | 'clientNonce'>) => void;
  sendDuelMessage: (payload: Omit<DuelChallengePayload, 'ts' | 'clientNonce'>) => void;
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

/**
 * V6 Sprint 47 — the generic broadcast primitive `useRealtimeBroadcast`
 * (below) is now a thin wrapper over. Subscribes to broadcast messages of
 * one `event` name, scoped to one `matchId` (composite-keyed — see
 * `broadcastKey` above), for any payload shape `T`. Registration is a
 * pure Map mutation against `broadcastRegistryRef`, never touching the
 * underlying Supabase channel object directly, so a group switch
 * mid-mount can never leave this hook's listener silently unbound.
 */
export function useRealtimeBroadcastChannel<T>(matchId: string, event: string, onMessage: BroadcastHandler<T>) {
  const ctx = useContext(RealtimeContext);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribeBroadcast(matchId, event, (payload: T) => handlerRef.current(payload));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, matchId, event]);
}

/**
 * V5 Sprint 39 — subscribes to broadcast `live_reaction` events scoped to
 * one `matchId`, and returns a `send()` for firing one. A thin,
 * signature-preserving wrapper over `useRealtimeBroadcastChannel` (V6
 * Sprint 47's generalization) — every existing call site
 * (useLiveReactions.ts) keeps working unmodified. `send()` is a thin
 * pass-through to the provider's own `sendReaction`, which reads the live
 * channel reference itself at call time; if the channel is momentarily
 * unavailable (the brief group-switch recreation window), it's a silent,
 * non-critical no-op — nothing here is persisted, so a missed tap during
 * that narrow window is a UX nicety lost, never a correctness bug.
 */
export function useRealtimeBroadcast(matchId: string, onReaction: BroadcastHandler<LiveReactionPayload>) {
  const ctx = useContext(RealtimeContext);
  useRealtimeBroadcastChannel<LiveReactionPayload>(matchId, LIVE_REACTION_EVENT, onReaction);

  const send = useCallback((chip: string, username: string, gender: Gender) => {
    ctx?.sendReaction({ chip, username, gender, matchId });
  }, [ctx, matchId]);

  return { send };
}

/**
 * V6 Sprint 47 — subscribes to `duel_challenge` negotiation messages for
 * one `matchId`, and returns a `send()` for firing one. Same shape as
 * `useRealtimeBroadcast` above, one event type over. Every message here
 * is pure matchmaking chatter (offer/counter/accept/reject/cancel) — no
 * coins move as a side effect of anything sent through this channel; see
 * the `DuelChallengePayload` file-header comment for exactly why the real
 * escrow is a separate, per-side, auth-checked DB call instead.
 */
export function useLiveDuelBroadcast(matchId: string, onMessage: BroadcastHandler<DuelChallengePayload>) {
  const ctx = useContext(RealtimeContext);
  useRealtimeBroadcastChannel<DuelChallengePayload>(matchId, DUEL_CHALLENGE_EVENT, onMessage);

  const send = useCallback((msg: Omit<DuelChallengePayload, 'ts' | 'clientNonce' | 'matchId'>) => {
    ctx?.sendDuelMessage({ ...msg, matchId });
  }, [ctx, matchId]);

  return { send };
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

  // V5 Sprint 39 — broadcast registry, keyed by `${matchId}:${event}`
  // (V6 Sprint 47 generalization — was matchId alone, back when
  // `live_reaction` was the only broadcast event this file carried; the
  // composite key is what lets `duel_challenge` share the same registry
  // shape without ever mixing dispatch with reactions for the same
  // match). Survives every Group Channel recreation untouched — see the
  // file-header comment above for why this is what makes the whole thing
  // race-free across a group switch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broadcastRegistryRef = useRef<Map<string, Set<BroadcastHandler<any>>>>(new Map());
  const groupChannelRef = useRef<RealtimeChannel | null>(null);

  const subscribeBroadcastFn = useCallback((matchId: string, event: string, handler: BroadcastHandler) => {
    const key = broadcastKey(matchId, event);
    let set = broadcastRegistryRef.current.get(key);
    if (!set) {
      set = new Set();
      broadcastRegistryRef.current.set(key, set);
    }
    set.add(handler);
    return () => { broadcastRegistryRef.current.get(key)?.delete(handler); };
  }, []);

  const dispatchBroadcast = useCallback((matchId: string, event: string, payload: unknown) => {
    broadcastRegistryRef.current.get(broadcastKey(matchId, event))?.forEach((h) => h(payload));
  }, []);

  const sendReactionFn = useCallback((payload: Omit<LiveReactionPayload, 'ts' | 'clientNonce'>) => {
    const channel = groupChannelRef.current;
    if (!channel) return; // no live channel right now — a non-critical miss, nothing here is persisted
    void channel.send({
      type: 'broadcast',
      event: LIVE_REACTION_EVENT,
      payload: { ...payload, ts: Date.now(), clientNonce: genNonce() },
    });
  }, []);

  // V6 Sprint 47 — identical shape to sendReactionFn, one event name over.
  const sendDuelMessageFn = useCallback((payload: Omit<DuelChallengePayload, 'ts' | 'clientNonce'>) => {
    const channel = groupChannelRef.current;
    if (!channel) return;
    void channel.send({
      type: 'broadcast',
      event: DUEL_CHALLENGE_EVENT,
      payload: { ...payload, ts: Date.now(), clientNonce: genNonce() },
    });
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
      // V5 Sprint 36 Hotfix — syndicate_pools. event: '*' covers both a
      // brand-new pool (INSERT, from create_syndicate_pool) and an existing
      // pool's total_staked bump (UPDATE, from every contribute_to_pool
      // call) — see the file-header comment above for why this single
      // binding is sufficient to keep the contributor bar live too.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'syndicate_pools', filter: `group_id=eq.${activeGroupId}` },
        (payload) => dispatch('syndicate_pools', payload as RealtimePostgresChangesPayload<Record<string, unknown>>),
      )
      // V5 Sprint 36 Hotfix — group_battles. TWO bindings, not one: the
      // active group can be EITHER side of a battle (challenger or
      // defender), and Realtime's postgres_changes filter only supports a
      // single column=eq.value equality — there's no OR. Both dispatch to
      // the same 'group_battles' table handler; BattleMeter's own fetch
      // already queries both sides via its own `.or(...)`, so either
      // trigger firing is equally sufficient to make it refetch.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_battles', filter: `challenger_group_id=eq.${activeGroupId}` },
        (payload) => dispatch('group_battles', payload as RealtimePostgresChangesPayload<Record<string, unknown>>),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_battles', filter: `defender_group_id=eq.${activeGroupId}` },
        (payload) => dispatch('group_battles', payload as RealtimePostgresChangesPayload<Record<string, unknown>>),
      )
      // V5 Sprint 39 — live_reaction broadcast. Registered atomically in
      // the same .on(...) chain as every postgres_changes binding above,
      // on the SAME channel object — this is what makes it immune to the
      // cross-effect ordering hazard described in the file-header comment.
      // Dispatches into broadcastRegistryRef, filtered by matchId+event
      // inside dispatchBroadcast itself (payload.matchId, this literal
      // event name), not by a Realtime-side filter — broadcast has no
      // server-side filter syntax at all, every subscriber on this
      // channel receives every reaction for the whole group and
      // dispatchBroadcast narrows it client-side to whichever
      // MatchCard(s) are actually listening for that matchId right now.
      .on('broadcast', { event: LIVE_REACTION_EVENT }, (msg) => {
        const payload = msg.payload as LiveReactionPayload;
        dispatchBroadcast(payload.matchId, LIVE_REACTION_EVENT, payload);
      })
      // V6 Sprint 47 — duel_challenge broadcast. Same registration shape
      // as live_reaction, one event name over — see the DuelChallengePayload
      // file-header comment for why negotiation stays broadcast-only while
      // the actual escrow (Commit 3) never does.
      .on('broadcast', { event: DUEL_CHALLENGE_EVENT }, (msg) => {
        const payload = msg.payload as DuelChallengePayload;
        dispatchBroadcast(payload.matchId, DUEL_CHALLENGE_EVENT, payload);
      })
      .subscribe(handleChannelStatus('group'));

    groupChannelRef.current = channel;

    return () => {
      groupChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeGroupId, dispatch, dispatchBroadcast, handleChannelStatus]);

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

  const value: RealtimeContextValue = {
    subscribe: subscribeFn,
    subscribeBroadcast: subscribeBroadcastFn,
    sendReaction: sendReactionFn,
    sendDuelMessage: sendDuelMessageFn,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
