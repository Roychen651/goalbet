-- ─── Migration 044: The Bento Arena — get_stats_arena_payload (V4 Sprint 15) ──
-- One SECURITY DEFINER RPC that assembles the entire "My Arena" stats tab in
-- a single round trip: a League x Bet-Type win-ratio heatmap, the caller's
-- position in the group's stake/streak/risk distribution, and a precomputed
-- head-to-head matrix against every other group member. The H2H matrix is
-- the deliberate N+1 kill — the frontend opponent-picker re-indexes into this
-- one payload with zero additional network calls per opponent selected.
--
-- Privacy: this is read-only, but the H2H matrix exposes cross-user
-- comparison data, so it gets the same two guards as every coin-spending RPC
-- in this codebase (auth.uid() check first, then group membership) even
-- though no money moves here. Every aggregate additionally requires
-- predictions.is_resolved = true — see the note in section 0 below on why
-- that is the correct gate, not a literal matches.status = 'FT' string match.
--
-- Idempotent (CREATE OR REPLACE; no destructive DDL).

-- ============================================================
-- 0. Gate note: is_resolved, not literal status = 'FT'
-- ============================================================
-- predictions.is_resolved is the authoritative "this prediction is settled
-- and safe to expose cross-user" flag everywhere else in this codebase (rule
-- 4.14 — it's exactly what gates coin payout, notification emission, and the
-- migration-037 privacy RLS boundary). A match that went to extra time or
-- penalties resolves with is_resolved = true while matches.status may be
-- 'AET' or 'PEN', not the literal string 'FT'. Filtering on status = 'FT'
-- alone would silently exclude every knockout match that went past
-- regulation — a real gap given the World Cup 2026 knockout stage is live at
-- the time of this migration. Every CTE below filters on
-- p.is_resolved = true, which is a strict superset of "status = 'FT'" and
-- the same boundary the rest of the app already trusts.

-- ============================================================
-- 1. Supporting index — this RPC's access pattern is
--    "all of a user's resolved predictions within one group," which the
--    existing idx_predictions_group (group_id) and idx_predictions_user_match
--    (user_id, match_id) only partially serve.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_predictions_group_user_resolved
  ON public.predictions (group_id, user_id)
  WHERE is_resolved = true;

