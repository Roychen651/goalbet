// Production-incident fix (July 2026) — shared timeout guards for Supabase
// auth calls. Supabase's client never rejects on its own for a hung/slow
// connection — a stalled network request just leaves the returned Promise
// pending forever. authStore.init()'s getSession() was the first call
// found with this gap (users stuck on PageLoader indefinitely); the same
// pattern turned out to be systemic across every direct supabase.auth.*
// call in useAuthV2.ts (users stuck on a permanently-spinning login/signup
// button with zero recovery path, since `finally { setLoading(false) }`
// only runs once the awaited promise actually settles). Every one of
// those call sites now routes through one of these two helpers instead of
// being fixed ad hoc, one incident report at a time.

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * For calls shaped `Promise<{ data, error }>` — every direct
 * supabase.auth.* method. If the real call hasn't settled within `ms`,
 * resolves with a synthetic `{ error: { message: 'auth_timeout' } }` in
 * the exact shape every caller already checks via `if (err)` — no
 * try/catch restructuring needed at the call site, `finally` still fires
 * on schedule. mapAuthError() recognizes 'auth_timeout' and returns a
 * real "check your connection and try again" message.
 */
export function withAuthTimeout<T extends { error: unknown }>(
  promise: Promise<T>,
  ms: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve({ error: { message: 'auth_timeout' } } as unknown as T), ms);
    }),
  ]);
}

/**
 * For calls using throw-on-error semantics (authStore.signInWithGoogle)
 * rather than a {data,error} return shape. Rejects with a real Error
 * after `ms` if the underlying promise hasn't settled, so an existing
 * try/catch at the call site handles it exactly like any other failure.
 */
export function rejectOnTimeout<T>(promise: Promise<T>, ms: number = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('auth_timeout')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
