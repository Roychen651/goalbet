-- Store the actual halftime points earned at resolution time.
-- Nullable so we can distinguish old predictions (NULL = unknown) from new ones
-- (0 = HT wrong, 4 = HT correct). Prevents ESPN's late HT corrections from
-- making correctly-scored HT predictions appear wrong on the frontend.
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS halftime_pts_earned integer;
