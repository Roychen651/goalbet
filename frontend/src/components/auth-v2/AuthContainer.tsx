/**
 * AuthContainer — The auth-v2 UI masterpiece.
 *
 * A single floating glassmorphism card that morphs between 7 views using
 * spring-physics Framer Motion transitions. Directional slide animations
 * mimic the feel of navigating a native mobile flow.
 *
 * Views: email → signin | signup → forgot → check-email
 *        otp-sent (passwordless OR migration code) → set-password → success
 *
 * Google sign-in removed entirely, Nov 2026 — see useAuthV2.ts's header
 * comment for why. Every legacy account that was created via Google now
 * migrates in-place the first time it tries to sign in: a failed password
 * attempt (there never was one) is silently routed into the exact same
 * one-time-code screen passwordless sign-in already uses, then straight to
 * "set a password" — no separate "merge your identity" screen needed.
 *
 * This file is entirely self-contained:
 *   - All view sub-components defined inline (easy to delete the folder)
 *   - No global state written (auth state lives in authStore via useAuthV2)
 *   - Redirect after login: LoginPage's existing useEffect on authStore.user
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion';
import { useAuthV2 } from '../../hooks/useAuthV2';
import { PasswordStrength } from './PasswordStrength';
import { isEmailValid, isPasswordValid, isUsernameValid } from '../../lib/authSchema';
import { cn } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';

// ─── Shared animation config ──────────────────────────────────────────────────

const SPRING = { type: 'spring' as const, stiffness: 340, damping: 28, mass: 0.85 };

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 28 : -28,
    opacity: 0,
    scale: 0.97,
    filter: 'blur(3px)',
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { ...SPRING, opacity: { duration: 0.18 }, filter: { duration: 0.18 } },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -28 : 28,
    opacity: 0,
    scale: 0.97,
    filter: 'blur(3px)',
    transition: { duration: 0.14, ease: 'easeIn' as const },
  }),
};

// ─── Shared primitives ────────────────────────────────────────────────────────

function AuthInput({
  type = 'text',
  placeholder,
  value,
  onChange,
  onEnter,
  autoFocus = false,
  hasError = false,
  rightSlot,
  disabled = false,
}: {
  type?: 'text' | 'email' | 'password';
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  hasError?: boolean;
  rightSlot?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()}
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete={
          type === 'email' ? 'email' :
          type === 'password' ? 'current-password' :
          'username'
        }
        className={cn(
          'w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none',
          'transition-all duration-200',
          'bg-white/[0.06] border',
          'focus:bg-white/[0.09]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          hasError
            ? 'border-red-500/50 focus:border-red-400/70'
            : 'border-white/[0.09] focus:border-accent-green/50',
          rightSlot ? 'pr-11' : '',
        )}
      />
      {rightSlot && (
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          {rightSlot}
        </div>
      )}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  loading,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  loading: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled ?? loading}
      whileHover={{ scale: (disabled ?? loading) ? 1 : 1.02 }}
      whileTap={{ scale: (disabled ?? loading) ? 1 : 0.97 }}
      className={cn(
        'relative flex items-center justify-center w-full py-3 rounded-xl text-sm font-bold transition-all duration-200',
        'bg-accent-green text-bg-base',
        'shadow-[0_0_0_0_rgba(var(--color-live-glow-rgb), 0)] hover:shadow-[0_0_18px_rgba(var(--color-live-glow-rgb), 0.35)]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
      )}
    >
      {loading ? (
        <div className="w-4 h-4 rounded-full border-2 border-bg-base/30 border-t-bg-base animate-spin" />
      ) : children}
    </motion.button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ x: -2 }}
      whileTap={{ scale: 0.92 }}
      className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-xs"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </motion.button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs leading-relaxed"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5" aria-hidden>
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M7 4.5V7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="7" cy="9.5" r="0.7" fill="currentColor"/>
      </svg>
      {message}
    </motion.div>
  );
}

function EmailChip({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/6 border border-white/10 w-fit max-w-full">
      <div className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" />
      <span className="text-white/70 text-xs truncate">{email}</span>
    </div>
  );
}

// ─── VIEW: Email entry ────────────────────────────────────────────────────────

function EmailView({
  email,
  setEmail,
  onSendMagicLink,
  onContinue,
  loading,
  error,
}: {
  email: string;
  setEmail: (v: string) => void;
  onSendMagicLink: () => void;
  onContinue: () => void;
  loading: boolean;
  error: string | null;
}) {
  const valid = isEmailValid(email);
  const { t } = useLangStore();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bebas text-3xl tracking-wider text-white mb-1">Welcome to GoalBet</h2>
        <p className="text-white/45 text-sm">{t('magicLinkSubtitle')}</p>
      </div>

      <div className="space-y-3">
        <AuthInput
          type="email"
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={setEmail}
          onEnter={valid ? onSendMagicLink : undefined}
          autoFocus
          hasError={!!error}
        />
        <AnimatePresence>{error && <ErrorBanner message={error} />}</AnimatePresence>
        {/* Passwordless-first: the one-time code is the prominent primary action. */}
        <PrimaryButton onClick={onSendMagicLink} loading={loading} disabled={!valid}>
          ✉️ {t('magicLinkButton')}
        </PrimaryButton>
      </div>

      {/* Password path preserved, demoted to a secondary link (rule: fallback must exist). */}
      <button
        onClick={onContinue}
        disabled={!valid}
        className="w-full text-center text-white/50 hover:text-white/80 disabled:opacity-40 text-[13px] transition-colors pt-1"
      >
        {t('usePasswordInstead')} →
      </button>

      <p className="text-white/20 text-[11px] text-center leading-relaxed">
        By continuing you agree to compete fairly and not ruin the fun.
      </p>
    </div>
  );
}

