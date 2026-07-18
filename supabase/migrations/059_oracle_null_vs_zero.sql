-- ─── Migration 059: Oracle — distinguish "0%" from "no data" (V5 Sprint 33 hotfix) ─
-- Live user report: the Analytics Oracle "feels shallow / doesn't help
-- decisions" — traced to compute_team_recent_form() (migration 053)
-- returning a literal 0 for over25_pct/btts_pct whenever sample_size = 0.
-- A brand-new World Cup team with zero resolved matches in this app's own
-- history then rendered as a confident "0%" gauge — visually identical to a
-- real "checked 10 matches, none went over 2.5" reading, even though it
-- actually means "we have never observed this team." That's the opposite of
-- this codebase's own standing sample-size-honesty rule (§30/§33/§48):
-- never let a stat look more precise/confident than the sample backing it.
--
-- CREATE OR REPLACE in place — same signature, same extend-in-place pattern
-- already used for submit_prediction() (040→049) and get_stats_arena_payload
-- (044→045). Only the two CASE expressions change: NULL instead of 0 when
-- COUNT(*) = 0. wins/draws/losses stay real zeros (0 wins out of 0 games
-- played is an accurate count, not a percentage claim) — only the two
-- *_pct fields, which read as a confident rate, get the NULL treatment.

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
    'over25_pct', CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE is_over25) / COUNT(*)) END,
    'btts_pct', CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE is_btts) / COUNT(*)) END,
    'sample_size', COUNT(*)
  ) INTO v_result
  FROM scored;

  RETURN v_result;
END;
$$;

-- Force every already-cached oracle_stats row to recompute under the new
-- NULL-vs-zero semantics next sync cycle (matchOracle.ts's compute-once
-- .is(column, null) guard would otherwise keep serving the old, misleading
-- 0% values forever). Only touches NS matches — anything already resolved
-- doesn't show a live Oracle panel anymore anyway (PredictionForm gates on
-- NS), so there's nothing user-visible to recompute for those.
UPDATE matches
SET oracle_stats = NULL, ai_oracle_insight = NULL, ai_oracle_insight_he = NULL
WHERE status = 'NS' AND oracle_stats IS NOT NULL;
