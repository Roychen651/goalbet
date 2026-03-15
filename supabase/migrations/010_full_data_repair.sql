-- ============================================================
-- GoalBet — Migration 010: Full data repair
-- Fixes points, hit rate, streak for all existing data
-- Run in Supabase SQL Editor
-- ============================================================

-- Step 1: Fix Barcelona prediction that was resolved without halftime in DB
UPDATE predictions p
SET points_earned = 12
FROM matches m
WHERE p.match_id = m.id
  AND p.is_resolved = true
  AND m.status = 'FT'
  AND m.home_team ILIKE '%barcelona%'
  AND m.halftime_home IS NOT NULL
  AND m.halftime_home > m.halftime_away
  AND p.predicted_halftime_outcome = 'H'
  AND p.points_earned = 8;

-- Step 2: Recompute total_points, predictions_made, correct_predictions
-- correct_predictions = only FT result correct (new logic)
UPDATE leaderboard lb
SET
  total_points        = COALESCE(subq.total, 0),
  weekly_points       = COALESCE(subq.total, 0),
  predictions_made    = COALESCE(subq.made, 0),
  correct_predictions = COALESCE(subq.ft_correct, 0)
FROM (
  SELECT
    p.user_id,
    p.group_id,
    SUM(p.points_earned)  AS total,
    COUNT(*)              AS made,
    COUNT(*) FILTER (
      WHERE p.predicted_outcome IS NOT NULL
        AND (
          (p.predicted_outcome = 'H' AND m.home_score > m.away_score) OR
          (p.predicted_outcome = 'D' AND m.home_score = m.away_score) OR
          (p.predicted_outcome = 'A' AND m.home_score < m.away_score)
        )
    ) AS ft_correct
  FROM predictions p
  JOIN matches m ON m.id = p.match_id
  WHERE p.is_resolved = true
  GROUP BY p.user_id, p.group_id
) subq
WHERE lb.user_id = subq.user_id
  AND lb.group_id = subq.group_id;

-- Step 3: Recompute current_streak and best_streak (FT result only, chronological)
DO $$
DECLARE
  rec          RECORD;
  v_streak     INTEGER := 0;
  v_best       INTEGER := 0;
  v_prev_user  UUID    := NULL;
  v_prev_group UUID    := NULL;
  is_correct   BOOLEAN;
  actual_outcome TEXT;
BEGIN
  FOR rec IN
    SELECT
      p.user_id,
      p.group_id,
      p.predicted_outcome,
      m.home_score,
      m.away_score,
      m.kickoff_time
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE p.is_resolved = true
      AND m.status = 'FT'
      AND p.predicted_outcome IS NOT NULL
    ORDER BY p.user_id, p.group_id, m.kickoff_time ASC, p.created_at ASC
  LOOP
    -- New user/group combo → reset streak
    IF rec.user_id IS DISTINCT FROM v_prev_user
       OR rec.group_id IS DISTINCT FROM v_prev_group THEN
      -- Save previous user/group streak before resetting
      IF v_prev_user IS NOT NULL THEN
        UPDATE leaderboard
        SET current_streak = v_streak,
            best_streak    = GREATEST(best_streak, v_best)
        WHERE user_id = v_prev_user AND group_id = v_prev_group;
      END IF;
      v_streak     := 0;
      v_best       := 0;
      v_prev_user  := rec.user_id;
      v_prev_group := rec.group_id;
    END IF;

    actual_outcome := CASE
      WHEN rec.home_score > rec.away_score THEN 'H'
      WHEN rec.home_score < rec.away_score THEN 'A'
      ELSE 'D'
    END;
    is_correct := rec.predicted_outcome = actual_outcome;

    IF is_correct THEN
      IF v_streak >= 2 THEN
        -- 3rd correct in a row → bonus fires, streak resets
        v_streak := 0;
      ELSE
        v_streak := v_streak + 1;
      END IF;
    ELSE
      v_streak := 0;
    END IF;

    v_best := GREATEST(v_best, v_streak);
  END LOOP;

  -- Save last user/group
  IF v_prev_user IS NOT NULL THEN
    UPDATE leaderboard
    SET current_streak = v_streak,
        best_streak    = GREATEST(best_streak, v_best)
    WHERE user_id = v_prev_user AND group_id = v_prev_group;
  END IF;
END $$;
