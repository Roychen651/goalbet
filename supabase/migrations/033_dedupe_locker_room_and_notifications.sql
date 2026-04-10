-- ─── Migration 033: clean up locker room + notification duplicates ──────────
-- The same pre-030 race condition that duplicated coin_transactions also
-- duplicated rows in group_events (the locker room feed) and notifications.
-- Both inserts lived inside the same un-guarded block in scoreUpdater.ts:
-- two concurrent workers would both pass the un-atomic prediction update,
-- both insert into group_events, both insert into notifications.
--
-- Migration 030 fixed the application-level race (atomic claim on
-- predictions.is_resolved). Migration 031 cleaned up coin_transactions.
-- This migration cleans up the two derived tables AND adds DB-level unique
-- constraints as a defense-in-depth backstop.
--
-- Investigation (run 2026-04-10) found:
--   • 4 duplicate group_events WON_COINS rows (Bologna ×2, Freiburg ×2, Mainz ×3)
--   • 3 duplicate notifications prediction_result rows
--   • All visible in the user's locker room screenshot
--
-- The dedup keys are intentionally narrower than coin_transactions:
--   • group_events: (group_id, user_id, event_type, match_id) — there is only
--     ever ONE WON_COINS event per (user, match) per group; the corners
--     re-score path does not insert into group_events
--   • notifications: (user_id, type, metadata->>match_id) — same reasoning;
--     one prediction_result notification per (user, match)

BEGIN;

-- ─── Step 1 · Delete duplicate group_events WON_COINS rows ───────────────────
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY group_id, user_id, event_type, match_id
      ORDER BY created_at, id
    ) AS rn
  FROM group_events
  WHERE event_type = 'WON_COINS'
    AND match_id IS NOT NULL
)
DELETE FROM group_events
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─── Step 2 · Delete duplicate notifications prediction_result rows ──────────
-- metadata is JSONB; we use the ->> operator to extract the match_id text.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, type, (metadata->>'match_id')
      ORDER BY created_at, id
    ) AS rn
  FROM notifications
  WHERE type = 'prediction_result'
    AND metadata ? 'match_id'
)
DELETE FROM notifications
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─── Step 3 · Backstop: partial unique index on group_events ─────────────────
-- Even if any future application code path bypasses the atomic claim, the
-- database will refuse a duplicate WON_COINS event for the same (group, user,
-- match). Other event types (LOCKED_PREDICTION, etc.) are not constrained.
CREATE UNIQUE INDEX IF NOT EXISTS group_events_won_coins_unique
  ON group_events (group_id, user_id, match_id)
  WHERE event_type = 'WON_COINS' AND match_id IS NOT NULL;

-- ─── Step 4 · Backstop: partial unique index on notifications ────────────────
-- One prediction_result notification per (user, match). Other notification
-- types (e.g. daily bonus) are not constrained.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_prediction_result_unique
  ON notifications (user_id, (metadata->>'match_id'))
  WHERE type = 'prediction_result' AND metadata ? 'match_id';

COMMIT;
