# GoalBet — CLAUDE.md

Authoritative reference for Claude when working in this repository.
Read this before touching any file. Everything here reflects the live codebase.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Commands](#3-commands)
4. [Critical Rules](#4-critical-rules)
5. [File & Folder Map](#5-file--folder-map)
6. [Routing](#6-routing)
7. [Architecture Overview](#7-architecture-overview)
8. [Auth System](#8-auth-system)
9. [Sync System](#9-sync-system)
10. [Scoring System](#10-scoring-system)
11. [Coin Economy](#11-coin-economy)
12. [Match Status System](#12-match-status-system)
13. [League System & ESPN Coverage](#13-league-system--espn-coverage)
14. [Database & Migrations](#14-database--migrations)
15. [Theme System](#15-theme-system)
16. [Internationalisation (i18n)](#16-internationalisation-i18n)
17. [Stores](#17-stores)
18. [Hooks](#18-hooks)
19. [CI / GitHub Actions](#19-ci--github-actions)
20. [Common Pitfalls](#20-common-pitfalls)

---

## 1. Project Overview

**GoalBet** is a non-commercial football prediction game for friend groups.
Users sign up with email/password or Google, join private groups via invite code, predict match outcomes across 5 tiers, stake coins, and compete on a real-time leaderboard.

**Live URL:** Auto-deploys from `main` via Vercel.
**Supabase project:** `rzavwyejcldvztkykhks`
**Backend:** Hosted on Render (free tier — sleeps after ~15 min inactivity).
**Primary market:** Israel (Hebrew-first, RTL support, midnight Israel timezone for daily bonuses).
**Zero paid APIs:** ESPN public scoreboard (no key), Supabase free tier, Render free tier.

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Build | Vite | ^5.0 |
| UI | React | ^18.2 |
| Language | TypeScript | ^5.3 (strict) |
| Styling | Tailwind CSS | ^3.4 |
| Animation | Framer Motion | ^12.36 |
| Routing | react-router-dom | ^6.21 |
| State | Zustand | ^4.5 |
| Backend/DB | Supabase JS | ^2.39 |
| Icons | Lucide React | ^0.577 |
| Backend runtime | Node.js + Express | ^4.18 |
| Backend cron | node-cron | ^3.0 |
| Backend HTTP client | axios | ^1.6 |

**No** Redux, MUI, Chakra, styled-components, class-based components, or TheSportsDB (replaced by ESPN).

---

## 3. Commands

```bash
# Frontend — http://localhost:5173
cd frontend && npm run dev

# Backend — http://localhost:3001
cd backend && npm run dev

# Type-check (run before committing)
cd frontend && npx tsc --noEmit

# Build (what CI runs — must pass)
cd frontend && npm run build

# Manual match sync (dev only)
cd backend && npm run sync

# Seed dev data
cd backend && npm run seed
```

**Required env files** — never committed to git:

```
frontend/.env.local
  VITE_SUPABASE_URL=https://rzavwyejcldvztkykhks.supabase.co
  VITE_SUPABASE_ANON_KEY=<anon key>
  VITE_BACKEND_URL=http://localhost:3001

backend/.env
  SUPABASE_URL=https://rzavwyejcldvztkykhks.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<service role key>
  PORT=3001
  NODE_ENV=development
```

No feature flags required. Email + password auth is active by default; no env var needed.

---

## 4. Critical Rules

These have caused build failures or subtle bugs in the past. Never violate them.

### 4.1 Framer Motion `ease` type

```tsx
// ❌ Breaks tsc — number[] is not assignable to Easing in some contexts
transition={{ ease: [0.4, 0, 1, 1] }}

// ✅ Correct
transition={{ ease: 'easeIn' as const }}
transition={{ ease: 'easeOut' as const }}
transition={{ ease: 'easeInOut' as const }}
```

### 4.2 Framer Motion `Variants` — import the type

```tsx
import { type Variants } from 'framer-motion'

const slideVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 28 : -28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir > 0 ? -28 : 28, opacity: 0,
    transition: { duration: 0.14, ease: 'easeIn' as const } }),
}
```

### 4.3 AppShell owns ALL auto-sync — never add sync to page components

```tsx
// ❌ Creates race conditions and infinite spinners
useEffect(() => { fetch('/api/sync/matches') }, [])  // inside a page component

// ✅ AppShell.tsx is the only file that triggers automatic sync
// Pages dispatch 'goalbet:synced' listeners — never the triggerers
```

### 4.4 Realtime UPDATE events — always re-fetch, never swap in-place

```tsx
// ❌ The Realtime payload is PARTIAL — JSONB columns (predicted_*, add_ons) are missing
.on('postgres_changes', { event: 'UPDATE', ... }, (payload) => {
  setMatches(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
})

// ✅ Always call a full re-fetch
.on('postgres_changes', { event: 'UPDATE', ... }, () => {
  fetchMatches()
})
```

### 4.5 Prediction lock must be validated server-side

Kickoff time is checked client-side for UX, but the Supabase RLS/trigger also validates it. Never rely only on the client-side `kickoff_time < now()` check for security.

### 4.6 Never use `CURRENT_DATE` for daily bonus — use Israel timezone

```sql
-- ❌ Uses UTC, resets at wrong time for Israeli users
WHERE claim_date = CURRENT_DATE

-- ✅ Israel timezone (Asia/Jerusalem)
WHERE claim_date = (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE
```

### 4.7 Scoring uses regulation time, not final score

For knockout matches that go to extra time or penalties, scoring always uses `regulation_home` / `regulation_away`, not `home_score` / `away_score`.

```typescript
// In pointsEngine.ts and calcBreakdown() — always use:
const homeGoals = match.regulation_home ?? match.home_score
const awayGoals = match.regulation_away ?? match.away_score
```

### 4.8 Two coexisting Tier 3 fields — never remove either

Old predictions: `predicted_halftime_outcome` (half-time result, pre-migration 014).
New predictions: `predicted_corners` (corners, post-migration 014).
Both fields exist on the `predictions` table. `calcBreakdown()` handles both. Never remove either.

### 4.9 `Avatar` expects `emoji:🏆` prefix format

```tsx
// ❌ Treated as image URL, silently fails
<Avatar src="🏆" />

// ✅ Correct — prefix tells Avatar it's an emoji
<Avatar src="emoji:🏆" />
```

### 4.10 Use logical CSS properties for RTL compatibility

```tsx
// ❌ Breaks Hebrew RTL layout
className="ml-2 pl-4"

// ✅ Logical properties flip automatically in RTL
className="ms-2 ps-4"
```

---

## 5. File & Folder Map

```
goalbet/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── auth-v2/
│       │   │   ├── AuthContainer.tsx     # Master auth UI — 8-view glassmorphism card
│       │   │   ├── PasswordStrength.tsx  # Animated strength meter + 5 SVG checkmarks
│       │   │   └── ReAuthModal.tsx       # Session-expiry overlay — slides in over current page
│       │   ├── auth/
│       │   │   └── GoogleLoginButton.tsx # Legacy Google button (unused in auth-v2 flow)
│       │   ├── groups/
│       │   │   ├── CreateGroupModal.tsx
│       │   │   ├── InviteCodeDisplay.tsx
│       │   │   └── JoinGroupModal.tsx
│       │   ├── layout/
│       │   │   ├── AppShell.tsx          # Root layout + ONLY place for auto-sync
│       │   │   ├── BottomNav.tsx         # Mobile bottom navigation
│       │   │   ├── Sidebar.tsx           # Desktop sidebar
│       │   │   └── TopBar.tsx            # Mobile header: logo, group selector, coins, avatar
│       │   ├── leaderboard/
│       │   │   ├── H2HModal.tsx          # Head-to-head comparison (tap another user's row)
│       │   │   ├── LeaderboardRow.tsx    # Own row → history modal; other row → H2H modal
│       │   │   ├── LeaderboardTable.tsx
│       │   │   └── UserMatchHistoryModal.tsx
│       │   ├── matches/
│       │   │   ├── MatchCard.tsx         # Computes isPastKickoffNS, DELAYED sentinel, live clock
│       │   │   ├── MatchFeed.tsx         # Date-grouped list of MatchCards
│       │   │   ├── MatchStatusBadge.tsx  # Status pill: Live/HT/Delayed/FT/PST/CANC
│       │   │   ├── MatchTimeline.tsx     # ESPN summary events (returns null when no data)
│       │   │   └── PredictionForm.tsx    # 5-tier prediction input; corners hidden for league 4396
│       │   └── ui/
│       │       ├── Avatar.tsx            # Expects emoji:🏆 prefix
│       │       ├── CoinGuide.tsx
│       │       ├── GlassCard.tsx
│       │       ├── HelpGuideModal.tsx
│       │       ├── InfoTip.tsx           # Tooltip using CSS vars (works in both themes)
│       │       ├── LangToggle.tsx
│       │       ├── LoadingSpinner.tsx
│       │       ├── NeonButton.tsx        # Variants: green / ghost / danger
│       │       ├── PolicyModal.tsx
│       │       ├── ScoringGuide.tsx
│       │       ├── ThemeToggle.tsx
│       │       ├── Toast.tsx
│       │       └── WelcomeAnimation.tsx  # First-login welcome sequence
│       ├── hooks/
│       │   ├── useAuth.ts                # Legacy Google OAuth (kept for backward compat)
│       │   ├── useAuthV2.ts              # Auth-v2 state machine (8 views)
│       │   ├── useGroupMatchPredictions.ts
│       │   ├── useLeaderboard.ts
│       │   ├── useLiveClock.ts           # Ticking clock for live matches
│       │   ├── useMatches.ts             # Fetches + Realtime + goalbet:synced listener
│       │   ├── useMatchSync.ts           # Manual sync ONLY (Settings button) — 60s timeout
│       │   ├── useNewPointsAlert.ts      # Toast on newly earned points since last visit
│       │   ├── usePredictions.ts
│       │   └── useRTLDirection.ts        # Sets document.dir from active language
│       ├── lib/
│       │   ├── authSchema.ts             # Password validation: strength, requirements, error mapping
│       │   ├── constants.ts              # FOOTBALL_LEAGUES, LEAGUE_ESPN_SLUG, POINTS, COIN_COSTS, ROUTES
│       │   ├── featureFlags.ts           # Feature flag registry (currently no active flags)
│       │   ├── i18n.ts                   # EN + HE translations, TranslationKey type
│       │   ├── supabase.ts               # Supabase client (anon key) + all TypeScript table types
│       │   └── utils.ts                  # calcBreakdown() (client-side scoring mirror), cn()
│       ├── pages/
│       │   ├── AuthCallbackPage.tsx      # Handles Supabase OAuth redirect
│       │   ├── HomePage.tsx              # Match feed — All / Upcoming / Live / Results tabs
│       │   ├── LeaderboardPage.tsx       # Group standings with H2H modal
│       │   ├── LoginPage.tsx             # Thin wrapper — redirect if logged in, render AuthContainer
│       │   ├── ProfilePage.tsx           # Stats, prediction history, sign-out button
│       │   └── SettingsPage.tsx          # Group mgmt, leagues, admin tools, Account section
│       └── stores/
│           ├── authStore.ts              # user, profile, session; signInWithGoogle, signOut
│           ├── coinsStore.ts             # coins, lastDailyBonus; synced from DB
│           ├── groupStore.ts             # groups[], activeGroupId; persisted to localStorage
│           ├── langStore.ts              # lang ('en'|'he'); persisted to localStorage
│           ├── themeStore.ts             # theme ('dark'|'light'); persisted to localStorage
│           └── uiStore.ts                # activeModal, toasts[]; memory only
│
├── backend/
│   └── src/
│       ├── cron/
│       │   └── scheduler.ts              # Startup catch-up + 30s score poller + daily/weekly crons
│       ├── lib/
│       │   └── supabaseAdmin.ts          # Supabase client with service-role key (bypasses RLS)
│       ├── routes/
│       │   ├── health.ts                 # GET /api/health → { status: 'ok' }
│       │   └── sync.ts                   # POST /api/sync/matches · POST /api/sync/scores
│       ├── scripts/
│       │   ├── manualSync.ts             # npm run sync — dev helper
│       │   └── seed.ts                   # npm run seed — populates dev data
│       └── services/
│           ├── espn.ts                   # ESPN API client + LEAGUE_ESPN_MAP
│           ├── matchSync.ts              # syncLeague(id), syncAllActiveLeagues()
│           ├── pointsEngine.ts           # PURE scoring function — no DB calls, fully testable
│           ├── scoreUpdater.ts           # Resolves predictions after FT, writes leaderboard + coins
│           └── sportsdb.ts              # DBMatch type definition (legacy, kept for types)
│
├── supabase/
│   ├── email-templates/
│   │   ├── confirm-signup.html           # Green-theme onboarding email (paste into Supabase dashboard)
│   │   └── reset-password.html           # Orange-theme recovery email (paste into Supabase dashboard)
│   └── migrations/                       # 001 → 022 — run in order via SQL editor
│
└── .github/
    └── workflows/
        ├── ci.yml                        # Type-check + build on every push/PR
        └── sync-cron.yml                 # Pings backend every 10 min (keep-alive + data sync)
```

---

## 6. Routing

```
/login           → LoginPage          (public — renders AuthContainer)
/auth/callback   → AuthCallbackPage   (public — Supabase Google OAuth redirect)
/                → HomePage           (protected via AuthGuard → AppShell)
/leaderboard     → LeaderboardPage    (protected via AuthGuard → AppShell)
/profile         → ProfilePage        (protected via AuthGuard → AppShell)
/settings        → SettingsPage       (protected via AuthGuard → AppShell)
*                → redirect to /
```

**`AuthGuard`** (in `App.tsx`):
- Renders `<PageLoader />` while `!initialized || loading`
- On unexpected session expiry (user was logged in → now null): shows `<ReAuthModal>` instead of redirecting
- On deliberate sign-out with no session: `<Navigate to="/login" replace />`

**`AppInitializer`** (wraps entire app):
- Calls `authStore.init()` once on mount (restores session, subscribes to `onAuthStateChange`)
- Calls `groupStore.fetchGroups(user.id)` on user change
- Calls `coinsStore.initCoins(user.id, activeGroupId)` on user/group change + `visibilitychange` for midnight Israel timezone reset

---

## 7. Architecture Overview

```
Browser
  │
  ├─ Vercel (React SPA — auto-deploy from main)
  │    ├─ AppShell         → owns ALL automatic sync (single source of truth)
  │    ├─ useMatches       → queries Supabase + listens for 'goalbet:synced' event + Realtime
  │    └─ useMatchSync     → Settings "Sync Now" button ONLY (manual, never auto-triggered)
  │
  ├─ Supabase Realtime     → pushes match UPDATE/INSERT to subscribed clients
  │
  └─ Render (Express API — free tier, sleeps after ~15 min)
       ├─ POST /api/sync/matches  → syncAllActiveLeagues() pulls fixtures from ESPN
       ├─ POST /api/sync/scores   → checkAndUpdateScores() resolves finished predictions
       ├─ GET  /api/health        → { status: 'ok' }
       └─ setInterval 30s         → live score polling while awake
```

**Data flow on page load:**
1. `AppShell` fires `POST /api/sync/matches` (90s timeout) — wakes Render + pulls fresh fixtures
2. `AppShell` fires `POST /api/sync/scores` immediately + retries at 20s
3. Each successful response: `window.dispatchEvent(new Event('goalbet:synced'))`
4. `useMatches` hears `goalbet:synced` → calls `fetchMatches()` → UI updates
5. Supabase Realtime also pushes row-level changes for live score diffs

**GitHub Actions as heartbeat:**
`sync-cron.yml` runs every 10 minutes. Pings `/api/health` → `/api/sync/matches` → `/api/sync/scores`. Keeps Render awake 24/7, data current even with zero active users.

---

## 8. Auth System

### Sign-in methods

| Method | Flow |
|--------|------|
| Google OAuth | `authStore.signInWithGoogle()` → Supabase OAuth redirect → `/auth/callback` → `authStore.onAuthStateChange` handles session → `LoginPage.useEffect` redirects to `/` |
| Email + password | `AuthContainer` → `useAuthV2` → `supabase.auth.signInWithPassword()` |
| Sign up | `AuthContainer` sign-up view → `supabase.auth.signUp()` with `data.username` → confirm email → back to sign-in |
| Forgot password | `AuthContainer` forgot view → `supabase.auth.resetPasswordForEmail()` redirecting to `/login?type=recovery` |
| Password recovery | `useAuthV2` detects `?type=recovery` on mount → verifies session → navigates to `set-password` view → `supabase.auth.updateUser({ password })` |
| Change password (in-app) | `SettingsPage` Account section → `supabase.auth.updateUser({ password })` directly |

### `useAuthV2` — view state machine

```
email ──continue──► signin ──success──► success (→ redirect)
  │                   │
  │              wrong creds: show error + Google hint
  │
  └──create account──► signup ──already registered──► oauth-merge
                         │
                         └──success──► check-email (signup context)

email ──forgot──► forgot ──always──► check-email (reset context)

/login?type=recovery ──on mount──► set-password ──success──► success
```

**Identity collision detection:**
`supabase.signUp()` returning "User already registered" (HTTP 422) is the only reliable client-side signal that an email belongs to a Google-only account. UI morphs to `oauth-merge` view. Never use a separate "check email" endpoint — that breaks anti-enumeration.

**Anti-enumeration on forgot password:**
`handleForgotPassword()` swallows all errors and always navigates to `check-email`. Never show "email not found" — that reveals account existence.

**Password recovery URL:**
`resetPasswordForEmail` redirects to `/login?type=recovery` (not `/auth/callback`). `useAuthV2` detects this on mount, verifies the recovery session, navigates to `set-password`, and cleans the URL with `history.replaceState`.

### `authStore` API

```typescript
// Called once on app mount — restores session, subscribes to onAuthStateChange
init(): () => void

// Google OAuth — browser redirects immediately
signInWithGoogle(): Promise<void>

// Signed-in users
signOut(): Promise<void>
fetchProfile(): Promise<void>
updateUsername(username: string): Promise<void>
```

State: `user`, `session`, `profile`, `loading`, `initialized`

### `ReAuthModal`

Appears when session expires mid-session (user was authenticated → now null, without a deliberate sign-out). Shows over the current page without losing any UI state. Has three sub-views: `main` (Google or email/password options), `password` (email + password form), `set-password` (new password + PasswordStrength).

`onSuccess` prop: clears the modal so the user continues seamlessly.
`onSignOut` prop: resets `hadUser` ref, calls `signOut()`, navigates to `/login`.

### `PasswordStrength` component

Used in two places: `AuthContainer` (sign-up view) and `SettingsPage` (change password inline form).

- 4 animated bars with `scaleX` + stagger
- 5 requirement rows (8 chars, uppercase, lowercase, number, special char) with animated SVG path checkmarks
- Color: weak → red, fair → amber, strong → lime, very-strong → accent-green
- `PasswordStrength` must not be duplicated — import from `auth-v2/PasswordStrength`

### `authSchema.ts` — validation functions

```typescript
checkPasswordRequirements(password: string): PasswordRequirements
getPasswordStrength(password: string): PasswordStrength  // 'empty'|'weak'|'fair'|'strong'|'very-strong'
isPasswordValid(password: string): boolean               // all 5 requirements met
isEmailValid(email: string): boolean
isUsernameValid(username: string): boolean               // 2-30 chars, Unicode (Hebrew supported)
mapAuthError(message: string): string                    // maps Supabase error strings → human-readable
```

---

## 9. Sync System

> Read this section before touching any sync-related code.

### Single source of truth: `AppShell.tsx`

`AppShell` is the **only** place that triggers automatic background sync. Do not add auto-sync to any page component — it creates race conditions and infinite spinners.

```
Mount
  ├─ POST /api/sync/matches  (90s AbortController timeout) — wakes Render + pulls fixtures
  ├─ POST /api/sync/scores   (30s timeout) — resolves any finished predictions immediately
  ├─ setTimeout 20s → POST /api/sync/scores — backend is warm by now, fast retry
  └─ setInterval 45s → POST /api/sync/scores — live-score polling

Tab restore (hidden > 5 min) → force POST /api/sync/scores
```

All fetches use `AbortController` with explicit timeouts. If the backend times out (cold start), the fetch aborts cleanly — `setSyncing` is never stuck, the next interval retries.

### Manual sync: `useMatchSync.ts`

Used **only** by the Settings page "Sync Now" button. 60s timeout. Never add an auto-trigger `useEffect` inside `useMatchSync` — it was removed deliberately.

After completing, dispatches `goalbet:synced` so data hooks refetch.

### Backend startup catch-up: `scheduler.ts`

5 seconds after the Render backend restarts (cold start):
1. `syncAllActiveLeagues()` — pulls any fixtures missed during sleep
2. `checkAndUpdateScores()` — resolves any predictions that finished while backend was down

### `syncAllActiveLeagues()` filtering

```typescript
// Silently skips leagues not in LEAGUE_ESPN_MAP
leagueIds = leagueIds.filter(id => id in LEAGUE_ESPN_MAP)
```

If a league is in `FOOTBALL_LEAGUES` (frontend) but NOT in `LEAGUE_ESPN_MAP` (backend `espn.ts`), it silently never syncs. **Always add to both.**

### Fixture window

`syncLeague()` calls `fetchLeagueMatches(leagueId, 7, 42)` — **7 days back, 42 days ahead**.

### The `goalbet:synced` event

```typescript
window.dispatchEvent(new Event('goalbet:synced'))
```

`useMatches` listens for this and calls `fetchMatches()`. Any component needing a refetch after sync should listen for this event, not poll independently.

---

## 10. Scoring System

| Tier | What is predicted | Points |
|------|-------------------|--------|
| 1 | Full-time result (H / D / A) | **+3** |
| 2 | Exact score — stacks with Tier 1 | **+7** (+3 bonus if result also correct = **+10** total) |
| 3 | Total corners: ≤9 / exactly 10 / ≥11 | **+4** |
| 4 | Both Teams To Score — Yes / No | **+2** |
| 5 | Over / Under 2.5 goals | **+3** |

**Maximum: 19 points per match.**

No streak bonus (removed — `streak_bonus` column still exists in DB for backward compat, always 0).

### Backward compatibility: Tier 3 was Half-Time result

Old predictions have `predicted_halftime_outcome`. New predictions have `predicted_corners`. Both fields exist on the `predictions` table. `calcBreakdown()` in `utils.ts` handles both. Never remove either field.

- Old predictions display: hardcoded string `"Half Time"` — **do not use `t('halfTimeResult')`**, that i18n key was removed
- New predictions display: corners tier label

### Source of truth

`backend/src/services/pointsEngine.ts` — pure function, no DB calls. `frontend/src/lib/utils.ts → calcBreakdown()` mirrors it client-side for prediction previews. Both must always be in sync.

### Extra time & penalties

Prediction scoring always uses **regulation-time score** (`regulation_home` / `regulation_away`).
If `regulation_home` is null, falls back to `home_score` / `away_score` (safe for non-ET matches).
`went_to_penalties = true` → shootout happened. `penalty_home` / `penalty_away` store the shootout score.

### Corners — International Friendlies exception

Corners (`predicted_corners`) is **hidden** in `PredictionForm` for league 4396 (International Friendlies).
`corners_total` must be set manually in Supabase, and friendlies have 50+ matches/day.

```typescript
// PredictionForm.tsx
const LEAGUES_WITHOUT_CORNERS = new Set([4396])
```

---

## 11. Coin Economy

### Earn & spend

| Event | Coins |
|-------|-------|
| Join bonus (one-time) | **+120** |
| Daily login bonus | **+30** |
| Stake a prediction | **−(sum of tiers played)** |
| Tier resolved correctly | **+(points_earned × 2)** |

### Coin costs per tier (`constants.ts → COIN_COSTS`)

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

### UX rules — never violate

- **Never show negative coin balance.** Clamp at 0.
- **Always show `+coinsBack`** — `coinsBack = pointsEarned × 2`. Always ≥ 0.
- **Only show a "profit" line** when `coinsBack > coinsBet`.

### Daily bonus timezone

`claim_daily_bonus` DB function uses `(NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE`, not `CURRENT_DATE`. The daily window resets at midnight Israel time.

### Key DB functions

```sql
increment_coins(user_id UUID, amount INT)
claim_daily_bonus(user_id UUID) → BOOLEAN  -- true = claimed, false = already claimed today
```

---

## 12. Match Status System

### Status strings (stored in DB)

| Status | Meaning | Display |
|--------|---------|---------|
| `NS` | Not started | "Upcoming" |
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

### Frontend-only sentinel statuses (never stored in DB)

| Sentinel | When used | Display |
|----------|-----------|---------|
| `DELAYED` | NS match past kickoff, ESPN still shows as pre/scheduled | "Delayed" (orange) |
| `ET_HT` | Live break between ET halves | "AET HT" (amber) |

Computed in `MatchCard.tsx`, passed to `MatchStatusBadge`. Never write them to the database.

### Stalled NS matches (`isPastKickoffNS`)

```typescript
const isPastKickoffNS = match.status === 'NS' && new Date(match.kickoff_time).getTime() < Date.now()
```

These show: animated `— —` score, `~{minutesSinceKickoff}'` clock, **"Delayed"** badge (orange — never green "Live").

### Tab filtering rules

- **Results tab**: `status = 'FT'` only — never PST or CANC
- **Live tab**: `['1H', 'HT', '2H']` + stalled-NS within 3-hour buffer
- **All tab**: live → upcoming NS → completed FT (sorted in that priority)

### MatchTimeline

- Fetches ESPN `summary?event={id}` client-side for FT matches
- Returns `null` entirely when ESPN has no `keyEvents` (friendlies, small-nation matches)
- **Never** shows "No event data available" — the section is hidden entirely

---

## 13. League System & ESPN Coverage

### Internal ID → ESPN slug mapping

Must be kept in sync between **both** files:
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

### Leagues with NO ESPN coverage (silently skipped)

- **Israeli Premier League** (4354) — not on ESPN
- **World Cup** (4480) — only relevant during tournament years
- **Euro Championship** (4467) — only relevant every 4 years

### Adding a new league

```bash
# 1. Verify the ESPN slug works
curl "https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard"

# 2. Add to frontend
# frontend/src/lib/constants.ts → FOOTBALL_LEAGUES + LEAGUE_ESPN_SLUG

# 3. Add to backend
# backend/src/services/espn.ts → LEAGUE_ESPN_MAP
```

---

## 14. Database & Migrations

Migrations live in `supabase/migrations/`. Current sequence: **001 → 022**.
Apply via Supabase SQL editor or `supabase db push --linked`.

| Migration | What it adds |
|-----------|-------------|
| `001` | Initial schema: profiles, groups, group_members, matches, predictions, leaderboard |
| `002` | RLS policies |
| `003` | Functions & triggers: `increment_coins`, `claim_daily_bonus`, leaderboard update trigger, `set_updated_at` |
| `004` | Bug fixes |
| `005` | `display_clock` column on matches |
| `006` | Leaderboard readable by all group members |
| `007` | Prediction resolution fixes |
| `008` | `last_week_points` column on leaderboard |
| `009` | Streak bonus backfill |
| `010` | Full data repair |
| `011` | `reset_group_scores` RPC |
| `012` | `streak_bonus` column (always 0, kept for backward compat) |
| `013` | `halftime_pts` column |
| `014` | `predicted_corners` column (replaces `predicted_halftime_outcome` for new predictions) |
| `015` | `regulation_home` / `regulation_away` columns |
| `016` | `went_to_penalties` boolean |
| `017` | Predictions delete policy |
| `018` | `penalty_home` / `penalty_away` columns |
| `019` | `red_cards_home` / `red_cards_away` columns |
| `020` | Coins system: `user_coins` table, `increment_coins`, `claim_daily_bonus` |
| `021` | Coins bug fixes |
| `022` | Admin features: `delete_group` RPC, `remove_member` RPC |

### CI migration repair

`ci.yml` auto-repairs Supabase migration history for migrations 001–014. This handles the case where migrations were applied manually before the CI was set up.

### Key tables (abbreviated)

**`profiles`** — `id` (FK → auth.users), `username` (unique), `avatar_url`, `group_id`, `created_at`

**`matches`** — `id`, `external_id` (ESPN event ID), `league_id`, `home_team`, `away_team`, `home_team_badge`, `away_team_badge`, `kickoff_time`, `status`, `home_score`, `away_score`, `regulation_home`, `regulation_away`, `went_to_penalties`, `penalty_home`, `penalty_away`, `halftime_home`, `halftime_away`, `corners_total`, `red_cards_home`, `red_cards_away`, `display_clock`, `season`, `round`, `updated_at`

**`predictions`** — `id`, `user_id`, `match_id`, `group_id`, `predicted_outcome` (H/D/A), `predicted_home_score`, `predicted_away_score`, `predicted_halftime_outcome` (legacy), `predicted_corners` (new), `predicted_btts`, `predicted_over_under` (over/under), `points_earned`, `is_resolved`, `created_at`

**`leaderboard`** — `id`, `user_id`, `group_id`, `total_points`, `weekly_points`, `last_week_points`, `predictions_made`, `correct_predictions`, `streak_bonus` (always 0), `updated_at`

**`user_coins`** — `id`, `user_id`, `group_id`, `coins`, `last_daily_claim`, `updated_at`

### RLS summary

- **profiles**: readable by all; writable by owner (`auth.uid() = id`)
- **matches**: public read; service role writes only (backend)
- **predictions**: readable by group members; writable by owner; NOT readable by others when `status = 'NS'` (pre-kickoff privacy)
- **leaderboard**: readable by all group members; service role writes
- **user_coins**: readable by owner; service role writes (increment_coins function)

---

## 15. Theme System

Dark mode is the default. Light mode toggled via `ThemeToggle` in the top bar.

**Mechanism:** `html.light` class on `<html>` managed by `themeStore.ts`.
**CSS tokens:** defined in `frontend/src/index.css` under `:root` (dark) and `html.light` (light overrides).

### Design tokens

```css
/* Dark (default) */
--color-bg-base: #080d0a
--color-bg-card: rgba(255,255,255,0.055)
--color-accent-green: #00ff87
--color-accent-orange: #ff6b35
--color-text-muted: rgba(255,255,255,0.45)
--glow-green: 0 0 20px rgba(0,255,135,0.3)
```

Fonts: **Bebas Neue** (headings, `font-bebas`), **DM Sans** (body) — imported from Google Fonts in `index.html`.

### Rules

- **Never hardcode dark hex colors** in modals, tooltips, or cards — they break in light mode
- Use `card-elevated` CSS class instead of `bg-[#0c1610]` or similar
- Use CSS vars (`var(--color-tooltip-bg)`) for dynamic surfaces
- Test every new component in both dark and light mode

---

## 16. Internationalisation (i18n)

All UI strings live in `frontend/src/lib/i18n.ts` as `en` and `he` objects.

```typescript
const { t } = useLangStore()
t('matchDay')  // → "Match Day" or "יום משחק"
```

`TranslationKey` type is auto-derived from the `en` object — TypeScript errors on unknown keys.

- Language stored in `langStore.ts` (persisted to localStorage)
- RTL layout applied automatically via `useRTLDirection` hook (`document.dir`)
- Use `ms-` / `me-` instead of `ml-` / `mr-` for RTL compatibility

### Rules

- `t()` accepts **only** `TranslationKey` — passing a plain `string` is a TS error
- Import `TranslationKey` from `../../lib/i18n` when calling `t` in helper functions
- **Do not use `t('halfTimeResult')`** — that key was removed. Use the hardcoded string `"Half Time"` for backward-compat HT label

### Hebrew football terminology

| English | Correct Hebrew |
|---------|---------------|
| Corners | **קרנות** (not ~~קורנרים~~) |
| Score | **סקור** (not ~~ניקוד~~) |
| FT Result hit rate | **ניחוש תוצאה** |

---

## 17. Stores

All stores use Zustand. Persistence uses `localStorage` where noted.

| Store | Key state | Persistence | Notes |
|-------|-----------|-------------|-------|
| `authStore.ts` | `user`, `profile`, `session`, `loading`, `initialized` | Session-based | `init()` must be called once on app mount |
| `groupStore.ts` | `groups[]`, `activeGroupId` | localStorage | `fetchGroups(userId)` on every login |
| `coinsStore.ts` | `coins`, `lastDailyBonus` | Synced from DB | `initCoins(userId, groupId)` re-checks on tab focus for midnight reset |
| `langStore.ts` | `lang` (`'en'` \| `'he'`) | localStorage | Also controls `document.dir` via `useRTLDirection` |
| `themeStore.ts` | `theme` (`'dark'` \| `'light'`) | localStorage | Manages `html.light` class |
| `uiStore.ts` | `activeModal`, `toasts[]` | Memory only | `openModal(id)`, `addToast(msg, type)` |

---

## 18. Hooks

| Hook | Purpose |
|------|---------|
| `useMatches.ts` | Fetches match list from Supabase. Listens for `goalbet:synced` + Supabase Realtime. Handles tab/all/live/completed filters |
| `useMatchSync.ts` | **Manual sync ONLY** (Settings "Sync Now" button). 60s timeout. Never add auto-trigger |
| `usePredictions.ts` | Fetches and saves user predictions for a set of match IDs. Optimistic updates |
| `useGroupMatchPredictions.ts` | Fetches all group members' predictions for a specific match (social display, H2H) |
| `useLeaderboard.ts` | Fetches leaderboard for active group + Realtime subscription |
| `useLiveClock.ts` | Ticking clock for live matches. Increments from `display_clock` value |
| `useNewPointsAlert.ts` | Detects newly earned points since last visit, fires a toast |
| `useAuthV2.ts` | Auth state machine for `AuthContainer`. 8 views: `email → signin \| signup → oauth-merge \| forgot → check-email \| set-password → success`. Detects `?type=recovery` for password reset |
| `useAuth.ts` | Legacy Google OAuth wrapper — kept for backward compat, not used in main flows |
| `useRTLDirection.ts` | Sets `document.documentElement.dir` based on active language |

---

## 19. CI / GitHub Actions

### `sync-cron.yml` — every 10 minutes, 24/7

```
1. GET  /api/health         → wakes Render (30s curl timeout)
2. POST /api/sync/matches   → pull ESPN fixtures (60s curl timeout)
3. POST /api/sync/scores    → resolve predictions (60s curl timeout)
```

**No auth required** — sync endpoints are intentionally public. Do not add `SYNC_SECRET` back.

### `ci.yml` — every push / PR to main

1. TypeScript type-check (`tsc --noEmit`)
2. Vite build (`npm run build`)
3. Supabase migration history repair (001–014)

### GitHub Secrets

| Secret | Used by | Purpose |
|--------|---------|---------|
| `BACKEND_URL` | `sync-cron.yml` | Production Render URL |
| `SUPABASE_ACCESS_TOKEN` | `ci.yml` | Supabase CLI auth for migration repair |
| `SUPABASE_PROJECT_REF` | `ci.yml` | Supabase project ID |

`SYNC_SECRET` must **not exist** — it was removed because it caused 401s in GitHub Actions.

---

## 20. Common Pitfalls

### Sync

- **Never add auto-sync to page components.** `AppShell` owns all automatic sync. Two auto-triggers create race conditions.
- **Never remove `AbortController` timeouts** from sync fetches. Without them, the UI hangs indefinitely on Render cold starts (30–90s).
- **Adding a league to `FOOTBALL_LEAGUES` without adding it to `LEAGUE_ESPN_MAP`** silently produces no data — no error, no log. Always add to both.
- **Wrong ESPN slug returns 400.** Verify: `curl "https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard"`

### Match display

- **PST / CANC must never appear in Results or Live tabs.** Only `FT` is shown in completed tabs.
- **Stalled NS matches show "Delayed" (orange), not "Live" (green).** Sentinel is `'DELAYED'`, never `'1H'`.
- **MatchTimeline returns null when ESPN has no events.** Do not add an empty state — the section is hidden.

### Predictions & scoring

- **Old predictions have `predicted_halftime_outcome`; new ones have `predicted_corners`.** Both coexist. `calcBreakdown()` handles both.
- **Scoring always uses `regulation_home` / `regulation_away`** for ET/penalty matches.
- **Corners are hidden for league 4396** (International Friendlies). Do not remove `LEAGUES_WITHOUT_CORNERS`.
- **Do not use `t('halfTimeResult')`** — key was removed. Use hardcoded `"Half Time"`.

### Auth

- **`LoginPage` is a thin wrapper only.** Auth UI and logic belong in `AuthContainer` + `useAuthV2`. Do not add auth logic to `LoginPage`.
- **Identity collision signal** is `signUp()` returning "User already registered" (HTTP 422). Do not add a "check email" API endpoint — that breaks anti-enumeration.
- **Forgot password always shows success.** `handleForgotPassword` swallows all errors. Never show "email not found".
- **Password recovery redirects to `/login?type=recovery`**, not `/auth/callback`. `useAuthV2` detects this on mount.
- **`PasswordStrength` is shared** between `AuthContainer` and `SettingsPage`. Import from `auth-v2/PasswordStrength`; never duplicate it.

### UI / Components

- **`Avatar` expects `emoji:🏆` format** (with `emoji:` prefix). Raw emoji string is treated as an image URL and silently fails.
- **Hardcoded hex colors in modals break light mode.** Use `card-elevated` class or `var(--color-tooltip-bg)`.
- **`t()` only accepts `TranslationKey`.** Passing a plain `string` is a TypeScript error.
- **Use `ms-` / `me-` for margins, never `ml-` / `mr-`.** RTL layout requires logical CSS properties.

### Coins

- **Never show negative coin amounts.** Clamp at 0.
- **Daily bonus uses Israel timezone** (`Asia/Jerusalem`). `CURRENT_DATE` is wrong.
- **Friend prediction privacy:** predictions are hidden (🔒) when `status = 'NS'` AND `kickoff > now`. Never show pre-kickoff predictions to other group members.
- **H2H modal** opens when clicking ANOTHER user's leaderboard row. Clicking your own row opens `UserMatchHistoryModal`. This is intentional.
