-- Replace half-time prediction with corners prediction.
-- Three buckets: ≤9 corners, exactly 10, ≥11 corners (4 pts, same as old HT tier).
-- corners_total on matches is populated by admin after the match (or future API integration).

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS predicted_corners text
    CHECK (predicted_corners IN ('under9', 'ten', 'over11'));

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS corners_total integer;
