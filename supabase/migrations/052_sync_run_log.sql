-- ─── Migration 052: sync_run_log telemetry + admin RPC (V4 Sprint 31) ──────
-- "Failover, Telemetry Logging & Self-Healing Sync Tasks" — additive only,
-- zero locks on matches/predictions/any coin-spending table. Idempotent
-- throughout (CREATE TABLE/INDEX IF NOT EXISTS, CREATE OR REPLACE, an
-- unschedule-then-reschedule cron step matching migration 036's own
-- established idempotent pattern).
--
-- Two nullable "checked" columns, not one shared column: checkAndUpdateScores
-- counts MATCHES in scope (matchesInScope), while syncAllActiveLeagues counts
-- LEAGUES (results.length) — a single overloaded "leagues_checked" column
-- would silently mean something different depending on run_type. Kept
-- separate so a reader never needs to already know the row's type to
-- interpret its own columns correctly.
--
-- `errors` is a JSONB array of {scope, message} objects, not a bare count —
-- an admin dashboard meant to show WHY a sync failed needs the message, not
-- just a number.

CREATE TABLE IF NOT EXISTS sync_run_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type          TEXT NOT NULL CHECK (run_type IN ('live_poll', 'daily_sync', 'startup_catchup')),
  tier              TEXT CHECK (tier IN ('tier1', 'tier2')),  -- only meaningful when run_type = 'live_poll'
  started_at        TIMESTAMPTZ NOT NULL,
  completed_at      TIMESTAMPTZ,        -- NULL only if the process crashed mid-run before the wrapper's own insert could run
  leagues_checked   INTEGER,            -- daily_sync / startup_catchup
  matches_checked   INTEGER,            -- live_poll
  matches_resolved  INTEGER,
  errors            JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms       INTEGER
);

-- RLS enabled, ZERO policies — default-deny for anon/authenticated. This
-- table can carry internal error messages/stack traces, unlike
-- league_registry/match_team_stats' non-sensitive sports data (which are
-- correctly public-read). Service-role writes (backend, bypasses RLS by
-- construction); the only read path is admin_get_sync_log() below, which
-- bypasses RLS the same proven way admin_get_users()/admin_get_stats()
-- already do (SECURITY DEFINER, owned by a role with BYPASSRLS).
ALTER TABLE sync_run_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sync_run_log_type_started ON sync_run_log(run_type, started_at DESC);

CREATE OR REPLACE FUNCTION admin_get_sync_log(p_limit INTEGER DEFAULT 20)
RETURNS SETOF sync_run_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super-admin only';
  END IF;

  RETURN QUERY
    SELECT * FROM sync_run_log
    ORDER BY started_at DESC
    LIMIT p_limit;
END;
$$;

-- pg_cron-only retention sweep — never GRANTed to authenticated, same
-- posture as distribute_daily_allowance()/decay_idle_streaks() (migration
-- 041). At Tier-1's 30s cadence this table can grow ~2,880 rows/day; 14-day
-- retention bounds resident rows to a real, stated number (~55K) rather than
-- growing unbounded on a Supabase free-tier project.
CREATE OR REPLACE FUNCTION prune_old_sync_logs()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM sync_run_log WHERE started_at < now() - interval '14 days';
$$;

-- Idempotent schedule — same unschedule-then-reschedule shape as migration
-- 036's goalbet-sync-heartbeat job.
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'goalbet-prune-sync-logs';

SELECT cron.schedule(
  'goalbet-prune-sync-logs',
  '0 3 * * *',
  'SELECT public.prune_old_sync_logs();'
);
