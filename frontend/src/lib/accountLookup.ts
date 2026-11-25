/**
 * checkAccountAuthMethod — asks the backend (service-role access to
 * auth.users, never exposed to anon directly — see migration 074) whether
 * an email already has an account and, if so, whether it has a password
 * set yet.
 *
 * Used ONLY after an existing signal has already independently revealed the
 * account exists — a signUp() "already registered" 422, or a failed
 * signInWithPassword() attempt (the caller already believes an account
 * exists). Never called proactively on every email keystroke, so it reveals
 * nothing beyond what that signal already did.
 *
 * Fails safe: any network error, timeout, or non-OK response returns
 * `{ exists: false, hasPassword: true }` so a lookup outage can never
 * misroute a real password-holder into the no-password migration flow.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string | undefined;
const TIMEOUT_MS = 6000;

export interface AccountAuthMethod {
  exists: boolean;
  hasPassword: boolean;
}

const SAFE_FALLBACK: AccountAuthMethod = { exists: false, hasPassword: true };

export async function checkAccountAuthMethod(email: string): Promise<AccountAuthMethod> {
  if (!BACKEND_URL) return SAFE_FALLBACK;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/account-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: ctrl.signal,
    });
    if (!res.ok) return SAFE_FALLBACK;
    const data = (await res.json()) as { exists?: boolean; hasPassword?: boolean };
    return {
      exists: !!data.exists,
      hasPassword: data.exists ? !!data.hasPassword : true,
    };
  } catch {
    return SAFE_FALLBACK;
  } finally {
    clearTimeout(timer);
  }
}
