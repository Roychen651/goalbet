# GoalBet — Claude Code Guide

> Football prediction game for friend groups. Users predict match outcomes across 5 tiers, stake coins, and compete on group leaderboards.

---

## Table of Contents

1. [Tech Stack & Deployment](#1-tech-stack--deployment)
2. [Local Development](#2-local-development)
3. [Architecture Overview](#3-architecture-overview)
4. [Sync System](#4-sync-system) ← read this before touching any sync code
5. [Scoring System](#5-scoring-system)
6. [Coin Economy](#6-coin-economy)
7. [Match Status System](#7-match-status-system)
8. [League System & ESPN Coverage](#8-league-system--espn-coverage)
9. [Database & Migrations](#9-database--migrations)
10. [Theme System](#10-theme-system)
11. [Internationalisation (i18n)](#11-internationalisation-i18n)
12. [File Map](#12-file-map)
13. [Stores](#13-stores)
14. [Hooks](#14-hooks)
15. [CI / GitHub Actions](#15-ci--github-actions)
16. [GitHub Secrets](#16-github-secrets)
17. [Common Pitfalls](#17-common-pitfalls)

---

## 1. Tech Stack & Deployment

| Layer | Technology | Deployment |
|-------|-----------|------------|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS + Framer Motion | Vercel (auto-deploy on push to `main`) |
| Backend | Node.js + Express + TypeScript | Render (free tier — **sleeps after ~15 min inactivity**) |
| Database | Supabase (PostgreSQL + RLS + Realtime + Auth) | Supabase cloud |
| Data source | ESPN Public Scoreboard API (no key required) | External |

---

## 2. Local Development

```bash
# Frontend — http://localhost:5173
cd frontend && npm run dev

# Backend — http://localhost:3001
cd backend && npm run dev
```

**Required env files:**

```
frontend/.env.local
  VITE_SUPABASE_URL=
  VITE_SUPABASE_ANON_KEY=
  VITE_BACKEND_URL=http://localhost:3001

backend/.env
  SUPABASE_URL=
  SUPABASE_SERVICE_ROLE_KEY=
  PORT=3001
```

---

## 3. Architecture Overview

```
User browser
  │
  ├─ Vercel (React SPA)
  │    ├─ AppShell          → owns ALL automatic sync (single source of truth)
  │    ├─ useMatches        → queries Supabase + listens for 'goalbet:synced' event
  │    └─ useMatchSync      → manual-only (Settings "Sync Now" button)
  │
  ├─ Supabase Realtime      → pushes match UPDATE/INSERT to subscribed clients
  │
  └─ Render (Express API)
       ├─ POST /api/sync/matches  → syncAllActiveLeagues() ← ESPN
       ├─ POST /api/sync/scores   → checkAndUpdateScores()
       ├─ GET  /api/health        → { status: 'ok' }
       └─ Cron (setInterval 30 s) → live score polling while awake
```

**Data flow on page load:**
1. AppShell fires `POST /api/sync/matches` (90 s timeout) — wakes Render + pulls fresh fixtures
2. AppShell fires `POST /api/sync/scores` immediately + retries at 20 s
3. Each successful response dispatches `window.Event('goalbet:synced')`
4. `useMatches` hears the event → calls `fetchMatches()` → UI updates
5. Supabase Realtime also pushes row-level changes for live score diffs

---

## 4. Sync System

> **Read this section before touching any sync-related code.**

### Single source of truth: `AppShell.tsx`

`AppShell` is the **only** place that triggers automatic background sync. Do not add auto-sync to any page component — it creates race conditions.

```
Mount
  ├─ POST /api/sync/matches  (90 s timeout)  — fixture sync, wakes cold backend
  ├─ POST /api/sync/scores   (30 s timeout)  — immediate score/prediction resolution
  ├─ setTimeout 20 s → POST /api/sync/scores — backend is awake by now, fast
  └─ setInterval 45 s → POST /api/sync/scores — live-score polling

Tab restore (hidden >5 min) → force POST /api/sync/scores
```

All fetches use `AbortController` with explicit timeouts. If the backend times out (cold start), the fetch aborts cleanly, `setSyncing` is never stuck, and the next poll retries.

### Manual sync: `useMatchSync.ts`

Used only by the Settings page "Sync Now" button. Has a **60-second timeout** on all fetches. After completing (success or timeout), dispatches `goalbet:synced` so data hooks refetch.

Do not add an auto-trigger `useEffect` inside `useMatchSync` — that was removed deliberately.

### Backend startup catch-up: `scheduler.ts`

When the Render backend restarts (cold start), 5 seconds after boot it runs:
1. `syncAllActiveLeagues()` — pulls any matches from the sleep window
2. `checkAndUpdateScores()` — resolves any unresolved predictions

### GitHub Actions keep-alive: `sync-cron.yml`

Runs every **10 minutes**, 24/7. Calls `POST /api/sync/matches` + `POST /api/sync/scores` via curl. This wakes Render before it sleeps, keeping the backend continuously alive and data fresh even when no users are active.

### `syncAllActiveLeagues()` filtering

```typescript
leagueIds = leagueIds.filter(id => id in LEAGUE_ESPN_MAP);
```

Leagues NOT present in `LEAGUE_ESPN_MAP` (backend `espn.ts`) are silently skipped. If a new league is added to `FOOTBALL_LEAGUES` (frontend) but not to `LEAGUE_ESPN_MAP` (backend), it will never sync. **Always add to both.**

### Fixture window

`syncLeague()` calls `fetchLeagueMatches(leagueId, 7, 42)` — **7 days back, 42 days ahead**.

### The `goalbet:synced` event

```typescript
window.dispatchEvent(new Event('goalbet:synced'));
```

`useMatches` listens for this event and calls `fetchMatches()`. Any component that needs to refetch after a sync should listen for this event, not poll independently.

---

## 5. Scoring System

| Tier | What is predicted | Points |
|------|-------------------|--------|
| 1 | Full-time result (H / D / A) | +3 |
| 2 | Exact score — stacks with T1 | +7 (+3 bonus when result also correct = +10 total) |
| 3 | Total corners: ≤9 / exactly 10 / ≥11 | +4 |
| 4 | BTTS (Both Teams To Score) Yes/No | +2 |
| 5 | Over/Under 2.5 goals | +3 |

**Maximum: 19 points per match.**

No streak bonus (removed — old `streak_bonus` column still exists in DB for backward compat, always 0).

### Backward compatibility: Tier 3 was Half-Time result

Old predictions have `predicted_halftime_outcome` set. New predictions have `predicted_corners`. Both fields exist on the `predictions` table. `_computeBreakdown()` in `utils.ts` handles both cases. Never remove either field.

- When rendering old predictions: show `"Half Time"` label (hardcoded string, not `t()` — the i18n key was removed)
- When rendering new predictions: show corners tier

### Scoring source of truth

`backend/src/services/pointsEngine.ts` — pure function, no DB calls. `frontend/src/lib/utils.ts → calcBreakdown()` mirrors it client-side for prediction previews.

### Extra time & penalties scoring

- Prediction scoring always uses **regulation-time score** (`regulation_home` / `regulation_away`).
- If `regulation_home` is null, falls back to `home_score` / `away_score` (safe for non-ET matches).
- `went_to_penalties` = true → shootout happened. `penalty_home` / `penalty_away` store shootout score.

---

## 6. Coin Economy

### Earn & spend

| Event | Coins |
|-------|-------|
| One-time join bonus | +120 |
| Daily login bonus | +30 |
| Staking a prediction | −(sum of tiers entered) |
| Prediction resolved correctly | +(points\_earned × 2) |

### Coin costs per tier

Defined in `constants.ts → COIN_COSTS`:

```typescript
RESULT_ONLY: 3,   // predicted outcome only (no exact score)
SCORE: 10,        // predicted home + away score (includes result cost)
CORNERS: 4,
BTTS: 2,
OVER_UNDER: 3,
JOIN_BONUS: 120,
DAILY_BONUS: 30,
MAX_PER_MATCH: 19,
```

### UX rules — never violate these

- **Never show a negative coin balance.** If coins would go below 0, clamp to 0.
- **Always show `+coinsBack`** (never a raw number). `coinsBack = pointsEarned × 2`. Always ≥ 0.
- **Only show a "profit" line** when `coinsBack > coinsBet`.

### Daily bonus timezone

`claim_daily_bonus` DB function uses `(NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE` — not `CURRENT_DATE`. The daily window resets at midnight Israel time, not UTC.

### Key DB functions

```sql
increment_coins(user_id UUID, amount INT)
claim_daily_bonus(user_id UUID) → BOOLEAN  -- true = claimed, false = already claimed today
```

---

## 7. Match Status System

### Status strings (our internal values, stored in DB)

| Status | Meaning | Display |
|--------|---------|---------|
| `NS` | Not started (upcoming) | "Upcoming" |
| `1H` | First half live | "Live" (green) |
| `HT` | Half time | "Half Time" (yellow) |
| `2H` | Second half live | "Live" (green) |
| `ET1` | Extra time first half | "ET Live" (amber) |
| `ET2` | Extra time second half | "ET Live" (amber) |
| `AET` | After extra time (no pens) | "AET" (amber) |
| `PEN` | Penalty shootout live | "Pens" (amber) |
| `FT` | Final | "Full Time" (muted) |
| `PST` | Postponed | "Postponed" (red) |
| `CANC` | Cancelled | "Cancelled" (red) |

### Sentinel statuses (frontend-only, never stored in DB)

| Sentinel | When used | Display |
|----------|-----------|---------|
| `DELAYED` | NS match past kickoff time, ESPN still shows as pre/scheduled | "Delayed" (orange) |
| `ET_HT` | Live break between ET halves | "AET HT" (amber) |

These are computed in `MatchCard.tsx` and passed to `MatchStatusBadge`. Never write them to the database.

### Stalled NS matches (`isPastKickoffNS`)

```typescript
const isPastKickoffNS = match.status === 'NS' && new Date(match.kickoff_time).getTime() < Date.now();
```

These are matches where our backend hasn't polled ESPN yet, OR ESPN itself hasn't started the match (genuine delay). They show:
- Score: animated `— —`
- Clock: `~{minutesSinceKickoff}'`
- Badge: **"Delayed"** (orange — not green "Live")

### Filtering rules

- **Results tab**: only `status = 'FT'` — never show PST or CANC
- **Live tab**: `['1H', 'HT', '2H']` + stalled-NS within 3-hour buffer
- **All tab**: live → upcoming NS → completed FT (sorted in that priority)

### MatchTimeline

- Fetches ESPN `summary?event={id}` client-side for finished (FT) matches
- Returns null entirely when ESPN has no `keyEvents` (small-nation internationals, friendlies)
- Never shows "No event data available" — the section is hidden instead

---

## 8. League System & ESPN Coverage

### Internal IDs (TheSportsDB) → ESPN slugs

This mapping must be kept in sync between **both** files:
- Backend: `backend/src/services/espn.ts → LEAGUE_ESPN_MAP`
- Frontend: `frontend/src/lib/constants.ts → LEAGUE_ESPN_SLUG`

| League | Internal ID | ESPN Slug |
|--------|-------------|-----------|
| Premier League | 4328 | `eng.1` |
| La Liga | 4335 | `esp.1` |
| Bundesliga | 4331 | `ger.1` |
| Serie A | 4332 | `ita.1` |
| Ligue 1 | 4334 | `fra.1` |
| Champions League | 4346 | `uefa.champions` |
| Europa League | 4399 | `uefa.europa` |
| Conference League | 4877 | `uefa.europa.conf` |
| Eredivisie | 4337 | `ned.1` |
| Süper Lig | 4338 | `tur.1` |
| Scottish Premiership | 4330 | `sco.1` |
| MLS | 4344 | `usa.1` |
| Brazilian Série A | 4351 | `bra.1` |
| Argentine Primera | 4350 | `arg.1` |
| International Friendlies | 4396 | `fifa.friendly` |
| UEFA Nations League | 4635 | `uefa.nations` |
| World Cup Qualifiers 2026 | 5000 | `uefa.worldq` |

### Leagues with NO ESPN coverage (sync skipped)

- **Israeli Premier League** (4354) — not on ESPN, silently skipped by `syncAllActiveLeagues`
- **World Cup** (4480) — only relevant during tournament years
- **Euro Championship** (4467) — only relevant every 4 years

### International Friendlies — corners disabled

Corners (`predicted_corners`) is **hidden** in `PredictionForm` for league ID `4396` (International Friendlies). Reason: `corners_total` must be set manually in Supabase, and friendlies have 50+ matches per day — it's impractical to manage. Users would stake coins on corners that can never be resolved.

```typescript
// In PredictionForm.tsx
const LEAGUES_WITHOUT_CORNERS = new Set([4396]);
```

### Adding a new league

1. Add to `FOOTBALL_LEAGUES` array in `frontend/src/lib/constants.ts`
2. Add to `LEAGUE_ESPN_SLUG` in `frontend/src/lib/constants.ts`
3. Add to `LEAGUE_ESPN_MAP` in `backend/src/services/espn.ts`
4. Verify the ESPN slug returns 200: `curl "https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard"`

---

## 9. Database & Migrations

Migrations live in `supabase/migrations/`. Current sequence: **001 → 022**.

| File | What it adds |
|------|-------------|
| `001` | Initial schema: users, groups, matches, predictions, leaderboard |
| `002` | RLS policies |
| `003` | Functions & triggers (increment_coins, daily_bonus, leaderboard update) |
| `004` | Bug fixes |
| `005` | `display_clock` column on matches |
| `006` | Leaderboard visible to all group members |
| `007` | Prediction resolution fixes |
| `008` | `last_week_points` column |
| `009` | Streak bonus backfill |
| `010` | Full data repair |
| `011` | `reset_group_scores` RPC |
| `012` | `streak_bonus` column (always 0 now, kept for compat) |
| `013` | `halftime_pts` column |
| `014` | `predicted_corners` column |
| `015` | `regulation_home` / `regulation_away` columns |
| `016` | `went_to_penalties` boolean |
| `017` | Predictions delete policy |
| `018` | `penalty_home` / `penalty_away` columns |
| `019` | `red_cards_home` / `red_cards_away` columns |
| `020` | Coins system (user_coins table, functions) |
| `021` | Coins bug fixes |
| `022` | Admin features (delete group, remove member) |

**Applying migrations:** Paste SQL into the Supabase dashboard SQL editor, or use `supabase db push --linked`.

CI auto-repairs migration history for migrations 001–014.

---

## 10. Theme System

Dark mode is the default. Light mode is toggled via `ThemeToggle`.

- **Mechanism**: `html.light` class on `<html>` element (managed by `themeStore.ts`)
- **CSS tokens**: defined in `frontend/src/index.css` under `:root` (dark) and `html.light` (light)
- **Key tokens**: `--color-tooltip-bg`, `--color-tooltip-text`, `--color-tooltip-border`
- Light mode overrides for Tailwind opacity utilities (`text-white/18`, `bg-white/25`, etc.) are in `index.css`

### Rules

- **Never use hardcoded dark hex colors** in modals, tooltips, or cards — they break in light mode
- Use the `card-elevated` CSS class instead of `bg-[#0c1610]` or similar
- Use CSS vars (`var(--color-tooltip-bg)`) for dynamic surfaces
- Test every new component in both dark and light mode before shipping

---

## 11. Internationalisation (i18n)

All UI strings live in `frontend/src/lib/i18n.ts` as `en` and `he` objects.

```typescript
const { t } = useLangStore();
t('matchDay') // → "Match Day" or "יום משחק"
```

`TranslationKey` type is auto-derived from the `en` object — TypeScript will error on unknown keys.

- Language stored in `langStore.ts` (persisted to localStorage)
- RTL layout applied automatically via `useRTLDirection` hook
- Use `ms-` / `me-` instead of `ml-` / `mr-` in Tailwind for RTL compatibility

### Rules

- `t()` accepts **only** `TranslationKey` — passing a plain `string` is a TS error
- Always import `TranslationKey` from `../../lib/i18n` when using `t` in helper functions
- **Do not use `t('halfTimeResult')`** — key was removed. Use the hardcoded string `"Half Time"` for old-prediction backward-compat display

### Hebrew football terminology

| English | Correct Hebrew | Wrong |
|---------|---------------|-------|
| Corners | **קרנות** | ~~קורנרים~~ |
| Score | **סקור** | ~~ניקוד~~ |
| FT Result hit rate | **ניחוש תוצאה** | — |

---

## 12. File Map

### Backend

| File | Purpose |
|------|---------|
| `backend/src/services/pointsEngine.ts` | **Source of truth** for scoring — pure function, no DB calls |
| `backend/src/services/scoreUpdater.ts` | Resolves predictions, updates leaderboard + coins after match ends |
| `backend/src/services/matchSync.ts` | Syncs ESPN fixtures into Supabase. `syncLeague(id)` and `syncAllActiveLeagues()` |
| `backend/src/services/espn.ts` | ESPN API client. Contains `LEAGUE_ESPN_MAP`. `fetchLeagueMatches(id, daysBack, daysAhead)` |
| `backend/src/services/sportsdb.ts` | `DBMatch` type definition |
| `backend/src/cron/scheduler.ts` | Startup catch-up sync + 30 s live-score interval + daily cron jobs |
| `backend/src/routes/sync.ts` | `POST /api/sync/matches` and `POST /api/sync/scores` handlers |
| `backend/src/routes/health.ts` | `GET /api/health` |
| `backend/src/lib/supabaseAdmin.ts` | Supabase client with service-role key (bypasses RLS) |

### Frontend — Pages

| File | Purpose |
|------|---------|
| `frontend/src/pages/HomePage.tsx` | Main match feed with tab filtering (All / Upcoming / Live / Results) |
| `frontend/src/pages/LeaderboardPage.tsx` | Group leaderboard with H2H modal |
| `frontend/src/pages/ProfilePage.tsx` | User stats, prediction history, analytics |
| `frontend/src/pages/SettingsPage.tsx` | Group management, leagues, admin tools, manual sync button |
| `frontend/src/pages/LoginPage.tsx` | Google OAuth sign-in |
| `frontend/src/pages/AuthCallbackPage.tsx` | Handles Supabase OAuth callback |

### Frontend — Layout

| File | Purpose |
|------|---------|
| `frontend/src/components/layout/AppShell.tsx` | **Root layout + single sync orchestrator** — owns all auto-sync logic |
| `frontend/src/components/layout/TopBar.tsx` | Mobile header: logo, group selector, coins, lang toggle, avatar |
| `frontend/src/components/layout/BottomNav.tsx` | Mobile bottom navigation |
| `frontend/src/components/layout/Sidebar.tsx` | Desktop sidebar navigation |

### Frontend — Matches

| File | Purpose |
|------|---------|
| `frontend/src/components/matches/MatchCard.tsx` | Single match card. Computes `isPastKickoffNS`, `DELAYED` sentinel, live clock |
| `frontend/src/components/matches/MatchFeed.tsx` | List of match cards with date grouping and section headers |
| `frontend/src/components/matches/MatchStatusBadge.tsx` | Status pill: Live (green), HT (yellow), Delayed (orange), FT (muted), etc. |
| `frontend/src/components/matches/MatchTimeline.tsx` | Expandable match event timeline (fetches ESPN `summary` client-side). Returns null when no events |
| `frontend/src/components/matches/PredictionForm.tsx` | 5-tier prediction input. Corners hidden for `LEAGUES_WITHOUT_CORNERS` (league 4396) |

### Frontend — Leaderboard

| File | Purpose |
|------|---------|
| `frontend/src/components/leaderboard/LeaderboardTable.tsx` | Sortable leaderboard table |
| `frontend/src/components/leaderboard/LeaderboardRow.tsx` | Single user row — clicking another user opens H2H modal, own row opens history |
| `frontend/src/components/leaderboard/H2HModal.tsx` | Head-to-head prediction comparison between you and another user |
| `frontend/src/components/leaderboard/UserMatchHistoryModal.tsx` | Your own prediction history modal |

### Frontend — UI primitives

| File | Purpose |
|------|---------|
| `frontend/src/components/ui/NeonButton.tsx` | Primary button (variants: green / ghost / danger) |
| `frontend/src/components/ui/GlassCard.tsx` | Frosted-glass card container |
| `frontend/src/components/ui/Avatar.tsx` | User avatar. Expects `emoji:🏆` prefix for emoji avatars |
| `frontend/src/components/ui/InfoTip.tsx` | Tooltip — uses CSS vars, works in both themes |
| `frontend/src/components/ui/ScoringGuide.tsx` | Per-tier scoring explainer modal |
| `frontend/src/components/ui/CoinGuide.tsx` | Coin economy explainer modal |
| `frontend/src/components/ui/Toast.tsx` | Toast notification system |
| `frontend/src/components/ui/WelcomeAnimation.tsx` | First-login welcome sequence |

### Frontend — Lib

| File | Purpose |
|------|---------|
| `frontend/src/lib/constants.ts` | `FOOTBALL_LEAGUES`, `LEAGUE_ESPN_SLUG`, `POINTS`, `COIN_COSTS`, `LIVE_STATUSES`, `ROUTES` |
| `frontend/src/lib/i18n.ts` | All UI strings (EN + HE) and `TranslationKey` type |
| `frontend/src/lib/supabase.ts` | Supabase client (anon key) + TypeScript types for all tables |
| `frontend/src/lib/utils.ts` | `calcBreakdown()` (client-side scoring mirror), `cn()` (classname util) |

---

## 13. Stores

All stores use Zustand + persist (localStorage where noted).

| Store | State | Persistence |
|-------|-------|-------------|
| `authStore.ts` | `user`, `profile`, `session` | Session-based |
| `groupStore.ts` | `groups[]`, `activeGroupId` | localStorage |
| `coinsStore.ts` | `coins`, `lastDailyBonus` | Synced from DB |
| `langStore.ts` | `lang` ('en' \| 'he') | localStorage |
| `themeStore.ts` | `theme` ('dark' \| 'light') | localStorage |
| `uiStore.ts` | `activeModal`, `toasts[]` | Memory only |

---

## 14. Hooks

| Hook | Purpose |
|------|---------|
| `useMatches.ts` | Fetches match list from Supabase. Listens for `goalbet:synced` event + Realtime. Handles tab/all/live/completed filters |
| `useMatchSync.ts` | **Manual sync only** (Settings button). 60 s timeout. No auto-trigger |
| `usePredictions.ts` | Fetches and saves user predictions for a set of match IDs |
| `useGroupMatchPredictions.ts` | Fetches all group members' predictions for a match (for social display) |
| `useLeaderboard.ts` | Fetches leaderboard data for active group |
| `useLiveClock.ts` | Ticking clock display for live matches. Increments from `display_clock` value |
| `useNewPointsAlert.ts` | Detects newly earned points since last visit, triggers toast |
| `useAuth.ts` | Google OAuth sign-in / sign-out |
| `useRTLDirection.ts` | Sets `document.dir` based on active language |

---

## 15. CI / GitHub Actions

### `sync-cron.yml` — runs every 10 minutes

```
1. GET /api/health        → wakes backend (30 s curl timeout)
2. POST /api/sync/matches → pull ESPN fixtures (60 s curl timeout)
3. POST /api/sync/scores  → resolve predictions (60 s curl timeout)
```

**No auth required** — sync endpoints are public. Do not add `SYNC_SECRET` back.

### `ci.yml` — runs on every push / PR

1. TypeScript type-check (`tsc --noEmit`)
2. Build (`vite build`)
3. Supabase migration history repair (001–014)

---

## 16. GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `BACKEND_URL` | Production backend URL — used by sync-cron.yml |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI auth — used by CI migration repair |
| `SUPABASE_PROJECT_REF` | Supabase project ID — used by CI migration repair |

`SYNC_SECRET` is **not required and must not exist** — it was removed because it caused GitHub Actions to fail with 401.

---

## 17. Common Pitfalls

### Sync system

- **Never add auto-sync to page components.** AppShell owns all automatic sync. Two systems firing in parallel cause race conditions and infinite spinners.
- **Never remove AbortController timeouts** from sync fetches. Without them, the UI hangs indefinitely on Render cold starts (30–90 s).
- **Adding a league to `FOOTBALL_LEAGUES` without adding it to `LEAGUE_ESPN_MAP`** means it's silently skipped — no error, just no data. Always add to both.
- **Wrong ESPN slug returns 400.** Verify with: `curl "https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard"` before adding.

### Match display

- **PST / CANC matches must never appear in Results or Live tabs.** Only `FT` is shown in completed tabs. Do not revert this.
- **Stalled NS matches show "Delayed" (orange), not "Live" (green).** The sentinel is `'DELAYED'`, passed to `MatchStatusBadge`. Never use `'1H'` as the sentinel for stalled matches.
- **MatchTimeline returns null when ESPN has no events.** Do not add an empty state — the entire section is hidden for matches with no ESPN coverage.

### Predictions & scoring

- **Old predictions have `predicted_halftime_outcome`; new ones have `predicted_corners`.** Both fields coexist. `calcBreakdown()` handles both. Never remove either.
- **Do not use `t('halfTimeResult')`** — the i18n key was removed. Use the hardcoded string `"Half Time"` for backward-compat HT label.
- **Corners are hidden for league 4396** (International Friendlies) in `PredictionForm`. `corners_total` must be set manually and managing 50+ friendlies/day is impractical. Do not remove `LEAGUES_WITHOUT_CORNERS`.
- **Scoring always uses `regulation_home` / `regulation_away`**, not `home_score` / `away_score`, for knockout matches that went to ET.

### UI / Components

- **`Avatar` expects `emoji:🏆` format** (with prefix). A raw emoji string is treated as an image URL and silently fails.
- **Hardcoded hex colors in modals break light mode.** Use `card-elevated` CSS class or `var(--color-tooltip-bg)` instead of `#0c1610` or similar.
- **`t()` only accepts `TranslationKey`.** Passing a plain `string` is a TypeScript error. Import the type explicitly when calling `t` outside of components.
- **Use `ms-` / `me-` for margins, not `ml-` / `mr-`.** Hebrew RTL layout requires logical properties.

### Coins

- **Never show negative coin amounts.** Clamp at 0.
- **`coinsBack = pointsEarned × 2`** — always ≥ 0. Show as `+coinsBack`. Only show profit line when `coinsBack > coinsBet`.
- **Daily bonus uses Israel timezone** (`Asia/Jerusalem`), not UTC. `CURRENT_DATE` is wrong. Use `(NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE`.

### Auth / Privacy

- **H2H modal** opens when clicking ANOTHER user's leaderboard row. Clicking your own row opens `UserMatchHistoryModal`. This is intentional.
- **Friend prediction privacy**: a friend's prediction is hidden (🔒) until the match kicks off (`status !== 'NS'` OR `kickoff <= now`). Never show NS predictions to other users.
