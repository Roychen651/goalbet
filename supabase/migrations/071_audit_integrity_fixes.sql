-- ─── Migration 071: Full-App Audit — Integrity Fixes (Nov 2026) ───────────────
-- Two independent, surgical fixes found during a full-app security/QA audit.
-- Both are extend-in-place (CREATE OR REPLACE, same signature as the latest
-- prior definition — no DROP needed, neither function's parameter list
-- changes) and were verified against the LATEST real definition of each
-- function (migration 054 for submit_prediction, migration 020 for
-- award_join_bonus), not re-derived from memory or from CLAUDE.md's own
-- prose — the exact discipline this codebase's own §72 already learned once
-- the hard way.

-- ============================================================
-- Fix 1: submit_prediction() now clears copied_from_user_id on every
-- direct call, since a plain call to this RPC always means "this is my
-- own fresh pick."
-- ============================================================
-- Bug found: a copy-tailed prediction (submit_copied_prediction, migration
-- 064) stamps copied_from_user_id = the root creator. If the tailing user
-- then edits their own prediction via the NORMAL edit flow
-- (usePredictions.ts -> submit_prediction() directly, not through the tail
-- RPC), the UPSERT's ON CONFLICT DO UPDATE SET clause never touched
-- copied_from_user_id — so a user's entirely self-chosen, re-picked
-- prediction kept paying the ORIGINAL creator a 5% royalty if it later won,
-- directly contradicting this codebase's own stated design intent (§62:
-- "a royalty for virality they originated").
--
-- Fix is safe for the tail flow itself: submit_copied_prediction() already
-- calls submit_prediction() FIRST, then does its own separate
-- "UPDATE predictions SET copied_from_user_id = v_root_creator" immediately
-- after (migration 064, step 6) — so clearing it inside submit_prediction()
-- only ever matters for the window between those two statements, and is
-- unconditionally overwritten back to the correct value by the tail RPC's
-- own next line. A tail followed immediately by a direct edit (bypassing
-- the tail RPC) is exactly the case this fix closes.
CREATE OR REPLACE FUNCTION submit_prediction(
  p_user_id               UUID,
  p_group_id              UUID,
  p_match_id              UUID,
  p_predicted_outcome     TEXT,     -- 'H' | 'D' | 'A' | NULL
  p_predicted_home_score  INTEGER,
  p_predicted_away_score  INTEGER,
  p_predicted_corners     TEXT,     -- 'under9' | 'ten' | 'over11' | NULL
  p_predicted_btts        BOOLEAN,
  p_predicted_over_under  TEXT,     -- 'over' | 'under' | NULL
  p_is_parlay             BOOLEAN DEFAULT false,
  p_parlay_linked_tiers   TEXT[]   DEFAULT NULL
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
  v_tier              TEXT;
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
  --    (league 4396) — enforced server-side.
  IF p_predicted_corners IS NOT NULL AND v_league_id = 4396 THEN
    RAISE EXCEPTION 'Corners predictions are not available for this competition';
  END IF;

  -- 3b. Empirically-flagged corners-unsupported leagues (migration 048).
  --     NULL (not enough resolved matches yet) fails open, same as the
  --     frontend's disabled-state computation.
  IF p_predicted_corners IS NOT NULL AND v_corners_supported IS FALSE THEN
    RAISE EXCEPTION 'Corners predictions are not available for this match';
  END IF;

  -- 3c. V5 Sprint 34 — parlay linkage validation. Every linked tier key
  --     must correspond to a tier that actually has a value in THIS call —
  --     a client can never chain a tier it isn't actually predicting.
  IF p_is_parlay THEN
    IF p_parlay_linked_tiers IS NULL
       OR array_length(p_parlay_linked_tiers, 1) < 2
       OR array_length(p_parlay_linked_tiers, 1) > 3
    THEN
      RAISE EXCEPTION 'A parlay must link 2-3 tiers';
    END IF;

    FOREACH v_tier IN ARRAY p_parlay_linked_tiers LOOP
      IF v_tier = 'result' AND p_predicted_outcome IS NULL AND
         NOT (p_predicted_home_score IS NOT NULL AND p_predicted_away_score IS NOT NULL) THEN
        RAISE EXCEPTION 'Cannot link result to a parlay without predicting it';
      ELSIF v_tier = 'score' AND (p_predicted_home_score IS NULL OR p_predicted_away_score IS NULL) THEN
        RAISE EXCEPTION 'Cannot link exact score to a parlay without predicting it';
      ELSIF v_tier = 'corners' AND p_predicted_corners IS NULL THEN
        RAISE EXCEPTION 'Cannot link corners to a parlay without predicting it';
      ELSIF v_tier = 'btts' AND p_predicted_btts IS NULL THEN
        RAISE EXCEPTION 'Cannot link BTTS to a parlay without predicting it';
      ELSIF v_tier = 'ou' AND p_predicted_over_under IS NULL THEN
        RAISE EXCEPTION 'Cannot link over/under to a parlay without predicting it';
      ELSIF v_tier NOT IN ('result','score','corners','btts','ou') THEN
        RAISE EXCEPTION 'Unknown parlay tier: %', v_tier;
      END IF;
    END LOOP;
  END IF;

  -- 4. Compute the authoritative cost from the tiers actually submitted.
  --    Chaining is FREE — parlay linkage never changes the coin cost, it
  --    only links selections that are already being paid for individually.
  IF p_predicted_home_score IS NOT NULL AND p_predicted_away_score IS NOT NULL THEN
    v_new_cost := v_new_cost + 10; -- SCORE (includes result)
  ELSIF p_predicted_outcome IS NOT NULL THEN
    v_new_cost := v_new_cost + 3;  -- RESULT_ONLY
  END IF;
  IF p_predicted_corners IS NOT NULL THEN
    v_new_cost := v_new_cost + 4;  -- CORNERS
  END IF;
  IF p_predicted_btts IS NOT NULL THEN
    v_new_cost := v_new_cost + 2;  -- BTTS
  END IF;
  IF p_predicted_over_under IS NOT NULL THEN
    v_new_cost := v_new_cost + 3;  -- OVER_UNDER
  END IF;

  -- 5. Look up the existing cost ourselves.
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

  -- 7. Upsert the prediction row itself, with the server-computed coins_bet
  --    plus the new parlay columns. copied_from_user_id = NULL on the
  --    UPDATE path only (the fix this migration adds) — a direct call to
  --    this RPC always represents the user's own fresh pick, never a tail.
  --    submit_copied_prediction() re-stamps the real value immediately
  --    after calling this function, so the tail flow is unaffected.
  INSERT INTO predictions (
    user_id, group_id, match_id,
    predicted_outcome, predicted_home_score, predicted_away_score,
    predicted_corners, predicted_btts, predicted_over_under,
    coins_bet, is_parlay, parlay_linked_tiers
  ) VALUES (
    p_user_id, p_group_id, p_match_id,
    p_predicted_outcome, p_predicted_home_score, p_predicted_away_score,
    p_predicted_corners, p_predicted_btts, p_predicted_over_under,
    v_new_cost, p_is_parlay, p_parlay_linked_tiers
  )
  ON CONFLICT (user_id, match_id, group_id) DO UPDATE SET
    predicted_outcome    = EXCLUDED.predicted_outcome,
    predicted_home_score = EXCLUDED.predicted_home_score,
    predicted_away_score = EXCLUDED.predicted_away_score,
    predicted_corners    = EXCLUDED.predicted_corners,
    predicted_btts       = EXCLUDED.predicted_btts,
    predicted_over_under = EXCLUDED.predicted_over_under,
    coins_bet            = EXCLUDED.coins_bet,
    is_parlay            = EXCLUDED.is_parlay,
    parlay_linked_tiers  = EXCLUDED.parlay_linked_tiers,
    copied_from_user_id  = NULL
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
  UUID, UUID, UUID, TEXT, INTEGER, INTEGER, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT[]
) TO authenticated;

