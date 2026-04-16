import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Match } from '../lib/supabase';
import { useGroupStore } from '../stores/groupStore';

type StatusFilter = 'all' | 'upcoming' | 'live' | 'completed';

// ─── Smart merge ──────────────────────────────────────────────────────────────
// Preserves object identity for matches that haven't changed.
// React's reconciler compares by reference — if the object is the same reference,
// the entire MatchCard + PredictionForm subtree is skipped during diffing.
// Only records whose score/status/clock actually changed get new references.
function mergeMatches(prev: Match[], next: Match[]): Match[] {
  const prevMap = new Map(prev.map(m => [m.id, m]));
  return next.map(m => {
    const p = prevMap.get(m.id);
    if (!p) return m; // new match — use incoming
    if (
      p.status         === m.status         &&
      p.home_score     === m.home_score     &&
      p.away_score     === m.away_score     &&
      p.display_clock  === m.display_clock  &&
      p.regulation_home === m.regulation_home &&
      p.regulation_away === m.regulation_away &&
      p.penalty_home   === m.penalty_home   &&
      p.penalty_away   === m.penalty_away   &&
      p.halftime_home  === m.halftime_home  &&
      p.halftime_away  === m.halftime_away
    ) {
      return p; // nothing changed — same reference, React bails out of subtree
    }
    return { ...p, ...m }; // surgical update of changed fields
  });
}

const INITIAL_UPCOMING_DAYS = 30; // show 30 days ahead by default (covers international breaks)
const LOAD_MORE_DAYS = 14;        // each "Load More" click adds 14 more days
const COMPLETED_DAYS = 14;        // show results from last 14 days

async function queryMatches(
  leagueIds: number[],
  statusFilter: StatusFilter,
  upcomingDays: number,
): Promise<Match[]> {
  const now = new Date();
  // Buffer: NS matches up to 3h past kickoff are shown as "live/in-progress"
  const liveBufferStart = new Date(now.getTime() - 3 * 3600_000).toISOString();

  if (statusFilter === 'live') {
    const [liveRes, stalledRes] = await Promise.all([
      supabase
        .from('matches').select('*')
        .in('league_id', leagueIds)
        .in('status', ['1H', 'HT', '2H'])
        .order('kickoff_time', { ascending: true }),
      supabase
        .from('matches').select('*')
        .in('league_id', leagueIds)
        .eq('status', 'NS')
        .gte('kickoff_time', liveBufferStart)
        .lte('kickoff_time', now.toISOString())
        .order('kickoff_time', { ascending: true }),
    ]);
    if (liveRes.error) throw liveRes.error;
    if (stalledRes.error) throw stalledRes.error;
    const seen = new Set<string>();
    const all: Match[] = [];
    for (const m of [...(liveRes.data ?? []), ...(stalledRes.data ?? [])] as Match[]) {
      if (!seen.has(m.id)) { seen.add(m.id); all.push(m); }
    }
    all.sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());
    return all;
  }

  if (statusFilter === 'upcoming') {
    const cutoff = new Date(now.getTime() + upcomingDays * 86400_000).toISOString();
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .in('league_id', leagueIds)
      .eq('status', 'NS')
      .gte('kickoff_time', liveBufferStart)
      .lte('kickoff_time', cutoff)
      .order('kickoff_time', { ascending: true })
      .limit(300);
    if (error) throw error;
    return (data as Match[]) ?? [];
  }

  if (statusFilter === 'completed') {
    const since = new Date(now.getTime() - COMPLETED_DAYS * 86400_000).toISOString();
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .in('league_id', leagueIds)
      .eq('status', 'FT')
      .gte('kickoff_time', since)
      .order('kickoff_time', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as Match[]) ?? [];
  }

  // 'all' tab
  const upcomingCutoff = new Date(now.getTime() + upcomingDays * 86400_000).toISOString();
  const completedSince = new Date(now.getTime() - COMPLETED_DAYS * 86400_000).toISOString();

  const [liveRes, stalledNsRes, upcomingRes, completedRes] = await Promise.all([
    supabase.from('matches').select('*')
      .in('league_id', leagueIds)
      .in('status', ['1H', 'HT', '2H'])
      .order('kickoff_time', { ascending: true }).limit(30),

    supabase.from('matches').select('*')
      .in('league_id', leagueIds)
      .eq('status', 'NS')
      .gte('kickoff_time', liveBufferStart)
      .lte('kickoff_time', now.toISOString())
      .order('kickoff_time', { ascending: true }).limit(30),

    supabase.from('matches').select('*')
      .in('league_id', leagueIds)
      .eq('status', 'NS')
      .gte('kickoff_time', now.toISOString())
      .lte('kickoff_time', upcomingCutoff)
      .order('kickoff_time', { ascending: true }).limit(300),

    supabase.from('matches').select('*')
      .in('league_id', leagueIds)
      .eq('status', 'FT')
      .gte('kickoff_time', completedSince)
      .order('kickoff_time', { ascending: false }).limit(100),
  ]);

  if (liveRes.error) throw liveRes.error;
  if (stalledNsRes.error) throw stalledNsRes.error;
  if (upcomingRes.error) throw upcomingRes.error;
  if (completedRes.error) throw completedRes.error;

  const seen = new Set<string>();
  const all: Match[] = [];
  for (const m of [
    ...(liveRes.data ?? []),
    ...(stalledNsRes.data ?? []),
    ...(upcomingRes.data ?? []),
    ...(completedRes.data ?? []),
  ] as Match[]) {
    if (!seen.has(m.id)) { seen.add(m.id); all.push(m); }
  }

  const liveSet = new Set(['1H', 'HT', '2H']);
  const doneSet = new Set(['FT']);
  all.sort((a, b) => {
    const aLive = liveSet.has(a.status) || (a.status === 'NS' && new Date(a.kickoff_time).getTime() < Date.now());
    const bLive = liveSet.has(b.status) || (b.status === 'NS' && new Date(b.kickoff_time).getTime() < Date.now());
    const aDone = doneSet.has(a.status), bDone = doneSet.has(b.status);
    if (aLive !== bLive) return aLive ? -1 : 1;
    if (aDone !== bDone) return aDone ? 1 : -1;
    const timeDiff = new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.league_id - b.league_id;
  });

  return all;
}

