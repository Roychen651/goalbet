import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Match } from '../lib/supabase';

/**
 * useKnockoutMatches — V7 Sprint 56. Generalizes useWorldCupMatches.ts's
 * proven shape (fetch every synced match for one league_id, regardless of
 * the active group's league selection, so a Stats Hub view can render the
 * full knockout picture) to any league id, since the Champions/Europa/
 * Conference League knockout bracket needs the exact same "all synced
 * matches for this league" fetch three separate leagues need, not one
 * hardcoded constant.
 *
 * Realtime + goalbet:synced both trigger a full re-fetch (never an
 * in-place swap — Realtime UPDATE payloads are partial; see CLAUDE.md 4.4).
 * Deliberately its own dedicated channel, not RealtimeProvider's Group
 * Channel (Sprint 35, §50) — this is league-scoped data, not group-scoped,
 * the same explicit scope boundary useMatches.ts/useWorldCupMatches.ts
 * already established.
 */
export function useKnockoutMatches(leagueId: number | null) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMatches = useCallback(async () => {
    if (leagueId == null) {
      setMatches([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('league_id', leagueId)
      .order('kickoff_time', { ascending: true })
      .limit(200);
    if (!error) setMatches((data as Match[]) ?? []);
    setLoading(false);
  }, [leagueId]);

  useEffect(() => {
    if (leagueId == null) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchMatches();

    channelRef.current = supabase
      .channel(`knockout-matches-${leagueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `league_id=eq.${leagueId}` },
        () => fetchMatches(),
      )
      .subscribe();

    const onSynced = () => fetchMatches();
    window.addEventListener('goalbet:synced', onSynced);

    return () => {
      window.removeEventListener('goalbet:synced', onSynced);
      channelRef.current?.unsubscribe();
    };
  }, [leagueId, fetchMatches]);

  return { matches, loading, refetch: fetchMatches };
}
