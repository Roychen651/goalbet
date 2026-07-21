-- ─── Migration 063: Redact Leaked Prediction Values From group_events ──────
-- SECURITY HOTFIX (pre-Sprint-47) — usePredictions.ts's PREDICTION_LOCKED
-- insert previously wrote predicted_outcome/predicted_home_score/
-- predicted_away_score/predicted_btts/predicted_over_under/predicted_corners
-- into group_events.metadata. Unlike the predictions table (migration 037's
-- kickoff-time RLS wall), group_events has NO time-based visibility gate —
-- useGroupEvents.ts fetches `select('*', ...)` into every group member's
-- browser filtered only by group_id, and ActivityFeed.tsx's "Prediction
-- details" block rendered those exact values unconditionally, for every
-- member, regardless of whether the match had kicked off. This bypassed the
-- predictions table's RLS wall entirely via this parallel, un-gated copy of
-- the same data.
--
-- The application-layer fix (usePredictions.ts no longer writes these
-- fields; ActivityFeed.tsx no longer renders them) only stops the leak
-- going FORWARD. Every PREDICTION_LOCKED row already inserted still carries
-- the leaked values in its metadata today. This migration strips exactly
-- those six keys from every existing PREDICTION_LOCKED row's metadata,
-- using Postgres's JSONB `-` (remove key) operator — idempotent (removing
-- an already-absent key is a no-op), keeps every other metadata key
-- (tiers_count/coins_bet/is_parlay/parlay_linked_tiers) untouched.

UPDATE group_events
SET metadata = metadata
  - 'predicted_outcome'
  - 'predicted_home_score'
  - 'predicted_away_score'
  - 'predicted_btts'
  - 'predicted_over_under'
  - 'predicted_corners'
WHERE event_type = 'PREDICTION_LOCKED';