// ─── VIEW: OTP sent (passwordless sign-in OR migration verification) ──────────

function OtpSentView({
  email,
  intent,
  onVerify,
  onResend,
  onBack,
  loading,
  error,
}: {
  email: string;
  intent: 'signin' | 'migrate';
  onVerify: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}) {
  const { t } = useLangStore();
  const [code, setCode] = useState('');
  const valid = /^\d{4,8}$/.test(code.trim());

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />
      <div>
        <h2 className="font-bebas text-3xl tracking-wider text-white mb-1">
          {intent === 'migrate' ? t('migrateVerifyTitle') : t('otpSentTitle')}
        </h2>
        <p className="text-white/45 text-sm">
          {(intent === 'migrate' ? t('migrateVerifySubtitle') : t('otpSentSubtitle')).replace('{0}', email)}
        </p>
      </div>

      <div className="space-y-3">
        <AuthInput
          type="text"
          placeholder={t('otpCodePlaceholder')}
          value={code}
          onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))}
          onEnter={valid ? () => onVerify(code) : undefined}
          autoFocus
          hasError={!!error}
        />
        <AnimatePresence>{error && <ErrorBanner message={error} />}</AnimatePresence>
        <PrimaryButton onClick={() => onVerify(code)} loading={loading} disabled={!valid}>
          {t('verifyCodeBtn')}
        </PrimaryButton>
      </div>

      <button
        onClick={onResend}
        disabled={loading}
        className="w-full text-center text-white/50 hover:text-white/80 disabled:opacity-40 text-[13px] transition-colors"
      >
        {t('resendMagicLink')}
      </button>
    </div>
  );
}

// ─── VIEW: Sign in ────────────────────────────────────────────────────────────

