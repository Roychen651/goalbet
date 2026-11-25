/**
 * ReAuthModal — Session expiry overlay.
 *
 * Slides in from the bottom over the current page when the user's session
 * expires unexpectedly (Supabase refresh token expired). Instead of a jarring
 * hard-redirect to /login, this appears as a contextual overlay so the user
 * can re-authenticate and resume exactly where they were.
 *
 * Placed inside AuthGuard (App.tsx) so it only mounts on protected routes.
 * Only active when FEATURE_FLAGS.AUTH_V2 === true.
 *
 * Google sign-in removed entirely, Nov 2026 — see useAuthV2.ts's header
 * comment for why. A legacy account that originally signed in via Google
 * has no password set — a failed password attempt here is checked against
 * the same backend lookup AuthContainer uses and, if it's one of those
 * accounts, silently routed into a one-time email code instead of a
 * dead-end "wrong password" error.
 *
 * Props:
 *   onSuccess   — called after successful re-auth; clears the overlay
 *   onSignOut   — called when user explicitly chooses "Sign out fully"; caller
 *                 resets the hadUser ref and navigates to /login
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { isEmailValid, isPasswordValid, mapAuthError } from '../../lib/authSchema';
import { checkAccountAuthMethod } from '../../lib/accountLookup';
import { PasswordStrength } from './PasswordStrength';
import { useLangStore } from '../../stores/langStore';
import { withAuthTimeout } from '../../lib/asyncTimeout';

type ReAuthView = 'main' | 'password' | 'migrate-otp' | 'set-password';

export function ReAuthModal({
  onSuccess,
  onSignOut,
}: {
  onSuccess: () => void;
  onSignOut: () => void;
}) {
  const [reAuthView, setReAuthView] = useState<ReAuthView>('main');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signOut } = useAuthStore();

  const handlePasswordSignIn = async () => {
    if (!isEmailValid(email) || !pw) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await withAuthTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password: pw }),
      );
      if (err) {
        // "Invalid login credentials" covers both a wrong password and a
        // legacy account that never had one (see useAuthV2.ts's handleSignIn
        // for the full reasoning — identical shape here).
        const status = await checkAccountAuthMethod(email.trim());
        if (status.exists && !status.hasPassword) {
          const { error: otpErr } = await withAuthTimeout(
            supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } }),
          );
          if (otpErr) { setError(mapAuthError(otpErr.message)); return; }
          setReAuthView('migrate-otp');
          setError(null);
          return;
        }
        setError(mapAuthError(err.message));
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMigrationOtp = async () => {
    if (!/^\d{4,8}$/.test(otpCode.trim())) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await withAuthTimeout(
        supabase.auth.verifyOtp({ email: email.trim(), token: otpCode.trim(), type: 'email' }),
      );
      if (err) { setError(mapAuthError(err.message)); return; }
      setReAuthView('set-password');
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async () => {
    if (!isPasswordValid(newPw) || newPw !== confirmPw) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await withAuthTimeout(supabase.auth.updateUser({ password: newPw }));
      if (err) { setError(mapAuthError(err.message)); return; }
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const handleFullSignOut = async () => {
    setLoading(true);
    await signOut();
    onSignOut();
  };

  const emailOk = isEmailValid(email);
  const newPwOk = isPasswordValid(newPw);
  const confirmOk = newPw === confirmPw && confirmPw.length > 0;
  const { t } = useLangStore();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end sm:justify-center p-4">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      />

      {/* Modal card */}
      <motion.div
        className="relative z-10 w-full max-w-sm rounded-3xl p-6 space-y-5"
        style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: [
            '0 40px 100px rgba(0,0,0,0.7)',
            'inset 0 1px 0 rgba(255,255,255,0.12)',
          ].join(', '),
        }}
        initial={{ y: 60, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, mass: 0.9 }}
      >
        <AnimatePresence mode="wait">
          {reAuthView === 'main' && (
            <motion.div
              key="main"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Lock size={18} strokeWidth={1.75} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bebas text-2xl tracking-wider text-white leading-tight">
                    Session Ended
                  </h3>
                  <p className="text-white/45 text-sm mt-0.5">
                    Your session expired. Sign in again to continue right where you left off.
                  </p>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs"
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0 mt-0.5">
                      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.1"/>
                      <path d="M6.5 4V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      <circle cx="6.5" cy="8.5" r="0.65" fill="currentColor"/>
                    </svg>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="space-y-2.5">
                {/* Email / Password */}
                <motion.button
                  type="button"
                  onClick={() => { setReAuthView('password'); setError(null); }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/6 border border-white/10
                             text-white/70 text-sm font-medium hover:bg-white/10 hover:text-white transition-all"
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <rect x="1.5" y="3.5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M1.5 5.5l6 3.5 6-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Sign in with Email & Password
                </motion.button>
              </div>

              {/* Sign out completely */}
              <div className="border-t border-white/6 pt-3">
                <button
                  type="button"
                  onClick={handleFullSignOut}
                  disabled={loading}
                  className="w-full text-center text-xs text-white/25 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  Sign out completely
                </button>
              </div>
            </motion.div>
          )}

          {reAuthView === 'password' && (
            <motion.div
              key="password"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setReAuthView('main'); setError(null); }}
                  className="text-white/30 hover:text-white/60 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <h3 className="font-bebas text-xl tracking-wider text-white">Sign Back In</h3>
              </div>

              <div className="space-y-2.5">
                <input
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none
                             bg-white/[0.06] border border-white/[0.09] focus:border-accent-green/50 focus:bg-white/[0.09] transition-all"
                />
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder={t('passwordPlaceholder')}
                    value={pw}
                    onChange={e => setPw(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePasswordSignIn()}
                    className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-white/30 outline-none
                               bg-white/[0.06] border border-white/[0.09] focus:border-accent-green/50 focus:bg-white/[0.09] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    className="absolute inset-y-0 right-3 flex items-center text-white/30 hover:text-white/60 transition-colors"
                    aria-label={t('togglePasswordVisibility')}
                  >
                    {showPw ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 2l12 12M7 4.06A5.98 5.98 0 0 1 8 4c3.31 0 6 3.58 6 4s-.44 1.03-1.14 1.97M4.35 5.35C3.07 6.26 2 7.56 2 8c0 .42 2.69 4 6 4a5.97 5.97 0 0 0 2.65-.63" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <ellipse cx="8" cy="8" rx="6" ry="4" stroke="currentColor" strokeWidth="1.3"/>
                        <circle cx="8" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                      </svg>
                    )}
                  </button>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="button"
                  onClick={handlePasswordSignIn}
                  disabled={!emailOk || !pw || loading}
                  whileHover={{ scale: (!emailOk || !pw || loading) ? 1 : 1.02 }}
                  whileTap={{ scale: (!emailOk || !pw || loading) ? 1 : 0.97 }}
                  className="flex items-center justify-center w-full py-3 rounded-xl bg-accent-green text-bg-base text-sm font-bold
                             hover:shadow-[0_0_16px_rgba(var(--color-live-glow-rgb), 0.35)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <div className="w-4 h-4 rounded-full border-2 border-bg-base/30 border-t-bg-base animate-spin" /> : 'Sign In'}
                </motion.button>
              </div>
            </motion.div>
          )}

          {reAuthView === 'migrate-otp' && (
            <motion.div
              key="migrate-otp"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div>
                <h3 className="font-bebas text-2xl tracking-wider text-white">{t('migrateVerifyTitle')}</h3>
                <p className="text-white/45 text-sm mt-0.5">
                  {t('migrateVerifySubtitle').replace('{0}', email)}
                </p>
              </div>

              <div className="space-y-2.5">
                <input
                  type="text"
                  placeholder={t('otpCodePlaceholder')}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyMigrationOtp()}
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none
                             bg-white/[0.06] border border-white/[0.09] focus:border-accent-green/50 focus:bg-white/[0.09] transition-all"
                />

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="button"
                  onClick={handleVerifyMigrationOtp}
                  disabled={!/^\d{4,8}$/.test(otpCode.trim()) || loading}
                  whileHover={{ scale: (!/^\d{4,8}$/.test(otpCode.trim()) || loading) ? 1 : 1.02 }}
                  whileTap={{ scale: (!/^\d{4,8}$/.test(otpCode.trim()) || loading) ? 1 : 0.97 }}
                  className="flex items-center justify-center w-full py-3 rounded-xl bg-accent-green text-bg-base text-sm font-bold
                             hover:shadow-[0_0_16px_rgba(var(--color-live-glow-rgb), 0.35)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <div className="w-4 h-4 rounded-full border-2 border-bg-base/30 border-t-bg-base animate-spin" /> : t('verifyCodeBtn')}
                </motion.button>
              </div>
            </motion.div>
          )}

          {reAuthView === 'set-password' && (
            <motion.div
              key="set-password"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div>
                <h3 className="font-bebas text-2xl tracking-wider text-white">Set New Password</h3>
                <p className="text-white/45 text-sm mt-0.5">Choose a strong password to secure your account.</p>
              </div>

              <div className="space-y-2.5">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder={t('choosePasswordPlaceholder')}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none
                             bg-white/[0.06] border border-white/[0.09] focus:border-accent-green/50 transition-all"
                />

                {newPw.length > 0 && (
                  <div className="px-0.5">
                    <PasswordStrength password={newPw} />
                  </div>
                )}

                {newPwOk && (
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder={t('confirmPasswordPlaceholder2')}
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSetNewPassword()}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none
                               bg-white/[0.06] border border-white/[0.09] focus:border-accent-green/50 transition-all"
                  />
                )}

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="button"
                  onClick={handleSetNewPassword}
                  disabled={!newPwOk || !confirmOk || loading}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-center w-full py-3 rounded-xl bg-accent-green text-bg-base text-sm font-bold
                             disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? <div className="w-4 h-4 rounded-full border-2 border-bg-base/30 border-t-bg-base animate-spin" /> : 'Save Password'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
