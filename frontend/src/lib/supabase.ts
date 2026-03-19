import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check your .env.local file.');
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
        };
        Insert: Omit<Database['public']['Tables']['group_members']['Row'], 'joined_at'>;
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
          season: string | null;
          round: string | null;
          updated_at: string;
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
          is_resolved: boolean;
          created_at: string;
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
    };
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Group = Database['public']['Tables']['groups']['Row'];
export type GroupMember = Database['public']['Tables']['group_members']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type Prediction = Database['public']['Tables']['predictions']['Row'];
export type LeaderboardEntry = Database['public']['Tables']['leaderboard']['Row'];

export interface LeaderboardEntryWithProfile extends LeaderboardEntry {
  rank: number;
  username: string;
  avatar_url: string | null;
  accuracy: number;
  live_points?: number; // potential points from unresolved live predictions right now
}
