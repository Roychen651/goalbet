-- ─── Migration 048: Corners Stat-Capability Flag (V4 Sprint 26) ─────────────
-- Some leagues synced from ESPN never report the `wonCorners` boxscore stat
-- (espn.ts already extracts it automatically when present — this is not a
-- new data pipeline). A prediction's Corners tier resolves for points via
-- `if (prediction.predicted_corners !== null && match.corners_total !== null)`
-- (pointsEngine.ts) — when corners_total never populates for a league, that
-- guard silently skips the whole Corners tier forever: the user already paid
-- COIN_COSTS.CORNERS to place the bet and can NEVER win it back for that
-- match. This is a real, currently-occurring bug for any league not already
-- in the frontend's static LEAGUES_WITHOUT_CORNERS set, not a hypothetical.
--
-- There is no per-match ESPN signal for "will this match have corners data" —
-- a not-yet-played match's statistics array is empty regardless of whether
-- the league will ever report corners, structurally identical to "wait and
-- see." The only honest signal is per-LEAGUE and empirical: does this league
-- actually end up with non-null corners_total once matches resolve? NULL
-- means "not enough finished matches yet to judge" — never guessed at, never
-- defaults to a false confidence in either direction.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS corners_supported BOOLEAN;

COMMENT ON COLUMN matches.corners_supported IS
  'NULL = not enough resolved (FT) matches in this league yet to judge. '
  'TRUE/FALSE = empirically computed by compute_corners_support() from this '
  'league''s own FT-match history (>=80% non-null corners_total across >=10 '
  'resolved matches). Denormalized onto every match row (including future NS '
  'ones) for the same league so the frontend gets it for free on the existing '
  'matches fetch — no new query.';

-- SECURITY DEFINER, service-role only (never GRANTed to authenticated) — pure
-- set-based aggregation + upsert, the same "one SQL pass, not one query per
-- row" discipline as get_stats_arena_payload (migration 044).
CREATE OR REPLACE FUNCTION compute_corners_support()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE matches m
  SET corners_supported = sub.supported
  FROM (
    SELECT
      league_id,
      (COUNT(*) FILTER (WHERE corners_total IS NOT NULL))::float / COUNT(*) >= 0.8 AS supported
    FROM matches
    WHERE status = 'FT'
    GROUP BY league_id
    HAVING COUNT(*) >= 10
  ) sub
  WHERE m.league_id = sub.league_id
    AND (m.corners_supported IS DISTINCT FROM sub.supported);
END;
$$;

REVOKE ALL ON FUNCTION compute_corners_support() FROM PUBLIC;
