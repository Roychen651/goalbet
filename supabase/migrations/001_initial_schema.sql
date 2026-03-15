-- GoalBet Initial Schema
-- Run this first in your Supabase SQL editor

create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  created_at timestamptz default now(),
  group_id uuid  -- soft reference to last active group
);

-- ============================================================
-- GROUPS
-- ============================================================
create table groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  invite_code text unique not null default upper(substring(md5(random()::text), 1, 8)),
  created_by uuid references profiles(id),
  active_leagues integer[] default '{}',
  created_at timestamptz default now()
);

-- ============================================================
-- GROUP MEMBERS (many-to-many)
-- ============================================================
create table group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- ============================================================
-- MATCHES (sourced from TheSportsDB)
-- ============================================================
create table matches (
  id uuid primary key default uuid_generate_v4(),
  external_id text unique not null,    -- TheSportsDB idEvent
  league_id integer not null,
  league_name text not null,
  home_team text not null,
  away_team text not null,
  home_team_badge text,
  away_team_badge text,
  kickoff_time timestamptz not null,
  status text not null default 'NS',   -- NS | 1H | HT | 2H | FT | PST | CANC
  home_score integer,
  away_score integer,
  halftime_home integer,
  halftime_away integer,
  season text,
  round text,
  updated_at timestamptz default now()
);

create index idx_matches_league_id on matches(league_id);
create index idx_matches_kickoff on matches(kickoff_time);
create index idx_matches_status on matches(status);
create index idx_matches_external_id on matches(external_id);

-- ============================================================
-- PREDICTIONS
-- ============================================================
create table predictions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  match_id uuid references matches(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  -- Tier 1: Full Time Outcome
  predicted_outcome text check (predicted_outcome in ('H', 'D', 'A')),
  -- Tier 2: Exact Score
  predicted_home_score integer,
  predicted_away_score integer,
  -- Tier 3: Halftime Result
  predicted_halftime_outcome text check (predicted_halftime_outcome in ('H', 'D', 'A')),
  predicted_halftime_home integer,
  predicted_halftime_away integer,
  -- Tier 5: Both Teams To Score
  predicted_btts boolean,
  -- Tier 6: Over/Under 2.5
  predicted_over_under text check (predicted_over_under in ('over', 'under')),
  -- Resolution
  points_earned integer default 0,
  is_resolved boolean default false,
  created_at timestamptz default now(),
  unique(user_id, match_id, group_id)
);

create index idx_predictions_user_match on predictions(user_id, match_id);
create index idx_predictions_group on predictions(group_id);
create index idx_predictions_unresolved on predictions(match_id) where is_resolved = false;

-- ============================================================
-- LEADERBOARD (materialized per group)
-- ============================================================
create table leaderboard (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  total_points integer default 0,
  weekly_points integer default 0,
  predictions_made integer default 0,
  correct_predictions integer default 0,
  current_streak integer default 0,
  best_streak integer default 0,
  updated_at timestamptz default now(),
  unique(user_id, group_id)
);

create index idx_leaderboard_group on leaderboard(group_id, total_points desc);
create index idx_leaderboard_weekly on leaderboard(group_id, weekly_points desc);
