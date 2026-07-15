-- ─── Migration 049: submit_prediction() corners_supported guard (V4 Sprint 26) ──
-- Extends submit_prediction() (migration 040) so the server-side corners
-- guard also respects the new empirical matches.corners_supported flag
-- (migration 048), not just the static league-4396 exclusion. The client
-- (PredictionForm.tsx) disables the Corners tier chips accordingly, but per
-- this codebase's standing rule for every coin-spending RPC (§11/§27), a
-- client-side disabled state is UX, never the actual security boundary —
-- a modified client must still be rejected here.
--
-- CREATE OR REPLACE with the full, unchanged function body plus this one
-- added check — Postgres has no ALTER FUNCTION for a function body, so this
-- is the same "extend in place" pattern already used for migration 040
-- itself and get_stats_arena_payload (044 -> 045).
--
-- Idempotent.

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
  v_league_id         INTEGER;
  v_corners_supported BOOLEAN;
  v_new_cost          INTEGER := 0;
  v_old_cost          INTEGER;
  v_diff              INTEGER;
  v_coins             INTEGER;
  v_balance           INTEGER;
  v_prediction        predictions%ROWTYPE;
BEGIN
  -- 1. Identity check — caller must be the user they claim to be.
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user mismatch';
  END IF;

  -- 2. Resolve the match's league + corners_supported flag together.
  SELECT league_id, corners_supported INTO v_league_id, v_corners_supported
    FROM matches WHERE id = p_match_id;
  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  -- 3. Corners predictions are not available for International Friendlies
  --    (league 4396) — previously a frontend-only hide (LEAGUES_WITHOUT_CORNERS),
  --    now enforced server-side too.
  IF p_predicted_corners IS NOT NULL AND v_league_id = 4396 THEN
    RAISE EXCEPTION 'Corners predictions are not available for this competition';
  END IF;

  -- 3b. V4 Sprint 26 — also reject when this specific match's league has been
  --     empirically flagged as not reporting corners data (corners_supported
  --     = false). NULL (not enough resolved matches yet to judge) fails
  --     open, same as the frontend's disabled-state computation — an unknown
  --     league is treated as normal, not preemptively blocked.
  IF p_predicted_corners IS NOT NULL AND v_corners_supported IS FALSE THEN
    RAISE EXCEPTION 'Corners predictions are not available for this match';
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
