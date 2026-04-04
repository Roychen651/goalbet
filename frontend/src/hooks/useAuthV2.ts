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

export type AuthView =
  | 'email'
  | 'signin'
  | 'signup'
  | 'oauth-merge'
  | 'forgot'
  | 'check-email'
  | 'set-password'
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

  // ── Password recovery URL detection ───────────────────────────────────────
  // When user clicks the reset link in email, they land on /login?type=recovery
  // Supabase has already exchanged the token and the user has a recovery session.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('type') === 'recovery') {
      // Verify the session is valid before showing the password form
      supabase.auth.getSession().then(({ data: { session } }) => {
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

  // ── Sign in with password ─────────────────────────────────────────────────
  const handleSignIn = useCallback(async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
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
      const { error: err } = await supabase.auth.signUp({
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
      });
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
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        // Must land back on /login so useAuthV2 can detect ?type=recovery on mount
        redirectTo: `${window.location.origin}/login?type=recovery`,
      });
    } catch {
      // Intentionally swallowed — we always show success (anti-enumeration)
    } finally {
      setLoading(false);
      setCheckEmailContext('reset');
      navigateTo('check-email', 1);
    }
  }, [email, navigateTo]);

  // ── Google sign-in ─────────────────────────────────────────────────────────
  const handleGoogleSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle(); // redirects — setLoading(false) never runs
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Try again.');
      setLoading(false);
    }
  }, [signInWithGoogle]);

  // ── Set / update password ─────────────────────────────────────────────────
  // Used by both the password-recovery flow and the Google→password merge flow.
  // The user must already have a valid session (recovery or authenticated).
  const handleSetPassword = useCallback(async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
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
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login?type=recovery`,
      });
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
