-- ─── Migration 046: Notification Dismiss (V4 Sprint 23) ─────────────────────
-- Adds a real "dismissed" concept to notifications, distinct from is_read.
-- Swiping a notification away in the new mobile drawer must not silently
-- reappear on the next page load — the existing table only had is_read,
-- which the fetch query never filtered on, so a client-only "remove from
-- this render" would have been an illusion of dismissal.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- The existing notifications_user_created_idx (user_id, created_at DESC)
-- already covers the fetch query efficiently at this table's per-user scale
-- (Postgres filters dismissed_at post-index-scan) — no new index needed.
