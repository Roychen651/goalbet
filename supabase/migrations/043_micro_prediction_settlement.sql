-- ─── Migration 043: Momentum Bets settlement primitives (V4 Sprint 14) ────────
-- Two small additions needed for resolveLockedMicroQuestions() (momentumBets.ts):
--
-- 1. `settled_at` — a dedicated "has this bet been financially processed"
--    guard, deliberately separate from `is_winner`. A canceled/refunded bet
--    has no winner/loser, so `is_winner` can't double as a completion marker
--    for that path — using it that way would either be semantically wrong or,
--    worse, leave no way to distinguish "not yet processed" from "processed,
--    no outcome applies." `settled_at IS NULL` is the atomic per-bet claim
--    guard (same shape as resolveMatchPredictions' is_resolved=false claim),
--    so a crash mid-settlement-loop leaves unprocessed bets exactly as they
--    were, safely retried on the next sweep regardless of the question's own
--    status.
--
-- 2. `credit_group_coins` — a minimal atomic balance-increment primitive.
--    The Supabase JS client can't express `coins = coins + N` without either
--    a race-prone read-then-write or an RPC; this is that RPC, intentionally
--    doing nothing else (no ledger insert, no dedup index) — the caller
--    already has its own idempotency guarantee via the settled_at claim, and
--    inserting the coin_transactions row in application code (rather than
--    inside this RPC, unlike increment_coins) is what lets Momentum Bets use
--    its own distinct `type` values (micro_prediction_won /
--    micro_prediction_refund) instead of increment_coins' hardcoded
--    'bet_won', keeping the coin-history UI able to categorize them
--    separately from real prediction payouts.
--
-- Idempotent.

ALTER TABLE public.micro_prediction_bets
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.credit_group_coins(
  p_user_id  UUID,
  p_group_id UUID,
  p_amount   INTEGER
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

  RETURN COALESCE(v_balance, 0);
END;
$$;

-- No GRANT to authenticated — this is a service-role-only primitive, called
-- exclusively from momentumBets.ts after its own per-bet settlement claim
-- already guarantees single-execution. A client-callable version of "add N
-- coins to my own balance" would obviously be a critical vulnerability;
-- this function must never be granted to the authenticated role.
