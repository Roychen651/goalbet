-- ============================================================
-- GoalBet — Migration 007: Fix prediction resolution
-- Paste into Supabase SQL Editor and run
-- ============================================================

-- ============================================================
-- 1. FIX: prevent_late_prediction trigger was blocking backend
--    from marking predictions as is_resolved = true.
--
--    Root cause: The trigger ran on ALL updates to predictions,
--    including the backend's resolution write (is_resolved=true,
--    points_earned=N). After kickoff, match.status != 'NS', so
--    the trigger raised an exception — predictions stayed unresolved
--    forever while the leaderboard (separate table, no trigger)
--    was updated normally.
--
--    Fix: If the update is setting is_resolved=true, allow it.
--    Only the backend can do this (RLS WITH CHECK below blocks clients).
-- ============================================================
create or replace function prevent_late_prediction()
returns trigger
language plpgsql
as $$
declare
  match_kickoff timestamptz;
  match_status  text;
begin
  -- Allow backend resolution: only the backend sets is_resolved=true.
  -- Client is blocked from doing this via RLS WITH CHECK.
  if TG_OP = 'UPDATE' and new.is_resolved = true then
    return new;
  end if;

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
-- 2. FIX RLS: Add WITH CHECK so clients cannot set is_resolved=true.
-- ============================================================
drop policy if exists "predictions_update_own" on predictions;
create policy "predictions_update_own"
  on predictions for update
  using (user_id = auth.uid() and is_resolved = false)
  with check (user_id = auth.uid() and is_resolved = false);


-- ============================================================
-- 3. BACKFILL: Mark stuck predictions (is_resolved=false on FT matches)
--    with their correct points_earned.
--
--    The leaderboard already has correct points (backend updated it).
--    We only need to set is_resolved=true and points_earned on each
--    prediction row so the Profile page and history modal show correct data.
--
--    Over/Under: total_goals > 2 is equivalent to > 2.5 for integers.
-- ============================================================
do $$
declare
  rec           record;
  actual_outcome text;
  actual_ht      text;
  actual_btts    boolean;
  total_goals    integer;
  exact_correct  boolean;
  pts            integer;
begin
  for rec in
    select
      p.id,
      p.predicted_outcome,
      p.predicted_home_score,
      p.predicted_away_score,
      p.predicted_halftime_outcome,
      p.predicted_btts,
      p.predicted_over_under,
      m.home_score,
      m.away_score,
      m.halftime_home,
      m.halftime_away
    from predictions p
    join matches m on m.id = p.match_id
    where p.is_resolved = false
      and m.status = 'FT'
      and m.home_score is not null
      and m.away_score is not null
  loop
    pts := 0;
    total_goals := rec.home_score + rec.away_score;
    actual_btts := rec.home_score > 0 and rec.away_score > 0;

    actual_outcome := case
      when rec.home_score > rec.away_score then 'H'
      when rec.home_score < rec.away_score then 'A'
      else 'D'
    end;

    exact_correct := (
      rec.predicted_home_score is not null and
      rec.predicted_away_score is not null and
      rec.predicted_home_score = rec.home_score and
      rec.predicted_away_score = rec.away_score
    );

    -- Tier 1: outcome (3 pts)
    if (rec.predicted_outcome is not null and rec.predicted_outcome = actual_outcome)
       or (rec.predicted_outcome is null and exact_correct)
    then
      pts := pts + 3;
    end if;

    -- Tier 2: exact score (7 pts)
    if exact_correct then
      pts := pts + 7;
    end if;

    -- Tier 3: halftime result (4 pts)
    if rec.predicted_halftime_outcome is not null
       and rec.halftime_home is not null
       and rec.halftime_away is not null
    then
      actual_ht := case
        when rec.halftime_home > rec.halftime_away then 'H'
        when rec.halftime_home < rec.halftime_away then 'A'
        else 'D'
      end;
      if rec.predicted_halftime_outcome = actual_ht then
        pts := pts + 4;
      end if;
    end if;

    -- Tier 5: BTTS (2 pts)
    if rec.predicted_btts is not null and rec.predicted_btts = actual_btts then
      pts := pts + 2;
    end if;

    -- Tier 6: Over/Under 2.5 goals (3 pts)
    if rec.predicted_over_under is not null then
      if (rec.predicted_over_under = 'over'  and total_goals > 2)
      or (rec.predicted_over_under = 'under' and total_goals <= 2)
      then
        pts := pts + 3;
      end if;
    end if;

    -- Mark prediction resolved with correct points
    update predictions
       set is_resolved = true, points_earned = pts
     where id = rec.id;

  end loop;
end $$;
