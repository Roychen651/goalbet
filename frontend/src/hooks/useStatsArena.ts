import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';

export interface ArenaHeatmapCell {
  league_id: number;
  league_name: string;
  bet_type: 'full_match' | 'momentum';
  sample_size: number;
  insufficient_data: boolean;
  win_ratio: number | null;
}

export interface ArenaDistribution {
  avg_stake: number;
  group_avg_stake: number;
  group_stddev_stake: number;
  current_streak: number;
  best_streak: number;
  risk_score: number;
}

export interface ArenaH2HRow {
  opponent_id: string;
  username: string;
  avatar_url: string | null;
  shared_matches: number;
  user_points: number;
  opponent_points: number;
  user_wins: number;
  opponent_wins: number;
  ties: number;
}

export interface StatsArenaPayload {
  heatmap: ArenaHeatmapCell[];
  distribution: ArenaDistribution;
  h2h_matrix: ArenaH2HRow[];
}

// This data moves at the pace of match resolutions, not live scores, so it
// deliberately sits outside AppShell's auto-sync (rule 4.3) — a 2-minute
// staleTime + manual refetch is the right cadence, not a 30s poll.
const STALE_TIME_MS = 2 * 60 * 1000;

export function useStatsArena() {
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();

  return useQuery<StatsArenaPayload>({
    queryKey: ['statsArena', user?.id, activeGroupId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_stats_arena_payload', {
        p_user_id: user!.id,
        p_group_id: activeGroupId!,
      });
      if (error) throw error;
      return data as StatsArenaPayload;
    },
    enabled: !!user?.id && !!activeGroupId,
    staleTime: STALE_TIME_MS,
  });
}