-- ============================================================
-- Fix 2: award_join_bonus() — add the missing auth.uid() identity check.
-- ============================================================
-- Bug found: this is the only live, callable RPC in the entire schema
-- taking a p_user_id parameter with NO auth.uid() check anywhere in its
-- body — the exact "any authenticated caller could move another user's
-- coins by passing a different UUID" hole §11/§27's discipline exists to
-- forbid for every RPC from migration 040 onward (claim_daily_bonus had
-- the same gap and was dropped outright in migration 041; this one was
-- never retrofitted). Practical exploitability was already narrow (the
-- function is idempotent per (user_id, group_id) via its own
-- coin_transactions check, and the balance UPDATE only matches a row if a
-- real group_members pair already exists), but it's still a reachable,
-- unauthenticated-identity RPC, and the very next person to touch this
-- function (bumping the bonus amount, "simplifying" the idempotency
-- check) could trivially reintroduce real exploitability without
-- realizing the guard they were relying on was never the identity check
-- at all. Same signature as migration 020 — no DROP needed.
CREATE OR REPLACE FUNCTION award_join_bonus(p_user_id UUID, p_group_id UUID)
RETURNS INTEGER   -- returns new balance
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count   INTEGER;
  v_balance INTEGER;
BEGIN
  -- Identity check — caller must be the user they claim to be. First
  -- action, matching every other coin-spending RPC in this schema since
  -- migration 040 (rule 4.11/§11/§27).
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user mismatch';
  END IF;

  SELECT COUNT(*) INTO v_count FROM coin_transactions
  WHERE user_id = p_user_id AND group_id = p_group_id AND type = 'join_bonus';

  IF v_count > 0 THEN
    SELECT coins INTO v_balance FROM group_members
    WHERE user_id = p_user_id AND group_id = p_group_id;
    RETURN COALESCE(v_balance, 0);
  END IF;

  UPDATE group_members SET coins = coins + 120
  WHERE user_id = p_user_id AND group_id = p_group_id
  RETURNING coins INTO v_balance;

  INSERT INTO coin_transactions(user_id, group_id, type, amount, balance_after, description)
  VALUES (p_user_id, p_group_id, 'join_bonus', 120, v_balance, 'Welcome bonus');

  RETURN COALESCE(v_balance, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION award_join_bonus(UUID, UUID) TO authenticated;
