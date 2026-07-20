-- ─── Migration 062: Prediction Activity By Day (V6 Sprint 45) ──────────────
-- Backs PredictionHeatmapGrid.tsx's contribution-style grid. Deliberately
-- scoped to the last 84 days (12 weeks), not a full 365-day GitHub-style
-- year: this is a friend-group prediction game, real per-user volume is
-- dozens-to-low-hundreds of predictions a YEAR, not thousands — a dense
-- annual grid would misrepresent normal activity as sparse/broken for the
-- median user. Sparse output (one row per day that actually has a
-- resolved prediction, no zero-filled days) — the frontend fills gaps for
-- grid positioning, this function never fabricates a "0 predictions" row.
--
-- Access guard mirrors get_player_scout_report() (migration 060) exactly —
-- same shared-group model H2HModal/UserMatchHistoryModal already rely on,
-- so this RPC is reusable for a future "view a group member's activity"
-- context too, not hardcoded self-only.
--
-- Idempotent (CREATE OR REPLACE; no destructive DDL).

CREATE OR REPLACE FUNCTION public.get_prediction_activity_by_day(
  p_target_user_id UUID,
  p_group_id       UUID,
  p_days           INTEGER DEFAULT 84
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_days JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members caller
    WHERE caller.user_id = auth.uid() AND caller.group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'Access denied: caller is not a member of this group';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members target
    WHERE target.user_id = p_target_user_id AND target.group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'Access denied: target is not a member of this group';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'date'), '[]'::jsonb)
  INTO v_days
  FROM (
    SELECT jsonb_build_object(
      'date', (m.kickoff_time AT TIME ZONE 'Asia/Jerusalem')::date,
      'predictions_made', COUNT(*),
      'points_earned', SUM(p.points_earned)
    ) AS row_data
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = p_target_user_id
      AND p.group_id = p_group_id
      AND p.is_resolved = true
      AND m.kickoff_time >= NOW() - (p_days || ' days')::interval
    GROUP BY (m.kickoff_time AT TIME ZONE 'Asia/Jerusalem')::date
  ) daily;

  RETURN v_days;
END;
$$;
