-- ─── Migration 031: clean up duplicate coin_transactions + rebuild balances ──
-- Migration 030 prevents NEW duplicates by enforcing matchEndAt timestamps and
-- atomic prediction claims in scoreUpdater.ts. This migration cleans up the
-- EXISTING duplicate rows that were created before the race-condition fix.
--
-- Investigation (run 2026-04-10) found:
--   • 6 duplicate bet_won rows across 5 matches
--   • +42 coins of inflation in Roy's balance (593 → should be 551)
--   • All duplicates fired within milliseconds of each other — same composite
--     key (user_id, group_id, match_id, amount, description) but different ids,
--     produced by concurrent scoreUpdater workers (GitHub Actions cron + Render
--     scheduler + manual sync).
--
-- Strategy:
--   1. DELETE duplicate rows, keeping the earliest by (created_at, id) within
--      each (user_id, group_id, match_id, type, amount, description) cluster.
--      Including `description` in the partition is intentional — a "Corners
--      re-score: ..." row for the same match is a legitimate second award and
--      must NOT be merged with the original "Won X pts → Y coins" row.
--   2. REBUILD group_members.coins from the cleaned coin_transactions log so
--      the authoritative balance matches the (now-correct) ledger.
--   3. RECOMPUTE balance_after for every surviving row via a window function,
--      so the running balance shown in CoinHistoryModal stays consistent.

BEGIN;

-- ─── Step 1 · Delete duplicate bet_won rows ──────────────────────────────────
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, group_id, match_id, type, amount, description
      ORDER BY created_at, id
    ) AS rn
  FROM coin_transactions
  WHERE type = 'bet_won'
    AND match_id IS NOT NULL
)
DELETE FROM coin_transactions
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─── Step 2 · Rebuild group_members.coins from cleaned ledger ────────────────
-- The ledger is now the source of truth. Sum every transaction (positive and
-- negative) per (user_id, group_id) and overwrite the cached balance.
UPDATE group_members gm
SET coins = COALESCE(t.total, 0)
FROM (
  SELECT user_id, group_id, SUM(amount)::INTEGER AS total
  FROM coin_transactions
  GROUP BY user_id, group_id
) t
WHERE gm.user_id = t.user_id
  AND gm.group_id = t.group_id;

-- Any group_members rows with zero transactions get coins = 0 (no row in t).
-- They're not touched by the UPDATE above; if any default needs setting, the
-- column already defaults to 0 for new members.

-- ─── Step 3 · Recompute balance_after for every surviving row ────────────────
WITH ordered AS (
  SELECT
    id,
    SUM(amount) OVER (
      PARTITION BY user_id, group_id
      ORDER BY created_at, id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )::INTEGER AS new_balance
  FROM coin_transactions
)
UPDATE coin_transactions ct
SET balance_after = o.new_balance
FROM ordered o
WHERE ct.id = o.id
  AND ct.balance_after IS DISTINCT FROM o.new_balance;

COMMIT;
