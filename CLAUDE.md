# GoalBet — Claude Code Guide

## Project Overview
Full-stack football prediction game for friend groups. Users predict match outcomes across 5 tiers, stake coins on predictions, and compete on group leaderboards.

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

## Coin Economy

Users stake coins on predictions and earn back `points_earned × 2` coins when resolved.

| Event | Coins |
|-------|-------|
| Join bonus (one-time) | +120 |
| Daily bonus | +30 |
| Coins staked per prediction | = sum of tiers bet on |
| Coins earned back | points_earned × 2 |

**UX philosophy**: Never show negative coin numbers to users. Always show `+coinsBack` (always ≥ 0). Only show a "profit" line when `coinsBack > coinsBet`.

**Coin costs per tier** (in `constants.ts → COIN_COSTS`): Result=3, Score=10 (result+exact), Corners=4, BTTS=2, O/U=3. Max staked per match = 19 (mirrors max pts).

Key DB functions: `increment_coins(user_id, amount)`, `claim_daily_bonus(user_id)` (uses `Asia/Jerusalem` timezone for daily reset).

---

## Key Architecture Notes

### Why the backend sleeps
Backend is on Render free tier. After ~15 min inactivity it sleeps. All cron jobs stop. Matches played while sleeping stay stale.

### How we keep it alive
Two mechanisms:
1. **On startup** (`scheduler.ts`): 5s after server start, runs `syncAllActiveLeagues()` + `checkAndUpdateScores()` — catches up any missed matches.
2. **GitHub Actions cron** (`sync-cron.yml`): runs every 30 min, calls `POST /api/sync/matches` and `POST /api/sync/scores`. This wakes the backend AND syncs data. **No auth required** on these endpoints.

### Fixture window
`matchSync.ts` calls `fetchLeagueMatches(leagueId, 7, 21)` — 7 days back, 21 days ahead.

### Corners data
`corners_total` on the `matches` table must be set manually in Supabase dashboard after each match. Once set, the backend resolves corners predictions on the next 30s poll cycle.

### Extra time / penalties
Knockout matches can go to ET (`ET1`, `ET2`, `AET`) then penalties (`PEN`). `STATUS_FINAL_AET` and `STATUS_FINAL_PK` from ESPN both map to `'FT'` in our system.

`regulation_home` / `regulation_away` store the 90-minute score. Prediction scoring always uses these. `went_to_penalties` (boolean) and `penalty_home`/`penalty_away` store shootout result.

---

## Theme System

The app supports **dark mode** (default) and **light mode** toggled via `ThemeToggle`.

- `html.light` class is applied to `<html>` element when light mode is active (`themeStore.ts`)
- CSS design tokens defined in `index.css` under `:root` (dark) and `html.light` (light)
- Key tokens: `--color-tooltip-bg`, `--color-tooltip-text`, `--color-tooltip-border` (used by `InfoTip`)
- Light mode overrides for Tailwind opacity utilities (e.g. `text-white/18`, `bg-white/25`) are in `index.css`
- **Never use hardcoded dark hex colors** in modals/tooltips — use `card-elevated` class or CSS vars instead

---

## Internationalisation (i18n)

All UI strings live in `frontend/src/lib/i18n.ts` as `en` and `he` objects. The `TranslationKey` type is auto-derived from the `en` object.

- Language toggle in Settings — stored in `langStore.ts`
- RTL layout applied automatically via `useRTLDirection` hook when language is Hebrew
- Use `ms-`/`me-` instead of `ml-`/`mr-` in Tailwind for RTL compatibility

**Hebrew football terminology** (important for translations):
- Corners → **קרנות** (not קורנרים)
- Score → **סקור** (not ניקוד)
- FT Result hit rate → **ניחוש תוצאה**

---

## Sync Endpoints (public, no auth)
- `POST /api/sync/matches` — triggers `syncAllActiveLeagues()`
- `POST /api/sync/scores` — triggers `checkAndUpdateScores()`
- `GET /api/health` — returns `{ status: 'ok' }`

---

## Database Migrations
Migrations are in `supabase/migrations/`. Current sequence: **001 → 021**.
After adding a migration: apply via Supabase dashboard SQL editor or `supabase db push --linked`.
CI repairs migration history for 001–014 automatically.

---

## Important Files

| File | Purpose |
|------|---------|
| `backend/src/services/pointsEngine.ts` | Pure scoring function — source of truth |
| `backend/src/services/scoreUpdater.ts` | Resolves predictions, updates leaderboard + coins |
| `backend/src/services/matchSync.ts` | Syncs ESPN fixtures into Supabase |
| `backend/src/services/espn.ts` | ESPN API client |
| `backend/src/cron/scheduler.ts` | Cron jobs + startup catch-up |
| `frontend/src/lib/utils.ts` | `calcBreakdown()` — mirrors pointsEngine client-side |
| `frontend/src/lib/i18n.ts` | All UI strings in EN + HE; `TranslationKey` type |
| `frontend/src/lib/constants.ts` | Points values, coin costs, league list, status lists |
| `frontend/src/stores/coinsStore.ts` | Coin balance, daily bonus state |
| `frontend/src/stores/themeStore.ts` | Dark/light mode toggle |
| `frontend/src/components/leaderboard/H2HModal.tsx` | Head-to-Head comparison modal — opens when clicking another user's row |
| `frontend/src/components/ui/InfoTip.tsx` | Tooltip — uses CSS vars for theme support |
| `frontend/src/components/ui/ScoringGuide.tsx` | Per-tier scoring explainer modal |
| `frontend/src/components/ui/CoinGuide.tsx` | Coin economy explainer modal |
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

- **Don't add `SYNC_SECRET` auth back to sync routes** — it caused GitHub Actions to fail with 401.
- **`t()` accepts only `TranslationKey`** — passing a plain `string` is a TS error. Always import `TranslationKey` from `../../lib/i18n` when using `t` in helper functions.
- **Don't use `t('halfTimeResult')`** — that key was removed. Use the literal string `"Half Time"` for backward-compat HT display.
- **Old predictions** have `predicted_halftime_outcome` set; new predictions have `predicted_corners`. Both are handled in `_computeBreakdown` in `utils.ts`.
- **`Avatar` component** expects emoji avatars as `emoji:🏆` (with prefix). Raw emoji strings fail as image URLs.
- **Hardcoded dark backgrounds in modals** cause light-mode breakage — use `card-elevated` CSS class instead of hex colors like `#0c1610`.
- **H2H modal** opens when clicking ANOTHER user's leaderboard row. Clicking your OWN row still opens `UserMatchHistoryModal`. Privacy rule: friend's prediction is hidden (`🔒`) until the match kicks off (`status !== 'NS' || kickoff <= now`).
- **Coin display** — never show negative amounts. Use `coinsBack = pointsEarned * 2` and show `+coinsBack`. Only show profit line when `coinsBack > coinsBet`.
- **Daily bonus timezone** — `claim_daily_bonus` uses `(NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE`, not `CURRENT_DATE`.
