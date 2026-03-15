-- ============================================================
-- GoalBet — Migration 004: Bug fixes & helpers
-- Paste into Supabase SQL Editor and run
-- ============================================================

-- ============================================================
-- 1. SECURITY DEFINER helper to avoid RLS recursion on group_members
-- ============================================================
create or replace function get_my_group_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select group_id from group_members where user_id = auth.uid();
$$;

-- Recreate policies to use the SECURITY DEFINER function (no infinite recursion)
drop policy if exists "group_members_read" on group_members;
create policy "group_members_read" on group_members for select
  using (group_id in (select get_my_group_ids()));

drop policy if exists "groups_read_member" on groups;
create policy "groups_read_member" on groups for select
  using (created_by = auth.uid() or id in (select get_my_group_ids()));

drop policy if exists "predictions_read_group" on predictions;
create policy "predictions_read_group" on predictions for select
  using (group_id in (select get_my_group_ids()));

drop policy if exists "leaderboard_read_group" on leaderboard;
create policy "leaderboard_read_group" on leaderboard for select
  using (group_id in (select get_my_group_ids()));

-- ============================================================
-- 2. Fix prediction lock: 15 minutes BEFORE kickoff (not at kickoff)
-- ============================================================
create or replace function prevent_late_prediction()
returns trigger
language plpgsql
as $$
declare
  match_kickoff timestamptz;
  match_status  text;
begin
  select kickoff_time, status
  into match_kickoff, match_status
  from matches
  where id = new.match_id;

  -- Lock 15 minutes before kickoff
  if match_status != 'NS' or match_kickoff <= now() + interval '15 minutes' then
    raise exception 'Predictions are locked 15 minutes before kickoff';
  end if;

  return new;
end;
$$;

-- ============================================================
-- 3. find_group_by_invite_code — needed for joining groups
--    (direct SELECT on groups is blocked by RLS when user not yet a member)
-- ============================================================
create or replace function find_group_by_invite_code(p_code text)
returns setof groups
language sql
security definer
stable
set search_path = public
as $$
  select * from groups where invite_code = upper(trim(p_code)) limit 1;
$$;

-- ============================================================
-- 4. Get count of matches per league (useful for debugging)
-- ============================================================
create or replace function get_match_counts()
returns table(league_id integer, league_name text, total bigint, upcoming bigint, finished bigint)
language sql
security definer
as $$
  select
    league_id,
    league_name,
    count(*) as total,
    count(*) filter (where status = 'NS') as upcoming,
    count(*) filter (where status in ('FT','PST','CANC')) as finished
  from matches
  group by league_id, league_name
  order by league_name;
$$;
