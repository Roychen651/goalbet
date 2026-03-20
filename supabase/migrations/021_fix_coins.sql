-- ============================================================
-- Migration 021: Fix coin system reliability
-- 1. increment_coins: wrap coin_transactions INSERT in exception
--    handler so a failed log insert never rolls back the balance update.
-- 2. claim_daily_bonus: use Israel timezone for the date comparison
--    so midnight local time (not UTC midnight) triggers the award.
-- ============================================================

-- ── Fix increment_coins ──────────────────────────────────────────────────────
-- Previously: if coin_transactions INSERT failed for any reason,
-- PostgreSQL rolled back the whole function including the group_members UPDATE,
-- meaning the player's coins were never credited.
-- Fix: wrap the INSERT in a sub-block with EXCEPTION so the UPDATE always commits.
CREATE OR REPLACE FUNCTION increment_coins(
  p_user_id     UUID,
  p_group_id    UUID,
  p_match_id    UUID,
  p_amount      INTEGER,
  p_description TEXT DEFAULT 'Prediction won'
)
RETURNS INTEGER  -- new balance
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance INTEGER;
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
      INSERT INTO coin_transactions(user_id, group_id, match_id, type, amount, balance_after, description)
      VALUES (p_user_id, p_group_id, p_match_id, 'bet_won', p_amount, v_balance, p_description);
    EXCEPTION WHEN OTHERS THEN
      -- Transaction log failed — coins are still credited above. Safe to continue.
      NULL;
    END;
  END IF;

  RETURN COALESCE(v_balance, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION increment_coins(UUID, UUID, UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION increment_coins(UUID, UUID, UUID, INTEGER, TEXT) TO authenticated;


-- ── Fix claim_daily_bonus: use Israel timezone ───────────────────────────────
-- CURRENT_DATE is UTC. Israeli users cross midnight at 22:00-23:00 UTC,
-- so the UTC date hasn't changed yet when they expect the bonus at 00:00 local.
-- Fix: derive "today" using Israel's timezone so bonus resets at local midnight.
CREATE OR REPLACE FUNCTION claim_daily_bonus(p_user_id UUID, p_group_id UUID)
RETURNS JSONB  -- { awarded: bool, amount: int, balance: int }
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last_date DATE;
  -- Use Israel timezone so the bonus resets at local midnight, not UTC midnight.
  v_today     DATE := (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE;
  v_balance   INTEGER;
BEGIN
  SELECT last_daily_bonus_date, coins INTO v_last_date, v_balance
  FROM group_members WHERE user_id = p_user_id AND group_id = p_group_id;

  IF v_last_date IS NOT DISTINCT FROM v_today THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', COALESCE(v_balance, 0));
  END IF;

  UPDATE group_members
  SET coins = coins + 30, last_daily_bonus_date = v_today
  WHERE user_id = p_user_id AND group_id = p_group_id
  RETURNING coins INTO v_balance;

  BEGIN
    INSERT INTO coin_transactions(user_id, group_id, type, amount, balance_after, description)
    VALUES (p_user_id, p_group_id, 'daily_bonus', 30, v_balance, 'Daily bonus');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- don't roll back the balance update if the log insert fails
  END;

  RETURN jsonb_build_object('awarded', true, 'amount', 30, 'balance', COALESCE(v_balance, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION claim_daily_bonus(UUID, UUID) TO authenticated;