-- ============================================================
-- 2. get_stats_arena_payload
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_stats_arena_payload(
  p_user_id  UUID,
  p_group_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_heatmap    JSONB;
  v_distribution JSONB;
  v_h2h        JSONB;
BEGIN
  -- ── Access guards — first actions, before any aggregation runs ──────────
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = p_group_id AND gm.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this group';
  END IF;

  -- ── 1. Heatmap: League x Bet-Type win ratio ──────────────────────────────
  WITH full_match_cells AS (
    SELECT
      m.league_id,
      m.league_name,
      'full_match'::text AS bet_type,
      COUNT(*) AS sample_size,
      COUNT(*) FILTER (
        WHERE p.predicted_outcome = (
          CASE
            WHEN COALESCE(m.regulation_home, m.home_score) > COALESCE(m.regulation_away, m.away_score) THEN 'H'
            WHEN COALESCE(m.regulation_home, m.home_score) < COALESCE(m.regulation_away, m.away_score) THEN 'A'
            ELSE 'D'
          END
        )
      ) AS correct
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = p_user_id
      AND p.group_id = p_group_id
      AND p.is_resolved = true
      AND p.predicted_outcome IS NOT NULL
    GROUP BY m.league_id, m.league_name
  ),
  momentum_cells AS (
    SELECT
      m.league_id,
      m.league_name,
      'momentum'::text AS bet_type,
      COUNT(*) AS sample_size,
      COUNT(*) FILTER (WHERE b.is_winner = true) AS correct
    FROM micro_prediction_bets b
    JOIN micro_prediction_questions q ON q.id = b.question_id
    JOIN matches m ON m.id = q.match_id
    WHERE b.user_id = p_user_id
      AND b.group_id = p_group_id
      AND b.settled_at IS NOT NULL
      AND b.is_winner IS NOT NULL
    GROUP BY m.league_id, m.league_name
  ),
  all_cells AS (
    SELECT * FROM full_match_cells
    UNION ALL
    SELECT * FROM momentum_cells
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'league_id', league_id,
      'league_name', league_name,
      'bet_type', bet_type,
      'sample_size', sample_size,
      'insufficient_data', sample_size < 3,
      'win_ratio', ROUND(correct::numeric / NULLIF(sample_size, 0), 4)
    )
    ORDER BY league_name, bet_type
  ), '[]'::jsonb)
  INTO v_heatmap
  FROM all_cells;

  -- ── 2. Distribution: caller's stake/streak/risk position vs. the group ──
  WITH member_stakes AS (
    SELECT
      p.user_id,
      AVG(p.coins_bet) AS avg_stake
    FROM predictions p
    WHERE p.group_id = p_group_id
    GROUP BY p.user_id
  ),
  group_stats AS (
    SELECT
      AVG(avg_stake) AS group_avg_stake,
      STDDEV(avg_stake) AS group_stddev_stake
    FROM member_stakes
  ),
  caller AS (
    SELECT
      ms.avg_stake,
      l.current_streak,
      l.best_streak
    FROM member_stakes ms
    LEFT JOIN leaderboard l ON l.user_id = ms.user_id AND l.group_id = p_group_id
    WHERE ms.user_id = p_user_id
  )
  SELECT jsonb_build_object(
    'avg_stake', ROUND(COALESCE(caller.avg_stake, 0)::numeric, 2),
    'group_avg_stake', ROUND(COALESCE(group_stats.group_avg_stake, 0)::numeric, 2),
    'group_stddev_stake', ROUND(COALESCE(group_stats.group_stddev_stake, 0)::numeric, 2),
    'current_streak', COALESCE(caller.current_streak, 0),
    'best_streak', COALESCE(caller.best_streak, 0),
    -- z-score of the caller's avg stake vs. the group, clipped to [-3, 3]
    -- and rescaled to a 0-100 "risk tolerance" display score centered on 50.
    'risk_score', ROUND(
      50 + 50 * GREATEST(-1, LEAST(1,
        COALESCE(caller.avg_stake - group_stats.group_avg_stake, 0)
          / NULLIF(group_stats.group_stddev_stake, 0) / 3
      ))
    )
  )
  INTO v_distribution
  FROM caller, group_stats;

  -- ── 3. H2H matrix: one row per opponent, one self-join, zero N+1 ────────
  WITH shared AS (
    SELECT
      p2.user_id AS opponent_id,
      COUNT(*) AS shared_matches,
      SUM(p1.points_earned) AS user_points,
      SUM(p2.points_earned) AS opponent_points,
      COUNT(*) FILTER (WHERE p1.points_earned > p2.points_earned) AS user_wins,
      COUNT(*) FILTER (WHERE p1.points_earned < p2.points_earned) AS opponent_wins,
      COUNT(*) FILTER (WHERE p1.points_earned = p2.points_earned) AS ties
    FROM predictions p1
    JOIN predictions p2
      ON p2.match_id = p1.match_id
     AND p2.group_id = p1.group_id
     AND p2.user_id != p1.user_id
    WHERE p1.user_id = p_user_id
      AND p1.group_id = p_group_id
      AND p1.is_resolved = true
      AND p2.is_resolved = true
    GROUP BY p2.user_id
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'opponent_id', s.opponent_id,
      'username', pr.username,
      'avatar_url', pr.avatar_url,
      'shared_matches', s.shared_matches,
      'user_points', s.user_points,
      'opponent_points', s.opponent_points,
      'user_wins', s.user_wins,
      'opponent_wins', s.opponent_wins,
      'ties', s.ties
    )
    ORDER BY pr.username
  ), '[]'::jsonb)
  INTO v_h2h
  FROM shared s
  JOIN profiles pr ON pr.id = s.opponent_id;

  RETURN jsonb_build_object(
    'heatmap', v_heatmap,
    'distribution', v_distribution,
    'h2h_matrix', v_h2h
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stats_arena_payload(UUID, UUID) TO authenticated;
