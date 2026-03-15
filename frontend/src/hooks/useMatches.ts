import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, Match } from '../lib/supabase';
import { useGroupStore } from '../stores/groupStore';
import { useUIStore } from '../stores/uiStore';

type StatusFilter = 'all' | 'upcoming' | 'live' | 'completed';

const UPCOMING_DAYS = 14;  // show matches up to 14 days ahead
const COMPLETED_DAYS = 7;  // show results from last 7 days

async function queryMatches(leagueIds: number[], statusFilter: StatusFilter): Promise<Match[]> {
  const now = new Date();
  // Buffer: NS matches up to 3h past kickoff are shown as "live/in-progress"
  // because the backend may not have polled TheSportsDB yet to flip them to 1H/HT/2H.
  const liveBufferStart = new Date(now.getTime() - 3 * 3600_000).toISOString();

  if (statusFilter === 'live') {
    // Fetch actual live statuses + NS matches that should be playing (started up to 3h ago)
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
    // Include NS matches from liveBufferStart so a match that just kicked off
    // (but backend hasn't updated status yet) still appears here instead of vanishing.
    const cutoff = new Date(now.getTime() + UPCOMING_DAYS * 86400_000).toISOString();
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .in('league_id', leagueIds)
      .eq('status', 'NS')
      .gte('kickoff_time', liveBufferStart)
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

  const [liveRes, stalledNsRes, upcomingRes, completedRes] = await Promise.all([
    supabase
      .from('matches').select('*')
      .in('league_id', leagueIds)
      .in('status', ['1H', 'HT', '2H'])
      .order('kickoff_time', { ascending: true }).limit(30),

    // NS matches past kickoff (backend hasn't updated status yet) — show as live-ish
    supabase
      .from('matches').select('*')
      .in('league_id', leagueIds)
      .eq('status', 'NS')
      .gte('kickoff_time', liveBufferStart)
      .lte('kickoff_time', now.toISOString())
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
  if (stalledNsRes.error) throw stalledNsRes.error;
  if (upcomingRes.error) throw upcomingRes.error;
  if (completedRes.error) throw completedRes.error;

  // Merge & deduplicate
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

  // Sort: live first, then upcoming by (kickoff asc, league_id asc), then completed desc
  // Grouping by league_id within same kickoff time keeps e.g. all EPL games together
  const liveSet = new Set(['1H', 'HT', '2H']);
  const doneSet = new Set(['FT', 'PST', 'CANC']);
  all.sort((a, b) => {
    const aLive = liveSet.has(a.status) || (a.status === 'NS' && new Date(a.kickoff_time).getTime() < Date.now());
    const bLive = liveSet.has(b.status) || (b.status === 'NS' && new Date(b.kickoff_time).getTime() < Date.now());
    const aDone = doneSet.has(a.status), bDone = doneSet.has(b.status);
    if (aLive !== bLive) return aLive ? -1 : 1;
    if (aDone !== bDone) return aDone ? 1 : -1;
    const timeDiff = new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime();
    if (timeDiff !== 0) return timeDiff;
    // Same kickoff time — group by league so same-competition games are adjacent
    return a.league_id - b.league_id;
  });

  return all;
}

export function useMatches(statusFilter: StatusFilter = 'all') {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true); // starts true — waits for groups
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const { activeGroupId, groups, loading: groupsLoading } = useGroupStore();
  const { addToast } = useUIStore();
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeLeagues = activeGroup?.active_leagues ?? [];
  // Track loaded state so we don't fire goal toasts on initial load
  const initialLoadDone = useRef(false);
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
      initialLoadDone.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, leaguesKey, statusFilter, groupsLoading]);

  // Subscribe to live match updates + fire goal toasts
  const subscribeToMatches = useCallback(() => {
    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`matches-${leaguesKey}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (payload) => {
        const updated = payload.new as Match;
        const prev = payload.old as Partial<Match>;

        // Goal notification — only after initial load, only for in-progress matches
        if (initialLoadDone.current && !['NS', 'FT', 'PST', 'CANC'].includes(updated.status)) {
          const homeGoal = (updated.home_score ?? 0) > (prev.home_score ?? 0);
          const awayGoal = (updated.away_score ?? 0) > (prev.away_score ?? 0);
          if (homeGoal || awayGoal) {
            addToast(
              `⚽ ${updated.home_team} ${updated.home_score} — ${updated.away_score} ${updated.away_team}`,
              'success',
            );
          }
        }

        setMatches(prev =>
          prev.map(m => m.id === updated.id ? { ...m, ...updated } as Match : m)
        );
      })
      .subscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaguesKey, addToast]);

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
