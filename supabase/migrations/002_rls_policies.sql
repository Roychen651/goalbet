-- GoalBet Row Level Security Policies
-- Run this after 001_initial_schema.sql

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;
alter table leaderboard enable row level security;

-- ============================================================
-- PROFILES policies
-- ============================================================
-- Anyone can read profiles (needed for leaderboard avatars/names)
create policy "profiles_read_all"
  on profiles for select
  using (true);

-- Users can only update their own profile
create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id);

-- Profile is inserted automatically by trigger (see 003_functions_triggers.sql)
-- But allow manual insert too for the trigger to work with security definer
create policy "profiles_insert_own"
  on profiles for insert
  with check (auth.uid() = id);

-- ============================================================
-- GROUPS policies
-- ============================================================
-- Members can read groups they belong to
create policy "groups_read_member"
  on groups for select
  using (
    id in (
      select group_id from group_members where user_id = auth.uid()
    )
  );

-- Any authenticated user can create a group
create policy "groups_insert_auth"
  on groups for insert
  with check (auth.uid() is not null);

-- Only group creator can update group settings
create policy "groups_update_creator"
  on groups for update
  using (created_by = auth.uid());

-- ============================================================
-- GROUP_MEMBERS policies
-- ============================================================
-- Members can see other members in their groups
create policy "group_members_read"
  on group_members for select
  using (
    group_id in (
      select group_id from group_members where user_id = auth.uid()
    )
  );

-- Users can join a group (insert themselves)
create policy "group_members_insert_self"
  on group_members for insert
  with check (user_id = auth.uid());

-- Users can leave a group (delete their own membership)
create policy "group_members_delete_self"
  on group_members for delete
  using (user_id = auth.uid());

-- ============================================================
-- MATCHES policies
-- ============================================================
-- Matches are public read (anyone logged in can see matches)
create policy "matches_read_all"
  on matches for select
  using (true);

-- Only service role (backend) can write matches — no client insert policy
-- Backend uses service_role key which bypasses RLS

-- ============================================================
-- PREDICTIONS policies
-- ============================================================
-- Users can read predictions from their groups (for leaderboard comparison)
create policy "predictions_read_group"
  on predictions for select
  using (
    group_id in (
      select group_id from group_members where user_id = auth.uid()
    )
  );

-- Users can only insert their own predictions
create policy "predictions_insert_own"
  on predictions for insert
  with check (user_id = auth.uid());

-- Users can update their own unresolved predictions
create policy "predictions_update_own"
  on predictions for update
  using (user_id = auth.uid() and is_resolved = false);

-- ============================================================
-- LEADERBOARD policies
-- ============================================================
-- Group members can read the leaderboard for their groups
create policy "leaderboard_read_group"
  on leaderboard for select
  using (
    group_id in (
      select group_id from group_members where user_id = auth.uid()
    )
  );

-- Only service role (backend) writes leaderboard
