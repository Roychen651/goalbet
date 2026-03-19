-- Add regulation-time scores for matches that go to extra time / penalties.
-- These store the 90-minute score so predictions can be scored correctly
-- (predictions are always judged on 90-minute result, not ET/penalty result).
alter table matches
  add column if not exists regulation_home integer,
  add column if not exists regulation_away integer;

comment on column matches.regulation_home is
  'Goals scored at 90 minutes (null for normal FT matches, set only when match went to ET or penalties)';
comment on column matches.regulation_away is
  'Goals scored at 90 minutes (null for normal FT matches, set only when match went to ET or penalties)';
