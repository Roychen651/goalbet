-- ─── Migration 032: bulletproof coin dedup at the DB level ──────────────────
-- Migration 030 fixed the race condition in scoreUpdater.ts (atomic claim on
-- predictions.is_resolved). Migration 031 cleaned up existing duplicates.
--
-- This migration adds defense-in-depth: even if any future code path bypasses
-- the application-level guard, the database itself will refuse to insert a
-- duplicate `bet_won` coin transaction for the same (user, group, match,
-- description) combination.
--
-- Why a PARTIAL index?
--   • daily_bonus / join_bonus rows have match_id IS NULL — must remain unique
--     by date, not by composite key
--   • bet_placed rows can legitimately repeat (a user can edit their prediction
--     multiple times — each edit is a separate stake adjustment)
--   • bet_won is the only type that should be unique per (user, group, match,
--     description), because it represents a one-time award
--
-- Why include `description` in the key?
--   • The same match can produce two legitimate bet_won rows: the original
--     "Won X pts → Y coins" award AND a later "Corners re-score: +Z pts → +W
--     coins" top-up after corners_total is entered manually. Both have the
--     same (user, group, match) but different descriptions, so both must be
--     allowed to coexist.

BEGIN;

-- ─── Step 1 · Partial unique index on bet_won transactions ───────────────────
-- This is the actual hard guarantee: Postgres will refuse a duplicate insert.
CREATE UNIQUE INDEX IF NOT EXISTS coin_transactions_bet_won_unique
  ON coin_transactions (user_id, group_id, match_id, description)
  WHERE type = 'bet_won' AND match_id IS NOT NULL;

-- ─── Step 2 · Rewrite increment_coins to use ON CONFLICT DO NOTHING ──────────
-- The previous version (migration 030) updated group_members.coins FIRST and
-- then tried to insert the log row. With concurrent workers this allowed:
--   1. Worker A: balance += amount
--   2. Worker B: balance += amount   ← double-credit
--   3. Worker A: insert log row      ← unique constraint OK on first
--   4. Worker B: insert log row      ← would now violate the unique constraint,
--                                       BUT exception was caught silently and
--                                       the double-credit on group_members
--                                       was NOT rolled back
--
-- The new version flips the order: try the log INSERT first with ON CONFLICT
-- DO NOTHING. If the row was inserted (we won), then bump the balance. If the
-- row was already there (we lost), return the existing balance unchanged.
-- This makes the function fully idempotent at the row level: calling it 100
-- times with the same args produces the same result as calling it once.

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
  v_balance     INTEGER;
  v_when        TIMESTAMPTZ := COALESCE(p_created_at, NOW());
  v_inserted_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    SELECT coins INTO v_balance FROM group_members
    WHERE user_id = p_user_id AND group_id = p_group_id;
    RETURN COALESCE(v_balance, 0);
  END IF;

  -- ── Atomic dedup guard ──────────────────────────────────────────────────
  -- Try to insert the log row first. ON CONFLICT DO NOTHING uses the partial
  -- unique index defined above as the conflict target. If a row with the
  -- same (user_id, group_id, match_id, description) already exists, the
  -- INSERT silently does nothing and v_inserted_id stays NULL.
  --
  -- We use a placeholder balance_after of -1; we'll backfill it after we
  -- know whether we won the conflict and credited the balance.
  INSERT INTO coin_transactions(
    user_id, group_id, match_id, type, amount, balance_after, description, created_at
  )
  VALUES (
    p_user_id, p_group_id, p_match_id, 'bet_won', p_amount, -1, p_description, v_when
  )
  ON CONFLICT (user_id, group_id, match_id, description)
  WHERE type = 'bet_won' AND match_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    -- Lost the race — another worker already credited this exact award.
    -- Return the current balance without modifying anything.
    SELECT coins INTO v_balance FROM group_members
    WHERE user_id = p_user_id AND group_id = p_group_id;
    RETURN COALESCE(v_balance, 0);
  END IF;

  -- Won the race — credit the balance and backfill balance_after on the
  -- row we just inserted.
  UPDATE group_members
  SET coins = coins + p_amount
  WHERE user_id = p_user_id AND group_id = p_group_id
  RETURNING coins INTO v_balance;

  IF v_balance IS NULL THEN
    -- group_members row missing — roll back the placeholder log row to keep
    -- the ledger consistent. (Should never happen in practice.)
    DELETE FROM coin_transactions WHERE id = v_inserted_id;
    RETURN 0;
  END IF;

  UPDATE coin_transactions
  SET balance_after = v_balance
  WHERE id = v_inserted_id;

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_coins(UUID, UUID, UUID, INTEGER, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION increment_coins(UUID, UUID, UUID, INTEGER, TEXT, TIMESTAMPTZ) TO authenticated;

COMMIT;
