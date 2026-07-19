-- ─── Migration 060: The Scout Report — get_player_scout_report (V5 Sprint 40) ──
-- Lazy-loaded, per-target-user analytics for the Leaderboard's expand-in-place
-- preview (LeaderboardRow.tsx, Sprint 21, §36 — this is a NEW block appended
-- to that EXISTING accordion, not a new accordion). Genuinely new surface,
-- checked against get_stats_arena_payload (044_stats_arena.sql) before
-- writing this: that RPC's heatmap is League x Bet-Type and self-scoped only
-- (p_user_id must equal auth.uid()) — it has no tier-level (Result/Score/
-- Corners/BTTS/O-U) breakdown and cannot answer "how good is THIS OTHER
-- group member," which is exactly what a leaderboard scouting feature needs.
--
-- Per-tier correctness mirrors backend/src/services/pointsEngine.ts's
-- calculatePoints() exactly (rule: keep the SQL mirror and the TS source in
-- sync, the same discipline calcBreakdown() already follows for scoring) —
-- including rule 4.7's regulation_home/regulation_away fallback for ET/PEN
-- matches, confirmed against scoreUpdater.ts's own mapping
-- (`regulation_home ?? home_score`) rather than assumed.
--
-- Privacy/access: this exposes one user's aggregate resolved-prediction
-- history to ANOTHER user (opponent scouting) — a different shape from
-- get_stats_arena_payload's self-view guard. The correct guard, mirroring
-- the access model H2HModal/UserMatchHistoryModal already rely on ("you can
-- see this because you share a leaderboard/group with them"): caller must
-- be authenticated AND share the target group with the target user via
-- group_members. Every aggregate filters on predictions.is_resolved = true
-- (superset of status='FT', same rule as migration 044) so AET/PEN knockout
-- matches are correctly included.
--
-- Idempotent (CREATE OR REPLACE; no destructive DDL).

CREATE OR REPLACE FUNCTION public.get_player_scout_report(
  p_target_user_id UUID,
  p_group_id       UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tier_rates JSONB;
  v_coins_staked BIGINT;
  v_points_earned BIGINT;
  v_trend JSONB;
BEGIN
  -- ── Access guards — first actions, before any aggregation runs ──────────
  -- (§11/§27's "guard first" discipline extended to read access, same
  -- precedent as get_stats_arena_payload's own p_user_id/group check.)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM group_members caller
    WHERE caller.user_id = auth.uid()
      AND caller.group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'Access denied: caller is not a member of this group';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM group_members target
    WHERE target.user_id = p_target_user_id
      AND target.group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'Access denied: target user is not a member of this group';
  END IF;

  -- ── 1. Tier success rates ────────────────────────────────────────────────
  -- Each tier's own "sample" = predictions where that tier's column is
  -- non-null (the tier was actually played); "correct" mirrors
  -- calculatePoints()'s exact per-tier condition. regulation_home/away
  -- fallback to home_score/away_score, matching rule 4.7 / scoreUpdater.ts.
  WITH scored AS (
    SELECT
      p.predicted_outcome,
      p.predicted_home_score,
      p.predicted_away_score,
      p.predicted_corners,
      p.predicted_btts,
      p.predicted_over_under,
      COALESCE(m.regulation_home, m.home_score) AS reg_home,
      COALESCE(m.regulation_away, m.away_score) AS reg_away,
      m.corners_total
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = p_target_user_id
      AND p.group_id = p_group_id
      AND p.is_resolved = true
      AND COALESCE(m.regulation_home, m.home_score) IS NOT NULL
      AND COALESCE(m.regulation_away, m.away_score) IS NOT NULL
  ),
  derived AS (
    SELECT
      *,
      CASE
        WHEN reg_home > reg_away THEN 'H'
        WHEN reg_home < reg_away THEN 'A'
        ELSE 'D'
      END AS actual_outcome,
      (reg_home > 0 AND reg_away > 0) AS actual_btts,
      (reg_home + reg_away) > 2.5 AS actual_over,
      CASE
        WHEN corners_total IS NULL THEN NULL
        WHEN corners_total <= 9 THEN 'under9'
        WHEN corners_total = 10 THEN 'ten'
        ELSE 'over11'
      END AS actual_corners_bucket
    FROM scored
  )
  SELECT jsonb_build_object(
    'result', jsonb_build_object(
      'sample',  COUNT(*) FILTER (WHERE predicted_outcome IS NOT NULL),
      'correct', COUNT(*) FILTER (WHERE predicted_outcome IS NOT NULL AND predicted_outcome = actual_outcome)
    ),
    'score', jsonb_build_object(
      'sample',  COUNT(*) FILTER (WHERE predicted_home_score IS NOT NULL AND predicted_away_score IS NOT NULL),
      'correct', COUNT(*) FILTER (WHERE predicted_home_score = reg_home AND predicted_away_score = reg_away)
    ),
    'corners', jsonb_build_object(
      'sample',  COUNT(*) FILTER (WHERE predicted_corners IS NOT NULL),
      'correct', COUNT(*) FILTER (WHERE predicted_corners IS NOT NULL AND predicted_corners = actual_corners_bucket)
    ),
    'btts', jsonb_build_object(
      'sample',  COUNT(*) FILTER (WHERE predicted_btts IS NOT NULL),
      'correct', COUNT(*) FILTER (WHERE predicted_btts IS NOT NULL AND predicted_btts = actual_btts)
    ),
    'ou', jsonb_build_object(
      'sample',  COUNT(*) FILTER (WHERE predicted_over_under IS NOT NULL),
      'correct', COUNT(*) FILTER (
        WHERE (predicted_over_under = 'over' AND actual_over)
           OR (predicted_over_under = 'under' AND NOT actual_over)
      )
    )
  )
  INTO v_tier_rates
  FROM derived;

  -- ── 2. Totals — coins_bet / points_earned, historical, this group only ──
  SELECT
    COALESCE(SUM(coins_bet), 0),
    COALESCE(SUM(points_earned), 0)
  INTO v_coins_staked, v_points_earned
  FROM predictions
  WHERE user_id = p_target_user_id
    AND group_id = p_group_id
    AND is_resolved = true;

  -- ── 3. Recent trend — last 5 completed match-weeks, oldest -> newest ─────
  -- Bucketed by ISO week of kickoff_time. Deliberately a DIFFERENT
  -- granularity from LeaderboardRowSparkline's existing per-prediction
  -- trend (last 5 individual picks) — this is genuinely new surface, not a
  -- re-derivation of what the row already renders.
  WITH weekly AS (
    SELECT
      date_trunc('week', m.kickoff_time) AS week_start,
      SUM(p.points_earned) AS week_points
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = p_target_user_id
      AND p.group_id = p_group_id
      AND p.is_resolved = true
    GROUP BY week_start
    ORDER BY week_start DESC
    LIMIT 5
  )
  SELECT jsonb_agg(week_points ORDER BY week_start ASC)
  INTO v_trend
  FROM weekly;

  RETURN jsonb_build_object(
    'tier_success_rates', v_tier_rates,
    'total_coins_staked', v_coins_staked,
    'total_points_earned', v_points_earned,
    -- NULLIF guards zero-stake division; a brand-new player gets NULL
    -- (rendered as "—" client-side), never NaN/Infinity or a thrown error.
    'efficiency', ROUND(v_points_earned::numeric / NULLIF(v_coins_staked, 0), 3),
    'recent_trend', COALESCE(v_trend, '[]'::jsonb)
  );
END;
$$;
