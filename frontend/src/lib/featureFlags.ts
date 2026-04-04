/**
 * GoalBet Feature Flags
 * ─────────────────────────────────────────────────────────────────────────────
 * Flags are read from environment variables at build time. Setting a flag to
 * false (or simply not defining it) makes the entire feature completely inert —
 * no bundle impact, no runtime cost, no user impact.
 *
 * ── AUTH_V2 ──────────────────────────────────────────────────────────────────
 * Enables the new email + password authentication system, including:
 *   • Email / password sign-up and sign-in
 *   • Live password strength checker
 *   • Identity-collision detection ("You usually sign in with Google")
 *   • Forgot-password flow (anti-enumeration: always shows success)
 *   • Password-recovery flow (triggered from reset email link)
 *   • Session-expiry re-auth modal (slides in over current context)
 *
 * Enable  → set VITE_AUTH_V2=true in frontend/.env.local
 *           AND in Vercel → Settings → Environment Variables
 * Disable → remove the variable (or set to anything other than "true")
 *
 * ROLLBACK PROCEDURE (zero-downtime):
 *   1. Remove VITE_AUTH_V2=true from Vercel environment variables
 *   2. Trigger redeploy (Vercel dashboard → Redeploy, or push any commit)
 *   3. The entire auth-v2/ folder becomes dead code — 0 user impact
 *   4. Email/password accounts created while the flag was live remain intact
 *      in Supabase Auth; users can recover them via password reset once the
 *      flag is re-enabled, or link their Google account in the meantime.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const FEATURE_FLAGS = {
  AUTH_V2: import.meta.env.VITE_AUTH_V2 === 'true',
} as const;
