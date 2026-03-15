-- Track the exact streak bonus awarded when each prediction was resolved.
-- This lets the frontend display the correct bonus amount even if halftime
-- scores are later corrected in the DB (which would otherwise throw off the
-- points_earned - calcBreakdown math used before this column existed).
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS streak_bonus_earned integer NOT NULL DEFAULT 0;
