-- V6 Sprint 44 — "Deep Telemetry & Live Commentary Engine"
--
-- Two additive pieces, both following this codebase's established
-- "compute once, serve infinite" AI Scout architecture (§22):
--
-- 1. matches.live_commentary — an append-only JSONB array of AI-narrated
--    lines, one per resolved live key event (goal/card/sub — the same
--    event vocabulary fetchMatchKeyEvents() already extracts, ESPN's
--    keyEvents/commentary feed has never exposed shots-on-target or fouls
--    in this codebase's own verified usage, so this scope is honest about
--    what's actually achievable, not what a brief assumed). Appended via
--    append_live_commentary_entry() — a single atomic UPDATE ... WHERE NOT
--    EXISTS, the same "claim via one statement, let a losing concurrent
--    worker's WHERE clause match zero rows" shape rule 4.14/§29 already
--    established for coin-spending RPCs, applied here to a purely additive
--    append instead of a claim.
--
-- 2. matches.referee_name — captured once per match at FT resolution
--    (scoreUpdater.ts, fire-and-forget, same trigger point as
--    ensurePostMatchSummary/ensureChronicle). Never populated retroactively
--    for historical matches (no backfill by design, same stated limitation
--    as HIGH_PROFILE_LEAGUE_IDS gating chronicles, §22) — a referee's
--    "strictness" average only accumulates meaningfully from here forward.
--    get_referee_strictness() aggregates over matches.referee_name joined
--    to match_team_stats' own real yellow_cards/red_cards columns
--    (Sprint 29) — zero new per-match stat columns needed.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS live_commentary JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS referee_name TEXT;

CREATE INDEX IF NOT EXISTS idx_matches_referee_name ON matches(referee_name) WHERE referee_name IS NOT NULL;

-- Atomic append with natural-key dedup. p_natural_key is a deterministic
-- string built from the source event's own identity (minute/extraTime/
-- period/type/team) — a concurrent second worker generating commentary for
-- the same event matches zero rows on its own attempt instead of double-
-- appending, the same idempotency shape as increment_coins' ON CONFLICT
-- (rule 4.15) applied to a JSONB array instead of a ledger table.
CREATE OR REPLACE FUNCTION append_live_commentary_entry(
  p_match_id    UUID,
  p_entry       JSONB,
  p_natural_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE matches
  SET live_commentary = live_commentary || p_entry
  WHERE id = p_match_id
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(live_commentary) e
      WHERE e->>'key' = p_natural_key
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Never GRANTed to authenticated — service-role only, same posture as every
-- other write-path RPC that isn't a client-facing coin/prediction action
-- (credit_group_coins, compute_battle_scores, ...).

-- Referee strictness — a plain read-only aggregate, no SECURITY DEFINER
-- needed since matches/match_team_stats are both already public-read.
CREATE OR REPLACE FUNCTION get_referee_strictness(p_referee_name TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  -- match_team_stats has one row per team_side (home/away) per match — sum
  -- both sides per match FIRST, then average across matches, so this reads
  -- "average total cards issued in a match this referee took," not "average
  -- cards per team-row" (a real, easy-to-miss aggregation bug — averaging
  -- directly over the joined rows would silently halve every figure).
  SELECT jsonb_build_object(
    'sample_size', COUNT(*),
    'avg_yellow', ROUND(AVG(totals.yellow)::numeric, 2),
    'avg_red', ROUND(AVG(totals.red)::numeric, 2)
  )
  FROM (
    SELECT m.id, SUM(COALESCE(mts.yellow_cards, 0)) AS yellow, SUM(COALESCE(mts.red_cards, 0)) AS red
    FROM matches m
    JOIN match_team_stats mts ON mts.match_id = m.id
    WHERE m.referee_name = p_referee_name
      AND m.status = 'FT'
    GROUP BY m.id
  ) totals;
$$;
