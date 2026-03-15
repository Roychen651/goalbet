import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Match } from '../lib/supabase';
import { useGroupStore } from '../stores/groupStore';

type StatusFilter = 'all' | 'upcoming' | 'live' | 'completed';

const UPCOMING_DAYS = 14;  // show matches up to 14 days ahead
const COMPLETED_DAYS = 7;  // show results from last 7 days

async function queryMatches(leagueIds: number[], statusFilter: StatusFilter): Promise<Match[]> {
  const now = new Date();

  if (statusFilter === 'live') {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .in('league_id', leagueIds)
      .in('status', ['1H', 'HT', '2H'])
      .order('kickoff_time', { ascending: true });
    if (error) throw error;
    return (data as Match[]) ?? [];
  }

  if (statusFilter === 'upcoming') {
    const cutoff = new Date(now.getTime() + UPCOMING_DAYS * 86400_000).toISOString();
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .in('league_id', leagueIds)
      .eq('status', 'NS')
      .gte('kickoff_time', now.toISOString())
      .lte('kickoff_time', cutoff)
      .order('kickoff_time', { ascending: true })
      .limit(150);
    if (error) throw error;
    return (data as Match[]) ?? [];
  }

  if (statusFilter === 'completed') {
    const since = new Date(now.getTime() - COMPLETED_DAYS * 86400_000).toISOString();
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .in('league_id', leagueIds)
      .in('status', ['FT', 'PST', 'CANC'])
      .gte('kickoff_time', since)
      .order('kickoff_time', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as Match[]) ?? [];
  }

  // 'all' tab: 3 queries merged — no complex OR
  const upcomingCutoff = new Date(now.getTime() + UPCOMING_DAYS * 86400_000).toISOString();
  const completedSince = new Date(now.getTime() - COMPLETED_DAYS * 86400_000).toISOString();

  const [liveRes, upcomingRes, completedRes] = await Promise.all([
    supabase
      .from('matches').select('*')
      .in('league_id', leagueIds)
      .in('status', ['1H', 'HT', '2H'])
      .order('kickoff_time', { ascending: true }).limit(30),

    supabase
      .from('matches').select('*')
      .in('league_id', leagueIds)
      .eq('status', 'NS')
      .gte('kickoff_time', now.toISOString())
      .lte('kickoff_time', upcomingCutoff)
      .order('kickoff_time', { ascending: true }).limit(150),

    supabase
      .from('matches').select('*')
      .in('league_id', leagueIds)
      .in('status', ['FT', 'PST', 'CANC'])
      .gte('kickoff_time', completedSince)
      .order('kickoff_time', { ascending: false }).limit(50),
  ]);

  if (liveRes.error) throw liveRes.error;
  if (upcomingRes.error) throw upcomingRes.error;
  if (completedRes.error) throw completedRes.error;

  // Merge & deduplicate
  const seen = new Set<string>();
  const all: Match[] = [];
  for (const m of [
    ...(liveRes.data ?? []),
    ...(upcomingRes.data ?? []),
    ...(completedRes.data ?? []),
  ] as Match[]) {
    if (!seen.has(m.id)) { seen.add(m.id); all.push(m); }
  }

  // Sort: live first, then upcoming ascending, then completed descending
  const liveSet = new Set(['1H', 'HT', '2H']);
  const doneSet = new Set(['FT', 'PST', 'CANC']);
  all.sort((a, b) => {
    const aLive = liveSet.has(a.status), bLive = liveSet.has(b.status);
    const aDone = doneSet.has(a.status), bDone = doneSet.has(b.status);
    if (aLive !== bLive) return aLive ? -1 : 1;
    if (aDone !== bDone) return aDone ? 1 : -1;
    return new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime();
  });

  return all;
}

export function useMatches(statusFilter: StatusFilter = 'all') {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true); // starts true — waits for groups
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const { activeGroupId, groups, loading: groupsLoading } = useGroupStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeLeagues = activeGroup?.active_leagues ?? [];
  // Stable key — only changes when leagues actually change
  const leaguesKey = [...activeLeagues].sort().join(',');

  const fetchMatches = useCallback(async () => {
    // No group selected at all
    if (!activeGroupId) {
      setMatches([]);
      setLoading(false);
      return;
    }

    // Groups still being fetched from Supabase — keep spinner
    if (groupsLoading) {
      setLoading(true);
      return;
    }

    // Groups loaded but no leagues configured (stale ID or unconfigured group)
    if (activeLeagues.length === 0) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await queryMatches(activeLeagues, statusFilter);
      setMatches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, leaguesKey, statusFilter, groupsLoading]);

  // Subscribe to live match updates
  const subscribeToMatches = useCallback(() => {
    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`matches-${leaguesKey}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (payload) => {
        setMatches(prev =>
          prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } as Match : m)
        );
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
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      channelRef.current?.unsubscribe();
    };
  }, [fetchMatches, subscribeToMatches]);

  return { matches, loading, error, refetch: fetchMatches };
}
