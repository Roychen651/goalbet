-- ============================================================
-- GoalBet — PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR
-- Then click RUN (or Cmd+Enter)
-- ============================================================

create extension if not exists "uuid-ossp";

-- PROFILES
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  created_at timestamptz default now(),
  group_id uuid
);

-- GROUPS
create table groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  invite_code text unique not null default upper(substring(md5(random()::text), 1, 8)),
  created_by uuid references profiles(id),
  active_leagues integer[] default '{}',
  created_at timestamptz default now()
);

-- GROUP MEMBERS
create table group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- MATCHES
create table matches (
  id uuid primary key default uuid_generate_v4(),
  external_id text unique not null,
  league_id integer not null,
  league_name text not null,
  home_team text not null,
  away_team text not null,
  home_team_badge text,
  away_team_badge text,
  kickoff_time timestamptz not null,
  status text not null default 'NS',
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

-- PREDICTIONS
create table predictions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  match_id uuid references matches(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  predicted_outcome text check (predicted_outcome in ('H', 'D', 'A')),
  predicted_home_score integer,
  predicted_away_score integer,
  predicted_halftime_outcome text check (predicted_halftime_outcome in ('H', 'D', 'A')),
  predicted_halftime_home integer,
  predicted_halftime_away integer,
  predicted_btts boolean,
  predicted_over_under text check (predicted_over_under in ('over', 'under')),
  points_earned integer default 0,
  is_resolved boolean default false,
  created_at timestamptz default now(),
  unique(user_id, match_id, group_id)
);
create index idx_predictions_user_match on predictions(user_id, match_id);
create index idx_predictions_group on predictions(group_id);
create index idx_predictions_unresolved on predictions(match_id) where is_resolved = false;

-- LEADERBOARD
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

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;
alter table leaderboard enable row level security;

create policy "profiles_read_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

create policy "groups_read_member" on groups for select
  using (id in (select group_id from group_members where user_id = auth.uid()));
create policy "groups_insert_auth" on groups for insert with check (auth.uid() is not null);
create policy "groups_update_creator" on groups for update using (created_by = auth.uid());

create policy "group_members_read" on group_members for select
  using (group_id in (select group_id from group_members where user_id = auth.uid()));
create policy "group_members_insert_self" on group_members for insert with check (user_id = auth.uid());
create policy "group_members_delete_self" on group_members for delete using (user_id = auth.uid());

create policy "matches_read_all" on matches for select using (true);

create policy "predictions_read_group" on predictions for select
  using (group_id in (select group_id from group_members where user_id = auth.uid()));
create policy "predictions_insert_own" on predictions for insert with check (user_id = auth.uid());
create policy "predictions_update_own" on predictions for update
  using (user_id = auth.uid() and is_resolved = false);

create policy "leaderboard_read_group" on leaderboard for select
  using (group_id in (select group_id from group_members where user_id = auth.uid()));

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Auto-update timestamps
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger matches_updated_at before update on matches for each row execute procedure set_updated_at();
create trigger leaderboard_updated_at before update on leaderboard for each row execute procedure set_updated_at();

-- Lock predictions after kickoff
create or replace function prevent_late_prediction()
returns trigger language plpgsql as $$
declare match_kickoff timestamptz; match_status text;
begin
  select kickoff_time, status into match_kickoff, match_status from matches where id = new.match_id;
  if match_status != 'NS' or match_kickoff <= now() then
    raise exception 'Predictions are locked after kickoff';
  end if;
  return new;
end; $$;

create trigger lock_predictions_at_kickoff
  before insert or update on predictions
  for each row execute procedure prevent_late_prediction();

-- Enable Realtime
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table leaderboard;
alter publication supabase_realtime add table predictions;

-- Leaderboard helper function
create or replace function get_group_leaderboard(p_group_id uuid)
returns table (rank bigint, user_id uuid, username text, avatar_url text,
  total_points integer, weekly_points integer, predictions_made integer,
  correct_predictions integer, current_streak integer, best_streak integer, accuracy numeric)
language sql security definer as $$
  select
    row_number() over (order by l.total_points desc, l.correct_predictions desc) as rank,
    l.user_id, p.username, p.avatar_url, l.total_points, l.weekly_points,
    l.predictions_made, l.correct_predictions, l.current_streak, l.best_streak,
    case when l.predictions_made > 0
      then round((l.correct_predictions::numeric / l.predictions_made::numeric) * 100, 1)
      else 0 end as accuracy
  from leaderboard l
  join profiles p on p.id = l.user_id
  where l.group_id = p_group_id
  order by l.total_points desc, l.correct_predictions desc;
$$;
