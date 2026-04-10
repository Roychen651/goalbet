-- ─── Migration 030: increment_coins accepts explicit created_at ──────────────
-- Bug fix: previously, coin_transactions.created_at defaulted to NOW(), which
-- meant the recorded time was when the backend *processed* the resolution
-- (often hours after the match ended, on cold-start when a user logged in).
-- Per the user: "the times are sacred" — the transaction must reflect when
-- the match actually finished.
--
-- This migration adds an optional p_created_at parameter. When provided, it
-- is used as the coin_transactions.created_at. When NULL (or omitted by
-- legacy callers), the function falls back to NOW() for backward compatibility.

CREATE OR REPLACE FUNCTION increment_coins(
  p_user_id     UUID,
  p_group_id    UUID,
  p_match_id    UUID,
  p_amount      INTEGER,
  p_description TEXT        DEFAULT 'Prediction won',
  p_created_at  TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER  -- new balance
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance INTEGER;
  v_when    TIMESTAMPTZ := COALESCE(p_created_at, NOW());
BEGIN
  IF p_amount <= 0 THEN
    SELECT coins INTO v_balance FROM group_members
    WHERE user_id = p_user_id AND group_id = p_group_id;
    RETURN COALESCE(v_balance, 0);
  END IF;

  -- Update the balance first — this is the critical operation.
  UPDATE group_members
  SET coins = coins + p_amount
  WHERE user_id = p_user_id AND group_id = p_group_id
  RETURNING coins INTO v_balance;

  IF v_balance IS NOT NULL THEN
    -- Try to record the transaction; don't let a log failure undo the award.
    BEGIN
      INSERT INTO coin_transactions(user_id, group_id, match_id, type, amount, balance_after, description, created_at)
      VALUES (p_user_id, p_group_id, p_match_id, 'bet_won', p_amount, v_balance, p_description, v_when);
    EXCEPTION WHEN OTHERS THEN
      -- Transaction log failed — coins are still credited above. Safe to continue.
      NULL;
    END;
  END IF;

  RETURN COALESCE(v_balance, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION increment_coins(UUID, UUID, UUID, INTEGER, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION increment_coins(UUID, UUID, UUID, INTEGER, TEXT, TIMESTAMPTZ) TO authenticated;
