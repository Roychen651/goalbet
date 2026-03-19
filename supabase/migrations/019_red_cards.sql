-- Store red card counts per team (updated live from ESPN statistics)
alter table matches
  add column if not exists red_cards_home integer,
  add column if not exists red_cards_away integer;
