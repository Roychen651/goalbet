import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Match } from '../lib/supabase';

// World Cup 2026 internal league id (ESPN slug 'fifa.world').
const WORLD_CUP_LEAGUE_ID = 4480;

/**
 * useWorldCupMatches — fetches every synced World Cup 2026 match (league 4480)
 * regardless of the active group's league selection, so the Stats-Hub bracket
 * can overlay real status / scores / prediction-ability onto its static
 * tournament scaffold.
 *
 * Realtime + goalbet:synced both trigger a full re-fetch (never an in-place
 * swap — Realtime UPDATE payloads are partial; see CLAUDE.md 4.4).
 */
export function useWorldCupMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMatches = useCallback(async () => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('league_id', WORLD_CUP_LEAGUE_ID)
      .order('kickoff_time', { ascending: true })
      .limit(200);
    if (!error) setMatches((data as Match[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMatches();

    channelRef.current = supabase
      .channel('wc-matches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `league_id=eq.${WORLD_CUP_LEAGUE_ID}` },
        () => fetchMatches(),
      )
      .subscribe();

    const onSynced = () => fetchMatches();
    window.addEventListener('goalbet:synced', onSynced);

    return () => {
      window.removeEventListener('goalbet:synced', onSynced);
      channelRef.current?.unsubscribe();
    };
  }, [fetchMatches]);

  return { matches, loading, refetch: fetchMatches };
}
