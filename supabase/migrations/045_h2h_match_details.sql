-- ─── Migration 045: H2H match-by-match detail (V4 Sprint 16) ──────────────────
-- Sprint 16's morphing H2H drill-down (ExpandedH2HView.tsx) needs every shared
-- resolved match between the caller and each opponent, not just the
-- aggregated totals migration 044 already computes. The self-join in the H2H
-- CTE already visits every one of those match rows before folding them into
-- COUNT/SUM — this migration just also collects them into a jsonb_agg
-- alongside the existing aggregates, in the same single query. No new query,
-- no N+1: the per-match detail rides along in the same RPC call the Bento
-- Arena already makes.
--
-- CREATE OR REPLACE on the same function migration 044 defined — this is the
-- established pattern for extending an RPC in a later migration (e.g. 040
-- replaced earlier RPCs the same way). Every other part of the function is
-- byte-for-byte identical to 044; only the H2H block gains a `matches` join
-- and the `match_details` field.
--
-- Idempotent.

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
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = p_group_id AND gm.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this group';
  END IF;

  -- ── 1. Heatmap: League x Bet-Type win ratio (unchanged from migration 044) ──
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

  -- ── 2. Distribution (unchanged from migration 044) ──────────────────────
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
    'risk_score', ROUND(
      50 + 50 * GREATEST(-1, LEAST(1,
        COALESCE(caller.avg_stake - group_stats.group_avg_stake, 0)
          / NULLIF(group_stats.group_stddev_stake, 0) / 3
      ))
    )
  )
  INTO v_distribution
  FROM caller, group_stats;

  -- ── 3. H2H matrix — now with per-match detail for the Sprint 16 drill-down ──
  WITH shared AS (
    SELECT
      p2.user_id AS opponent_id,
      COUNT(*) AS shared_matches,
      SUM(p1.points_earned) AS user_points,
      SUM(p2.points_earned) AS opponent_points,
      COUNT(*) FILTER (WHERE p1.points_earned > p2.points_earned) AS user_wins,
      COUNT(*) FILTER (WHERE p1.points_earned < p2.points_earned) AS opponent_wins,
      COUNT(*) FILTER (WHERE p1.points_earned = p2.points_earned) AS ties,
      jsonb_agg(
        jsonb_build_object(
          'match_id', p1.match_id,
          'kickoff_time', m.kickoff_time,
          'league_name', m.league_name,
          'home_team', m.home_team,
          'away_team', m.away_team,
          'home_score', m.home_score,
          'away_score', m.away_score,
          'user_predicted_home', p1.predicted_home_score,
          'user_predicted_away', p1.predicted_away_score,
          'opponent_predicted_home', p2.predicted_home_score,
          'opponent_predicted_away', p2.predicted_away_score,
          'user_points', p1.points_earned,
          'opponent_points', p2.points_earned
        )
        ORDER BY m.kickoff_time DESC
      ) AS match_details
    FROM predictions p1
    JOIN predictions p2
      ON p2.match_id = p1.match_id
     AND p2.group_id = p1.group_id
     AND p2.user_id != p1.user_id
    JOIN matches m ON m.id = p1.match_id
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
      'ties', s.ties,
      'match_details', s.match_details
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
