import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { logger } from '../lib/logger';

// Guards the internal, machine-triggered sync routes (GitHub Actions cron,
// Supabase pg_cron). The key lives server-side only (Render env / Supabase
// Vault) and is NEVER shipped to the browser — the public /api/sync/* routes
// stay open for the browser call sites (AppShell, useMatchSync, admin console),
// bounded by rate limiting instead. See CLAUDE.md §9 / §19.
//
// Returns 403 (not 401) on failure: the frontend's auth interceptors treat 401
// as "session expired" and would fire a re-auth flow — 403 avoids that.
export function syncAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.SYNC_API_KEY;

  // Fail closed: an internal route with no key configured is a misconfiguration,
  // never an open door.
  if (!expected) {
    logger.error('[syncAuth] SYNC_API_KEY is not set — rejecting internal sync request');
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const provided = req.headers['x-sync-key'];
  if (typeof provided !== 'string' || !safeEqual(provided, expected)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  next();
}

// Constant-time comparison so a caller can't probe the key byte-by-byte via
// response timing. Length mismatch short-circuits to false (the length itself
// isn't secret, but we must not call timingSafeEqual on unequal-length buffers).
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
