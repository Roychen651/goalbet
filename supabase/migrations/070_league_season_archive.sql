-- ─── Migration 070: league_season_archive table (V7 Sprint 56 follow-up) ───
-- "The Season Archive" — a self-maintained historical standings/leaders
-- archive, backed by GoalBet's own writes going forward, deliberately NOT a
-- retroactive backfill from ESPN's own historical depth (which this
-- codebase has never verified — this sandbox cannot reach ESPN's API to
-- confirm how far back its standings/statistics endpoints genuinely go, or
-- whether their shape is stable for old seasons). The very first archived
-- season is written the moment this feature's backend service first runs
-- (see backend/src/services/seasonArchive.ts) — the season that just
-- completed (the same one getLeagueStats()'s own fallback path already
-- treats as "the most recent table ESPN has fully populated") is snapshotted
-- immediately, so a real lookback already exists from day one; a second
-- season accumulates automatically a year from now when the next one ends.
--
-- Public read (same non-sensitive-sports-data posture as league_registry/
-- match_team_stats), service-role-only write — this table is backend-
-- managed on a daily cron + startup catch-up, never client-writable.
--
-- Idempotent: CREATE TABLE/POLICY/INDEX IF NOT EXISTS. Safe to re-run.

CREATE TABLE IF NOT EXISTS league_season_archive (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    INTEGER NOT NULL,
  -- ESPN's own season-start-year convention (e.g. 2025 = the "2025-26"
  -- season) — the exact number stats.ts's currentSeason()/StatsResponse.season
  -- already use everywhere else, so a season number here means the same
  -- thing it means anywhere else in this codebase.
  season       INTEGER NOT NULL,
  -- The exact StandingsRow[] / LeagueLeaders shapes stats.ts already
  -- produces — a structured JSONB blob, matching the precedent already set
  -- by oracle_stats/match_team_stats.raw_stats rather than a fully
  -- normalized row-per-team/row-per-player schema this data doesn't need.
  standings    JSONB NOT NULL,
  leaders      JSONB,
  archived_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (league_id, season)
);

ALTER TABLE league_season_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS league_season_archive_read_all ON league_season_archive;
CREATE POLICY league_season_archive_read_all
  ON league_season_archive FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_league_season_archive_league
  ON league_season_archive(league_id, season DESC);
