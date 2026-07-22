-- ─── Migration 067: Oracle goal averages (V7 Sprint 52) ─────────────────
-- "The Monte Carlo Web Worker Engine" needs a real expected-goals (λ) input
-- per team — this codebase has NO xG field anywhere (confirmed by grep
-- across backend/frontend before writing this migration; ESPN's soccer
-- feed has never exposed it here, same "data.predictor unavailable for
-- soccer" gap already documented at §34). The honest, already-real proxy
-- is each team's own recent scoring rate — extending compute_team_recent_form()
-- in place, the same "CREATE OR REPLACE, same signature" pattern already
-- used repeatedly on submit_prediction()/get_stats_arena_payload.
--
-- IMPORTANT: this extends migration 059's version of the function (the
-- NULL-vs-zero honesty fix — over25_pct/btts_pct are NULL, not a
-- misleadingly-confident 0, when sample_size=0), NOT migration 053's
-- original. A first draft of this migration was written against 053's
-- body from memory and would have silently regressed 059's fix — caught
-- and corrected before this file was ever shown for confirmation, by
-- re-reading every migration that has ever CREATE OR REPLACE'd this exact
-- function (053, 059) rather than trusting an earlier read of 053 alone.
-- avg_goals_scored/avg_goals_conceded follow the same NULL-at-zero-sample
-- discipline 059 already established for the percentage fields.
--
-- Purely additive JSONB keys on the SAME oracle_stats blob every match
-- already computes and caches once (§22's compute-once architecture) — zero
-- new columns, zero new RPC, zero new network call from the frontend. A
-- match's oracle_stats already ships to the client on the normal matches
-- fetch; the Monte Carlo worker (Commit 1, same sprint) reads these two
-- new numbers straight off match.oracle_stats with nothing new to fetch.

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
      (regulation_home > 0 AND regulation_away > 0) AS is_btts,
      -- V7 Sprint 52 — goals FOR/AGAINST this specific team, regardless of
      -- which side (home/away) they played on in that match. This is the
      -- real input a Poisson lambda needs; nothing before this migration
      -- computed it.
      CASE WHEN home_team = p_team_name THEN regulation_home ELSE regulation_away END AS goals_for,
      CASE WHEN home_team = p_team_name THEN regulation_away ELSE regulation_home END AS goals_against
    FROM recent
  )
  SELECT jsonb_build_object(
    'wins', COUNT(*) FILTER (WHERE outcome = 'win'),
    'draws', COUNT(*) FILTER (WHERE outcome = 'draw'),
    'losses', COUNT(*) FILTER (WHERE outcome = 'loss'),
    'over25_pct', CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE is_over25) / COUNT(*)) END,
    'btts_pct', CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE is_btts) / COUNT(*)) END,
    'sample_size', COUNT(*),
    'avg_goals_scored', CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(AVG(goals_for)::numeric, 2) END,
    'avg_goals_conceded', CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(AVG(goals_against)::numeric, 2) END
  ) INTO v_result
  FROM scored;

  RETURN v_result;
END;
$$;

-- Same forced-recompute as migration 059 — matchOracle.ts's compute-once
-- .is(column, null) guard would otherwise keep serving pre-067 rows that
-- lack avg_goals_scored/avg_goals_conceded forever. Only NS matches (the
-- only ones with a live Oracle panel / Monte Carlo simulator to feed).
UPDATE matches
SET oracle_stats = NULL, ai_oracle_insight = NULL, ai_oracle_insight_he = NULL
WHERE status = 'NS' AND oracle_stats IS NOT NULL;

COMMENT ON COLUMN matches.oracle_stats IS
  'Deterministic, SQL-computed historical form for both teams, from their '
  'own last <=10 resolved (regulation-score-present) matches at write time. '
  'Shape: {"home": {wins,draws,losses,over25_pct,btts_pct,sample_size,'
  'avg_goals_scored,avg_goals_conceded}, "away": {...}}. sample_size can be '
  '< 10 for a newly-promoted/newly-added team. over25_pct/btts_pct/'
  'avg_goals_scored/avg_goals_conceded are all NULL (never a misleadingly '
  'confident 0) at sample_size=0 (migration 059 + 067) — the frontend must '
  'show the real sample size, never silently imply a full history. Written '
  'once by matchOracle.ts, never recomputed for a given match once set '
  '(mirrors ai_pre_match_insight''s compute-once contract). V7 Sprint 52 '
  '(migration 067) added the two avg_goals_* fields, feeding the Monte '
  'Carlo exact-score simulator.';
