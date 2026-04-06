-- ─── Migration 026: Notification Center ─────────────────────────────────────
-- Creates a notifications table for persistent, translatable in-app notifications.
-- Notifications are inserted by the backend scoreUpdater when predictions resolve.
-- The client constructs translated text from type + metadata JSONB at render time.

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id    UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL DEFAULT 'prediction_result',
  -- i18n keys — client uses these + metadata to render translated strings
  title_key   TEXT        NOT NULL,
  body_key    TEXT        NOT NULL,
  -- Raw match/prediction data — language-independent, interpreted client-side
  metadata    JSONB       NOT NULL DEFAULT '{}',
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (user_id, is_read)
  WHERE is_read = false;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Backend uses service role which bypasses RLS; this policy covers any direct
-- anon inserts (not used but kept for completeness).
DROP POLICY IF EXISTS "notifications_insert_service" ON notifications;
CREATE POLICY "notifications_insert_service" ON notifications
  FOR INSERT WITH CHECK (true);

-- ── Helper RPC: mark_notifications_read ──────────────────────────────────────
-- Marks all unread notifications as read for the calling user (+ optional group filter).
-- Called from the client when the user opens the notification center.

DROP FUNCTION IF EXISTS mark_notifications_read(UUID, UUID);
CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_user_id  UUID,
  p_group_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow users to mark their own notifications
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_group_id IS NOT NULL THEN
    UPDATE notifications
    SET    is_read = true
    WHERE  user_id  = p_user_id
      AND  group_id = p_group_id
      AND  is_read  = false;
  ELSE
    UPDATE notifications
    SET    is_read = true
    WHERE  user_id = p_user_id
      AND  is_read = false;
  END IF;
END;
$$;
