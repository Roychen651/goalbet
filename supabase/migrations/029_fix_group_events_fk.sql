-- ─── Migration 029: Fix group_events FK + Enable Realtime ───────────────────
-- The FK on user_id pointed to auth.users(id) which prevents PostgREST from
-- joining to profiles. Change it to reference profiles(id) so the Supabase
-- client can do `select('*, profiles(username, avatar_url)')`.

-- ── Fix FK: auth.users → profiles ────────────────────────────────────────────

ALTER TABLE group_events
  DROP CONSTRAINT IF EXISTS group_events_user_id_fkey;

ALTER TABLE group_events
  ADD CONSTRAINT group_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ── Enable Realtime ──────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE group_events;
