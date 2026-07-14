-- ─── Migration 040: Secure Prediction Cost (V4 Sprint 11) ─────────────────────
-- Replaces place_prediction_bet + adjust_prediction_bet (which trusted a
-- client-supplied p_cost / p_old_cost / p_new_cost) with a single atomic
-- submit_prediction() RPC that computes cost natively from the actual tier
-- columns being submitted, and performs the predictions upsert itself so
-- coins_bet can never be set independently of the authoritative cost.
--
-- Also fixes an identity-check gap present in the functions being replaced:
-- neither place_prediction_bet nor adjust_prediction_bet verified
-- p_user_id = auth.uid(), meaning any authenticated caller could pass an
-- arbitrary user_id and place predictions / move coins for someone else.
-- submit_prediction() checks this as its first action (same discipline as
-- is_super_admin() being the first action in every admin RPC).
--
-- Idempotent.

-- ============================================================
-- submit_prediction — single authoritative entry point
-- ============================================================
CREATE OR REPLACE FUNCTION submit_prediction(
  p_user_id               UUID,
  p_group_id              UUID,
  p_match_id              UUID,
  p_predicted_outcome     TEXT,     -- 'H' | 'D' | 'A' | NULL
  p_predicted_home_score  INTEGER,
  p_predicted_away_score  INTEGER,
  p_predicted_corners     TEXT,     -- 'under9' | 'ten' | 'over11' | NULL
  p_predicted_btts        BOOLEAN,
  p_predicted_over_under  TEXT      -- 'over' | 'under' | NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_league_id   INTEGER;
  v_new_cost    INTEGER := 0;
  v_old_cost    INTEGER;
  v_diff        INTEGER;
  v_coins       INTEGER;
  v_balance     INTEGER;
  v_prediction  predictions%ROWTYPE;
BEGIN
  -- 1. Identity check — caller must be the user they claim to be. Neither
  --    predecessor function checked this; any authenticated user could
  --    otherwise move another user's coins or place predictions on their
  --    behalf by passing a different p_user_id.
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user mismatch';
  END IF;

  -- 2. Resolve the match's league (needed for the corners business rule).
  SELECT league_id INTO v_league_id FROM matches WHERE id = p_match_id;
  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  -- 3. Corners predictions are not available for International Friendlies
  --    (league 4396) — previously a frontend-only hide (LEAGUES_WITHOUT_CORNERS),
  --    now enforced server-side too.
  IF p_predicted_corners IS NOT NULL AND v_league_id = 4396 THEN
    RAISE EXCEPTION 'Corners predictions are not available for this competition';
  END IF;

  -- 4. Compute the authoritative cost from the tiers actually submitted.
  --    Mirrors calcPredictionCost() in frontend/src/lib/constants.ts exactly —
  --    keep both in sync if COIN_COSTS ever changes.
  IF p_predicted_home_score IS NOT NULL AND p_predicted_away_score IS NOT NULL THEN
    v_new_cost := v_new_cost + 10; -- SCORE (includes result)
  ELSIF p_predicted_outcome IS NOT NULL THEN
    v_new_cost := v_new_cost + 3;  -- RESULT_ONLY
  END IF;
  IF p_predicted_corners IS NOT NULL THEN
    v_new_cost := v_new_cost + 4;  -- CORNERS
  END IF;
  IF p_predicted_btts IS NOT NULL THEN
    v_new_cost := v_new_cost + 2;  -- BTTS (false is a valid pick — IS NOT NULL, not truthiness)
  END IF;
  IF p_predicted_over_under IS NOT NULL THEN
    v_new_cost := v_new_cost + 3;  -- OVER_UNDER
  END IF;

  -- 5. Look up the existing cost ourselves (replaces client-supplied p_old_cost).
  SELECT coins_bet INTO v_old_cost
    FROM predictions
   WHERE user_id = p_user_id AND match_id = p_match_id AND group_id = p_group_id;
  v_old_cost := COALESCE(v_old_cost, 0);
  v_diff := v_new_cost - v_old_cost;

  -- 6. Lock the balance row and adjust by the diff.
  SELECT coins INTO v_coins FROM group_members
   WHERE user_id = p_user_id AND group_id = p_group_id FOR UPDATE;

  IF v_coins IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'member_not_found');
  END IF;

  IF v_diff > 0 AND v_coins < v_diff THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_coins', 'balance', v_coins);
  END IF;

  IF v_diff <> 0 THEN
    UPDATE group_members SET coins = coins - v_diff
     WHERE user_id = p_user_id AND group_id = p_group_id
     RETURNING coins INTO v_balance;

    INSERT INTO coin_transactions(user_id, group_id, match_id, type, amount, balance_after, description)
    VALUES (
      p_user_id, p_group_id, p_match_id, 'bet_placed', -v_diff, v_balance,
      CASE WHEN v_old_cost = 0 THEN 'Prediction placed'
           WHEN v_diff > 0 THEN 'Prediction upgraded'
           ELSE 'Prediction edit refund' END
    );
  ELSE
    SELECT coins INTO v_balance FROM group_members
     WHERE user_id = p_user_id AND group_id = p_group_id;
  END IF;

  -- 7. Upsert the prediction row itself, with the server-computed coins_bet.
  --    The client no longer writes to `predictions` directly for this flow.
  --    lock_predictions_at_kickoff (migration 037) still fires normally —
  --    it's a table-level BEFORE INSERT OR UPDATE trigger, unaffected by
  --    this function's SECURITY DEFINER context.
  INSERT INTO predictions (
    user_id, group_id, match_id,
    predicted_outcome, predicted_home_score, predicted_away_score,
    predicted_corners, predicted_btts, predicted_over_under,
    coins_bet
  ) VALUES (
    p_user_id, p_group_id, p_match_id,
    p_predicted_outcome, p_predicted_home_score, p_predicted_away_score,
    p_predicted_corners, p_predicted_btts, p_predicted_over_under,
    v_new_cost
  )
  ON CONFLICT (user_id, match_id, group_id) DO UPDATE SET
    predicted_outcome    = EXCLUDED.predicted_outcome,
    predicted_home_score = EXCLUDED.predicted_home_score,
    predicted_away_score = EXCLUDED.predicted_away_score,
    predicted_corners    = EXCLUDED.predicted_corners,
    predicted_btts       = EXCLUDED.predicted_btts,
    predicted_over_under = EXCLUDED.predicted_over_under,
    coins_bet            = EXCLUDED.coins_bet
  RETURNING * INTO v_prediction;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_balance,
    'coins_bet', v_new_cost,
    'prediction', to_jsonb(v_prediction)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_prediction(
  UUID, UUID, UUID, TEXT, INTEGER, INTEGER, TEXT, BOOLEAN, TEXT
) TO authenticated;

