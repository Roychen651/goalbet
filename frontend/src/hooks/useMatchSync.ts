/**
 * Auto-sync hook — triggers a match sync when the selected leagues
 * have no matches in Supabase. Uses the sync-matches Edge Function
 * (runs on Supabase servers, no local backend needed).
 */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between auto-syncs
const lastSyncByLeagues = new Map<string, number>();

export function useMatchSync(
  activeLeagues: number[],
  matchCount: number,
  onSyncComplete?: () => void,
) {
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const syncRef = useRef(false);

  const triggerSync = async (leagues: number[]) => {
    if (syncRef.current || leagues.length === 0) return;
    syncRef.current = true;
    setSyncing(true);
    try {
      await supabase.functions.invoke('sync-matches', {
        body: { league_ids: leagues },
      });
      setLastSynced(new Date());
      onSyncComplete?.();
    } catch {
      // Sync failed silently — matches from DB (or empty) will still show
    } finally {
      setSyncing(false);
      syncRef.current = false;
    }
  };

  // Auto-sync when: leagues are selected AND no matches found AND cooldown expired
  useEffect(() => {
    if (activeLeagues.length === 0) return;
    if (matchCount > 0) return; // already have data, no need to sync

    const key = [...activeLeagues].sort().join(',');
    const lastSync = lastSyncByLeagues.get(key) ?? 0;
    const sinceLastSync = Date.now() - lastSync;

    if (sinceLastSync < SYNC_COOLDOWN_MS) return;

    lastSyncByLeagues.set(key, Date.now());
    triggerSync(activeLeagues);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeagues.join(','), matchCount]);

  return { syncing, lastSynced, triggerSync: () => triggerSync(activeLeagues) };
}
