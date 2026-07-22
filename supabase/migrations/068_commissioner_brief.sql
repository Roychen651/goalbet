-- V7 Sprint 51 — "The Autonomous Commish" weekly Locker Room brief.
--
-- COMMISSIONER_BRIEF is a new group_events type: a Groq-generated weekly
-- recap (group standings, streaks, upcoming fixtures) plus a purely
-- COSMETIC weekly theme/quest name — deliberately narrative-only, never a
-- real points modifier. This codebase has an explicit, already-enforced
-- rule from Sprint 14 (§29 of CLAUDE.md): "AI never generates the question
-- or determines its resolution — only the commentary after the outcome is
-- already mechanically known... An LLM must never touch anything that
-- moves coins." An AI-invented numeric bonus applied to real scoring would
-- violate that rule directly, so this migration adds ZERO scoring surface
-- — pointsEngine.ts, submit_prediction(), and every coin-spending RPC are
-- completely untouched. The "quest" lives only inside this event's own
-- metadata as flavor text.
--
-- Dedup granularity: (group_id, week_start) — one brief per group per
-- week, deliberately its own shape (not AI_BANTER's (group_id, match_id),
-- not MICRO_BANTER's (group_id, question_id), not BATTLE_PROGRESS's
-- (battle_id, milestone)). week_start is stamped into metadata by the
-- backend via arena_current_week_start() (migration 066) — the SAME
-- DST-safe "most recent Sunday 00:00 Israel" function the Global Arena's
-- own weekly promotion sweep already uses, called via RPC from Node so
-- there is only ONE source of truth for "what week is it," never a second,
-- independently-computed JS copy that could drift from the SQL one.

-- 1. group_events — allow COMMISSIONER_BRIEF, own dedup index.
ALTER TABLE public.group_events DROP CONSTRAINT IF EXISTS group_events_event_type_check;
ALTER TABLE public.group_events ADD CONSTRAINT group_events_event_type_check
  CHECK (event_type IN (
    'PREDICTION_LOCKED', 'WON_COINS', 'LEADERBOARD_CLIMB', 'AI_BANTER', 'MICRO_BANTER',
    'POOL_CONTRIBUTION', 'BATTLE_PROGRESS', 'COMMISSIONER_BRIEF'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS group_events_commissioner_brief_unique
  ON public.group_events (group_id, (metadata->>'week_start'))
  WHERE event_type = 'COMMISSIONER_BRIEF';