-- ============================================================
-- refund_prediction — coin-side of prediction deletion.
-- ProfilePage's delete flow refunds staked coins before the client removes the
-- predictions row. It previously called adjust_prediction_bet with a
-- client-supplied p_old_cost — the same trust gap as p_cost above. This RPC
-- reads coins_bet from the row itself and additionally re-checks is_resolved
-- server-side, so a resolved (already-paid-out) prediction can never be
-- refunded twice — the frontend already gates this client-side, but that's UX,
-- not a security boundary.
-- ============================================================
CREATE OR REPLACE FUNCTION refund_prediction(
  p_user_id  UUID,
  p_group_id UUID,
  p_match_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_coins_bet   INTEGER;
  v_is_resolved BOOLEAN;
  v_balance     INTEGER;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user mismatch';
  END IF;

  SELECT coins_bet, is_resolved INTO v_coins_bet, v_is_resolved
    FROM predictions
   WHERE user_id = p_user_id AND match_id = p_match_id AND group_id = p_group_id;

  IF v_coins_bet IS NULL THEN
    RETURN jsonb_build_object('success', true, 'balance', NULL); -- nothing to refund
  END IF;

  IF v_is_resolved THEN
    RAISE EXCEPTION 'Cannot refund a resolved prediction';
  END IF;

  IF v_coins_bet = 0 THEN
    SELECT coins INTO v_balance FROM group_members
     WHERE user_id = p_user_id AND group_id = p_group_id;
    RETURN jsonb_build_object('success', true, 'balance', COALESCE(v_balance, 0));
  END IF;

  UPDATE group_members SET coins = coins + v_coins_bet
   WHERE user_id = p_user_id AND group_id = p_group_id
   RETURNING coins INTO v_balance;

  INSERT INTO coin_transactions(user_id, group_id, match_id, type, amount, balance_after, description)
  VALUES (p_user_id, p_group_id, p_match_id, 'bet_placed', v_coins_bet, v_balance, 'Prediction removed — refund');

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION refund_prediction(UUID, UUID, UUID) TO authenticated;

-- ============================================================
-- Drop the two RPCs being replaced. This is required, not optional — leaving
-- them reachable via a direct supabase.rpc() call preserves the exact
-- client-trusted-cost vulnerability this migration fixes, even after the
-- frontend stops calling them.
-- ============================================================
DROP FUNCTION IF EXISTS place_prediction_bet(UUID, UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS adjust_prediction_bet(UUID, UUID, UUID, INTEGER, INTEGER);
