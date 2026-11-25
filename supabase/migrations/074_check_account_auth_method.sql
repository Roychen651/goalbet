-- Account auth-method lookup — Nov 2026, Google sign-in removal.
--
-- Google OAuth is being removed from the app entirely (live-reported redirect
-- failures that three independent fixes couldn't resolve — a dashboard-level
-- OAuth config issue outside what this codebase can inspect or fix). Every
-- legacy user who originally signed up via Google still has a real account
-- here with NO password set (auth.users.encrypted_password is null/empty for
-- them) — they need a one-time migration: verify it's really them via a
-- Supabase-native email one-time code, then set a password.
--
-- The frontend cannot tell "wrong password" apart from "this account has no
-- password yet" on its own — supabase.auth.signInWithPassword() returns the
-- identical generic "Invalid login credentials" for both. This function is
-- the server-side lookup that makes the distinction, so the UI can route a
-- legacy Google account into the migration flow instead of a dead-end error.
--
-- SECURITY DEFINER, and deliberately NOT granted to anon/authenticated:
-- auth.users/auth.identities are never exposed via PostgREST regardless, but
-- a client-callable grant here would still make this a free, unauthenticated
-- email-enumeration oracle keyed off the public anon key — directly in
-- tension with this app's own anti-enumeration discipline for the
-- forgot-password flow (§8). Only the backend's service-role key may call
-- it (backend/src/routes/auth.ts), behind its own tight rate limit, and only
-- ever in response to a signal (a signup 422, a failed sign-in) that already
-- independently revealed the account exists — never on every keystroke.
create or replace function public.check_account_auth_method(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_encrypted_password text;
  v_has_password boolean;
begin
  select id, encrypted_password
  into v_id, v_encrypted_password
  from auth.users
  where lower(email) = lower(trim(p_email))
    and deleted_at is null
  limit 1;

  if v_id is null then
    return jsonb_build_object('exists', false, 'has_password', false);
  end if;

  v_has_password := v_encrypted_password is not null and v_encrypted_password <> '';

  return jsonb_build_object('exists', true, 'has_password', v_has_password);
end;
$$;

-- Service-role only — no GRANT to anon/authenticated. Matches the posture
-- of every other service-role-only RPC in this schema (distribute_daily_
-- allowance, credit_group_coins, compute_corners_support, …).
revoke all on function public.check_account_auth_method(text) from public, anon, authenticated;
