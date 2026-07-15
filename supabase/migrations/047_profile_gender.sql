-- ─── Migration 047: Profile Gender (V4 Sprint 24) ───────────────────────────
-- Adds a gender preference to profiles, driving gender-correct copy across
-- notifications, the Locker Room feed, and AI-generated text (tg() in
-- lib/i18n.ts). Additive only, defaults every existing row to 'unspecified'
-- so nothing silently defaults to a wrong gender for a user who hasn't set
-- one yet.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT
  CHECK (gender IN ('male', 'female', 'unspecified'))
  DEFAULT 'unspecified' NOT NULL;

-- profiles already has an owner-write RLS policy (auth.uid() = id) that
-- covers every column including this one — no new policy needed, and no
-- new RPC either (authStore.updateGender() is a direct client write, same
-- shape as the existing updateUsername()).
