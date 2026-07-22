-- V7 Sprint 51 hotfix — DST-safe weekly leaderboard reset.
--
-- Fixes a real, pre-existing bug flagged (not fixed) in CLAUDE.md §69:
-- resetWeeklyPoints() (backend/src/services/scoreUpdater.ts) was triggered
-- by a fixed `cron.schedule('0 0 * * 0', ...)` in scheduler.ts — a literal
-- Sunday-00:00-UTC expression. During Israel Daylight Time (IDT, UTC+3,
-- ~7 months a year) this actually fires at 03:00 Israel local time, not
-- true midnight — the exact DST-drift shape this codebase already ruled
-- out once for the daily coin bonus (§28) and once more for the Global
-- Arena's weekly promotion sweep (§63, migration 066).
--
-- The fix reuses arena_current_week_start() (migration 066) as the single
-- source of truth for "the most recent Sunday 00:00 Israel" — never a
-- second, independently-computed date expression that could drift out of
-- sync with it (the exact dual-source-of-truth trap this codebase warns
-- against repeatedly: COIN_COSTS/migration 040, OKLCH tokens/§30,
-- arena_current_week_start() itself/§63).
--
-- Shape mirrors process_weekly_tier_promotions() (migration 066) exactly:
-- a cheap day-of-week guard (no-op on 6 of every 7 days), a real
-- Israel-local week_start computed once, an idempotency check against a
-- small log table (the UNIQUE constraint is the real backstop — a
-- concurrent double-fire's second INSERT raises a real constraint
-- violation and rolls back the WHOLE transaction, including the
-- leaderboard UPDATE that already ran earlier in the same call, per this
-- codebase's standing rule: never suppress a uniqueness violation once a
-- prior step already moved something, §29), then the reset itself.
--
-- ZERO SIDE-EFFECTS beyond the leaderboard's own weekly_points/
-- last_week_points columns — this migration does not touch coins,
-- predictions, total_points, or any historical archive. The UPDATE
-- statement is byte-for-byte the same one migration 008's
-- reset_weekly_points() has always run; only the TRIGGER moves.
--
-- Now fully pg_cron-native (no Node wrapper at all) — matching
-- distribute_daily_allowance()/decay_idle_streaks()'s established
-- "pg_cron-only, zero Node cron.schedule() involvement" shape (§28). The
-- old reset_weekly_points() SQL function (migration 008) and its Node
-- caller resetWeeklyPoints() (scoreUpdater.ts) are both retired by this
-- migration/its paired code change — see CLAUDE.md §69 addendum.

-- ============================================================
-- 1. weekly_points_reset_log — idempotency guard + audit trail, same
--    shape as arena_promotion_log (migration 066). Grows at most 52
--    rows/year (one reset per real week) — no retention sweep needed,
--    unlike sync_run_log's high-frequency growth concern (§46).
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_points_reset_log (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL UNIQUE, -- the Israel-local Sunday this reset concluded
  reset_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE weekly_points_reset_log ENABLE ROW LEVEL SECURITY;
-- Zero policies (default-deny) — an internal operational log, not
-- user-facing data, no client read path needed.

-- ============================================================
-- 2. reset_weekly_points_if_needed() — the DST-safe, idempotent replacement
--    for migration 008's unconditional reset_weekly_points().
-- ============================================================
CREATE OR REPLACE FUNCTION reset_weekly_points_if_needed()
RETURNS VOID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_week_start_date DATE;
BEGIN
  IF EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Asia/Jerusalem')) <> 0 THEN
    RETURN; -- cheap no-op on 6 of every 7 days' worth of ticks
  END IF;

  v_week_start_date := arena_current_week_start()::date;

  -- Idempotency: only one real reset per Israel-local week, no matter how
  -- many times this fires within Sunday's 15-min sweep window.
  IF EXISTS (SELECT 1 FROM weekly_points_reset_log WHERE week_start = v_week_start_date) THEN
    RETURN;
  END IF;

  -- Byte-for-byte the same statement migration 008's reset_weekly_points()
  -- has always run — only current weekly standings move, never coins,
  -- predictions, total_points, or any historical archive.
  UPDATE leaderboard SET last_week_points = weekly_points, weekly_points = 0;

  -- No ON CONFLICT here, deliberately — see the file header note on why a
  -- genuine race here should raise and roll back the whole transaction
  -- (the UPDATE above included) rather than silently no-op.
  INSERT INTO weekly_points_reset_log (week_start) VALUES (v_week_start_date);
END;
$$;

-- Never GRANTed to `authenticated` — pg_cron-only, matching
-- distribute_daily_allowance()/decay_idle_streaks()'s established rule
-- (§28: never GRANT a pg_cron-only function to the client role).

-- ============================================================
-- 3. pg_cron wiring — idempotent unschedule-then-reschedule, the exact
--    established shape from migration 036/066. Its own dedicated job
--    (not bundled into goalbet-refresh-global-standings/
--    goalbet-weekly-arena-promotions) — one job per purpose, matching
--    this codebase's general convention.
-- ============================================================
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'goalbet-weekly-points-reset';

SELECT cron.schedule(
  'goalbet-weekly-points-reset',
  '*/15 * * * *',
  'SELECT public.reset_weekly_points_if_needed();'
);

-- ============================================================
-- 4. Retire the old unconditional function — nothing in this codebase
--    calls it anymore after the paired scheduler.ts/scoreUpdater.ts
--    change (backend/src/cron/scheduler.ts's fixed weekly cron.schedule()
--    and scoreUpdater.ts's resetWeeklyPoints() wrapper are both removed
--    in the same commit as this migration).
-- ============================================================
DROP FUNCTION IF EXISTS reset_weekly_points();
