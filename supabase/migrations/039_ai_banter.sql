-- ─── Migration 039: AI Banter — "The Locker Room Provocateur" (V3 Sprint 10) ──
-- Lets the AI post context-aware H2H banter into the group activity feed as a
-- new AI_BANTER event. The AI is not a user, so user_id becomes nullable. A
-- partial unique index enforces one banter per match per group (dedup backstop
-- against concurrent cron/Render runs — same discipline as the coin/notification
-- dedup indexes). Idempotent.

-- 1. AI-authored events have no owning user.
ALTER TABLE public.group_events ALTER COLUMN user_id DROP NOT NULL;

-- 2. Extend the event_type CHECK to allow AI_BANTER.
ALTER TABLE public.group_events DROP CONSTRAINT IF EXISTS group_events_event_type_check;
ALTER TABLE public.group_events ADD CONSTRAINT group_events_event_type_check
  CHECK (event_type IN ('PREDICTION_LOCKED', 'WON_COINS', 'LEADERBOARD_CLIMB', 'AI_BANTER'));

-- 3. One banter per match per group — the concurrency backstop.
CREATE UNIQUE INDEX IF NOT EXISTS group_events_ai_banter_unique
  ON public.group_events (group_id, match_id)
  WHERE event_type = 'AI_BANTER';
