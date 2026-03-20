-- ============================================================
-- GoalBet — Migration 020: Coins / Currency System
-- Paste into Supabase SQL Editor and click Run
-- ============================================================

-- 1. Add coin columns to group_members
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_daily_bonus_date DATE;

-- 2. Add coins_bet to predictions (how much was staked when prediction was placed)
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS coins_bet INTEGER NOT NULL DEFAULT 0;

-- 3. Coin transactions log
CREATE TABLE IF NOT EXISTS coin_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id      UUID NOT NULL REFERENCES groups(id)   ON DELETE CASCADE,
  match_id      UUID REFERENCES matches(id)           ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN ('join_bonus','daily_bonus','bet_placed','bet_won')),
  amount        INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coin_tx_user_group
  ON coin_transactions(user_id, group_id, created_at DESC);

ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coin_tx_read_own" ON coin_transactions;
CREATE POLICY "coin_tx_read_own" ON coin_transactions FOR SELECT
  USING (user_id = auth.uid());

-- 4. Backfill: give every existing group member 120 coins
UPDATE group_members SET coins = 120 WHERE coins = 0;

-- Insert join_bonus transaction for each existing member (idempotent)
INSERT INTO coin_transactions (user_id, group_id, type, amount, balance_after, description)
SELECT gm.user_id, gm.group_id, 'join_bonus', 120, 120, 'Welcome bonus (backfilled)'
FROM group_members gm
WHERE NOT EXISTS (
  SELECT 1 FROM coin_transactions ct
  WHERE ct.user_id = gm.user_id AND ct.group_id = gm.group_id AND ct.type = 'join_bonus'
);

-- ============================================================
-- RPC: Award join bonus (120 coins, idempotent)
-- Called client-side after creating/joining a group
-- ============================================================
CREATE OR REPLACE FUNCTION award_join_bonus(p_user_id UUID, p_group_id UUID)
RETURNS INTEGER   -- returns new balance
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count   INTEGER;
  v_balance INTEGER;
BEGIN
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

-- ============================================================
-- RPC: Claim daily bonus (30 coins per calendar day, idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION claim_daily_bonus(p_user_id UUID, p_group_id UUID)
RETURNS JSONB  -- { awarded: bool, amount: int, balance: int }
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last_date DATE;
  v_today     DATE := CURRENT_DATE;
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

  INSERT INTO coin_transactions(user_id, group_id, type, amount, balance_after, description)
  VALUES (p_user_id, p_group_id, 'daily_bonus', 30, v_balance, 'Daily bonus');

  RETURN jsonb_build_object('awarded', true, 'amount', 30, 'balance', COALESCE(v_balance, 0));
END;
$$;
GRANT EXECUTE ON FUNCTION claim_daily_bonus(UUID, UUID) TO authenticated;

-- ============================================================
-- RPC: Place prediction bet — atomically deduct coins
-- ============================================================
CREATE OR REPLACE FUNCTION place_prediction_bet(
  p_user_id  UUID,
  p_group_id UUID,
  p_match_id UUID,
  p_cost     INTEGER
)
RETURNS JSONB  -- { success: bool, balance: int, error?: text }
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_coins   INTEGER;
  v_balance INTEGER;
BEGIN
  IF p_cost <= 0 THEN
    SELECT coins INTO v_balance FROM group_members
    WHERE user_id = p_user_id AND group_id = p_group_id;
    RETURN jsonb_build_object('success', true, 'balance', COALESCE(v_balance, 0));
  END IF;

  SELECT coins INTO v_coins FROM group_members
  WHERE user_id = p_user_id AND group_id = p_group_id FOR UPDATE;

  IF v_coins IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'member_not_found');
  END IF;

  IF v_coins < p_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_coins', 'balance', v_coins);
  END IF;

  UPDATE group_members SET coins = coins - p_cost
  WHERE user_id = p_user_id AND group_id = p_group_id
  RETURNING coins INTO v_balance;

  INSERT INTO coin_transactions(user_id, group_id, match_id, type, amount, balance_after, description)
  VALUES (p_user_id, p_group_id, p_match_id, 'bet_placed', -p_cost, v_balance, 'Prediction placed');

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;
GRANT EXECUTE ON FUNCTION place_prediction_bet(UUID, UUID, UUID, INTEGER) TO authenticated;

-- ============================================================
-- RPC: Adjust coins when editing a prediction
-- (refund old cost, deduct new cost — handles both directions)
-- ============================================================
CREATE OR REPLACE FUNCTION adjust_prediction_bet(
  p_user_id  UUID,
  p_group_id UUID,
  p_match_id UUID,
  p_old_cost INTEGER,
  p_new_cost INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_diff    INTEGER := p_new_cost - p_old_cost;
  v_coins   INTEGER;
  v_balance INTEGER;
BEGIN
  IF v_diff = 0 THEN
    SELECT coins INTO v_balance FROM group_members
    WHERE user_id = p_user_id AND group_id = p_group_id;
    RETURN jsonb_build_object('success', true, 'balance', COALESCE(v_balance, 0));
  END IF;

  SELECT coins INTO v_coins FROM group_members
  WHERE user_id = p_user_id AND group_id = p_group_id FOR UPDATE;

  -- Only need balance check when spending MORE
  IF v_diff > 0 AND v_coins < v_diff THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_coins', 'balance', v_coins);
  END IF;

  UPDATE group_members SET coins = coins - v_diff
  WHERE user_id = p_user_id AND group_id = p_group_id
  RETURNING coins INTO v_balance;

  INSERT INTO coin_transactions(user_id, group_id, match_id, type, amount, balance_after, description)
  VALUES (
    p_user_id, p_group_id, p_match_id, 'bet_placed', -v_diff, v_balance,
    CASE WHEN v_diff > 0 THEN 'Prediction upgraded' ELSE 'Prediction edit refund' END
  );

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;
GRANT EXECUTE ON FUNCTION adjust_prediction_bet(UUID, UUID, UUID, INTEGER, INTEGER) TO authenticated;

-- ============================================================
-- RPC: Award coins when a prediction resolves with points
-- Called by backend (service_role) — bypasses RLS
-- ============================================================
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

  UPDATE group_members SET coins = coins + p_amount
  WHERE user_id = p_user_id AND group_id = p_group_id
  RETURNING coins INTO v_balance;

  IF v_balance IS NOT NULL THEN
    INSERT INTO coin_transactions(user_id, group_id, match_id, type, amount, balance_after, description)
    VALUES (p_user_id, p_group_id, p_match_id, 'bet_won', p_amount, v_balance, p_description);
  END IF;

  RETURN COALESCE(v_balance, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION increment_coins(UUID, UUID, UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION increment_coins(UUID, UUID, UUID, INTEGER, TEXT) TO authenticated;
