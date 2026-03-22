import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, LeaderboardEntryWithProfile, Match, Prediction } from '../lib/supabase';
import { useGroupStore } from '../stores/groupStore';
import { calcLiveBreakdown } from '../lib/utils';

export type LeaderboardType = 'total' | 'weekly' | 'lastWeek';

// Sun-start week bounds (ISO strings). Each week runs Sun 00:00 UTC → next Sun 00:00 UTC.
// Predictions are counted in the week where their match's kickoff_time falls.
function getWeekBoundsISO(type: 'weekly' | 'lastWeek'): { start: string; end: string } {
  const now = new Date();
  const thisSunday = new Date(now);
  thisSunday.setUTCDate(now.getUTCDate() - now.getUTCDay());
  thisSunday.setUTCHours(0, 0, 0, 0);

  const lastSunday = new Date(thisSunday);
  lastSunday.setUTCDate(thisSunday.getUTCDate() - 7);
  const nextSunday = new Date(thisSunday);
  nextSunday.setUTCDate(thisSunday.getUTCDate() + 7);

  return type === 'weekly'
    ? { start: thisSunday.toISOString(), end: nextSunday.toISOString() }
    : { start: lastSunday.toISOString(), end: thisSunday.toISOString() };
}

// Fetch leaderboard using direct table queries — shows ALL group members including 0-point users.
// Does not depend on the get_group_leaderboard RPC being up to date.
async function fetchGroupLeaderboard(
  groupId: string,
  type: LeaderboardType,
): Promise<LeaderboardEntryWithProfile[]> {
  // 1. Get all group members
  const { data: members, error: membersErr } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);
  if (membersErr) throw membersErr;

  const userIds = (members ?? []).map(m => m.user_id);
  if (userIds.length === 0) return [];

  // 2. Fetch profiles + leaderboard rows in parallel
  const [profilesRes, lbRes] = await Promise.all([
    supabase.from('profiles').select('id, username, avatar_url').in('id', userIds),
    supabase.from('leaderboard').select('*').eq('group_id', groupId),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (lbRes.error) throw lbRes.error;

  const lbMap = new Map((lbRes.data ?? []).map(l => [l.user_id, l]));

  // 3. Compute period points from predictions (source of truth) for weekly/lastWeek.
  //    The leaderboard.weekly_points column depends on a backend cron that may not fire
  //    reliably on a free-tier server that sleeps. Reading from predictions directly
  //    guarantees correctness regardless of whether the reset cron ran.
  let weeklyPointsMap: Map<string, number> | null = null;
  let lastWeekPointsMap: Map<string, number> | null = null;

  if (type === 'weekly' || type === 'lastWeek') {
    const targetType = type;
    const { start, end } = getWeekBoundsISO(targetType);

    const { data: weekMatches } = await supabase
      .from('matches')
      .select('id')
      .gte('kickoff_time', start)
      .lt('kickoff_time', end);

    const matchIds = (weekMatches ?? []).map((m: { id: string }) => m.id);
    const pointsMap = new Map<string, number>();

    if (matchIds.length > 0) {
      const { data: weekPreds } = await supabase
        .from('predictions')
        .select('user_id, points_earned')
        .eq('group_id', groupId)
        .eq('is_resolved', true)
        .in('match_id', matchIds);

      for (const pred of (weekPreds ?? []) as { user_id: string; points_earned: number }[]) {
        pointsMap.set(pred.user_id, (pointsMap.get(pred.user_id) ?? 0) + pred.points_earned);
      }
    }

    if (targetType === 'weekly') weeklyPointsMap = pointsMap;
    else lastWeekPointsMap = pointsMap;
  }

  // 4. Merge — every member gets an entry; non-leaderboard members get 0s
  const sortField = type === 'weekly' ? 'weekly_points'
    : type === 'lastWeek' ? 'last_week_points'
    : 'total_points';

  const merged: LeaderboardEntryWithProfile[] = (profilesRes.data ?? []).map(profile => {
    const lb = lbMap.get(profile.id);
    // Use prediction-computed period points when available (correct regardless of cron state).
    // Fall back to leaderboard column only for 'total' type.
    const computedWeekly = weeklyPointsMap?.get(profile.id) ?? (weeklyPointsMap ? 0 : (lb?.weekly_points ?? 0));
    const computedLastWeek = lastWeekPointsMap?.get(profile.id) ?? (lastWeekPointsMap ? 0 : (lb?.last_week_points ?? 0));
    return {
      id: lb?.id ?? profile.id,
      user_id: profile.id,
      group_id: groupId,
      username: profile.username,
      avatar_url: profile.avatar_url,
      total_points: lb?.total_points ?? 0,
      weekly_points: computedWeekly,
      last_week_points: computedLastWeek,
      predictions_made: lb?.predictions_made ?? 0,
      correct_predictions: lb?.correct_predictions ?? 0,
      current_streak: lb?.current_streak ?? 0,
      best_streak: lb?.best_streak ?? 0,
      updated_at: lb?.updated_at ?? new Date().toISOString(),
      accuracy: lb?.predictions_made
        ? Math.round((lb.correct_predictions / lb.predictions_made) * 1000) / 10
        : 0,
      rank: 0,
    };
  });

  // Sort by chosen field desc, then total_points, then username
  merged.sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortField] as number ?? 0;
    const bVal = (b as unknown as Record<string, unknown>)[sortField] as number ?? 0;
    if (bVal !== aVal) return bVal - aVal;
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    return a.username.localeCompare(b.username);
  });

  const ranked = merged.map((e, i) => ({ ...e, rank: i + 1 }));

  // Overlay live points: fetch live matches + their unresolved predictions for this group
  try {
    const { data: liveMatches } = await supabase
      .from('matches')
      .select('*')
      .in('status', ['1H', 'HT', '2H'])
      .not('home_score', 'is', null);

    if (liveMatches && liveMatches.length > 0) {
      const liveMatchIds = liveMatches.map((m: Match) => m.id);
      const { data: livePreds } = await supabase
        .from('predictions')
        .select('*')
        .eq('group_id', groupId)
        .in('match_id', liveMatchIds)
        .eq('is_resolved', false);

      if (livePreds && livePreds.length > 0) {
        const matchMap = new Map(liveMatches.map((m: Match) => [m.id, m]));
        const predsByUser = new Map<string, Prediction[]>();
        for (const pred of livePreds as Prediction[]) {
          if (!predsByUser.has(pred.user_id)) predsByUser.set(pred.user_id, []);
          predsByUser.get(pred.user_id)!.push(pred);
        }
        let hasLive = false;
        for (const entry of ranked) {
          const userPreds = predsByUser.get(entry.user_id) ?? [];
          let live = 0;
          for (const pred of userPreds) {
            const match = matchMap.get(pred.match_id) as Match | undefined;
            if (match) {
              const breakdown = calcLiveBreakdown(pred, match);
              live += breakdown?.filter(r => r.earned).reduce((s, r) => s + r.pts, 0) ?? 0;
            }
          }
          entry.live_points = live;
          if (live > 0) hasLive = true;
        }

        // Re-sort positions by stored + live so rankings shift in real-time
        if (hasLive) {
          ranked.sort((a, b) => {
            const aTotal = ((a[sortField as keyof typeof a] as number) ?? 0) + (a.live_points ?? 0);
            const bTotal = ((b[sortField as keyof typeof b] as number) ?? 0) + (b.live_points ?? 0);
            if (bTotal !== aTotal) return bTotal - aTotal;
            if (b.total_points !== a.total_points) return b.total_points - a.total_points;
            return a.username.localeCompare(b.username);
          });
          ranked.forEach((e, i) => { e.rank = i + 1; });
        }
      }
    }
  } catch {
    // live overlay is best-effort — don't break leaderboard if it fails
  }

  return ranked;
}

