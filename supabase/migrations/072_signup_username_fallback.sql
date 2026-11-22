-- ─── Migration 072: Full-App Audit — Signup Username Fallback (Nov 2026) ──────
-- Extends handle_new_user() in place (same signature, same trigger binding
-- `on_auth_user_created` already created by migration 003 — untouched, a
-- trigger references its function by name so re-CREATE-OR-REPLACE-ing the
-- function body alone is sufficient, no DROP/recreate of the trigger
-- itself needed). Verified against the ACTUAL current body in migration
-- 003 (the only migration that has ever defined this function — confirmed
-- by grep, not assumed) before writing this, the same "extend the LATEST
-- real definition" discipline this codebase's own §72 already learned
-- once the hard way.
--
-- Bug: every magic-link signup — this app's single most-encouraged CTA,
-- per useAuthV2.ts's handleSendMagicLink()/handleVerifyOtp() — never
-- supplies full_name/name in raw_user_meta_data. The trigger's fallback,
-- `split_part(new.email, '@', 1)`, is therefore the ACTUAL, permanent
-- username for 100% of users who take the fastest path through signup —
-- raw, unsanitized, often containing digits ("roy123") — visible on every
-- social surface in the app (leaderboard, Locker Room, H2H, Trophy
-- Cabinet) forever, until the user manually finds Settings and changes it.
--
-- Fix: clean the local-part before using it — strip digits entirely,
-- turn '.', '_', '-' into word breaks (so "roy.chen123" -> "roy chen",
-- not "roychen"), collapse whitespace, then initcap() each word
-- ("roy chen" -> "Roy Chen"; "janedoe99" -> "Janedoe", a single word is
-- fine, it's just never raw-with-digits anymore). If nothing presentable
-- survives cleaning (an all-digits or all-separator local part, e.g.
-- "12345@gmail.com"), fall back to a generic, always-valid default
-- ("Player" + a random 4-digit suffix) rather than an empty/too-short
-- username — frontend/src/lib/authSchema.ts's isUsernameValid() requires
-- >= 2 characters, confirmed by reading it directly.
--
-- ⚠️ NEEDS MANUAL CONFIRMATION — this sandbox has no Supabase CLI
-- installed, so the repo's auto-push PostToolUse hook could not have run
-- this. Paste this file's contents into the Supabase SQL Editor and run
-- it, then confirm ("Success. No rows returned" is the expected result).
-- This only affects FUTURE signups — it does not retroactively rename any
-- existing user (a separate, explicit decision, not bundled in here).

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta_name  text;
  v_local_part text;
  v_cleaned    text;
  v_fallback   text;
begin
  v_meta_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');

  if v_meta_name is null then
    v_local_part := split_part(new.email, '@', 1);
    v_cleaned := trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(v_local_part, '[0-9]', '', 'g'),   -- strip digits entirely
          '[._-]+', ' ', 'g'                                 -- separators -> word breaks
        ),
        '\s+', ' ', 'g'                                      -- collapse whitespace
      )
    );

    if v_cleaned is not null and length(v_cleaned) >= 2 then
      v_fallback := initcap(v_cleaned);
    else
      -- Nothing presentable survived cleaning — generic but pleasant,
      -- always >= 2 chars, never an empty/invalid username.
      v_fallback := 'Player' || floor(random() * 9000 + 1000)::int;
    end if;
  end if;

  insert into profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(v_meta_name, v_fallback),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
