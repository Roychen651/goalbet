-- ─── Migration 041: The Autonomous Economy (V4 Sprint 12) ─────────────────────
-- Moves the daily +30 coin bonus from a client-triggered RPC to a proactive
-- pg_cron sweep, adds a 3-day inactivity cap so dead accounts stop accruing,
-- and decays abandoned prediction streaks after 7 days of silence.
--
-- Scheduling note: rather than firing once at exactly 00:00 Israel time (which
-- drifts a full hour off midnight for ~7 months/year across DST, since pg_cron
-- runs against UTC), both jobs run every 15 minutes and are made idempotent via
-- the same date-comparison already used by claim_daily_bonus. Each is a cheap
-- no-op outside its real trigger window — DST-proof by construction, and a
-- missed tick self-heals on the next one with no catch-up logic needed.
--
-- Idempotent.

-- ============================================================
-- 1. Schema
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.leaderboard
  ADD COLUMN IF NOT EXISTS streak_warning_sent_at TIMESTAMPTZ;

-- ============================================================
-- 2. touch_last_active — called by the client on app open (AppInitializer),
--    never on a per-request basis. Callable by any authenticated user, but
--    only ever touches the caller's own row.
-- ============================================================
CREATE OR REPLACE FUNCTION touch_last_active()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET last_active_at = NOW() WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION touch_last_active() TO authenticated;

-- ============================================================
-- 3. distribute_daily_allowance — pg_cron only, no client GRANT.
--
-- Eligibility: last_active_at within the last 3 days (a frozen timestamp from
-- a dead account ages out of this window after 3 ticks of accrual — a user
-- offline 5 days accumulates exactly 90 coins and then stops, until they
-- return and touch_last_active() refreshes the window).
--
-- FOR UPDATE SKIP LOCKED is the bulk-SQL equivalent of the atomic-claim
-- pattern already used for coin payouts elsewhere (see scoreUpdater.ts rule
-- 4.14): if two overlapping ticks ever raced, the second simply skips rows
-- the first is mid-processing rather than double-crediting them. Combined
-- with the last_daily_bonus_date IS DISTINCT check, this closes the race from
-- both the locking side and the idempotency side.
-- ============================================================
CREATE OR REPLACE FUNCTION distribute_daily_allowance()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE;
BEGIN
  WITH eligible AS (
    SELECT gm.user_id, gm.group_id
    FROM group_members gm
    JOIN profiles p ON p.id = gm.user_id
    WHERE p.last_active_at >= v_today - INTERVAL '3 days'
      AND gm.last_daily_bonus_date IS DISTINCT FROM v_today
    FOR UPDATE OF gm SKIP LOCKED
  ),
  updated AS (
    UPDATE group_members gm
    SET coins = gm.coins + 30,
        last_daily_bonus_date = v_today
    FROM eligible e
    WHERE gm.user_id = e.user_id AND gm.group_id = e.group_id
    RETURNING gm.user_id, gm.group_id, gm.coins
  )
  INSERT INTO coin_transactions (user_id, group_id, type, amount, balance_after, description)
  SELECT user_id, group_id, 'daily_bonus', 30, coins, 'Daily bonus'
  FROM updated;
END;
$$;

-- ============================================================
-- 4. decay_idle_streaks — pg_cron only. Scoped per (user_id, group_id), same
--    as the streak columns themselves. No calendar-day logic needed here (a
--    rolling 7-day window, not a midnight boundary), so it's safe to run on
--    the same frequent cadence as the allowance sweep with no DST concern.
-- ============================================================
CREATE OR REPLACE FUNCTION decay_idle_streaks()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE leaderboard lb
  SET current_streak = 0
  WHERE current_streak > 0
    AND NOT EXISTS (
      SELECT 1 FROM predictions p
      WHERE p.user_id = lb.user_id
        AND p.group_id = lb.group_id
        AND p.created_at >= NOW() - INTERVAL '7 days'
    );
END;
$$;

-- ============================================================
-- 5. Schedule both jobs (idempotent — unschedule before reschedule).
-- ============================================================
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'goalbet-daily-allowance';
SELECT cron.schedule(
  'goalbet-daily-allowance',
  '*/15 * * * *',
  'SELECT public.distribute_daily_allowance();'
);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'goalbet-streak-decay';
SELECT cron.schedule(
  'goalbet-streak-decay',
  '*/15 * * * *',
  'SELECT public.decay_idle_streaks();'
);

-- ============================================================
-- 6. Drop the client-triggered RPC this migration replaces. Required, not
--    optional — leaving it reachable creates a second, redundant bonus-award
--    code path with no purpose once the cron is live (same discipline as
--    dropping place_prediction_bet/adjust_prediction_bet in migration 040,
--    though this one is a cleanliness call, not a vulnerability — claim_daily_
--    bonus was always idempotent and user-scoped, just now obsolete).
-- ============================================================
DROP FUNCTION IF EXISTS claim_daily_bonus(UUID, UUID);

-- Verify after running:
--   select jobname, schedule, active from cron.job where jobname like 'goalbet-%';
--   select * from cron.job_run_details order by start_time desc limit 10;
