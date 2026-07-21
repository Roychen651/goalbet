import { useQuery } from '@tanstack/react-query';
import { supabase, type GlobalUserStanding } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

// V6 Sprint 48 — "The Global Arena." Reads global_user_standings
// (migration 066), a materialized view refreshed by pg_cron every ~15
// minutes — deliberately NOT real-time (rule stated in the migration
// itself: a read-mostly cache for a platform-wide summary stat, not a
// live score feed). staleTime here is a client-side half of that same
// freshness contract, matching useStatsArena.ts's own precedent of
// picking a staleTime that fits the DATA's real cadence rather than
// defaulting to "as fresh as possible."
const STALE_TIME_MS = 5 * 60 * 1000;

export function useGlobalArena() {
  const { user } = useAuthStore();

  const query = useQuery({
    queryKey: ['globalArena'],
    queryFn: async (): Promise<GlobalUserStanding[]> => {
      const { data, error } = await supabase
        .from('global_user_standings')
        .select('*')
        .eq('is_ranked', true)
        .order('avg_points_per_prediction', { ascending: false });
      if (error) throw error;
      return (data ?? []) as GlobalUserStanding[];
    },
    staleTime: STALE_TIME_MS,
  });

  const entries = query.data ?? [];
  const myEntry = user ? entries.find((e) => e.user_id === user.id) ?? null : null;
  const myRank = myEntry ? entries.findIndex((e) => e.user_id === user!.id) + 1 : null;

  return {
    entries,
    myEntry,
    myRank,
    loading: query.isLoading,
    error: query.isError,
  };
}
