-- ─── Migration 053: Analytics Oracle — historical form stats (V5 Sprint 33) ─
-- "The Analytics Oracle" — deterministic SQL-computed historical frequency
-- stats (never AI-guessed), narrated by AI Scout only after the real numbers
-- already exist. Additive only, zero locks on predictions/coin tables.
--
-- match_team_stats (Sprint 29) is deliberately NOT joined here — it archives
-- corners/cards, not goals. Full-time result, Over/Under 2.5, and BTTS are
-- all fully derivable from matches.regulation_home/regulation_away alone,
-- the same fields pointsEngine.ts already uses for scoring (rule 4.7).
--
-- oracle_stats is ONE JSONB column (not 12 scalar ones) — matches
-- match_team_stats.raw_stats' precedent for "a structured stat blob", and
-- avoids the exact column sprawl a dozen new scalar columns would add to
-- an already-wide matches table. ai_oracle_insight/_he stay plain TEXT,
-- matching the existing ai_pre_match_insight/_he pairing convention exactly
-- (narration is text, not structured data).
--
-- This is the "compute once, serve infinite" architecture AI Scout already
-- proved (§22) — not a live-query-plus-cache model. A specific match's
-- "last 10 games" history is static once computed; it only changes when
-- either team plays again. Computing it once and storing it on the match
-- row costs nothing per pageview, unlike a live RPC hit on every preview.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS oracle_stats JSONB;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ai_oracle_insight TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ai_oracle_insight_he TEXT;

COMMENT ON COLUMN matches.oracle_stats IS
  'Deterministic, SQL-computed historical form for both teams, from their '
  'own last <=10 resolved (regulation-score-present) matches at write time. '
  'Shape: {"home": {wins,draws,losses,over25_pct,btts_pct,sample_size}, '
  '"away": {...}}. sample_size can be < 10 for a newly-promoted/newly-added '
  'team — the frontend must show the real sample size, never silently '
  'imply 10. Written once by matchOracle.ts, never recomputed for a given '
  'match once set (mirrors ai_pre_match_insight''s compute-once contract).';

-- Team identity in this schema is a free-text name (home_team/away_team),
-- not a stable FK — no index on either column existed before this
-- migration, so "last 10 matches for team X" would sequential-scan.
CREATE INDEX IF NOT EXISTS idx_matches_home_team_kickoff ON matches(home_team, kickoff_time DESC);
CREATE INDEX IF NOT EXISTS idx_matches_away_team_kickoff ON matches(away_team, kickoff_time DESC);

-- Helper: one team's own recent-form aggregate. Standalone and independently
-- callable/testable (e.g. `select compute_team_recent_form('Arsenal', null)`)
-- rather than inlined into the orchestrator below.
--
-- Deliberately plain SQL/plpgsql, no SECURITY DEFINER: matches already has
-- `using (true)` public SELECT (migration 002), so a read-only aggregate
-- over data every client can already see needs no elevated privilege. Only
-- ever called from the backend (matchOracle.ts) today, but harmless if
-- called directly since it can't expose anything not already public.
CREATE OR REPLACE FUNCTION compute_team_recent_form(p_team_name TEXT, p_exclude_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH recent AS (
    SELECT home_team, away_team, regulation_home, regulation_away
    FROM matches
    WHERE (home_team = p_team_name OR away_team = p_team_name)
      AND (p_exclude_match_id IS NULL OR id != p_exclude_match_id)
      AND regulation_home IS NOT NULL
      AND regulation_away IS NOT NULL
    ORDER BY kickoff_time DESC
    LIMIT 10
  ),
  scored AS (
    SELECT
      CASE
        WHEN home_team = p_team_name AND regulation_home > regulation_away THEN 'win'
        WHEN away_team = p_team_name AND regulation_away > regulation_home THEN 'win'
        WHEN regulation_home = regulation_away THEN 'draw'
        ELSE 'loss'
      END AS outcome,
      (regulation_home + regulation_away > 2) AS is_over25,
      (regulation_home > 0 AND regulation_away > 0) AS is_btts
    FROM recent
  )
  SELECT jsonb_build_object(
    'wins', COUNT(*) FILTER (WHERE outcome = 'win'),
    'draws', COUNT(*) FILTER (WHERE outcome = 'draw'),
    'losses', COUNT(*) FILTER (WHERE outcome = 'loss'),
    'over25_pct', CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE is_over25) / COUNT(*)) END,
    'btts_pct', CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE is_btts) / COUNT(*)) END,
    'sample_size', COUNT(*)
  ) INTO v_result
  FROM scored;

  RETURN v_result;
END;
$$;

-- Orchestrator: both sides of a specific match, excluding the match itself
-- (relevant for a re-run against an already-resolved match).
CREATE OR REPLACE FUNCTION compute_match_oracle_stats(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_home_team TEXT;
  v_away_team TEXT;
BEGIN
  SELECT home_team, away_team INTO v_home_team, v_away_team
  FROM matches WHERE id = p_match_id;

  IF v_home_team IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'home', compute_team_recent_form(v_home_team, p_match_id),
    'away', compute_team_recent_form(v_away_team, p_match_id)
  );
END;
$$;
