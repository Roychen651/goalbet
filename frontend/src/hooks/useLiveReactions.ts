import { useCallback, useRef, useState } from 'react';
import { useRealtimeBroadcast, type LiveReactionPayload } from '../components/providers/RealtimeProvider';
import { useAuthStore } from '../stores/authStore';
import type { Gender } from '../lib/i18n';

// V5 Sprint 39 — "The Live Lobby". One instance of this hook per expanded
// live MatchCard (mounted inside LiveLobby.tsx) — all state here (the
// floating queue, the ticker's last 3 lines) lives and dies with the card
// itself. Nothing in this file is ever written to Postgres — see the
// broadcast-transport comment in RealtimeProvider.tsx and CLAUDE.md §53.

export interface ReactionParticle {
  id: string;
  chip: string;
  x0: number; // 0..1 — horizontal spawn fraction of the canvas width
  driftSeed: number; // fixed per-particle random seed driving its unique sine-drift path
  spawnedAt: number; // performance.now() timestamp
}

export interface TickerEvent {
  id: string;
  chip: string;
  username: string;
  gender: Gender;
}

export const MAX_PARTICLES = 15;
const MAX_TICKER_LINES = 3;
const RESEND_THROTTLE_MS = 400;

/** Dispatched (window-scoped, CustomEvent<matchId>) every time a particle
 * is pushed — mirrors CoinsRainCanvas.tsx's own `goalbet:coins-rain`
 * event-driven wake pattern. ReactionEngine.tsx's RAF loop is idle
 * (fully stopped, zero per-frame cost) whenever its queue is empty, and
 * this event is what wakes it back up — deliberately NOT React state,
 * since routing every particle spawn through setState would re-render
 * the whole MatchCard subtree for something only a canvas needs to know
 * about, the same "keep React's render cycle out of the hot path"
 * discipline useTactileTilt.ts already established (§31). */
export const REACTION_SPAWN_EVENT = 'goalbet:live-reaction-spawn';

function genId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useLiveReactions(matchId: string) {
  const { profile } = useAuthStore();
  const queueRef = useRef<ReactionParticle[]>([]);
  const [tickerEvents, setTickerEvents] = useState<TickerEvent[]>([]);
  const lastSentAtRef = useRef<Record<string, number>>({});

  const pushParticle = useCallback((chip: string) => {
    const q = queueRef.current;
    // Hard cap of 15 simultaneous floating elements (older WebKit/Android
    // protection, per the brief) — evict the OLDEST entry rather than
    // rejecting the new one, so a live human tap always visibly fires
    // even under heavy load; both local taps and remote broadcasts push
    // into this exact same array through this exact same function.
    if (q.length >= MAX_PARTICLES) q.shift();
    q.push({
      id: genId(),
      chip,
      x0: 0.15 + Math.random() * 0.7,
      driftSeed: Math.floor(Math.random() * 1000),
      spawnedAt: performance.now(),
    });
    window.dispatchEvent(new CustomEvent<string>(REACTION_SPAWN_EVENT, { detail: matchId }));
  }, [matchId]);

  const pushTickerLine = useCallback((chip: string, username: string, gender: Gender) => {
    setTickerEvents((prev) => [{ id: genId(), chip, username, gender }, ...prev].slice(0, MAX_TICKER_LINES));
  }, []);

  const onRemoteReaction = useCallback((payload: LiveReactionPayload) => {
    pushParticle(payload.chip);
    pushTickerLine(payload.chip, payload.username, payload.gender);
  }, [pushParticle, pushTickerLine]);

  const { send } = useRealtimeBroadcast(matchId, onRemoteReaction);

  const fireReaction = useCallback((chip: string) => {
    // Client-side UX throttle only (a stuck-finger double-tap), never a
    // security boundary — nothing here spends coins or writes a DB row,
    // so this doesn't need the coin-spending-RPC discipline (§11/§27)
    // every other client-trust boundary in this app follows.
    const now = Date.now();
    const last = lastSentAtRef.current[chip] ?? 0;
    if (now - last < RESEND_THROTTLE_MS) return;
    lastSentAtRef.current[chip] = now;

    // Self-echo is off by design — render locally, synchronously, first.
    // The sender never waits on hearing their own broadcast back.
    const username = profile?.username ?? '';
    const gender: Gender = profile?.gender ?? 'unspecified';
    pushParticle(chip);
    pushTickerLine(chip, username, gender);
    send(chip, username, gender);
  }, [profile, pushParticle, pushTickerLine, send]);

  return { queueRef, tickerEvents, fireReaction };
}