export function useMatches(statusFilter: StatusFilter = 'all') {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upcomingDays, setUpcomingDays] = useState(INITIAL_UPCOMING_DAYS);
  const [hasMore, setHasMore] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Ref mirrors upcomingDays so full/background fetch callbacks don't need it
  // in their deps. Including it would rebuild the callbacks on every loadMore,
  // re-fire the subscribe effect, and flip loading=true — which swaps the match
  // list for skeletons mid-click, collapsing page height and resetting scroll.
  const upcomingDaysRef = useRef(INITIAL_UPCOMING_DAYS);

  const { activeGroupId, groups, loading: groupsLoading } = useGroupStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeLeagues = activeGroup?.active_leagues ?? [];
  const leaguesKey = [...activeLeagues].sort().join(',');

  // ── Full fetch (shows loading spinner) ────────────────────────────────────
  // Use ONLY for: initial mount, group/league changes, manual "Sync Now".
  // Never call this from background sync paths — it sets loading=true which
  // unmounts the match list and destroys all PredictionForm state.
  const fetchMatches = useCallback(async (days?: number) => {
    if (!activeGroupId) {
      setMatches([]);
      setLoading(false);
      return;
    }
    if (groupsLoading) {
      setLoading(true);
      return;
    }
    if (activeLeagues.length === 0) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await queryMatches(activeLeagues, statusFilter, days ?? upcomingDaysRef.current);
      setMatches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, leaguesKey, statusFilter, groupsLoading]);

  // ── Background fetch (zero UI disruption) ─────────────────────────────────
  // Called by: goalbet:synced event, tab restore after inactivity.
  // Never sets loading=true — the match list stays mounted, PredictionForm
  // state (user's in-progress selections) is fully preserved.
  // Uses mergeMatches to keep object identity stable for unchanged records,
  // so React's reconciler skips subtrees that haven't actually changed.
  const backgroundFetch = useCallback(async () => {
    if (!activeGroupId || groupsLoading || activeLeagues.length === 0) return;
    try {
      const data = await queryMatches(activeLeagues, statusFilter, upcomingDaysRef.current);
      setMatches(prev => mergeMatches(prev, data));
    } catch {
      // Silent — existing data stays, user is not disrupted
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, leaguesKey, statusFilter, groupsLoading]);

  // Load more fixtures: extend window without resetting scroll or showing full spinner.
  // If a bump returns the same match count (or fewer), we've hit the backend sync
  // ceiling — ESPN has no more scheduled fixtures. Flip hasMore so the UI can
  // swap the button for a "no more fixtures" note instead of lying to the user.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const newDays = upcomingDays + LOAD_MORE_DAYS;
    const prevCount = matches.length;
    setLoadingMore(true);
    try {
      const data = await queryMatches(activeLeagues, statusFilter, newDays);
      setMatches(data);
      upcomingDaysRef.current = newDays;
      setUpcomingDays(newDays);
      if (data.length <= prevCount) setHasMore(false);
    } catch {
      // silent — existing matches stay
    } finally {
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingDays, loadingMore, hasMore, matches.length, activeLeagues, statusFilter]);

  // Reset the "hit the ceiling" flag whenever the underlying data scope changes.
  useEffect(() => {
    setHasMore(true);
    upcomingDaysRef.current = INITIAL_UPCOMING_DAYS;
    setUpcomingDays(INITIAL_UPCOMING_DAYS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaguesKey, statusFilter, activeGroupId]);

  const subscribeToMatches = useCallback(() => {
    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`matches-${leaguesKey}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (payload) => {
        const updated = payload.new as Match;
        setMatches(prev =>
          prev.map(m => m.id === updated.id ? { ...m, ...updated } as Match : m)
        );
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, () => {
        // New match inserted (e.g. after sync) — refresh the list
        fetchMatches();
      })
      .subscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaguesKey]);

  useEffect(() => {
    fetchMatches();       // initial load — spinner is appropriate here
    subscribeToMatches();

    // Tab restore: re-subscribe in case the Realtime connection dropped,
    // then silently refresh data without a loading spinner.
    const onVisible = () => {
      if (!document.hidden) {
        subscribeToMatches();
        backgroundFetch(); // ← never sets loading=true
      }
    };

    // Background sync completed — merge new data without destroying form state.
    // Previously this called fetchMatches() which set loading=true, unmounted
    // the match list, and wiped all PredictionForm useState selections.
    const onSynced = () => backgroundFetch();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('goalbet:synced', onSynced);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('goalbet:synced', onSynced);
      channelRef.current?.unsubscribe();
    };
  }, [fetchMatches, subscribeToMatches, backgroundFetch]);

  return { matches, loading, loadingMore, error, refetch: fetchMatches, loadMore, upcomingDays, hasMore };
}
