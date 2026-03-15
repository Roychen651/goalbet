-- GoalBet Functions & Triggers
-- Run this after 002_rls_policies.sql

-- ============================================================
-- AUTO-CREATE PROFILE ON NEW USER SIGNUP
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- AUTO-UPDATE updated_at TIMESTAMPS
-- ============================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger matches_updated_at
  before update on matches
  for each row execute procedure set_updated_at();

create trigger leaderboard_updated_at
  before update on leaderboard
  for each row execute procedure set_updated_at();

-- ============================================================
-- PREVENT PREDICTIONS AFTER KICKOFF (server-side lock)
-- ============================================================
create or replace function prevent_late_prediction()
returns trigger
language plpgsql
as $$
declare
  match_kickoff timestamptz;
  match_status text;
begin
  select kickoff_time, status into match_kickoff, match_status
  from matches
  where id = new.match_id;

  if match_status != 'NS' or match_kickoff <= now() then
    raise exception 'Predictions are locked after kickoff';
  end if;

  return new;
end;
$$;

create trigger lock_predictions_at_kickoff
  before insert or update on predictions
  for each row execute procedure prevent_late_prediction();

-- ============================================================
-- ENABLE SUPABASE REALTIME
-- ============================================================
-- Enable realtime for live score updates and leaderboard changes
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table leaderboard;
alter publication supabase_realtime add table predictions;

-- ============================================================
-- HELPER: Get group leaderboard with profile info
-- ============================================================
create or replace function get_group_leaderboard(p_group_id uuid)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  avatar_url text,
  total_points integer,
  weekly_points integer,
  predictions_made integer,
  correct_predictions integer,
  current_streak integer,
  best_streak integer,
  accuracy numeric
)
language sql
security definer
as $$
  select
    row_number() over (order by l.total_points desc, l.correct_predictions desc) as rank,
    l.user_id,
    p.username,
    p.avatar_url,
    l.total_points,
    l.weekly_points,
    l.predictions_made,
    l.correct_predictions,
    l.current_streak,
    l.best_streak,
    case
      when l.predictions_made > 0
      then round((l.correct_predictions::numeric / l.predictions_made::numeric) * 100, 1)
      else 0
    end as accuracy
  from leaderboard l
  join profiles p on p.id = l.user_id
  where l.group_id = p_group_id
  order by l.total_points desc, l.correct_predictions desc;
$$;
