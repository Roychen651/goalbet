-- ─── Migration 028: Group Activity Feed ("The Locker Room") ──────────────────
-- Creates a group_events table for a real-time social activity feed.
-- Events are inserted client-side (predictions) and server-side (score resolution).

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL CHECK (event_type IN ('PREDICTION_LOCKED', 'WON_COINS', 'LEADERBOARD_CLIMB')),
  match_id    UUID        REFERENCES matches(id) ON DELETE SET NULL,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS group_events_group_created_idx
  ON group_events (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS group_events_user_idx
  ON group_events (user_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE group_events ENABLE ROW LEVEL SECURITY;

-- Users can read events for groups they belong to
DROP POLICY IF EXISTS "group_events_select_members" ON group_events;
CREATE POLICY "group_events_select_members" ON group_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_events.group_id
        AND gm.user_id = auth.uid()
    )
  );

-- Users can insert events for their own group
DROP POLICY IF EXISTS "group_events_insert_own" ON group_events;
CREATE POLICY "group_events_insert_own" ON group_events
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_events.group_id
        AND gm.user_id = auth.uid()
    )
  );

-- Service role bypasses RLS for backend inserts (WON_COINS, LEADERBOARD_CLIMB)

-- ── Cleanup: auto-delete events older than 30 days ──────────────────────────
-- Run via pg_cron or manual cleanup; not enforced at insert time.
