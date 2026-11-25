/**
 * useAuthV2 — State machine for the auth-v2 flow.
 *
 * Google sign-in removed entirely, Nov 2026 — three independent attempted
 * fixes (a redirect watchdog, switching flowType pkce→implicit, a genuine
 * manual-retry + diagnostic URL) all left the identical live-reported
 * symptom: the browser never actually leaves the page. Without access to
 * Google Cloud Console / Supabase's Auth dashboard from this environment,
 * that's very likely a dashboard-level OAuth config issue this codebase
 * cannot inspect or fix. Every auth path now runs entirely on Supabase's
 * own email infrastructure — no third-party identity provider in the loop.
 *
 * Views (AuthView):
 *   email          → single email field; passwordless OTP (primary) or
 *                     "Use a password instead" (secondary) → signin
 *   signin         → password entry; a failed attempt is checked against
 *                     the backend account-status lookup — a legacy account
 *                     with no password (there's no other way to have one
 *                     after removing Google) is routed straight into the
 *                     migration OTP flow instead of a dead-end error
 *   signup         → username + password; "already registered" is the same
 *                     lookup-and-branch: no password yet → migration flow,
 *                     already has one → "sign in instead"
 *   otp-sent       → shared view for BOTH passwordless sign-in codes and
 *                     migration-verification codes (`otpIntent` decides
 *                     where a verified code leads next)
 *   forgot         → password reset request (anti-enumeration: always
 *                     shows success)
 *   check-email    → post-signup / post-reset confirmation state
 *   set-password   → password creation/update (reset-link URL, OR right
 *                     after a migration OTP verifies)
 *   success        → animated checkmark before redirect
 *
 * This hook is deliberately self-contained:
 *   - Lives only in AuthContainer (not persisted, not global)
 *   - Redirect after login is handled by LoginPage's existing useEffect on
 *     authStore.user
 *   - PASSWORD_RECOVERY flow: reset link redirects to /login?type=recovery
 *     → this hook detects it on mount and jumps to set-password view
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { mapAuthError } from '../lib/authSchema';
import { checkAccountAuthMethod } from '../lib/accountLookup';
import { useLangStore } from '../stores/langStore';
import { withAuthTimeout } from '../lib/asyncTimeout';

export type AuthView =
  | 'email'
  | 'signin'
  | 'signup'
  | 'forgot'
  | 'check-email'
  | 'set-password'
  | 'otp-sent'      // shared: passwordless sign-in code AND migration code
  | 'success';

export type CheckEmailContext = 'signup' | 'reset';
// Which action an otp-sent/verify cycle is actually for — decides where a
// successful verifyOtp() navigates to next.
export type OtpIntent = 'signin' | 'migrate';

export interface UseAuthV2Return {
  // State
  view: AuthView;
  direction: 1 | -1;
  email: string;
  loading: boolean;
  error: string | null;
  checkEmailContext: CheckEmailContext;
  otpIntent: OtpIntent;
  // Actions
  setEmail: (v: string) => void;
  navigateTo: (v: AuthView, dir?: 1 | -1) => void;
  handleContinue: () => void;
  handleSendMagicLink: () => Promise<void>;
  handleVerifyOtp: (code: string) => Promise<void>;
  handleSignIn: (password: string) => Promise<void>;
  handleSignUp: (username: string, password: string) => Promise<void>;
  handleForgotPassword: () => Promise<void>;
  handleSetPassword: (password: string) => Promise<void>;
  clearError: () => void;
  goBack: () => void;
}

export function useAuthV2(): UseAuthV2Return {
  const [view, setView] = useState<AuthView>('email');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmailContext, setCheckEmailContext] = useState<CheckEmailContext>('signup');
  const [otpIntent, setOtpIntent] = useState<OtpIntent>('signin');
  const { t } = useLangStore();

  // ── Password recovery URL detection ───────────────────────────────────────
  // When user clicks the reset link in email, they land on /login?type=recovery
  // Supabase has already exchanged the token and the user has a recovery session.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('type') === 'recovery') {
      // Verify the session is valid before showing the password form.
      // Timeout-guarded (asyncTimeout.ts) — a hung call here used to leave
      // a legitimate password-reset visitor stuck with no way forward.
      // withAuthTimeout's synthetic timeout fallback carries only `error`,
      // no `data` — read `data?.session` defensively rather than
      // destructuring, so a timeout can never throw here.
      withAuthTimeout(supabase.auth.getSession()).then((result) => {
        const session = result.data?.session ?? null;
        if (session) {
          // Clean the URL so refreshing doesn't re-trigger this
          window.history.replaceState({}, '', window.location.pathname);
          navigateTo('set-password', 1);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Navigation helper ──────────────────────────────────────────────────────
  const navigateTo = useCallback((nextView: AuthView, dir: 1 | -1 = 1) => {
    setDirection(dir);
    setView(nextView);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const goBack = useCallback(() => navigateTo('email', -1), [navigateTo]);

  // ── Email view: "Continue" pressed ────────────────────────────────────────
  // We optimistically show sign-in (most users here will be returning).
  // Sign-up is an explicit "Create account" link.
  const handleContinue = useCallback(() => {
    if (!email.trim()) return;
    navigateTo('signin', 1);
  }, [email, navigateTo]);

  // ── Passwordless: send magic link + email OTP ─────────────────────────────
  // signInWithOtp emails BOTH a magic link and a numeric one-time code
  // (Supabase's own default length — see CLAUDE.md's note on this). The
  // user can click the link (→ /auth/callback → onAuthStateChange) OR type
  // the code here. shouldCreateUser:true makes this double as passwordless
  // sign-up.
  const handleSendMagicLink = useCallback(async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await withAuthTimeout(supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      }));
      if (err) {
        setError(mapAuthError(err.message));
        return;
      }
      setOtpIntent('signin');
      navigateTo('otp-sent', 1);
    } finally {
      setLoading(false);
    }
  }, [email, navigateTo]);

  // ── Migration: send a verification code to an account that exists but
  // has no password yet (every account from before Google was removed had
  // no other way to authenticate). Reuses the exact same Supabase-native
  // one-time code mechanism as passwordless sign-in — shouldCreateUser:false
  // since this path only ever runs after we've already confirmed the
  // account exists.
  const handleSendMigrationCode = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await withAuthTimeout(supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      }));
      if (err) {
        setError(mapAuthError(err.message));
        return;
      }
      setOtpIntent('migrate');
      navigateTo('otp-sent', 1);
    } finally {
      setLoading(false);
    }
  }, [email, navigateTo]);

  // ── Verify the code typed in-app ───────────────────────────────────────────
  // Shared by both intents: a plain passwordless sign-in lands the user at
  // success (they're done); a migration verification has just authenticated
  // them for the first time via code instead of a password they never had —
  // send them straight to set-password so that gap is closed immediately.
  const handleVerifyOtp = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await withAuthTimeout(supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      }));
      if (err) {
        setError(mapAuthError(err.message));
        return;
      }
      navigateTo(otpIntent === 'migrate' ? 'set-password' : 'success', 1);
    } finally {
      setLoading(false);
    }
  }, [email, otpIntent, navigateTo]);

  // ── Sign in with password ─────────────────────────────────────────────────
  const handleSignIn = useCallback(async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await withAuthTimeout(supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      }));
      if (err) {
        // "Invalid login credentials" covers two real cases: a wrong
        // password, or a legacy account that never had one set (every
        // account created before Google's removal). The backend lookup is
        // the only way to tell them apart — it fails safe toward "has a
        // password" (see accountLookup.ts), so an outage here just falls
        // through to today's ordinary "wrong password" message, never the
        // reverse.
        const status = await checkAccountAuthMethod(email.trim());
        if (status.exists && !status.hasPassword) {
          await handleSendMigrationCode();
          return;
        }
        setError(mapAuthError(err.message));
        return;
      }
      // authStore.onAuthStateChange handles the redirect via LoginPage's useEffect
      navigateTo('success', 1);
    } finally {
      setLoading(false);
    }
  }, [email, navigateTo, handleSendMigrationCode]);

  // ── Sign up with email + password ─────────────────────────────────────────
  const handleSignUp = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await withAuthTimeout(supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Pass username into user_metadata; the DB trigger reads this
          // to populate the profiles table automatically.
          data: {
            username: username.trim(),
            full_name: username.trim(),
          },
        },
      }));
      if (err) {
        // "User already registered" (status 422) = email exists in Supabase
        // Auth. Same lookup-and-branch as a failed sign-in: no password yet
        // (a legacy account) → straight into the migration flow; already
        // has one → tell them to sign in instead of leaving a confusing
        // "already registered" error sitting on the sign-up form.
        const isCollision =
          err.message.toLowerCase().includes('already registered') ||
          err.message.toLowerCase().includes('user already') ||
          (err as { status?: number }).status === 422;
        if (isCollision) {
          const status = await checkAccountAuthMethod(email.trim());
          if (status.exists && !status.hasPassword) {
            await handleSendMigrationCode();
            return;
          }
          navigateTo('signin', 1);
          setError(t('accountAlreadyExistsSignIn'));
          return;
        }
        setError(mapAuthError(err.message));
        return;
      }
      // Supabase sends a confirmation email. Show the check-inbox state.
      // If email confirmation is disabled in the Supabase project settings,
      // the user is immediately signed in (onAuthStateChange handles it).
      setCheckEmailContext('signup');
      navigateTo('check-email', 1);
    } finally {
      setLoading(false);
    }
  }, [email, navigateTo, handleSendMigrationCode, t]);

  // ── Forgot password ───────────────────────────────────────────────────────
  // Anti-enumeration: ALWAYS show the success state, whether or not the email
  // exists. Never reveal if an account is registered.
  const handleForgotPassword = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await withAuthTimeout(supabase.auth.resetPasswordForEmail(email.trim(), {
        // Must land back on /login so useAuthV2 can detect ?type=recovery on mount
        redirectTo: `${window.location.origin}/login?type=recovery`,
      }));
    } catch {
      // Intentionally swallowed — we always show success (anti-enumeration)
    } finally {
      setLoading(false);
      setCheckEmailContext('reset');
      navigateTo('check-email', 1);
    }
  }, [email, navigateTo]);

  // ── Set / update password ─────────────────────────────────────────────────
  // Used by both the password-recovery flow and right after a migration
  // OTP verifies. The user must already have a valid session (recovery or
  // freshly-authenticated-via-code).
  const handleSetPassword = useCallback(async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await withAuthTimeout(supabase.auth.updateUser({ password }));
      if (err) {
        setError(mapAuthError(err.message));
        return;
      }
      navigateTo('success', 1);
    } finally {
      setLoading(false);
    }
  }, [navigateTo]);

  return {
    view,
    direction,
    email,
    loading,
    error,
    checkEmailContext,
    otpIntent,
    setEmail,
    navigateTo,
    handleContinue,
    handleSendMagicLink,
    handleVerifyOtp,
    handleSignIn,
    handleSignUp,
    handleForgotPassword,
    handleSetPassword,
    clearError,
    goBack,
  };
}
