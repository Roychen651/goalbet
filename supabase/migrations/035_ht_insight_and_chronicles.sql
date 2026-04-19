-- Sprint 27: HT Tactical Read + Chronicler
-- 1. matches.ai_ht_insight / ai_ht_insight_he  — one-sentence half-time analyst read
-- 2. user_chronicles                            — mythic sagas for perfect scores on high-profile matches
--
-- Spec said match_id (integer); matches.id is uuid in this schema, so we use uuid.
-- Both EN + HE variants per Section 22 rule "Always generate both EN and HE".

-- ── HT INSIGHT COLUMNS ──────────────────────────────────────────────────────
alter table matches
  add column if not exists ai_ht_insight text,
  add column if not exists ai_ht_insight_he text;

-- ── USER CHRONICLES ─────────────────────────────────────────────────────────
create table if not exists user_chronicles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  group_id uuid,
  title text not null,
  epic_text text not null,
  epic_text_he text,
  predicted_home integer,
  predicted_away integer,
  final_home integer,
  final_away integer,
  points_earned integer not null default 10,
  created_at timestamptz not null default now()
);

-- One chronicle per user per match (perfect score can only happen once per match)
create unique index if not exists user_chronicles_user_match_unique
  on user_chronicles (user_id, match_id);

create index if not exists idx_user_chronicles_user_id
  on user_chronicles (user_id);

create index if not exists idx_user_chronicles_created_at
  on user_chronicles (created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table user_chronicles enable row level security;

drop policy if exists "Chronicles readable by authenticated" on user_chronicles;
create policy "Chronicles readable by authenticated"
  on user_chronicles for select
  to authenticated
  using (true);

-- Service role writes only — no insert/update/delete policies for anon/authenticated
-- (service role bypasses RLS entirely)
