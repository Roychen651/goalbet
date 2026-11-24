/**
 * useAuthV2 — State machine for the auth-v2 flow.
 *
 * Views (AuthView):
 *   email        → single email field, "Continue" → optimistically goes to signin
 *   signin       → password entry; on "Invalid credentials" shows Google hint
 *   signup       → username + password; on "already registered" → oauth-merge
 *   oauth-merge  → "You usually sign in with Google" (identity collision screen)
 *   forgot       → password reset request (anti-enumeration: always shows success)
 *   check-email  → post-signup / post-reset confirmation state
 *   set-password → password update (entered via reset-link URL or Google→password merge)
 *   success      → animated checkmark before redirect
 *
 * This hook is deliberately self-contained:
 *   - Lives only in AuthContainer (not persisted, not global)
 *   - Redirect after login is handled by LoginPage's existing useEffect on authStore.user
 *   - PASSWORD_RECOVERY flow: reset link redirects to /login?type=recovery
 *     → this hook detects it on mount and jumps to set-password view
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { mapAuthError } from '../lib/authSchema';
import { useLangStore } from '../stores/langStore';
import { withAuthTimeout } from '../lib/asyncTimeout';

export type AuthView =
  | 'email'
  | 'signin'
  | 'signup'
  | 'oauth-merge'
  | 'forgot'
  | 'check-email'
  | 'set-password'
  | 'otp-sent'      // passwordless: magic link + 6-digit code emailed, awaiting code entry
  | 'success';

export type CheckEmailContext = 'signup' | 'reset' | 'google-set-password';

export interface UseAuthV2Return {
  // State
  view: AuthView;
  direction: 1 | -1;
  email: string;
  loading: boolean;
  error: string | null;
  checkEmailContext: CheckEmailContext;
  // Actions
  setEmail: (v: string) => void;
  navigateTo: (v: AuthView, dir?: 1 | -1) => void;
  handleContinue: () => void;
  handleSendMagicLink: () => Promise<void>;
  handleVerifyOtp: (code: string) => Promise<void>;
  handleSignIn: (password: string) => Promise<void>;
  handleSignUp: (username: string, password: string) => Promise<void>;
  handleForgotPassword: () => Promise<void>;
  handleGoogleSignIn: () => Promise<void>;
  handleSetPassword: (password: string) => Promise<void>;
  handleSendGooglePasswordReset: () => Promise<void>;
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
  const { signInWithGoogle } = useAuthStore();
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
  // signInWithOtp emails BOTH a magic link and a 6-digit code. The user can
  // click the link (→ /auth/callback → onAuthStateChange) OR type the code
  // here. shouldCreateUser:true makes this double as passwordless sign-up.
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
      navigateTo('otp-sent', 1);
    } finally {
      setLoading(false);
    }
  }, [email, navigateTo]);

  // ── Passwordless: verify the 6-digit code typed in-app ────────────────────
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
      // onAuthStateChange handles the redirect via LoginPage's useEffect
      navigateTo('success', 1);
    } finally {
      setLoading(false);
    }
  }, [email, navigateTo]);

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
        // "Invalid login credentials" can mean: wrong password OR Google-only account.
        // We cannot distinguish these without a server-side email lookup, so we show
        // a helpful error message + offer Google as an alternative.
        setError(mapAuthError(err.message));
        return;
      }
      // authStore.onAuthStateChange handles the redirect via LoginPage's useEffect
      navigateTo('success', 1);
    } finally {
      setLoading(false);
    }
  }, [email, navigateTo]);

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
        // "User already registered" (status 422) = email exists in Supabase Auth.
        // This is the definitive identity-collision signal → show OAuth merge screen.
        if (
          err.message.toLowerCase().includes('already registered') ||
          err.message.toLowerCase().includes('user already') ||
          (err as { status?: number }).status === 422
        ) {
          navigateTo('oauth-merge', 1);
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
  }, [email, navigateTo]);

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

  // ── Google sign-in ─────────────────────────────────────────────────────────
  // Live-reported, Nov 2026: both the email button and this one got stuck
  // spinning forever with no error and no recovery short of a hard refresh.
  // Root cause: signInWithGoogle() (authStore.ts) is already timeout-guarded
  // against its OWN promise hanging (rejectOnTimeout, fixed July 2026) — but
  // that only covers "the call never settles." If it settles successfully
  // (Supabase built the OAuth URL fine) it triggers a top-level browser
  // redirect to Google as a side effect and this component is expected to
  // unmount before anything below matters. That assumption can fail for
  // reasons entirely outside this app's control — a popup/redirect blocker,
  // a stale Google OAuth client config, a webview that disallows the
  // redirect — and when it does, the promise never rejects either, so
  // `loading` was left permanently true with zero recovery path (the exact
  // "never let a UI state hang unbounded" violation this codebase already
  // enforces everywhere else, §21). A bounded fallback watchdog closes the
  // gap: if we're still on this page a few seconds after the call resolved
  // cleanly, the redirect clearly isn't happening, so recover the UI instead
  // of leaving it stuck. In the normal case the page has already navigated
  // away long before this fires, making it a harmless no-op.
  const handleGoogleSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Captured once signInWithGoogle() resolves cleanly (see authStore.ts) —
    // the exact address the SDK was about to send the browser to. Read by
    // the watchdog below; `let`, not state, since it's only ever consumed
    // from inside a timer callback closing over this same function call.
    let computedUrl: string | undefined;
    const redirectWatchdog = setTimeout(() => {
      // Two independent prior fixes (a shorter watchdog, then switching
      // flowType pkce→implicit) left the identical symptom — the SDK
      // resolves with no error, but window.location.assign() either never
      // fires or is ignored. One more real attempt, now genuinely
      // decoupled from whatever blocked the SDK's own internal call: if
      // THAT succeeds, the page navigates away before any of the lines
      // below are even perceived. If it doesn't, show the exact computed
      // URL so the next report is hard evidence (a malformed address, a
      // wrong project ref) instead of a fourth blind guess.
      if (computedUrl) {
        try { window.location.href = computedUrl; } catch { /* fall through to the error below */ }
      }
      setLoading(false);
      setError(
        computedUrl
          ? `${t('googleRedirectFailed')} [${computedUrl}]`
          : t('googleRedirectFailed'),
      );
    }, 6000);
    try {
      computedUrl = await signInWithGoogle();
      // Resolved without throwing — a redirect should already be under way.
      // Leave the watchdog armed: if navigation genuinely happens, this
      // component unmounts and the timer is harmless; if it doesn't, the
      // watchdog above recovers the UI instead of leaving it stuck forever.
    } catch (err) {
      clearTimeout(redirectWatchdog);
      setError(err instanceof Error ? err.message : t('googleSignInFailed'));
      setLoading(false);
    }
  }, [signInWithGoogle, t]);

  // ── Set / update password ─────────────────────────────────────────────────
  // Used by both the password-recovery flow and the Google→password merge flow.
  // The user must already have a valid session (recovery or authenticated).
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

  // ── Google-account "Set a password" flow ──────────────────────────────────
  // Called from the OAuthMerge view when user wants a password for their Google account.
  // Sends a password reset email to the Google-linked address.
  const handleSendGooglePasswordReset = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await withAuthTimeout(supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login?type=recovery`,
      }));
    } catch {
      // Swallowed — show success regardless
    } finally {
      setLoading(false);
      setCheckEmailContext('google-set-password');
      navigateTo('check-email', 1);
    }
  }, [email, navigateTo]);

  return {
    view,
    direction,
    email,
    loading,
    error,
    checkEmailContext,
    setEmail,
    navigateTo,
    handleContinue,
    handleSendMagicLink,
    handleVerifyOtp,
    handleSignIn,
    handleSignUp,
    handleForgotPassword,
    handleGoogleSignIn,
    handleSetPassword,
    handleSendGooglePasswordReset,
    clearError,
    goBack,
  };
}
