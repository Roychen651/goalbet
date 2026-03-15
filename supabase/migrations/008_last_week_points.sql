-- 008: Add last_week_points + atomic weekly reset function
-- Week definition: Sunday 00:00 UTC → Saturday 23:59:59 UTC

-- 1. Add the column (safe to run multiple times)
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS last_week_points integer DEFAULT 0;

-- 2. Atomic function: saves current weekly → last_week, then resets weekly to 0
--    Called by the backend cron every Sunday at 00:00 UTC
CREATE OR REPLACE FUNCTION reset_weekly_points()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE leaderboard SET last_week_points = weekly_points, weekly_points = 0;
$$;
