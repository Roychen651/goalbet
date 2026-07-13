import rateLimit from 'express-rate-limit';

// Baseline abuse guard across the whole API.
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// /api/sync/scores is hit by AppShell's cold-start flow (initial call + 25s
// retry) plus its own 30s live-poll interval, so a single active session can
// legitimately fire ~4 requests in the first 2 minutes. Sized with headroom
// so a few group members opening the app around the same time (possibly
// behind a shared IP) never get throttled into delayed coin payouts.
export const scoresSyncLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// /api/sync/matches is called far less often (cold-start once, manual
// "Sync Now", admin force-sync) — tighter budget than scores.
export const matchesSyncLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
