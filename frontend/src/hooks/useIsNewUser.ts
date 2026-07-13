import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';

/**
 * Authoritative "has this user ever predicted in the active group?" signal for
 * progressive disclosure — reads the single leaderboard row's predictions_made.
 * Returns true only for a genuine first-timer (predictions_made === 0).
 *
 * Cheap: one row, cached 60s. Consumers combine this with the in-session
 * predictions Map so tiers unlock the instant the first pick is placed
 * (predictions_made lags behind an optimistic write).
 */
export function useNeverPredicted(): boolean {
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();

  const { data } = useQuery({
    queryKey: ['my-predictions-made', user?.id ?? null, activeGroupId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('predictions_made')
        .eq('user_id', user!.id)
        .eq('group_id', activeGroupId!)
        .maybeSingle();
      if (error) throw error;
      return data?.predictions_made ?? 0;
    },
    enabled: !!user && !!activeGroupId,
    staleTime: 60_000,
  });

  return (data ?? 0) === 0;
}
