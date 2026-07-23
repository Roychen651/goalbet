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
 *
 * V7 Sprint 57 — gained an optional `season` filter so the bracket can be
 * scoped to exactly one season's matches (the true current one, or an
 * archived one selected from the Season Selector) instead of mixing every
 * season this league has ever synced into one view. Deliberately filters
 * by a KICKOFF-TIME date range, not `matches.season` (a raw ESPN
 * `season.displayName` string of unverified, possibly-inconsistent
 * format — never confirmed from this sandbox) — European football
 * seasons run July→June, the exact boundary stats.ts's own
 * `currentSeason()` already uses, so `season=2025` maps to
 * `[2025-07-01, 2026-07-01)`. This is the same class of "derive a real
 * boundary from a fact we control (the calendar), not an unverified
 * third-party field" discipline already applied elsewhere in this file.
 */
export function useKnockoutMatches(leagueId: number | null, season: number | null = null) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMatches = useCallback(async () => {
    if (leagueId == null) {
      setMatches([]);
      setLoading(false);
      return;
    }
    let query = supabase
      .from('matches')
      .select('*')
      .eq('league_id', leagueId);
    if (season != null) {
      query = query
        .gte('kickoff_time', `${season}-07-01`)
        .lt('kickoff_time', `${season + 1}-07-01`);
    }
    const { data, error } = await query
      .order('kickoff_time', { ascending: true })
      .limit(200);
    if (!error) setMatches((data as Match[]) ?? []);
    setLoading(false);
  }, [leagueId, season]);

  useEffect(() => {
    if (leagueId == null) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchMatches();

    channelRef.current = supabase
      .channel(`knockout-matches-${leagueId}-${season ?? 'live'}`)
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
  }, [leagueId, season, fetchMatches]);

  return { matches, loading, refetch: fetchMatches };
}
