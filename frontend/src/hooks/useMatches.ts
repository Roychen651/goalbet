import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Match } from '../lib/supabase';
import { useGroupStore } from '../stores/groupStore';

type StatusFilter = 'all' | 'upcoming' | 'live' | 'completed';

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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const { activeGroupId, groups, loading: groupsLoading } = useGroupStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeLeagues = activeGroup?.active_leagues ?? [];
  const leaguesKey = [...activeLeagues].sort().join(',');

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
      const data = await queryMatches(activeLeagues, statusFilter, days ?? upcomingDays);
      setMatches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, leaguesKey, statusFilter, groupsLoading, upcomingDays]);

  // Load more fixtures: extend window without resetting scroll or showing full spinner
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const newDays = upcomingDays + LOAD_MORE_DAYS;
    setUpcomingDays(newDays);
    setLoadingMore(true);
    try {
      const data = await queryMatches(activeLeagues, statusFilter, newDays);
      setMatches(data);
    } catch {
      // silent — existing matches stay
    } finally {
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingDays, loadingMore, activeLeagues, statusFilter]);

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
    fetchMatches();
    subscribeToMatches();

    const onVisible = () => {
      if (!document.hidden) { fetchMatches(); subscribeToMatches(); }
    };
    // After background sync completes, refetch so UI shows updated scores
    const onSynced = () => fetchMatches();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('goalbet:synced', onSynced);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('goalbet:synced', onSynced);
      channelRef.current?.unsubscribe();
    };
  }, [fetchMatches, subscribeToMatches]);

  return { matches, loading, loadingMore, error, refetch: fetchMatches, loadMore, upcomingDays };
}
