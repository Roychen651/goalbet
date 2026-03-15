-- 009: Retroactive streak bonus backfill
--
-- Old code: bonus when streak_before >= 3 → triggered at 4th correct, no reset
-- New code: bonus when streak_before >= 2 → triggered at 3rd correct, then resets to 0
--
-- Gap to fill: predictions where streak_before = 2 (3rd in a row) got no bonus
-- under old code (2 < 3) but should have gotten +2 under new code.
--
-- For each user+group, walk predictions chronologically and add +2 where the gap exists.

DO $$
DECLARE
  rec        RECORD;
  pred       RECORD;
  v_streak   INTEGER;   -- simulated streak (new logic)
  v_extra    INTEGER;   -- extra pts to add this cycle
  v_total    INTEGER;   -- total extra across all predictions
BEGIN
  FOR rec IN
    SELECT DISTINCT user_id, group_id
    FROM predictions
    WHERE is_resolved = true
  LOOP
    v_streak := 0;
    v_total  := 0;

    FOR pred IN
      SELECT p.id,
             (p.points_earned > 0) AS is_correct
      FROM   predictions p
      JOIN   matches m ON m.id = p.match_id
      WHERE  p.user_id   = rec.user_id
        AND  p.group_id  = rec.group_id
        AND  p.is_resolved = true
      ORDER BY m.kickoff_time ASC, p.created_at ASC
    LOOP
      IF pred.is_correct THEN
        IF v_streak = 2 THEN
          -- 3rd correct in a row:
          --   old code: streak_before=2, 2 >= 3? NO → no bonus
          --   new code: streak_before=2, 2 >= 2? YES → +2 bonus, then reset
          UPDATE predictions
          SET    points_earned = points_earned + 2
          WHERE  id = pred.id;
          v_extra := 2;
          v_total := v_total + 2;
          v_streak := 0;          -- reset cycle after bonus (new behaviour)

        ELSIF v_streak >= 3 THEN
          -- Old code already awarded a bonus here (streak_before >= 3).
          -- Don't add again; just keep counting for cycle detection.
          v_streak := v_streak + 1;

        ELSE
          v_streak := v_streak + 1;
        END IF;

      ELSE
        v_streak := 0;
      END IF;
    END LOOP;

    -- Apply accumulated extra to the leaderboard
    IF v_total > 0 THEN
      UPDATE leaderboard
      SET    total_points  = total_points  + v_total,
             weekly_points = GREATEST(0, weekly_points + v_total),
             current_streak = v_streak    -- reflects new-logic streak at end
      WHERE  user_id  = rec.user_id
        AND  group_id = rec.group_id;
    END IF;

  END LOOP;
END $$;
