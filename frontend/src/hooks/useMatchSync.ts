/**
 * Auto-sync hook — calls the backend sync API on page load to ensure fixtures
 * and scores are always fresh. Uses a 20-minute cooldown to avoid hammering the backend.
 *
 * This works even on free-tier backends that sleep: the request wakes the server
 * and immediately triggers a sync from ESPN.
 */
import { useState, useEffect, useRef } from 'react';

const SYNC_COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes between auto-syncs
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string | undefined;

// Module-level timestamp so cooldown persists across tab re-renders
let lastSyncTimestamp = 0;

async function callBackendSync(): Promise<void> {
  if (!BACKEND_URL) return;
  // Fire both in parallel — don't await, let it run in background
  const opts: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
  await Promise.allSettled([
    fetch(`${BACKEND_URL}/api/sync/matches`, opts),
    fetch(`${BACKEND_URL}/api/sync/scores`, opts),
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
    lastSyncTimestamp = Date.now();
    try {
      await callBackendSync();
      setLastSynced(new Date());
      onSyncComplete?.();
    } catch {
      // Sync failed silently — existing DB data still shows
    } finally {
      setSyncing(false);
      syncRef.current = false;
    }
  };

  // Sync on mount and whenever leagues change, respecting cooldown
  useEffect(() => {
    if (activeLeagues.length === 0) return;
    const sinceLastSync = Date.now() - lastSyncTimestamp;
    if (sinceLastSync < SYNC_COOLDOWN_MS) return;
    triggerSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeagues.join(',')]);

  return { syncing, lastSynced, triggerSync };
}
