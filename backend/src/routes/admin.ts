/**
 * Admin routes — require roychen651@gmail.com JWT
 *
 * These routes use the service-role Supabase client which bypasses RLS.
 * Every handler verifies the caller's email before taking any action.
 *
 * Endpoints:
 *   DELETE /api/admin/users/:userId  — hard-delete user from auth.users
 *   POST   /api/admin/reset-password — send password reset email
 */
import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';

const router = Router();

const SUPER_ADMIN_EMAIL = 'roychen651@gmail.com';

/** Extract and verify the caller's JWT; returns their email or null. */
async function resolveAdminEmail(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  return user.email ?? null;
}

function isSuperAdmin(email: string | null): boolean {
  return email === SUPER_ADMIN_EMAIL;
}

// ── DELETE /api/admin/users/:userId ──────────────────────────────────────────
// Hard-deletes the user from auth.users (all public-schema data must already
// be wiped by admin_delete_user_data() RPC before calling this).
router.delete('/users/:userId', async (req: Request, res: Response) => {
  const email = await resolveAdminEmail(req);
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

// ── POST /api/admin/reset-password ────────────────────────────────────────────
// Triggers a Supabase password reset email for any user email.
router.post('/reset-password', async (req: Request, res: Response) => {
  const email = await resolveAdminEmail(req);
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { userEmail, redirectTo } = req.body as { userEmail: string; redirectTo?: string };
  if (!userEmail) {
    return res.status(400).json({ error: 'userEmail is required' });
  }

  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(userEmail, {
    redirectTo: redirectTo ?? undefined,
  });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

export default router;
