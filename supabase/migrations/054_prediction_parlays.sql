-- ─── Migration 054: The Prediction Matrix — Same-Match Parlays (V5 Sprint 34) ─
-- Adds an additive-only "parlay" overlay on top of the existing 5-tier
-- independent scoring system. A parlay links 2-3 of a prediction's own tiers
-- (result/score/corners/btts/ou) into a single high-stakes combo; if every
-- linked tier is individually correct, a compounding bonus is added on top
-- of what those tiers already earn independently — it is never a
-- replacement of, or a clawback against, the existing per-tier scoring.
--
-- Why additive-only: coins_bet (submit_prediction, migration 040) is
-- computed purely from which tiers have a value, completely independent of
-- chaining. Zeroing out an individually-correct linked tier's points because
-- an UNRELATED linked tier missed would mean losing coins on a tier the
-- user actually predicted correctly, purely because they opted into
-- chaining it — a punitive trap, not the "lucrative upside" this feature is
-- meant to be. Every tier, chained or not, is still scored exactly as
-- pointsEngine.ts does today, unconditionally; the parlay bonus is a pure
-- addition on top, paid only when every linked tier hits.
--
-- No RLS policy change, no trigger change: predictions_read_group
-- (migration 037) and prevent_late_prediction() are both row-level and
-- column-agnostic — these two new columns inherit both protections
-- automatically the instant they exist on the table.

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS is_parlay BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS parlay_linked_tiers TEXT[];

-- 2-3 linked tiers only (a "parlay" of one tier is meaningless), and only
-- the five canonical tier keys already used by calcBreakdown()
-- (frontend/src/lib/utils.ts) — reusing that existing vocabulary instead of
-- inventing a second one for the same five things.
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_parlay_tiers_valid;
ALTER TABLE predictions ADD CONSTRAINT predictions_parlay_tiers_valid CHECK (
  parlay_linked_tiers IS NULL
  OR (
    array_length(parlay_linked_tiers, 1) BETWEEN 2 AND 3
    AND parlay_linked_tiers <@ ARRAY['result','score','corners','btts','ou']
  )
);

COMMENT ON COLUMN predictions.is_parlay IS
  'True when 2-3 of this row''s own tiers are chained into a single-match '
  'parlay. The base tiers still score independently and unconditionally — '
  'this flag only gates an ADDITIVE bonus in pointsEngine.ts, never a '
  'reduction of what the tiers earn on their own.';
COMMENT ON COLUMN predictions.parlay_linked_tiers IS
  'Subset of {result,score,corners,btts,ou} chained into the parlay, 2-3 '
  'entries. Validated server-side in submit_prediction() that every linked '
  'key actually has a non-null prediction value in the same call — a '
  'client can never claim a tier is linked that was never predicted.';

-- ============================================================
-- submit_prediction — extend in place (same pattern as 040 -> 049)
-- ============================================================
-- Two new parameters, both DEFAULTed so every existing call site (which
-- will simply be updated to always pass them) keeps working conceptually
-- unchanged for a non-parlay prediction. Postgres identifies a function by
-- its name + parameter TYPE LIST, not by name alone — adding two
-- parameters means CREATE OR REPLACE on the old 9-arg signature would
-- create a SECOND, overloaded function sitting alongside the original
-- rather than replacing it, silently leaving the old signature reachable
-- with none of this migration's parlay validation. The old signature is
-- therefore explicitly DROPped first — the same "a deprecated signature
-- must be dropped, not just abandoned" rule this codebase already applied
-- once to place_prediction_bet/adjust_prediction_bet (§27, migration 040).
--
-- Never trusts client-side chaining validity (§11/§27's standing rule for
-- every coin-spending RPC this function still is, even though the parlay
-- itself adds zero new coin cost) — every linked tier is checked against
-- the params actually submitted in this same call before the row is written.
DROP FUNCTION IF EXISTS submit_prediction(
  UUID, UUID, UUID, TEXT, INTEGER, INTEGER, TEXT, BOOLEAN, TEXT
);

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
  --    plus the new parlay columns.
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
    parlay_linked_tiers  = EXCLUDED.parlay_linked_tiers
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
