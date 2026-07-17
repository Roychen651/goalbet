import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check your .env.local file.');
}

// V5 Sprint 33 — mirrors backend/src/services/matchOracle.ts's TeamForm/
// OracleStats shape exactly. The JSONB column has no DB-enforced schema, so
// this type is a trust boundary: it describes what compute_team_recent_form()
// (migration 053) actually writes, not something Postgres itself guarantees.
export interface OracleTeamForm {
  wins: number;
  draws: number;
  losses: number;
  over25_pct: number;
  btts_pct: number;
  sample_size: number;
}

export interface OracleStats {
  home: OracleTeamForm;
  away: OracleTeamForm;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          created_at: string;
          group_id: string | null;
          // V4 Sprint 24 — migration 047. Default 'unspecified'; drives
          // tg()'s gendered copy across notifications/Locker Room/AI text.
          gender: 'male' | 'female' | 'unspecified';
          // V5 Sprint 37 — migration 057. unlocked_cosmetics is populated
          // ONLY by purchase_cosmetic_item(); active_cosmetics ONLY by
          // equip_cosmetic() — both columns are REVOKEd from direct client
          // UPDATE (see the migration's own comment), so Update below
          // must never actually be used for these two fields even though
          // the type doesn't statically forbid it.
          unlocked_cosmetics: string[];
          active_cosmetics: { frame?: string | null; halo?: string | null; badge?: string | null };
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      groups: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_by: string | null;
          active_leagues: number[];
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['groups']['Row'], 'id' | 'created_at' | 'invite_code'>;
        Update: Partial<Database['public']['Tables']['groups']['Insert']>;
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          joined_at: string;
          coins: number;
          last_daily_bonus_date: string | null;
        };
        Insert: Omit<Database['public']['Tables']['group_members']['Row'], 'joined_at' | 'coins' | 'last_daily_bonus_date'>;
        Update: never;
      };
      matches: {
        Row: {
          id: string;
          external_id: string;
          league_id: number;
          league_name: string;
          home_team: string;
          away_team: string;
          home_team_badge: string | null;
          away_team_badge: string | null;
          kickoff_time: string;
          status: string;
          home_score: number | null;
          away_score: number | null;
          halftime_home: number | null;
          halftime_away: number | null;
          display_clock: string | null;
          corners_total: number | null;
          regulation_home: number | null;
          regulation_away: number | null;
          went_to_penalties: boolean;
          penalty_home: number | null;
          penalty_away: number | null;
          red_cards_home: number | null;
          red_cards_away: number | null;
          corners_supported: boolean | null;
          season: string | null;
          round: string | null;
          updated_at: string;
          ai_pre_match_insight: string | null;
          ai_pre_match_insight_he: string | null;
          ai_post_match_summary: string | null;
          ai_post_match_summary_he: string | null;
          ai_ht_insight: string | null;
          ai_ht_insight_he: string | null;
          oracle_stats: OracleStats | null;
          ai_oracle_insight: string | null;
          ai_oracle_insight_he: string | null;
        };
        Insert: never;
        Update: never;
      };
      user_chronicles: {
        Row: {
          id: string;
          user_id: string;
          match_id: string;
          group_id: string | null;
          title: string;
          epic_text: string;
          epic_text_he: string | null;
          predicted_home: number | null;
          predicted_away: number | null;
          final_home: number | null;
          final_away: number | null;
          points_earned: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
      predictions: {
        Row: {
          id: string;
          user_id: string;
          match_id: string;
          group_id: string;
          predicted_outcome: 'H' | 'D' | 'A' | null;
          predicted_home_score: number | null;
          predicted_away_score: number | null;
          predicted_halftime_outcome: 'H' | 'D' | 'A' | null;
          predicted_halftime_home: number | null;
          predicted_halftime_away: number | null;
          predicted_btts: boolean | null;
          predicted_over_under: 'over' | 'under' | null;
          points_earned: number;
          streak_bonus_earned: number;
          halftime_pts_earned: number | null;
          predicted_corners: 'under9' | 'ten' | 'over11' | null;
          coins_bet: number;
          is_resolved: boolean;
          created_at: string;
          is_parlay: boolean;
          parlay_linked_tiers: ('result' | 'score' | 'corners' | 'btts' | 'ou')[] | null;
        };
        Insert: Omit<Database['public']['Tables']['predictions']['Row'], 'id' | 'created_at' | 'points_earned' | 'streak_bonus_earned' | 'halftime_pts_earned' | 'is_resolved'>;
        Update: Partial<Database['public']['Tables']['predictions']['Insert']>;
      };
      leaderboard: {
        Row: {
          id: string;
          user_id: string;
          group_id: string;
          total_points: number;
          weekly_points: number;
          last_week_points: number;
          predictions_made: number;
          correct_predictions: number;
          current_streak: number;
          best_streak: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
      };
      // V5 Sprint 36 — "The Social Syndicate". All three tables below are
      // RPC-managed only (contribute_to_pool / create_syndicate_pool /
      // challenge_group / respond_to_battle, or the backend service role) —
      // Insert/Update are `never` here, same convention as `leaderboard`.
      syndicate_pools: {
        Row: {
          id: string;
          match_id: string;
          group_id: string;
          created_by: string;
          target_prediction: {
            predicted_outcome: 'H' | 'D' | 'A' | null;
            predicted_home_score: number | null;
            predicted_away_score: number | null;
            predicted_corners: 'under9' | 'ten' | 'over11' | null;
            predicted_btts: boolean | null;
            predicted_over_under: 'over' | 'under' | null;
            is_parlay?: boolean | null;
            parlay_linked_tiers?: ('result' | 'score' | 'corners' | 'btts' | 'ou')[] | null;
          };
          total_staked: number;
          status: 'open' | 'locked' | 'resolved' | 'refunded';
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
      pool_contributions: {
        Row: {
          id: string;
          pool_id: string;
          user_id: string;
          amount: number;
          settled_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
      group_battles: {
        Row: {
          id: string;
          challenger_group_id: string;
          defender_group_id: string;
          start_time: string;
          end_time: string;
          status: 'pending' | 'active' | 'declined' | 'completed';
          challenger_score: number | null;
          defender_score: number | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
    };
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Group = Database['public']['Tables']['groups']['Row'];
export type GroupMember = Database['public']['Tables']['group_members']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type Prediction = Database['public']['Tables']['predictions']['Row'];
export type LeaderboardEntry = Database['public']['Tables']['leaderboard']['Row'];
export type SyndicatePool = Database['public']['Tables']['syndicate_pools']['Row'];
export type PoolContribution = Database['public']['Tables']['pool_contributions']['Row'];
export type GroupBattle = Database['public']['Tables']['group_battles']['Row'];
export type Chronicle = Database['public']['Tables']['user_chronicles']['Row'];

export interface LeaderboardEntryWithProfile extends LeaderboardEntry {
  rank: number;
  username: string;
  avatar_url: string | null;
  accuracy: number;
  live_points?: number; // potential points from unresolved live predictions right now
  // V5 Sprint 37 — joined from profiles alongside username/avatar_url.
  active_cosmetics?: Profile['active_cosmetics'] | null;
}
