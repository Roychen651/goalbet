import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, Match } from '../lib/supabase';
import { useGroupStore } from '../stores/groupStore';

type StatusFilter = 'all' | 'upcoming' | 'live' | 'completed';

// Stable empty reference so consumers don't re-render when the list is empty.
const EMPTY: Match[] = [];

// Show 60 days ahead by default. The old 30-day window silently hid the entire
// upcoming slate during the summer off-season — e.g. on 2026-07-12 the nearest
// Premier League fixture is 2026-08-21 (40 days out), so a 30-day window
// rendered "No matches found" even though the backend had synced all 60 PL
// fixtures. 60 days catches pre-season + the start of the European season while
// staying under the backend's 90-day sync window. "Load More" extends further.
const INITIAL_UPCOMING_DAYS = 60;
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

// ─── useMatches — TanStack Query edition (Sprint 3, Step 2) ────────────────────
// Same public return shape as the previous bespoke useState/useEffect version —
// HomePage requires zero changes.
//
// mergeMatches() is gone: React Query's built-in structural sharing preserves
// object identity for unchanged rows across refetches (the reconciler-bailout the
// hand-rolled merge existed to provide, AI columns included).
//
// upcomingDays is deliberately NOT part of the query key. It lives in a ref, and
// "Load More" bumps the ref then calls refetch() — so widening the window keeps
// the current list on screen (no skeleton, no scroll reset). A group/tab switch
// DOES change the key, so it correctly shows skeletons and fetches fresh.
export function useMatches(statusFilter: StatusFilter = 'all') {
  const queryClient = useQueryClient();
  const [upcomingDays, setUpcomingDays] = useState(INITIAL_UPCOMING_DAYS);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const upcomingDaysRef = useRef(INITIAL_UPCOMING_DAYS);

  const { activeGroupId, groups, loading: groupsLoading } = useGroupStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeLeagues = activeGroup?.active_leagues ?? [];
  const leaguesKey = [...activeLeagues].sort().join(',');

  const enabled = !!activeGroupId && !groupsLoading && activeLeagues.length > 0;

  const query = useQuery({
    queryKey: ['matches', activeGroupId ?? null, leaguesKey, statusFilter],
    queryFn: () => queryMatches(activeLeagues, statusFilter, upcomingDaysRef.current),
    enabled,
    // Freshness comes from Realtime (setQueryData patches) + the goalbet:synced
    // invalidation, never from a stale-timer refetch that would fight AppShell's
    // sole ownership of automatic sync (CLAUDE.md rule 4.3).
    staleTime: Infinity,
  });

  const { refetch: rqRefetch } = query;

  // ── Realtime: two-path model (see CLAUDE.md rule 4.4) ─────────────────────
  //  • UPDATE → surgical setQueryData merge patch. Instant live score/status/clock
  //    with zero network. Merge (never replace) so a partial payload can only
  //    overlay changed fields, never drop an existing one.
  //  • INSERT → invalidate (need the full row + re-sort).
  // The authoritative reconcile for anything a partial UPDATE payload dropped
  // (e.g. a JSONB/AI column) is the goalbet:synced invalidation below.
  const subscribeToMatches = useCallback(() => {
    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`matches-${leaguesKey}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (payload) => {
        const updated = payload.new as Match;
        queryClient.setQueriesData<Match[]>({ queryKey: ['matches'] }, (old) => {
          if (!old) return old;
          let changed = false;
          const next = old.map(m => {
            if (m.id === updated.id) { changed = true; return { ...m, ...updated }; }
            return m;
          });
          return changed ? next : old; // unchanged lists keep their reference
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, () => {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
      })
      .subscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaguesKey]);

  useEffect(() => {
    subscribeToMatches();

    // Tab restore: re-subscribe in case the Realtime socket dropped, then
    // silently revalidate (background refetch — never a skeleton).
    const onVisible = () => {
      if (!document.hidden) {
        subscribeToMatches();
        queryClient.invalidateQueries({ queryKey: ['matches'] });
      }
    };

    // Background sync finished → authoritative silent refetch of the active
    // query. isLoading stays false (data is present), so the list is never
    // unmounted and PredictionForm state is preserved.
    const onSynced = () => queryClient.invalidateQueries({ queryKey: ['matches'] });

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('goalbet:synced', onSynced);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('goalbet:synced', onSynced);
      channelRef.current?.unsubscribe();
    };
  }, [subscribeToMatches, queryClient]);

  // Reset the day window + "hit the ceiling" flag whenever the data scope changes.
  useEffect(() => {
    setHasMore(true);
    upcomingDaysRef.current = INITIAL_UPCOMING_DAYS;
    setUpcomingDays(INITIAL_UPCOMING_DAYS);
  }, [leaguesKey, statusFilter, activeGroupId]);

  // Load more fixtures: widen the window and refetch the SAME key, so the current
  // list stays on screen (no spinner, no scroll reset). If the wider window
  // returns the same count (or fewer), we've hit the backend's sync ceiling.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const prevCount = query.data?.length ?? 0;
    const newDays = upcomingDaysRef.current + LOAD_MORE_DAYS;
    setLoadingMore(true);
    upcomingDaysRef.current = newDays;
    try {
      const res = await rqRefetch();
      setUpcomingDays(newDays);
      if ((res.data?.length ?? 0) <= prevCount) setHasMore(false);
    } catch {
      // silent — existing matches stay
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, query.data, rqRefetch]);

  // Preserved for return-shape compatibility (no current consumer calls it).
  const refetch = useCallback(async (days?: number) => {
    if (typeof days === 'number') {
      upcomingDaysRef.current = days;
      setUpcomingDays(days);
    }
    await rqRefetch();
  }, [rqRefetch]);

  const matches = query.data ?? EMPTY;
  const loading = !!activeGroupId && (groupsLoading || (activeLeagues.length > 0 && query.isLoading));
  const error = query.error
    ? (query.error instanceof Error ? query.error.message : 'Failed to load matches')
    : null;

  return { matches, loading, loadingMore, error, refetch, loadMore, upcomingDays, hasMore };
}
