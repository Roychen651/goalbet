/**
 * Auth routes — public, tightly rate-limited.
 *
 * POST /api/auth/account-status — the ONLY way the frontend learns whether
 * an email already has a password set. Backed by migration 074's
 * check_account_auth_method() RPC, which reads auth.users directly — that
 * schema is never exposed via PostgREST, so this must go through the
 * service-role admin client here, never a client-callable Supabase RPC
 * (which would be a free, unauthenticated email-enumeration oracle keyed
 * off the public anon key). The frontend only ever calls this after an
 * existing signal (a signup "already registered" 422, a failed password
 * sign-in) already revealed the account exists — see
 * frontend/src/lib/accountLookup.ts.
 */
import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { accountStatusLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/account-status', accountStatusLimiter, async (req: Request, res: Response) => {
  const { email } = req.body as { email?: unknown };
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email is required' });
  }

  const { data, error } = await supabaseAdmin.rpc('check_account_auth_method', {
    p_email: email.trim(),
  });

  if (error) {
    // Fail safe toward "has a password" — a DB hiccup must never make a
    // real password-holder look migration-eligible to the client.
    return res.json({ exists: false, hasPassword: true });
  }

  res.json({ exists: !!data?.exists, hasPassword: !!data?.has_password });
});

export default router;
