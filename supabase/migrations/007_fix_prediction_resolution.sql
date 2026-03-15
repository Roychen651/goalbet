-- ============================================================
-- GoalBet — Migration 007: Fix prediction resolution
-- Paste into Supabase SQL Editor and run
-- ============================================================

-- ============================================================
-- 1. FIX: prevent_late_prediction trigger was blocking backend
--    from marking predictions as is_resolved = true.
--
--    Problem: The trigger ran on ALL updates to predictions,
--    including the backend's resolution write (is_resolved=true,
--    points_earned=N). Since after kickoff match.status != 'NS',
--    the trigger raised an exception and the update was silently
--    swallowed — predictions stayed unresolved forever while the
--    leaderboard (separate table, no trigger) was updated normally.
--
--    Fix: If the update is setting is_resolved=true, it is a
--    backend resolution call — allow it through unconditionally.
-- ============================================================
create or replace function prevent_late_prediction()
returns trigger
language plpgsql
as $$
declare
  match_kickoff timestamptz;
  match_status  text;
begin
  -- Allow backend to resolve predictions (only the backend sets is_resolved=true,
  -- and the RLS WITH CHECK below prevents clients from doing this).
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
-- 2. FIX: Add WITH CHECK to prediction update RLS policy so
--    clients cannot set is_resolved=true themselves.
--    (Without this, a client could bypass scoring by self-resolving.)
-- ============================================================
drop policy if exists "predictions_update_own" on predictions;
create policy "predictions_update_own"
  on predictions for update
  using (user_id = auth.uid() and is_resolved = false)
  with check (user_id = auth.uid() and is_resolved = false);


-- ============================================================
-- 3. BACKFILL: Immediately resolve all predictions for FT matches
--    that were stuck due to the trigger bug above.
--    Uses the match scores already in the DB.
--    Points calculation mirrors pointsEngine.ts:
--      Tier1 outcome correct:  3 pts
--      Tier2 exact score:      7 pts
--      Tier3 HT result:        4 pts
--      Tier5 BTTS:             2 pts
--      Tier6 Over/Under 2.5:   3 pts
-- ============================================================
do $$
declare
  rec record;
  actual_outcome text;
  actual_ht text;
  actual_btts boolean;
  total_goals integer;
  pts integer;
  is_correct boolean;
begin
  for rec in
    select
      p.id,
      p.user_id,
      p.group_id,
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
    is_correct := false;

    -- Derive actual outcome
    actual_outcome := case
      when rec.home_score > rec.away_score then 'H'
      when rec.home_score < rec.away_score then 'A'
      else 'D'
    end;

    total_goals := rec.home_score + rec.away_score;
    actual_btts := rec.home_score > 0 and rec.away_score > 0;

    -- Exact score
    declare
      exact_correct boolean := (
        rec.predicted_home_score is not null and
        rec.predicted_away_score is not null and
        rec.predicted_home_score = rec.home_score and
        rec.predicted_away_score = rec.away_score
      );
    begin
      -- Tier 1: outcome (3 pts)
      if rec.predicted_outcome is not null and rec.predicted_outcome = actual_outcome then
        pts := pts + 3;
        is_correct := true;
      elsif rec.predicted_outcome is null and exact_correct then
        pts := pts + 3;
        is_correct := true;
      end if;

      -- Tier 2: exact score (7 pts)
      if exact_correct then
        pts := pts + 7;
        is_correct := true;
      end if;
    end;

    -- Tier 3: halftime result (4 pts)
    if rec.predicted_halftime_outcome is not null
       and rec.halftime_home is not null
       and rec.halftime_away is not null then
      actual_ht := case
        when rec.halftime_home > rec.halftime_away then 'H'
        when rec.halftime_home < rec.halftime_away then 'A'
        else 'D'
      end;
      if rec.predicted_halftime_outcome = actual_ht then
        pts := pts + 4;
        is_correct := true;
      end if;
    end if;

    -- Tier 5: BTTS (2 pts)
    if rec.predicted_btts is not null and rec.predicted_btts = actual_btts then
      pts := pts + 2;
      is_correct := true;
    end if;

    -- Tier 6: Over/Under 2.5 (3 pts)
    if rec.predicted_over_under is not null then
      if (rec.predicted_over_under = 'over' and total_goals > 2) or
         (rec.predicted_over_under = 'under' and total_goals <= 2) then
        pts := pts + 3;
        is_correct := true;
      end if;
    end if;

    -- Mark prediction as resolved
    update predictions
    set points_earned = pts, is_resolved = true
    where id = rec.id;

    -- Update leaderboard (add to existing row)
    insert into leaderboard (user_id, group_id, total_points, weekly_points, predictions_made, correct_predictions, current_streak, best_streak)
    values (
      rec.user_id, rec.group_id,
      pts, pts, 1, case when is_correct then 1 else 0 end,
      case when is_correct then 1 else 0 end, case when is_correct then 1 else 0 end
    )
    on conflict (user_id, group_id) do update
    set
      -- NOTE: leaderboard was already updated by the backend when the trigger bug was active.
      -- We do NOT add points again here (that would double-count).
      -- We only fix the predictions.is_resolved flag above.
      predictions_made = leaderboard.predictions_made  -- no-op: keep existing
    ;

  end loop;
end $$;


-- ============================================================
-- IMPORTANT NOTE ON BACKFILL:
-- The DO block above marks stuck predictions as is_resolved=true
-- with the correct points_earned. It does NOT update the leaderboard
-- because the backend already updated it correctly when the match
-- went FT. Only the prediction rows were stuck — the leaderboard
-- points are accurate.
-- ============================================================
