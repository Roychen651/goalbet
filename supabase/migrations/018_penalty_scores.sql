-- Store the penalty shootout score (e.g. 3-0) for matches decided by penalties.
-- Separate from home_score/away_score which hold the 120-min (AET) result.
alter table matches
  add column if not exists penalty_home integer,
  add column if not exists penalty_away integer;
