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
 * Props:
 *   onSuccess   — called after successful re-auth; clears the overlay
 *   onSignOut   — called when user explicitly chooses "Sign out fully"; caller
 *                 resets the hadUser ref and navigates to /login
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { isEmailValid, isPasswordValid, mapAuthError } from '../../lib/authSchema';
import { PasswordStrength } from './PasswordStrength';
import { useLangStore } from '../../stores/langStore';

type ReAuthView = 'main' | 'password' | 'set-password';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

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
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signInWithGoogle, signOut } = useAuthStore();

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // redirect handles the rest — onSuccess called by App's useEffect on user change
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
      setLoading(false);
    }
  };

  const handlePasswordSignIn = async () => {
    if (!isEmailValid(email) || !pw) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (err) { setError(mapAuthError(err.message)); return; }
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async () => {
    if (!isPasswordValid(newPw) || newPw !== confirmPw) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPw });
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
                <div className="text-3xl leading-none">🔒</div>
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
                {/* Google */}
                <motion.button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.97 }}
                  className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-white text-gray-900 text-sm font-semibold
                             hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                >
                  {loading ? <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-800 animate-spin" /> : <GoogleIcon />}
                  Continue with Google
                </motion.button>

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
                             hover:shadow-[0_0_16px_rgba(0,255,135,0.35)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <div className="w-4 h-4 rounded-full border-2 border-bg-base/30 border-t-bg-base animate-spin" /> : 'Sign In'}
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
