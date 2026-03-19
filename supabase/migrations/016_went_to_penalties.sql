-- Track whether a match required a penalty shootout to determine the winner.
-- Allows the frontend to show a "Penalties" badge / label on finished matches.
alter table matches
  add column if not exists went_to_penalties boolean not null default false;
