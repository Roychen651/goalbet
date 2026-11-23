-- ─── Migration 073: Match-of-the-Week Push Dedup ───────────────────────────
-- Adds `groups.match_of_week_pushed_at TIMESTAMPTZ` — a single nullable
-- dedup timestamp, the same minimal shape as `matches.reminder_sent_at`
-- (migration 038) and `leaderboard.streak_warning_sent_at` (migration 041):
-- one column, compared against the real current week boundary (never a
-- fixed interval since the last send) to decide eligibility.
--
-- Why not an in-memory Set in the Node process: this backend runs on
-- Render's free tier, which sleeps after ~15 min idle and cold-starts on
-- the next request/cron tick (§9/§24). An in-memory dedup guard would be
-- silently wiped on every such restart, re-sending the same week's push
-- to every group on the first tick after each wake — a real spam risk for
-- a low-stakes feature that doesn't warrant it. A durable column, checked
-- against `arena_current_week_start()` (migration 066) exactly like
-- aiCommissioner.ts's own `COMMISSIONER_BRIEF` dedup already does, is the
-- correct, minimal fix — one column, not a new table, since there is
-- nothing else to store per send (no content to archive, no per-user
-- fan-out to track beyond "did this group's push fire this week").
--
-- ⚠️ NEEDS MANUAL CONFIRMATION — this sandbox has no Supabase CLI
-- installed, so the repo's auto-push PostToolUse hook could not have run
-- this. Paste this file's contents into the Supabase SQL Editor and run
-- it, then confirm ("Success. No rows returned" is the expected result).
-- backend/src/services/pushSender.ts's sendMatchOfTheWeekPush() degrades
-- safely (a failed/missing-column query just logs a warning and returns 0,
-- never throws) until this migration is applied — see that file's own
-- comment.

alter table groups
  add column if not exists match_of_week_pushed_at timestamptz;
