-- 038_push_notifications.sql
-- V3 Sprint 8: native Web Push (no OneSignal / FCM — raw Web Push API + VAPID).
--
-- (1) push_subscriptions — one row per browser/device push endpoint. The frontend
--     writes its own rows directly (RLS, insert/update/delete own); the backend
--     reads all rows via the service role when sending reminders.
-- (2) matches.reminder_sent_at — fire each match's "kicks off in 15 min" reminder
--     exactly once (the backend stamps it after sending).
--
-- Idempotent / re-runnable.

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,            -- unique per browser/device
  p256dh     text not null,                   -- client public key (from PushSubscription)
  auth       text not null,                   -- client auth secret
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- Users manage only their own subscriptions. The backend uses the service role
-- (bypasses RLS) to read every subscription when broadcasting reminders.
drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (user_id = (select auth.uid()));

-- One reminder per match.
alter table public.matches add column if not exists reminder_sent_at timestamptz;
