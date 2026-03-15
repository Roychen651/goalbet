-- GoalBet Migration 006: Show ALL group members on leaderboard (including 0-point users)
-- Problem: get_group_leaderboard did `FROM leaderboard JOIN profiles` which excludes
--          members who haven't earned any points yet (no row in leaderboard table).
-- Fix: LEFT JOIN from group_members so every member appears, with 0 for nulls.

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
    row_number() over (
      order by coalesce(l.total_points, 0) desc,
               coalesce(l.correct_predictions, 0) desc,
               p.username asc
    ) as rank,
    p.id as user_id,
    p.username,
    p.avatar_url,
    coalesce(l.total_points, 0)        as total_points,
    coalesce(l.weekly_points, 0)       as weekly_points,
    coalesce(l.predictions_made, 0)    as predictions_made,
    coalesce(l.correct_predictions, 0) as correct_predictions,
    coalesce(l.current_streak, 0)      as current_streak,
    coalesce(l.best_streak, 0)         as best_streak,
    case
      when coalesce(l.predictions_made, 0) > 0
      then round((coalesce(l.correct_predictions, 0)::numeric / l.predictions_made::numeric) * 100, 1)
      else 0
    end as accuracy
  from group_members gm
  join profiles p on p.id = gm.user_id
  left join leaderboard l
    on l.user_id = gm.user_id
    and l.group_id = gm.group_id
  where gm.group_id = p_group_id
  order by
    coalesce(l.total_points, 0) desc,
    coalesce(l.correct_predictions, 0) desc,
    p.username asc;
$$;
