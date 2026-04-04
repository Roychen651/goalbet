/**
 * Manual sync hook — exposes `triggerSync` for the Settings "Sync Now" button.
 *
 * Automatic background sync is handled entirely by AppShell (on mount, polling,
 * and tab-restore). This hook is ONLY for on-demand user-initiated syncs.
 *
 * All fetches are AbortController-gated with a 60 s timeout so the button
 * never gets stuck in a permanent "Syncing…" state.
 */
import { useState, useRef } from 'react';

const FETCH_TIMEOUT_MS = 60_000;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string | undefined;

async function callBackendSync(): Promise<void> {
  if (!BACKEND_URL) return;

  const withTimeout = (url: string) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { method: 'POST', signal: ctrl.signal }).finally(() => clearTimeout(t));
  };

  // Fire both in parallel — allSettled so one failure doesn't block the other
  await Promise.allSettled([
    withTimeout(`${BACKEND_URL}/api/sync/matches`),
    withTimeout(`${BACKEND_URL}/api/sync/scores`),
  ]);
}

export function useMatchSync(
  activeLeagues: number[],
  _matchCount: number,
  onSyncComplete?: () => void,
) {
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const syncRef = useRef(false);

  const triggerSync = async () => {
    if (syncRef.current || activeLeagues.length === 0) return;
    syncRef.current = true;
    setSyncing(true);
    try {
      await callBackendSync();
      setLastSynced(new Date());
      // Notify data hooks to refetch
      window.dispatchEvent(new Event('goalbet:synced'));
      onSyncComplete?.();
    } catch {
      // Timed out or network error — clear spinner, data will refresh via AppShell's next poll
    } finally {
      setSyncing(false);
      syncRef.current = false;
    }
  };

  return { syncing, lastSynced, triggerSync };
}
