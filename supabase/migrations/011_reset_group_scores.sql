-- 011_reset_group_scores.sql
-- Admin-only RPC to reset all leaderboard scores in a group.
-- Prediction history (is_resolved, points_earned) is preserved.
-- Only the group creator (admin) can call this.

create or replace function reset_group_scores(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requesting_user uuid;
  v_is_admin boolean;
begin
  v_requesting_user := auth.uid();

  -- Verify caller is the group creator
  select (created_by = v_requesting_user)
  into v_is_admin
  from groups
  where id = p_group_id;

  if not found or not v_is_admin then
    raise exception 'Only the group admin can reset scores';
  end if;

  -- Reset all leaderboard rows for this group to zero
  update leaderboard
  set
    total_points        = 0,
    weekly_points       = 0,
    last_week_points    = 0,
    predictions_made    = 0,
    correct_predictions = 0,
    current_streak      = 0,
    best_streak         = 0,
    updated_at          = now()
  where group_id = p_group_id;
end;
$$;

-- Allow authenticated users to call (admin check enforced inside)
grant execute on function reset_group_scores(uuid) to authenticated;
