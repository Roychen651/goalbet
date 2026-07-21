-- ─── Migration 066: The Global Arena — Cross-Group Divisions & Weekly Promotion (V6 Sprint 48) ──
-- Corrections made before writing this migration (full blueprint discussion
-- in chat, documented in CLAUDE.md §64):
--
--   1. Ranking metric is EFFICIENCY (avg points per resolved prediction),
--      never a raw summed total. Points are earned per-group (rule 4.12) —
--      a user active in 5 groups accrues roughly 5x the raw points of an
--      equally sharp predictor active in 1 group, purely from volume. A
--      raw-total ladder would rank group-count, not skill. Total points is
--      still surfaced as a secondary stat, never the primary sort.
--   2. The column is `arena_division`, not "tier" or "league" — both words
--      are already load-bearing elsewhere in this schema (the 5 prediction
--      TIERS in pointsEngine/PredictionForm, league_registry's
--      priority_tier for ESPN polling cadence, and "league" meaning a real
--      football league everywhere from FOOTBALL_LEAGUES to matches.league_id).
--      Reusing either word here would be a real three/four-way collision.
--   3. Weekly promotion timing reuses the exact DST-safe pattern already
--      established for the daily coin bonus (§28): never a fixed
--      "Sunday 00:00 UTC" cron expression, which drifts a full hour off
--      true Israel midnight across roughly 7 months of DST a year — the
--      same silent, twice-a-year bug already found and fixed once.
--      Instead a 15-minute sweep, DST-proof by construction: derives "is
--      it Sunday in Israel, and have we already run this week" from
--      NOW() AT TIME ZONE 'Asia/Jerusalem' plus an idempotency log, and is
--      a cheap no-op on 6 of every 7 days' worth of ticks.
--   4. Promotion/relegation is computed WITHIN each division (a real
--      ladder — the top ~10% of Bronze moves to Silver, never the top 10%
--      of the whole platform), among members with at least one resolved
--      prediction in the week just concluded. A quiet week costs nothing
--      in either direction — matches the non-punitive design already
--      established for streaks (§24: "missing a day does NOT break the
--      streak — only a wrong result does").
--   5. Materialized views cannot carry RLS policies in Postgres (RLS only
--      applies to real tables) — not an oversight. The view is granted
--      SELECT directly to `authenticated`, the same open-read posture
--      `profiles` itself already has (profiles_read_all, migration 002) —
--      a cross-group performance summary is no more sensitive than a
--      username, and nothing here ever exposes a single prediction's pick
--      value (that stays behind migration 037's wall).
--   6. Refresh cadence is 15 minutes, matching the daily-allowance/
--      streak-decay cadence family (migration 041) already established as
--      acceptable on this confirmed Supabase free-tier project (§46) — a
--      deliberate, stated freshness/cost tradeoff, not a live feed.

-- ============================================================
-- 1. profiles.arena_division
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS arena_division TEXT NOT NULL DEFAULT 'bronze'
  CHECK (arena_division IN ('bronze', 'silver', 'gold', 'diamond'));

COMMENT ON COLUMN profiles.arena_division IS
  'Cross-group ranking division (Bronze/Silver/Gold/Diamond), moved weekly '
  'by process_weekly_tier_promotions(). New users always start at bronze — '
  'a ladder climbed through play, never assigned. Deliberately NOT named '
  '"tier"/"league" — both words already mean something else in this schema.';

-- ============================================================
-- 2. arena_promotion_log — idempotency guard + audit trail for the weekly
--    sweep, same shape as sync_run_log's own telemetry precedent (§46).
--    Zero RLS policies (default-deny) — an internal operational log, not
--    user-facing data, no client read path needed this sprint.
-- ============================================================
CREATE TABLE IF NOT EXISTS arena_promotion_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start      DATE NOT NULL UNIQUE, -- the Israel-local Sunday this run concluded
  promoted_count  INTEGER NOT NULL DEFAULT 0,
  relegated_count INTEGER NOT NULL DEFAULT 0,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE arena_promotion_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. arena_current_week_start() — single source of truth for "the most
--    recent Sunday 00:00 in Israel", as a real timestamptz. Extracted so
--    the materialized view and the promotion engine can never drift out
--    of sync computing this independently (the exact dual-source-of-truth
--    trap this codebase warns against repeatedly, e.g. COIN_COSTS/
--    migration 040, OKLCH tokens/§30).
-- ============================================================
CREATE OR REPLACE FUNCTION arena_current_week_start()
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE AS $$
  SELECT (
    (
      (NOW() AT TIME ZONE 'Asia/Jerusalem')::date
      - (EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Asia/Jerusalem')))::int
    )::text || ' 00:00:00'
  )::timestamp AT TIME ZONE 'Asia/Jerusalem';
$$;

-- ============================================================
-- 4. global_user_standings — the read path for the Global Arena tab.
-- ============================================================
-- MIN_SAMPLE = 5 resolved predictions to be considered "ranked" — the same
-- honesty-about-small-samples discipline as ScoutReportPanel's sample<3
-- gate (§55) and PredictorArchetypeBadge's MIN_RESOLVED=8 (§60), applied
-- here at whole-platform-ranking scale rather than a single stat.
CREATE MATERIALIZED VIEW global_user_standings AS
SELECT
  p.id AS user_id,
  p.username,
  p.avatar_url,
  p.arena_division,
  p.active_cosmetics,
  COUNT(pr.id) FILTER (WHERE pr.is_resolved) AS resolved_predictions,
  COALESCE(SUM(pr.points_earned) FILTER (WHERE pr.is_resolved), 0) AS total_points,
  ROUND(
    COALESCE(SUM(pr.points_earned) FILTER (WHERE pr.is_resolved), 0)::numeric
      / NULLIF(COUNT(pr.id) FILTER (WHERE pr.is_resolved), 0),
    2
  ) AS avg_points_per_prediction,
  -- Running "this week so far" total (no upper bound) — a live-through-the-
  -- week scoreboard, a DIFFERENT window than the promotion engine's own
  -- closed [last Sunday, this Sunday) evaluation below.
  COALESCE(SUM(pr.points_earned) FILTER (
    WHERE pr.is_resolved AND pr.created_at >= arena_current_week_start()
  ), 0) AS weekly_points,
  (COUNT(pr.id) FILTER (WHERE pr.is_resolved) >= 5) AS is_ranked
FROM profiles p
LEFT JOIN predictions pr ON pr.user_id = p.id
GROUP BY p.id, p.username, p.avatar_url, p.arena_division, p.active_cosmetics;

-- Required for REFRESH ... CONCURRENTLY (readers keep seeing the last-good
-- snapshot until the new one atomically swaps in — never a read-lock on
-- the view during refresh).
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_user_standings_user ON global_user_standings (user_id);
CREATE INDEX IF NOT EXISTS idx_global_user_standings_division_rank
  ON global_user_standings (arena_division, avg_points_per_prediction DESC) WHERE is_ranked;

GRANT SELECT ON global_user_standings TO authenticated;

-- ============================================================
-- 5. refresh_global_user_standings — pg_cron only, every 15 minutes.
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_global_user_standings()
RETURNS VOID LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY global_user_standings;
EXCEPTION WHEN OTHERS THEN
  -- Never let a refresh failure take down the cron job permanently — log
  -- and let the next tick retry, the same self-healing idiom as every
  -- other pg_cron function in this schema.
  RAISE WARNING 'refresh_global_user_standings failed: %', SQLERRM;
END;
$$;

-- ============================================================
-- 6. process_weekly_tier_promotions — the DST-safe promotion engine.
-- ============================================================
-- Freezes each eligible user's start-of-run division + this-week's points
-- into a temp table FIRST, then runs promotion and relegation as two
-- separate, sequential UPDATEs against that frozen snapshot — never
-- against the live, possibly-already-mutated profiles.arena_division.
-- Doing this in one combined WITH clause (both UPDATEs as sibling
-- data-modifying CTEs touching the same table) has UNSPECIFIED execution
-- order in Postgres — unacceptable here, since relegation must never
-- evaluate a user against the division they were JUST promoted into
-- moments earlier in the same run (a "promoted then instantly relegated"
-- flip). The relegation UPDATE's own `p.arena_division = r.start_division`
-- guard is what naturally excludes anyone the promotion pass already
-- moved — their live division no longer matches their frozen snapshot.
CREATE OR REPLACE FUNCTION process_weekly_tier_promotions()
RETURNS VOID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_week_start_ts  TIMESTAMPTZ;
  v_week_start_date DATE;
  v_promoted       INTEGER := 0;
  v_relegated      INTEGER := 0;
BEGIN
  IF EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Asia/Jerusalem')) <> 0 THEN
    RETURN; -- cheap no-op on 6 of every 7 days' worth of ticks
  END IF;

  v_week_start_ts := arena_current_week_start(); -- this Sunday 00:00 Israel — effectively NOW, since we're guarded to Sunday
  v_week_start_date := v_week_start_ts::date;

  -- Idempotency: only one real run per Israel-local week, no matter how
  -- many times this fires within Sunday's 15-min sweep window.
  IF EXISTS (SELECT 1 FROM arena_promotion_log WHERE week_start = v_week_start_date) THEN
    RETURN;
  END IF;

  -- The week being evaluated is the 7 days BEFORE this Sunday boundary —
  -- i.e. the week that just concluded, not "since today" (which would be
  -- only the last few minutes, since today IS the boundary when this runs).
  CREATE TEMP TABLE weekly_activity ON COMMIT DROP AS
  SELECT
    p.id AS user_id,
    p.arena_division AS start_division,
    SUM(pr.points_earned) AS weekly_points
  FROM profiles p
  JOIN predictions pr ON pr.user_id = p.id
  WHERE pr.is_resolved
    AND pr.created_at >= v_week_start_ts - INTERVAL '7 days'
    AND pr.created_at < v_week_start_ts
  GROUP BY p.id, p.arena_division;

  -- Top ~10% within each division promotes up (Diamond has no ceiling).
  WITH ranked AS (
    SELECT user_id, start_division,
           PERCENT_RANK() OVER (PARTITION BY start_division ORDER BY weekly_points DESC) AS pct_rank
    FROM weekly_activity
  ),
  moved AS (
    UPDATE profiles p
    SET arena_division = CASE r.start_division
      WHEN 'bronze' THEN 'silver'
      WHEN 'silver' THEN 'gold'
      WHEN 'gold'   THEN 'diamond'
      ELSE r.start_division
    END
    FROM ranked r
    WHERE r.user_id = p.id AND r.pct_rank <= 0.10 AND r.start_division <> 'diamond'
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_promoted FROM moved;

  -- Bottom ~20% within each division relegates down (Bronze has no
  -- floor). `p.arena_division = r.start_division` is the guard against
  -- double-moving someone the promotion pass above already touched.
  WITH ranked AS (
    SELECT user_id, start_division,
           PERCENT_RANK() OVER (PARTITION BY start_division ORDER BY weekly_points ASC) AS pct_rank
    FROM weekly_activity
  ),
  moved AS (
    UPDATE profiles p
    SET arena_division = CASE r.start_division
      WHEN 'diamond' THEN 'gold'
      WHEN 'gold'    THEN 'silver'
      WHEN 'silver'  THEN 'bronze'
      ELSE r.start_division
    END
    FROM ranked r
    WHERE r.user_id = p.id
      AND r.pct_rank <= 0.20
      AND r.start_division <> 'bronze'
      AND p.arena_division = r.start_division
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_relegated FROM moved;

  INSERT INTO arena_promotion_log (week_start, promoted_count, relegated_count)
  VALUES (v_week_start_date, v_promoted, v_relegated);
END;
$$;

-- ============================================================
-- 7. pg_cron wiring — idempotent unschedule-then-reschedule, the exact
--    established shape from migration 036 (a SELECT over cron.job is a
--    no-op empty set when the job doesn't exist yet — no error on a
--    first-ever run, no exception handling needed).
-- ============================================================
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'goalbet-refresh-global-standings';

SELECT cron.schedule(
  'goalbet-refresh-global-standings',
  '*/15 * * * *',
  'SELECT public.refresh_global_user_standings();'
);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'goalbet-weekly-arena-promotions';

SELECT cron.schedule(
  'goalbet-weekly-arena-promotions',
  '*/15 * * * *',
  'SELECT public.process_weekly_tier_promotions();'
);

-- Neither refresh_global_user_standings() nor process_weekly_tier_promotions()
-- is GRANTed to `authenticated` — pg_cron-only, matching
-- distribute_daily_allowance()/decay_idle_streaks()'s established rule
-- (§28: never GRANT a pg_cron-only function to the client role).