function SignInView({
  email,
  onSignIn,
  onForgot,
  onSignUp,
  onBack,
  loading,
  error,
}: {
  email: string;
  onSignIn: (pw: string) => void;
  onForgot: () => void;
  onSignUp: () => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const { t } = useLangStore();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <BackButton onClick={onBack} />
          <h2 className="font-bebas text-3xl tracking-wider text-white mt-2 mb-1">Welcome back</h2>
          <EmailChip email={email} />
        </div>
      </div>

      <div className="space-y-3">
        <AuthInput
          type={show ? 'text' : 'password'}
          placeholder={t('passwordPlaceholder')}
          value={pw}
          onChange={setPw}
          onEnter={() => pw && onSignIn(pw)}
          autoFocus
          hasError={!!error}
          rightSlot={
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="text-white/30 hover:text-white/60 transition-colors pointer-events-auto"
              aria-label={show ? t('hidePassword') : t('showPassword')}
            >
              {show ? (
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
          }
        />

        <AnimatePresence>{error && <ErrorBanner message={error} />}</AnimatePresence>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onForgot}
            className="text-white/35 hover:text-accent-green text-xs transition-colors"
          >
            Forgot password?
          </button>
        </div>

        <PrimaryButton onClick={() => pw && onSignIn(pw)} loading={loading} disabled={!pw}>
          Sign In
        </PrimaryButton>
      </div>

      <p className="text-center text-white/30 text-xs">
        No account?{' '}
        <button
          type="button"
          onClick={onSignUp}
          className="text-accent-green hover:underline font-medium"
        >
          Create one
        </button>
      </p>
    </div>
  );
}

// ─── VIEW: Sign up ────────────────────────────────────────────────────────────

function SignUpView({
  email,
  onSignUp,
  onBack,
  loading,
  error,
}: {
  email: string;
  onSignUp: (username: string, pw: string) => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  const usernameOk = isUsernameValid(username);
  const pwOk = isPasswordValid(pw);
  const confirmOk = confirm === pw && confirm.length > 0;
  const canSubmit = usernameOk && pwOk && confirmOk;
  const { t } = useLangStore();

  return (
    <div className="space-y-4">
      <div>
        <BackButton onClick={onBack} />
        <h2 className="font-bebas text-3xl tracking-wider text-white mt-2 mb-1">Join GoalBet</h2>
        <EmailChip email={email} />
      </div>

      <div className="space-y-2.5">
        <AuthInput
          placeholder={t('usernamePlaceholder')}
          value={username}
          onChange={setUsername}
          autoFocus
          hasError={username.length > 0 && !usernameOk}
        />

        <div className="relative">
          <AuthInput
            type={show ? 'text' : 'password'}
            placeholder={t('choosePasswordPlaceholder')}
            value={pw}
            onChange={setPw}
            hasError={!!error}
            rightSlot={
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                className="text-white/30 hover:text-white/60 transition-colors pointer-events-auto"
                aria-label={t('togglePasswordVisibility')}
              >
                {show ? (
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
            }
          />
        </div>

        {/* Live password strength meter — visible once they start typing */}
        <AnimatePresence>
          {pw.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-1 pb-0.5">
                <PasswordStrength password={pw} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm password — only show when pw is valid */}
        <AnimatePresence>
          {pwOk && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <AuthInput
                type={show ? 'text' : 'password'}
                placeholder={t('confirmPasswordPlaceholder2')}
                value={confirm}
                onChange={setConfirm}
                onEnter={() => canSubmit && onSignUp(username, pw)}
                hasError={confirm.length > 0 && !confirmOk}
                rightSlot={
                  confirmOk ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-accent-green">
                      <path d="M 2 7 L 5.5 10.5 L 12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : null
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{error && <ErrorBanner message={error} />}</AnimatePresence>

        <PrimaryButton
          onClick={() => canSubmit && onSignUp(username, pw)}
          loading={loading}
          disabled={!canSubmit}
        >
          Create Account
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─── VIEW: Forgot password ────────────────────────────────────────────────────

function ForgotView({
  email,
  setEmail,
  onSend,
  onBack,
  loading,
}: {
  email: string;
  setEmail: (v: string) => void;
  onSend: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const valid = isEmailValid(email);

  return (
    <div className="space-y-4">
      <div>
        <BackButton onClick={onBack} />
        <div className="flex items-center gap-3 mt-3 mb-1">
          <div className="text-2xl">🔑</div>
          <h2 className="font-bebas text-3xl tracking-wider text-white">Reset Password</h2>
        </div>
        <p className="text-white/45 text-sm leading-relaxed">
          Enter your email and we'll send a secure reset link. It expires in 1 hour.
        </p>
      </div>

      <div className="space-y-3">
        <AuthInput
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={setEmail}
          onEnter={valid ? onSend : undefined}
          autoFocus
        />
        <PrimaryButton onClick={onSend} loading={loading} disabled={!valid}>
          Send Reset Link
        </PrimaryButton>
      </div>

      <p className="text-white/20 text-[11px] text-center leading-relaxed">
        For security, we never reveal whether an email is registered.
      </p>
    </div>
  );
}

// ─── VIEW: Check email ────────────────────────────────────────────────────────

function CheckEmailView({
  email,
  context,
  onResend,
  onBack,
  loading,
}: {
  email: string;
  context: 'signup' | 'reset';
  onResend: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    const id = setInterval(() => setCooldown(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const meta = {
    signup: {
      icon: '📬',
      heading: 'Check your inbox',
      sub: 'We sent a confirmation link to',
      action: 'Resend confirmation',
    },
    reset: {
      icon: '📨',
      heading: 'Recovery link sent',
      sub: 'If your email is in our system, a link was sent to',
      action: 'Resend link',
    },
  }[context];

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        {/* Animated envelope */}
        <motion.div
          className="text-5xl"
          initial={{ scale: 0, y: -20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <motion.span
            animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{ duration: 0.6, delay: 0.3, ease: 'easeInOut' }}
            style={{ display: 'inline-block' }}
          >
            {meta.icon}
          </motion.span>
        </motion.div>

        <div>
          <h2 className="font-bebas text-2xl tracking-wider text-white">{meta.heading}</h2>
          <p className="text-white/45 text-sm mt-1.5 leading-relaxed max-w-[260px]">
            {meta.sub}
          </p>
          <EmailChip email={email} />
        </div>

        <p className="text-white/30 text-xs leading-relaxed max-w-[220px]">
          Can't find it? Check your spam folder. The link expires in 1 hour.
        </p>
      </div>

      {/* Quick-open links */}
      <div className="flex gap-2">
        {[
          { label: 'Open Gmail', href: 'https://mail.google.com' },
          { label: 'Open Outlook', href: 'https://outlook.live.com' },
        ].map(({ label, href }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center py-2.5 rounded-xl text-xs font-medium text-white/60 border border-white/10
                       hover:bg-white/5 hover:text-white/80 transition-all duration-200"
          >
            {label}
          </a>
        ))}
      </div>

      {/* Resend with cooldown */}
      <button
        type="button"
        onClick={() => { if (cooldown === 0) { setCooldown(60); onResend(); } }}
        disabled={cooldown > 0 || loading}
        className="w-full text-center text-xs text-white/30 hover:text-accent-green disabled:hover:text-white/30 transition-colors disabled:cursor-not-allowed"
      >
        {loading ? 'Sending...' : cooldown > 0 ? `Resend available in ${cooldown}s` : meta.action}
      </button>

      <div className="border-t border-white/6 pt-3">
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          ← Back to sign in
        </button>
      </div>
    </div>
  );
}

// ─── VIEW: Set password (recovery + migration from no-password accounts) ──────

function SetPasswordView({
  onSetPassword,
  loading,
  error,
}: {
  onSetPassword: (pw: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  const pwOk = isPasswordValid(pw);
  const confirmOk = confirm === pw && confirm.length > 0;
  const canSubmit = pwOk && confirmOk;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="text-2xl">🛡️</div>
          <h2 className="font-bebas text-3xl tracking-wider text-white">Set New Password</h2>
        </div>
        <p className="text-white/45 text-sm leading-relaxed">
          Choose a strong password for your GoalBet account.
        </p>
      </div>

      <div className="space-y-2.5">
        <AuthInput
          type={show ? 'text' : 'password'}
          placeholder="New password"
          value={pw}
          onChange={setPw}
          autoFocus
          hasError={!!error}
          rightSlot={
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="text-white/30 hover:text-white/60 transition-colors pointer-events-auto"
              aria-label="Toggle visibility"
            >
              {show ? (
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
          }
        />

        <AnimatePresence>
          {pw.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-1 pb-0.5">
                <PasswordStrength password={pw} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {pwOk && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <AuthInput
                type={show ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirm}
                onChange={setConfirm}
                onEnter={() => canSubmit && onSetPassword(pw)}
                hasError={confirm.length > 0 && !confirmOk}
                rightSlot={
                  confirmOk ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-accent-green">
                      <path d="M 2 7 L 5.5 10.5 L 12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : null
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{error && <ErrorBanner message={error} />}</AnimatePresence>

        <PrimaryButton
          onClick={() => canSubmit && onSetPassword(pw)}
          loading={loading}
          disabled={!canSubmit}
        >
          Save Password
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─── VIEW: Success (SVG checkmark before redirect) ────────────────────────────

function SuccessView() {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-4">
      {/* Drawing checkmark animation */}
      <div className="relative">
        <svg
          width="100"
          height="100"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Glowing background circle */}
          <motion.circle
            cx="50" cy="50" r="44"
            fill="rgba(var(--color-live-glow-rgb), 0.06)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          />
          {/* Border circle — draws itself */}
          <motion.circle
            cx="50" cy="50" r="44"
            stroke="rgba(var(--color-live-glow-rgb), 0.3)"
            strokeWidth="1.5"
            pathLength="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          {/* Solid accent ring — draws itself slightly delayed */}
          <motion.circle
            cx="50" cy="50" r="38"
            stroke="rgba(var(--color-live-glow-rgb), 0.15)"
            strokeWidth="1"
            pathLength="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
          />
          {/* Checkmark — draws itself after circle */}
          <motion.path
            d="M 28 50 L 44 66 L 72 34"
            stroke="rgb(var(--color-live-glow-rgb))"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            pathLength="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1], delay: 0.45 }}
          />
        </svg>

        {/* Burst glow pulse */}
        <motion.div
          className="absolute inset-0 rounded-full"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: 'easeOut' }}
          style={{ background: 'radial-gradient(circle, rgba(var(--color-live-glow-rgb), 0.25) 0%, transparent 70%)' }}
        />
      </div>

      <div>
        <motion.h2
          className="font-bebas text-4xl tracking-wider text-white"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, type: 'spring', stiffness: 300, damping: 24 }}
        >
          You're in! ⚽
        </motion.h2>
        <motion.p
          className="text-white/50 text-sm mt-1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
        >
          Taking you to your matches…
        </motion.p>
      </div>

      {/* Progress bar */}
      <motion.div className="w-full h-0.5 rounded-full bg-white/8 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-accent-green"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.8, delay: 0.5, ease: 'easeInOut' }}
          style={{ boxShadow: '0 0 8px rgba(var(--color-live-glow-rgb), 0.6)' }}
        />
      </motion.div>
    </div>
  );
}

// ─── Main container ───────────────────────────────────────────────────────────

export function AuthContainer() {
  const shouldReduceMotion = useReducedMotion();
  const {
    view, direction, email, loading, error, checkEmailContext, otpIntent,
    setEmail, navigateTo,
    handleContinue, handleSendMagicLink, handleVerifyOtp, handleSignIn, handleSignUp,
    handleForgotPassword,
    handleSetPassword,
    goBack,
  } = useAuthV2();

  // Helper: direct resend based on context
  const handleResend = () => {
    if (checkEmailContext === 'reset') {
      handleForgotPassword();
    } else {
      handleSignUp('', ''); // re-triggers the signUp RPC which re-sends confirmation
    }
  };

  const effectiveVariants = shouldReduceMotion
    ? { enter: { opacity: 0 }, center: { opacity: 1, transition: { duration: 0.15 } }, exit: { opacity: 0, transition: { duration: 0.1 } } }
    : slideVariants;

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-bg-base" aria-label="GoalBet — sign in or create account">

        {/* ── Ambient orbs (match LoginPage atmosphere) ── */}
        <div
          className="absolute -top-32 -start-32 w-[600px] h-[600px] rounded-full pointer-events-none animate-orb-drift"
          style={{ background: 'radial-gradient(circle, rgba(var(--color-live-glow-rgb), 0.11) 0%, transparent 70%)', filter: 'blur(40px)' }}
        />
        <div
          className="absolute -bottom-40 -end-20 w-[700px] h-[700px] rounded-full pointer-events-none animate-orb-drift-rev"
          style={{ background: 'radial-gradient(circle, rgba(255,107,53,0.09) 0%, transparent 65%)', filter: 'blur(50px)' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none animate-glow-pulse"
          style={{ background: 'radial-gradient(circle, rgba(100,50,255,0.05) 0%, transparent 70%)', filter: 'blur(60px)' }}
        />

        {/* ── Stadium grid overlay ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />

        {/* ── Brand logo — compact above the card ── */}
        <AnimatePresence>
          {view !== 'success' && (
            <motion.header
              className="relative z-10 flex items-baseline gap-0 mb-5"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            >
              <h1 className="sr-only">GoalBet</h1>
              <span className="font-bebas text-3xl tracking-widest text-white" aria-hidden>GOAL</span>
              <span
                className="font-bebas text-3xl tracking-widest text-accent-green"
                style={{ textShadow: '0 0 20px rgba(var(--color-live-glow-rgb), 0.4)' }}
                aria-hidden
              >
                BET
              </span>
              <span className="text-2xl ms-2" aria-hidden>⚽</span>
            </motion.header>
          )}
        </AnimatePresence>

        {/* ── Glass card ── */}
        <div className="relative z-10 w-full max-w-[400px] mx-4">
          <motion.div
            layout
            className="rounded-3xl overflow-hidden p-7"
            style={{
              background: 'rgba(255,255,255,0.055)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid rgba(255,255,255,0.095)',
              boxShadow: [
                '0 32px 80px rgba(0,0,0,0.55)',
                '0 8px 24px rgba(0,0,0,0.3)',
                'inset 0 1px 0 rgba(255,255,255,0.11)',
                'inset 0 -1px 0 rgba(0,0,0,0.15)',
              ].join(', '),
            }}
            transition={{ type: 'spring', stiffness: 200, damping: 30 }}
          >
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={view}
                custom={direction}
                variants={effectiveVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {view === 'email' && (
                  <EmailView
                    email={email}
                    setEmail={setEmail}
                    onSendMagicLink={handleSendMagicLink}
                    onContinue={handleContinue}
                    loading={loading}
                    error={error}
                  />
                )}
                {view === 'otp-sent' && (
                  <OtpSentView
                    email={email}
                    intent={otpIntent}
                    onVerify={handleVerifyOtp}
                    onResend={handleSendMagicLink}
                    onBack={() => navigateTo('email', -1)}
                    loading={loading}
                    error={error}
                  />
                )}
                {view === 'signin' && (
                  <SignInView
                    email={email}
                    onSignIn={handleSignIn}
                    onForgot={() => navigateTo('forgot', 1)}
                    onSignUp={() => navigateTo('signup', 1)}
                    onBack={goBack}
                    loading={loading}
                    error={error}
                  />
                )}
                {view === 'signup' && (
                  <SignUpView
                    email={email}
                    onSignUp={handleSignUp}
                    onBack={goBack}
                    loading={loading}
                    error={error}
                  />
                )}
                {view === 'forgot' && (
                  <ForgotView
                    email={email}
                    setEmail={setEmail}
                    onSend={handleForgotPassword}
                    onBack={() => navigateTo('signin', -1)}
                    loading={loading}
                  />
                )}
                {view === 'check-email' && (
                  <CheckEmailView
                    email={email}
                    context={checkEmailContext}
                    onResend={handleResend}
                    onBack={() => navigateTo('email', -1)}
                    loading={loading}
                  />
                )}
                {view === 'set-password' && (
                  <SetPasswordView
                    onSetPassword={handleSetPassword}
                    loading={loading}
                    error={error}
                  />
                )}
                {view === 'success' && <SuccessView />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Bottom vignette ── */}
        <div
          className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(8,13,10,0.7), transparent)' }}
        />
      </main>
    </MotionConfig>
  );
}