export function useLeaderboard(type: LeaderboardType = 'total') {
  const [entries, setEntries] = useState<LeaderboardEntryWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeGroupId } = useGroupStore();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    if (!activeGroupId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchGroupLeaderboard(activeGroupId, type);
      setEntries(data);
    } catch (err) {
      console.error('[useLeaderboard] fetch failed:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [activeGroupId, type]);

  const subscribeToLeaderboard = useCallback(() => {
    if (!activeGroupId) return;
    channelRef.current?.unsubscribe();
    // Only subscribe to leaderboard row changes (real points awarded by backend).
    // Do NOT subscribe to match updates — the backend polls every 30s and fires
    // dozens of match UPDATEs which would cause constant re-fetches and re-renders.
    channelRef.current = supabase
      .channel(`leaderboard-${activeGroupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leaderboard',
        filter: `group_id=eq.${activeGroupId}`,
      }, () => { fetchLeaderboard(); })
      .subscribe();
  }, [activeGroupId, fetchLeaderboard]);

  useEffect(() => {
    fetchLeaderboard();
    subscribeToLeaderboard();

    const handleVisibilityChange = () => {
      if (!document.hidden) { fetchLeaderboard(); subscribeToLeaderboard(); }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      channelRef.current?.unsubscribe();
    };
  }, [fetchLeaderboard, subscribeToLeaderboard]);

  return { entries, loading, refetch: fetchLeaderboard };
}
