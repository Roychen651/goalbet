-- ─── Migration 051: match_team_stats + player_match_stats (V4 Sprint 29) ───
-- "Deep-Data Schema Evolution" — additive only, zero locks on matches/
-- predictions since both tables below are brand new. Idempotent throughout.
--
-- match_team_stats (Track A — actively ingested): captures the FULL raw
-- competitor.statistics[] array ESPN returns per team per match, not just
-- the 2 fields (wonCorners, redCards) already cherry-picked into
-- matches.corners_total/red_cards_home/red_cards_away. corners_total on
-- `matches` is an irreversible home+away SUM — this table stores the real
-- per-team split for the first time. A small set of already-proven-useful
-- fields (corners, red_cards, yellow_cards) are ALSO promoted to real typed
-- columns so hot-path reads never need to parse raw_stats at runtime; the
-- JSONB stays a forward-compatible archive of everything else ESPN sent.
--
-- player_match_stats (Track B — schema placeholder, NOT populated by this
-- migration or the free ESPN sync worker): no free ESPN endpoint anywhere
-- in this codebase's integration exposes individual player match-log data
-- (minutes, tackles, crosses). This table exists so a future paid data
-- source has zero migration lead time — stated here plainly, not implied
-- as already working.

CREATE TABLE IF NOT EXISTS match_team_stats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_side    TEXT NOT NULL CHECK (team_side IN ('home', 'away')),
  raw_stats    JSONB NOT NULL DEFAULT '[]'::jsonb,
  corners      INTEGER,
  red_cards    INTEGER,
  yellow_cards INTEGER,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, team_side)
);

-- Non-sensitive sports data (same trust level as `matches` itself) —
-- public read, service-role-only write. No client-facing INSERT/UPDATE/
-- DELETE policy at all: this table is sync-worker-managed, not user-editable.
ALTER TABLE match_team_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS match_team_stats_read_all ON match_team_stats;
CREATE POLICY match_team_stats_read_all
  ON match_team_stats FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_match_team_stats_match ON match_team_stats(match_id);
-- No GIN index on raw_stats — nothing queries inside the JSONB at runtime
-- yet. Adding one now would be pure write-amplification for zero benefit;
-- add it only if/when a real feature needs to filter inside the JSONB.

CREATE TABLE IF NOT EXISTS player_match_stats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  athlete_id TEXT,
  team_side  TEXT CHECK (team_side IN ('home', 'away')),
  raw_stats  JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_match_stats_read_all ON player_match_stats;
CREATE POLICY player_match_stats_read_all
  ON player_match_stats FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_player_match_stats_match ON player_match_stats(match_id);
