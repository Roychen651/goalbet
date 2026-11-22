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

// Full-app audit, Nov 2026 — /api/stats/:leagueId/team/:teamId/form's
// cache key is `leagueId:teamId`, so varying teamId on every call defeats
// its own 15-min cache entirely. Post ESPN-day-loop-fix (this same
// session), a cache miss now costs 61 individual ESPN requests instead of
// 1 — the bare 60/min globalLimiter alone would let one IP trigger up to
// ~3,660 ESPN calls/minute by just varying teamId. Tight, dedicated budget.
export const teamFormLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// /api/matches/events has no in-memory cache at all (unlike every other
// ESPN-reading service in this codebase) — one real ESPN call per request,
// uncached, public. Same tightened-budget treatment for consistency.
export const matchEventsLimiter = rateLimit({
  windowMs: 60_000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
});
