-- Add display_clock column to matches for live minute display (e.g. "67'", "HT", "90'+3")
alter table matches add column if not exists display_clock text;
