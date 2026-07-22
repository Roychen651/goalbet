/**
 * V7 Sprint 54 — "Stadium Vault" offline prediction queue (IndexedDB).
 *
 * CORRECTED FROM THE ORIGINAL BRIEF — see CLAUDE.md §68 for the full
 * write-up. The brief asked for a client-computed SHA-256 "cryptographic
 * signature," re-verified server-side, as proof against a spoofed client
 * timestamp. That is not a signature — a signature requires an
 * asymmetric secret the client doesn't hold. A hash computed ENTIRELY
 * from client-controlled inputs (the payload + a client-asserted
 * timestamp) can be trivially recomputed by that same client for any fake
 * timestamp it wants to claim; it provides zero tamper-resistance against
 * a motivated actor. What it IS still useful for: detecting accidental
 * local corruption (a browser crash mid-write, IndexedDB returning a torn
 * record) — a plain integrity checksum, never a security signature, and
 * NEVER sent to or trusted by the server.
 *
 * The only server-side anti-cheat mechanism this codebase actually trusts
 * for prediction timing is `prevent_late_prediction()` (migration 037) —
 * a trigger comparing the match's real `kickoff_time` against the
 * database's OWN clock at the literal moment of the write, regardless of
 * what any client claims. Every offline-queued prediction flushes through
 * the exact same `submit_prediction()` RPC (migration 040) every online
 * prediction already uses — zero new backend surface, zero new RPC, zero
 * new migration. `queued_at`/`checksum` here are pure client bookkeeping;
 * they are never transmitted to Supabase.
 */

import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import type { ParlayTierKey } from './constants';

const DB_NAME = 'goalbet-offline';
const DB_VERSION = 1;
const STORE_NAME = 'offline_predictions';

export type OfflinePredictionStatus = 'pending' | 'failed';

// Mirrors PredictionInput's tier fields (usePredictions.ts) minus match_id
// (already the record's own top-level key) and the legacy halftime fields
// (new predictions never set them) — a type-only import, so there's no
// runtime circular dependency between this "pure" queue module and the
// hooks layer, matching the same "mirror an existing type field-for-field"
// precedent §63's syndicate-pool target_prediction already established.
export interface OfflinePredictionPayload {
  predicted_outcome?: 'H' | 'D' | 'A' | null;
  predicted_home_score?: number | null;
  predicted_away_score?: number | null;
  predicted_corners?: 'under9' | 'ten' | 'over11' | null;
  predicted_btts?: boolean | null;
  predicted_over_under?: 'over' | 'under' | null;
  is_parlay?: boolean;
  parlay_linked_tiers?: ParlayTierKey[] | null;
}

export interface QueuedPrediction {
  match_id: string;
  group_id: string;
  user_id: string;
  payload: OfflinePredictionPayload;
  /** Local device clock only — never trusted server-side. See file header. */
  queued_at: string;
  /** SHA-256 integrity check, NOT a security signature. See file header. */
  checksum: string;
  attempts: number;
  status: OfflinePredictionStatus;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('indexeddb_unsupported'));
  }
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'match_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexeddb_open_failed'));
  });
  dbPromise = promise;
  // A failed open must not permanently wedge every later call behind the
  // same rejected promise — reset so a future attempt (e.g. after the
  // browser recovers from a transient quota error) gets a fresh try.
  promise.catch(() => { dbPromise = null; });
  return promise;
}

// Canonical (sorted-key) JSON stringify so the same logical payload always
// hashes identically regardless of property insertion order.
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

/**
 * SHA-256 over the canonical payload + match/user ids. Deliberately
 * excludes `queued_at` — the timestamp is never part of any trust
 * decision (see file header), so hashing it would misleadingly imply
 * otherwise. This is a local-only integrity check, never verified by the
 * server.
 */
