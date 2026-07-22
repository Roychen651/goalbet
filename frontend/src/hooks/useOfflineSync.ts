/**
 * V7 Sprint 54 — "Stadium Vault" offline-sync flush loop.
 *
 * Mounted ONCE, inside AppInitializer (App.tsx) — the same "single global
 * owner" discipline AppShell already applies to match/score sync (rule
 * 4.3). Never mount this a second time from a page component; two
 * simultaneous flush loops racing the same IndexedDB queue is exactly the
 * class of duplicated-effect bug rule 4.3/§32 already warn against
 * elsewhere in this codebase.
 *
 * Two triggers:
 *   1. `window`'s `online` event — an eager attempt the instant the
 *      browser detects connectivity resumed.
 *   2. A ~45s periodic tick — deliberately offset from AppShell's existing
 *      30s live-score poll cadence so the two timers don't fire in
 *      lockstep and compete for the same network burst.
 *
 * `navigator.onLine` is used only as a cheap pre-filter on the periodic
 * tick (skip attempting a flush when the browser definitively reports no
 * network interface at all) — it is NEVER treated as proof a flush will
 * succeed. The `online` event handler always attempts regardless, and
 * every actual outcome (success, expired, corrupted, gave-up) is decided
 * by the real RPC round trip, exactly the same "attempt, then react to
 * what actually happened" discipline AppShell's own sync fetches already
 * use (§9/§21).
 *
 * Every queued item flushes through submitPredictionRpc() — the exact
 * same submit_prediction() RPC call every online prediction already uses
 * (see usePredictions.ts and lib/offlinePredictionQueue.ts's file header
 * for why no new backend surface exists for this feature at all).
 */

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useLangStore } from '../stores/langStore';
import {
  getQueuedPredictions,
  removeQueuedPrediction,
  updateQueuedPredictionStatus,
  verifyChecksum,
  type QueuedPrediction,
} from '../lib/offlinePredictionQueue';
import { submitPredictionRpc, type PredictionInput } from './usePredictions';

const FLUSH_INTERVAL_MS = 45_000;
const MAX_ATTEMPTS = 5;

function toPredictionInput(record: QueuedPrediction): PredictionInput {
  return {
    match_id: record.match_id,
    predicted_outcome: record.payload.predicted_outcome ?? null,
    predicted_home_score: record.payload.predicted_home_score ?? null,
    predicted_away_score: record.payload.predicted_away_score ?? null,
    predicted_corners: record.payload.predicted_corners ?? null,
    predicted_btts: record.payload.predicted_btts ?? null,
    predicted_over_under: record.payload.predicted_over_under ?? null,
    is_parlay: record.payload.is_parlay ?? false,
    parlay_linked_tiers: record.payload.parlay_linked_tiers ?? null,
  };
}

export function useOfflineSync() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const addToast = useUIStore((s) => s.addToast);
  const isFlushingRef = useRef(false);
  // Stable refs so the interval/listener effect below never needs to
  // re-subscribe when these change — matches useTactileTilt's own
  // "capture what's needed in a ref, subscribe once" shape.
  const userRef = useRef(user);
  userRef.current = user;

  const flush = useCallback(async () => {
    if (isFlushingRef.current) return; // re-entrancy guard — mirrors scheduler.ts's guarded()
    const currentUser = userRef.current;
    if (!currentUser) return;

    isFlushingRef.current = true;
    try {
      const all = await getQueuedPredictions();
      // Only this device's CURRENTLY logged-in user's own items — a
      // shared-device queue can genuinely hold another user's still-
      // unflushed rows (see offlinePredictionQueue.ts's refreshPendingCount
      // comment for the same reasoning applied to the badge count).
      const mine = all.filter((r) => r.user_id === currentUser.id);

      for (const record of mine) {
        const t = useLangStore.getState().t;

        const isValid = await verifyChecksum(record);
        if (!isValid) {
          await removeQueuedPrediction(record.match_id);
          addToast(t('offlineSyncCorruptedToast'), 'warning');
          continue;
        }

        try {
          await submitPredictionRpc(toPredictionInput(record), record.user_id, record.group_id);
          await removeQueuedPrediction(record.match_id);
          addToast(t('offlineSyncSuccessToast'), 'success');
          // Pull the authoritative server row into every mounted
          // usePredictions() cache slice — the exact same broad
          // invalidation the online mutation's own onSettled already does.
          queryClient.invalidateQueries({ queryKey: ['predictions'] });
        } catch (err) {
          const message = err instanceof Error ? err.message : '';
          if (message.includes('locked once the match starts')) {
            // The 15-minute kickoff lock (prevent_late_prediction(),
            // migration 037) — this queued item genuinely expired while
            // offline. Drop it; there is nothing to retry.
            await removeQueuedPrediction(record.match_id);
            addToast(t('offlineSyncExpiredToast'), 'warning');
            continue;
          }

          const attempts = record.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            await removeQueuedPrediction(record.match_id);
            addToast(t('offlineSyncGaveUpToast'), 'error');
          } else {
            await updateQueuedPredictionStatus(record.match_id, 'failed', attempts);
          }
        }
      }
    } finally {
      isFlushingRef.current = false;
    }
  }, [queryClient, addToast]);

  useEffect(() => {
    const onOnline = () => { void flush(); };
    window.addEventListener('online', onOnline);

    const interval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      void flush();
    }, FLUSH_INTERVAL_MS);

    // A queue can already hold items from a previous session (app closed
    // mid-flush, or the user was offline when they last quit) — attempt
    // once on mount rather than waiting a full interval tick.
    void flush();

    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(interval);
    };
  }, [flush]);
}
