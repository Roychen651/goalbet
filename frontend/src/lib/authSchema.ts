/**
 * Auth Validation Schema — pure functions, zero dependencies.
 * Mirrors the security policy enforced by Supabase Auth server-side.
 * Used by useAuthV2 and the live PasswordStrength component.
 */

// ─── Password ─────────────────────────────────────────────────────────────────

export interface PasswordRequirements {
  minLength: boolean;   // ≥ 8 characters
  hasUppercase: boolean; // A-Z
  hasLowercase: boolean; // a-z
  hasNumber: boolean;    // 0-9
  hasSpecial: boolean;   // !@#$%... etc.
}

export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'strong' | 'very-strong';

export function checkPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength:    password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber:    /\d/.test(password),
    hasSpecial:   /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password),
  };
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'empty';
  const met = Object.values(checkPasswordRequirements(password)).filter(Boolean).length;
  if (met <= 2) return 'weak';
  if (met === 3) return 'fair';
  if (met === 4) return 'strong';
  return 'very-strong';
}

/** All 5 requirements must be met. */
export function isPasswordValid(password: string): boolean {
  return Object.values(checkPasswordRequirements(password)).every(Boolean);
}

// ─── Email ────────────────────────────────────────────────────────────────────

export function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ─── Username ─────────────────────────────────────────────────────────────────

/** 2–30 chars; letters, numbers, underscores, spaces, and Unicode (Hebrew etc.) */
export function isUsernameValid(username: string): boolean {
  const t = username.trim();
  return t.length >= 2 && t.length <= 30 && /^[\w\s\u0080-\uFFFF]+$/.test(t);
}

// ─── Supabase error → human string mapping ────────────────────────────────────

export function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials'))
    return 'Incorrect email or password. Try again, or use Google to sign in.';
  if (m.includes('already registered') || m.includes('user already'))
    return 'An account with this email already exists.';
  if (m.includes('email not confirmed'))
    return 'Please confirm your email first. Check your inbox for the verification link.';
  if (m.includes('password should be at least') || m.includes('weak password'))
    return 'Password is too weak. Use at least 8 characters with uppercase, numbers & symbols.';
  if (m.includes('rate limit') || m.includes('only request this after') || m.includes('too many'))
    return 'Too many attempts. Please wait a minute and try again.';
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch'))
    return 'Connection error. Check your internet connection and try again.';
  if (m.includes('email address') && m.includes('invalid'))
    return 'That doesn\'t look like a valid email address.';
  return message; // fallback: show raw message
}