export async function computeChecksum(
  matchId: string,
  userId: string,
  payload: OfflinePredictionPayload,
): Promise<string> {
  const canonical = canonicalize({ match_id: matchId, user_id: userId, payload });
  const bytes = new TextEncoder().encode(canonical);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Refreshes uiStore's badge count as a side effect of every mutation below
// — the queue module is the single owner of this count (see uiStore.ts's
// own comment on `pendingOfflineSyncCount`), so no caller (usePredictions.ts,
// useOfflineSync.ts) ever has to remember to sync it separately. Best-effort
// — a failed recount never blocks the mutation that triggered it.
//
// SCOPED TO THE CURRENTLY AUTHENTICATED USER, not the raw total row count.
// IndexedDB is scoped to the browser origin, not to a specific logged-in
// user — on a shared device, a different user logging in on the same
// browser would otherwise see (and the badge would count) whatever the
// PREVIOUS user left queued. Reading useAuthStore directly (rather than
// threading a userId parameter through every call site) keeps this queue
// module's public API unchanged while still getting this right.
async function refreshPendingCount(): Promise<void> {
  try {
    const userId = useAuthStore.getState().user?.id ?? null;
    const count = await countQueuedPredictions(userId);
    useUIStore.getState().setPendingOfflineSyncCount(count);
  } catch {
    // countQueuedPredictions() already never throws, but keep this belt-
    // and-braces so a badge-count failure can never surface as an
    // unhandled rejection on top of whatever the caller was doing.
  }
}

export async function enqueueOfflinePrediction(
  matchId: string,
  groupId: string,
  userId: string,
  payload: OfflinePredictionPayload,
): Promise<QueuedPrediction> {
  const checksum = await computeChecksum(matchId, userId, payload);
  const record: QueuedPrediction = {
    match_id: matchId,
    group_id: groupId,
    user_id: userId,
    payload,
    queued_at: new Date().toISOString(),
    checksum,
    attempts: 0,
    status: 'pending',
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexeddb_write_failed'));
  });
  await refreshPendingCount();
  return record;
}

export async function getQueuedPredictions(): Promise<QueuedPrediction[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as QueuedPrediction[]);
    req.onerror = () => reject(req.error ?? new Error('indexeddb_read_failed'));
  });
}

export async function removeQueuedPrediction(matchId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(matchId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexeddb_delete_failed'));
  });
  await refreshPendingCount();
}

export async function updateQueuedPredictionStatus(
  matchId: string,
  status: OfflinePredictionStatus,
  attempts: number,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(matchId);
    getReq.onsuccess = () => {
      const existing = getReq.result as QueuedPrediction | undefined;
      if (!existing) return;
      store.put({ ...existing, status, attempts });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexeddb_update_failed'));
  });
  await refreshPendingCount();
}

/**
 * Verifies a queued record's checksum still matches its payload — the
 * client-side-only "did this get corrupted at rest" check described in
 * the file header. Returns false on any mismatch or internal error
 * (never throws) so a caller can decide to drop the record with an
 * honest "this got corrupted, please redo it" message.
 */
export async function verifyChecksum(record: QueuedPrediction): Promise<boolean> {
  try {
    const expected = await computeChecksum(record.match_id, record.user_id, record.payload);
    return expected === record.checksum;
  } catch {
    return false;
  }
}

/**
 * Best-effort count for the persistent pending-sync badge (uiStore). Never
 * throws. Three distinct cases, not two — a real bug caught by this
 * sprint's own verification harness before shipping:
 *   - omitted (`undefined`) → the raw total across every user. Only for
 *     diagnostics/verification, never called this way from app code.
 *   - explicitly `null` (refreshPendingCount()'s shape when nobody is
 *     currently authenticated) → 0, always. `null` is falsy in JS, so a
 *     naive `userId ? filtered : all.length` ternary silently fell through
 *     to the RAW TOTAL here — meaning the badge could show a phantom count
 *     belonging to nobody currently viewing the app (a stale queue from a
 *     previous session, or another user on a shared device, the exact
 *     leak this scoping exists to prevent) the instant no user was signed
 *     in. Caught live by this sprint's own IndexedDB verification pass,
 *     fixed here, before ever shipping.
 *   - a real string → scoped to that one user's own queued items.
 */
export async function countQueuedPredictions(userId?: string | null): Promise<number> {
  try {
    const all = await getQueuedPredictions();
    if (userId === undefined) return all.length;
    if (userId === null) return 0;
    return all.filter((r) => r.user_id === userId).length;
  } catch {
    return 0;
  }
}
