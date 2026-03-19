# GoalBet — Claude Code Guide

## Project Overview
Full-stack football prediction game. Users predict match outcomes across 5 tiers, compete on group leaderboards.

- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + Framer Motion → deployed on Vercel
- **Backend**: Node.js + Express + TypeScript → deployed on Render (free tier, sleeps when inactive)
- **Database**: Supabase (PostgreSQL + RLS + Realtime + Auth)
- **Data source**: ESPN public scoreboard API (no auth required)

Local dev: `frontend` on http://localhost:5173, `backend` on http://localhost:3001

---

## Scoring System (current)

| Tier | What | Points |
|------|------|--------|
| 1 | Full-time result (H/D/A) | +3 |
| 2 | Exact score (stacks with T1) | +7 (=10 total) |
| 3 | Total corners: ≤9 / exactly 10 / ≥11 | +4 |
| 4 | BTTS Yes/No | +2 |
| 5 | Over/Under 2.5 goals | +3 |

Max: 19 pts per match. No streak bonus (removed). Tier 3 used to be half-time result — old predictions still show HT row for backward compatibility.

---

## Key Architecture Notes

### Why the backend sleeps
Backend is on Render free tier. After ~15 min inactivity it sleeps. All cron jobs stop. Matches played while sleeping stay stale.

### How we keep it alive
Two mechanisms:
1. **On startup** (`scheduler.ts`): 5s after server start, runs `syncAllActiveLeagues()` + `checkAndUpdateScores()` — catches up any missed matches.
2. **GitHub Actions cron** (`sync-cron.yml`): runs every 30 min, calls `POST /api/sync/matches` and `POST /api/sync/scores`. This wakes the backend AND syncs data. **No auth required** on these endpoints.

### Fixture window
`matchSync.ts` calls `fetchLeagueMatches(leagueId, 7, 21)` — 7 days back, 21 days ahead. During international breaks, club matches genuinely don't exist beyond the next round, so the fixture list may not extend far.

### Corners data
`corners_total` on the `matches` table must be set manually in Supabase dashboard after each match. Once set, the backend resolves corners predictions on the next 30s poll cycle.

---

## Sync Endpoints (public, no auth)
- `POST /api/sync/matches` — triggers `syncAllActiveLeagues()`
- `POST /api/sync/scores` — triggers `checkAndUpdateScores()`
- `GET /api/health` — returns `{ status: 'ok' }`

---

## Database Migrations
Migrations are in `supabase/migrations/`. Current sequence: 001 → 014.
After adding a migration: run `supabase db push --linked` OR apply via Supabase dashboard SQL editor.
CI repairs migration history for 001–014 automatically.

---

## Important Files

| File | Purpose |
|------|---------|
| `backend/src/services/pointsEngine.ts` | Pure scoring function — source of truth |
| `backend/src/services/scoreUpdater.ts` | Resolves predictions, updates leaderboard |
| `backend/src/services/matchSync.ts` | Syncs ESPN fixtures into Supabase |
| `backend/src/services/espn.ts` | ESPN API client |
| `backend/src/cron/scheduler.ts` | Cron jobs + startup catch-up |
| `frontend/src/lib/utils.ts` | `calcBreakdown()` — mirrors pointsEngine client-side |
| `frontend/src/lib/i18n.ts` | All UI strings in EN + HE |
| `frontend/src/lib/constants.ts` | Points values, league list, status lists |
| `.github/workflows/sync-cron.yml` | 30-min GitHub Actions sync cron |
| `.github/workflows/ci.yml` | TypeScript + build CI |

---

## GitHub Secrets Required
- `BACKEND_URL` — production backend URL (e.g. `https://goalbet-api.onrender.com`)
- `SUPABASE_ACCESS_TOKEN` — for CI migration repair
- `SUPABASE_PROJECT_REF` — for CI migration repair

`SYNC_SECRET` is **not required** — sync endpoints are public.

---

## Common Pitfalls
- Don't add `SYNC_SECRET` auth back to sync routes — it caused GitHub Actions to fail with 401.
- Don't use `t('halfTimeResult')` — that i18n key was removed. Use the string `"Half Time"` for backward-compat display.
- Old predictions have `predicted_halftime_outcome` set; new predictions have `predicted_corners` set. Both are handled in `_computeBreakdown` in utils.ts.
- `Avatar` component expects emoji avatars as `emoji:🏆` (with prefix). Raw emoji strings will fail as image URLs.
