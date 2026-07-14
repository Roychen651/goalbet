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
20. [Admin Console](#20-admin-console)
21. [Common Pitfalls](#21-common-pitfalls)
22. [AI Scout (Sprint 26)](#22-ai-scout-sprint-26)
23. [AI Live Read + Chronicles (Sprint 27)](#23-ai-live-read--chronicles-sprint-27)
24. [The Addiction Loop — Streaks + Web Push (V3 Sprint 8)](#24-the-addiction-loop--streaks--web-push-v3-sprint-8)
25. [Beautiful Analytics — Themed SVG Charts (V3 Sprint 9)](#25-beautiful-analytics--themed-svg-charts-v3-sprint-9)
26. [Agentic AI — The Locker Room Provocateur (V3 Sprint 10)](#26-agentic-ai--the-locker-room-provocateur-v3-sprint-10)
27. [The Integrity & Viral Loop (V4 Sprint 11)](#27-the-integrity--viral-loop-v4-sprint-11)
28. [The Autonomous Economy (V4 Sprint 12)](#28-the-autonomous-economy-v4-sprint-12)
29. [In-Play Micro-Predictions — Momentum Bets (V4 Sprint 14)](#29-in-play-micro-predictions--momentum-bets-v4-sprint-14)
30. [The Bento Arena — My Arena Stats Dashboard (V4 Sprint 15)](#30-the-bento-arena--my-arena-stats-dashboard-v4-sprint-15)

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
| Backend cron | node-cron | ^3.0 (in-process live poller) + Supabase `pg_cron` (5-min heartbeat) |
| Backend HTTP client | axios | ^1.6 |
| Backend rate limiting | express-rate-limit | ^8.5 |
| Data fetching (frontend) | TanStack Query (React Query) | ^5.101 — provider wired, hook migration pending |

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

# Deploy all pending migrations to remote Supabase
supabase db push --linked

# Check migration status (what's applied vs pending)
supabase migration list --linked
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

### Auto-migration hook

`.claude/settings.local.json` contains a PostToolUse hook that automatically runs
`supabase db push --linked` whenever Claude writes or edits a file matching
`supabase/migrations/*.sql`. This requires the Supabase CLI to be authenticated:

```bash
supabase login   # one-time browser auth — do this before working on migrations
```

After login, every migration file Claude writes is auto-deployed to the remote DB.

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

### 4.11 Admin RPCs are SECURITY DEFINER — never skip the email check

```sql
-- ❌ Skipping the admin guard exposes destructive RPCs to any authenticated user
CREATE OR REPLACE FUNCTION admin_delete_group(p_group_id UUID) ...

-- ✅ Every admin function must call is_super_admin() as its FIRST action
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super-admin only';
  END IF;
  ...
```

### 4.12 Coins live in `group_members.coins` — not a separate column

### 4.13 All bottom-sheet modals must implement swipe-to-close

Every modal that slides up from the bottom on mobile uses the Framer Motion drag pattern. Apply these props to the outer panel `motion.div`:

```tsx
drag="y"
dragConstraints={{ top: 0 }}
dragElastic={0.15}
dragMomentum={false}
onDragEnd={(_, info) => {
  if (info.offset.y > 100 && info.velocity.y > 20) onClose();
}}
```

And on every **scroll container inside** that modal:

```tsx
onPointerDown={e => e.stopPropagation()}
```

Without `onPointerDown` on scroll containers, Framer Motion intercepts touch events and the user can't scroll — the drag fires instead.

Modals with swipe-to-close: `HelpGuideModal`, `ScoringGuide`, `CoinGuide`, `CoinHistoryModal`, `UserMatchHistoryModal`.

### 4.14 Score resolution must use the atomic claim pattern + matchEndAt timestamps

Concurrent score resolvers (GitHub Actions cron every 5 min + Render scheduler every 30 s + manual sync from the Settings page) all SELECT the same `is_resolved=false` predictions. Without a guard they all proceed, all award coins, all insert notifications and locker-room events. This caused real duplicates in production (cleaned up by migrations 031 + 033).

**Every prediction-resolving code path in `scoreUpdater.ts` must:**

```typescript
// 1. Atomic claim — only one concurrent worker wins
const { data: claimed } = await supabaseAdmin
  .from('predictions')
  .update({ points_earned: finalPoints, is_resolved: true })
  .eq('id', prediction.id)
  .eq('is_resolved', false)        // ← guard
  .select('id');

if (!claimed || claimed.length === 0) continue;  // we lost — skip side effects

// 2. matchEndAt for every derived row (coin txn, notification, group_event)
const matchEndAt = new Date(new Date(kickoff_time).getTime() + 105 * 60 * 1000).toISOString();
```

The corners re-score loop uses a different claim shape because `is_resolved` is already true: `.lt('points_earned', correctBreakdown.total)` so only the first writer with the new (higher) total wins.

The DB has three partial unique indexes as a final backstop — see rule 4.15.

### 4.15 Never drop the coin/event/notification dedup constraints

Three partial unique indexes prevent duplicate awards even if application logic regresses. Do not drop these without a written, reviewed reason:

- `coin_transactions_bet_won_unique` — `(user_id, group_id, match_id, description) WHERE type='bet_won' AND match_id IS NOT NULL` (migration 032)
- `group_events_won_coins_unique` — `(group_id, user_id, match_id) WHERE event_type='WON_COINS' AND match_id IS NOT NULL` (migration 033)
- `notifications_prediction_result_unique` — `(user_id, (metadata->>'match_id')) WHERE type='prediction_result' AND metadata ? 'match_id'` (migration 033)

`description` is intentionally part of the coin key — the original "Won X pts → Y coins" award and a later "Corners re-score: +Z pts → +W coins" top-up are legitimate distinct rows for the same match. Removing `description` from the index would silently swallow the corners top-up.

`increment_coins` (after migration 032) relies on `coin_transactions_bet_won_unique` as its `ON CONFLICT` target. If the index is dropped, the function's `ON CONFLICT (user_id, group_id, match_id, description) WHERE …` clause throws at runtime — coin awards stop entirely. Recreate the index immediately if it ever goes missing.

### 4.16 Always set explicit `width` and `height` on `<img>` tags

All `<img>` elements must have numeric `width` and `height` HTML attributes so the browser reserves layout space before the image loads. Omitting them causes Cumulative Layout Shift (CLS) on slow connections.

```tsx
// ❌ CLS — browser doesn't know the size until the image loads
<img src={badge} alt={team} className="w-9 h-9" />

// ✅ Browser reserves 36×36px immediately
<img src={badge} alt={team} width={36} height={36} className="w-9 h-9" />
```

This applies to team badges, league logos, and avatars loaded from remote URLs.

The authoritative coin balance for a user in a group is `group_members.coins`.
`user_coins` is a legacy/supplementary table (created in migration 020) but the
primary balance used by `increment_coins`, `submit_prediction`, `distribute_daily_allowance`,
and all admin RPCs is `group_members.coins`.

```sql
-- ✅ Correct — read/write coins from group_members
UPDATE group_members SET coins = GREATEST(0, coins + p_delta)
WHERE user_id = p_user_id AND group_id = p_group_id;

-- ❌ Do not read totals from user_coins for balance display
```

---

## 5. File & Folder Map

```
goalbet/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── admin/
│       │   │   ├── AdminLayout.tsx        # Admin shell: sidebar (desktop) + top bar (mobile), Outlet
│       │   │   ├── AdminProtectedRoute.tsx # Email guard: only roychen651@gmail.com; silently redirects
│       │   │   ├── DangerModal.tsx        # Confirms destructive actions — requires typing "DELETE"
│       │   │   ├── GroupManagement.tsx    # Rename, view members, delete groups with DangerModal
│       │   │   └── UserManagement.tsx     # Edit name, manage coins per group, reset password, delete
│       │   ├── auth-v2/
│       │   │   ├── AuthContainer.tsx      # Master auth UI — 8-view glassmorphism card
│       │   │   ├── PasswordStrength.tsx   # Animated strength meter + 5 SVG checkmarks
│       │   │   └── ReAuthModal.tsx        # Session-expiry overlay — slides in over current page
│       │   ├── auth/
│       │   │   └── GoogleLoginButton.tsx  # Legacy Google button (unused in auth-v2 flow)
│       │   ├── groups/
│       │   │   ├── ActivityFeed.tsx       # The Locker Room feed — renders group_events. PREDICTION_LOCKED/WON_COINS/LEADERBOARD_CLIMB use the timeline-dot glass card; AI_BANTER (Sprint 10) AND MICRO_BANTER (V4 Sprint 14) both render via the same AiBanterCard — rotating conic-gradient border, dark glass panel, gradient "AI Scout" identity + Sparkles avatar + "AI" pill, lang-aware text
│       │   │   ├── CreateGroupModal.tsx
│       │   │   ├── InviteCodeDisplay.tsx
│       │   │   ├── JoinGroupModal.tsx
│       │   │   ├── MomentumBanner.tsx      # V4 Sprint 14 — breathing conic-gradient banner in LockerRoomPage when the active group has a live open/locked micro-prediction question. Countdown via useCountdown (useLiveClock-shaped isolated re-render — never touches LockerRoomPage/ActivityFeed). Tap opens MomentumBetSheet
│       │   │   └── MomentumBetSheet.tsx    # V4 Sprint 14 — swipe-to-close bottom sheet (rule 4.13), Yes/No choice buttons, haptic('selection') on tap + haptic('success') on confirmed submission
│       │   ├── layout/
│       │   │   ├── AppShell.tsx           # Root layout + ONLY place for auto-sync + cold-start isSyncing flag
│       │   │   ├── BottomNav.tsx          # Mobile bottom navigation
│       │   │   ├── ErrorBoundary.tsx      # Class component — catches render errors, shows bilingual fallback
│       │   │   ├── Sidebar.tsx            # Desktop sidebar
│       │   │   └── TopBar.tsx             # Mobile header: logo, group selector, coins, avatar
│       │   ├── leaderboard/
│       │   │   ├── H2HModal.tsx           # Head-to-head comparison (tap another user's row)
│       │   │   ├── LeaderboardRow.tsx     # Own row → history modal; other row → H2H modal
│       │   │   ├── LeaderboardTable.tsx
│       │   │   └── UserMatchHistoryModal.tsx  # Bottom sheet — swipe-to-close enabled
│       │   ├── profile/
│       │   │   ├── AvatarPicker.tsx       # Emoji avatar chooser
│       │   │   ├── HallOfFameChronicles.tsx # Sprint 27 — 3D-tilt gold/crimson carousel of user_chronicles (perfect +10 on high-profile matches); returns null when empty
│       │   │   ├── ProfileBentoV2.tsx     # Stats bento grid; hero card renders the live <Sparkline> points trajectory (Sprint 9) + NumberFlow-rolled total
│       │   │   └── ShareableRecapCard.tsx # V4 Sprint 11 — swipe-to-close bottom sheet showing rank/points/streak preview (reuses useLeaderboard, zero new query); Share button draws the actual shareable asset via lib/shareCard.ts's Canvas primitive, then the 3-tier share fallback (file-share → text-share → clipboard+download)
│       │   ├── matches/
│       │   │   ├── MatchCard.tsx          # ACTIVE card: MatchCardCore (private) + MatchCard (public, shimmer wrapper). isPastKickoffNS, DELAYED, live clock, weather/referee/competition phase, TacticalIntelSection, dual dark/light league logos, live breathing glow, goal flash, score flip. HT broadcast ticker via HTAnalystCard
│       │   │   ├── MatchFeed.tsx          # Date-grouped feed; imports MatchCard directly
│       │   │   ├── MatchRosters.tsx       # Starting XI + substitutes fetched from ESPN; feeds TacticalPitch
│       │   │   ├── MatchStats.tsx         # Post-match statistics (possession, shots, corners, etc.)
│       │   │   ├── MatchStatusBadge.tsx   # Status pill; intercepts DELAYED→SYNCING during cold-start
│       │   │   ├── MatchTimeline.tsx      # ESPN summary events (returns null when no data)
│       │   │   ├── TacticalPitch.tsx      # Glass tactical formation view for Starting XI; horizontal pitch with percentage-based positioning
│       │   │   └── PredictionForm.tsx     # 5-tier prediction input; corners hidden for league 4396
│       │   ├── stats/
│       │   │   ├── BentoArena.tsx         # V4 Sprint 15 — "My Arena" tab root. Responsive Bento Grid (1-col mobile, 4-col sm+), Framer Motion staggered spring entrance (staggerChildren 0.06, stiffness 100/damping 15), useReducedMotion short-circuit. Fed by useStatsArena (single RPC, no per-card fetch); hero/streak/risk tiles are NumberFlow-animated numbers, Heatmap/Distribution/H2H slots render PredictionHeatmap/GroupDistributionChart/H2HMatrix
│       │   │   ├── GroupDistributionChart.tsx # V4 Sprint 15 — "emphasis" chart: one muted-gray Gaussian curve modeling the group (RPC only exposes mean/stddev, never individual stakes — the curve is a modeled normal distribution, not a fake empirical one) + one glowing accent marker at the caller's own z-score position. Reuses lib/svgPath.ts's smoothPath
│       │   │   ├── H2HMatrix.tsx          # V4 Sprint 15 — scroll-snap opponent-picker rail (data-lenis-prevent) that re-indexes into the already-fetched h2h_matrix array — zero network calls per switch. NumberFlow-animated points/shared-matches/record comparison + a 3-segment win/tie/loss bar
│       │   │   ├── LeagueDropdown.tsx     # Custom animated dropdown; dual dark/light ESPN league logos; data-lenis-prevent so inner wheel-scroll works inside Lenis; layoutId-backed active bar
│       │   │   ├── LeagueLeaders.tsx      # Top scorers / assists tables sourced from ESPN leaders feed
│       │   │   ├── PredictionHeatmap.tsx  # V4 Sprint 15 — hand-built inline SVG League x Bet-Type grid. Diverging OKLCH color per cell via lib/oklch.ts (not CSS color-mix), every cell direct-labeled with its %, contrast-aware label ink, diagonal-hatch + "n/a" for sample_size < 3, RTL-aware column/label mirroring + clipPath guard on long league names, "view as table" accessible fallback, hover/focus detail line
│       │   │   ├── StandingsTable.tsx     # League standings table (rank, team, P/W/D/L, GF/GA/GD, pts)
│       │   │   └── WorldCupBracket.tsx    # Custom "Route to the Trophy" view for World Cup (league 4480). Tri-Host Aurora (Mexico #00FF87 + USA #00E5FF + Canada #FF004D blurred blobs, mix-blend: screen) + broadcast grain overlay on the root wrapper. Parallax hero (useScroll/useTransform on confetti, halo, trophy watermark) with brutalist hollow "2026" behind content — aurora-gradient fill reveals on scroll. Floating glass pill navigation (sticky, rounded-full, dark glass backdrop-blur-xl). 4 tabs: groups/fixtures/knockouts/venues. Groups: FIFA rank + seed pot indicators, GroupCard enters with 3D rotateX perspective. Fixtures: gold "Predict" button with toast teaser. Knockouts: Framer Motion accordion on mobile, 9-column symmetric bracket on desktop (BracketTreeCard compact grid / BracketMatchCard full-detail mobile). FinalApex: rotating sunburst, floating particles, gradient champion text. Venues: mobile scroll-snap carousel, desktop masonry grid (marquee venues span 2 cols), StadiumCard enters with 3D rotateX perspective + backdrop-blur glass. Pure Framer Motion + useScroll
│       │   └── ui/
│       │       ├── Avatar.tsx             # Expects emoji:🏆 prefix
│       │       ├── CoinGuide.tsx          # Bottom sheet — swipe-to-close enabled
│       │       ├── CoinHistoryModal.tsx   # Bottom sheet — swipe-to-close enabled. TYPE_CONFIG renders by coin_transactions.type (not raw description text) — join_bonus/daily_bonus/bet_placed/bet_won plus V4 Sprint 14's micro_prediction/micro_prediction_won/micro_prediction_refund, each own icon+label
│       │       ├── CoinIcon.tsx           # Animated coin SVG icon with configurable size
│       │       ├── EmptyState.tsx         # Reusable empty-state placeholder
│       │       ├── FadeInView.tsx         # Wrapper: fade-in on mount via Framer Motion
│       │       ├── GlassCard.tsx         # V4 Sprint 15 added an optional `grain` prop — overlays the .glass-grain feTurbulence texture (generalized from World Cup's .wc-grain). Only wraps children in an extra `relative z-10` div when grain is on, so every other call site is untouched
│       │       ├── HelpGuideModal.tsx     # Bottom sheet — swipe-to-close enabled
│       │       ├── HTAnalystCard.tsx      # Sprint 27 — broadcast-TV lower-third for live HT tactical read; rotating red/amber/cyan conic border + pulsing red LIVE badge + word-by-word typewriter reveal. Returns null when text is empty
│       │       ├── InfoTip.tsx            # Tooltip using CSS vars (works in both themes)
│       │       ├── LangToggle.tsx
│       │       ├── LoadingSpinner.tsx
│       │       ├── MagneticButtonV2.tsx   # Magnetic pull button; variants: volt / ghost / purple
│       │       ├── MatchCardSkeleton.tsx  # Premium cold-start loader (pulse + shimmer). Exports MatchCardSkeleton + MatchCardSkeletonList
│       │       ├── NeonButton.tsx         # Variants: green / ghost / danger
│       │       ├── PolicyModal.tsx
│       │       ├── PushToggle.tsx         # Sprint 8 — self-hiding match-reminder toggle (Settings). Renders nothing when Web Push unsupported / VAPID key unset; shows "add to home screen" hint on iOS Safari; enable/disable button on installed PWA + desktop/Android
│       │       ├── ScoringGuide.tsx       # Bottom sheet — swipe-to-close enabled
│       │       ├── Sparkline.tsx          # Sprint 9 — pure-SVG area+line micro-chart, zero chart-library dependency. Catmull-Rom smoothed path (smoothPath extracted to lib/svgPath.ts in Sprint 15 so GroupDistributionChart shares the same spline math), Framer Motion pathLength draw-on, colour via CSS vars (theme-fluid), useReducedMotion aware, CLS-stable fixed-height box + dashed baseline when data is insufficient
│       │       ├── FormBars.tsx           # Sprint 9 — last-N points-per-match bars (colour = outcome, height = magnitude), spring grow-in, reduced-motion aware
│       │       ├── StaggerList.tsx        # Wrapper: staggered child animations
│       │       ├── SyncProgressBar.tsx    # Fixed top bar; visible while isSyncing; z-[100]
│       │       ├── ThemeToggle.tsx
│       │       ├── TiltCardV2.tsx         # 3° tilt with spring physics for profile bento cards
│       │       ├── Toast.tsx
│       │       └── WelcomeAnimation.tsx   # First-login welcome sequence
│       ├── hooks/
│       │   ├── useAuth.ts                 # Legacy Google OAuth (kept for backward compat)
│       │   ├── useAuthV2.ts               # Auth-v2 state machine (8 views)
│       │   ├── useCountdown.ts            # V4 Sprint 14 — same isolated local-state/setInterval shape as useLiveClock, ticks whole seconds remaining until an expiry timestamp; drives MomentumBanner without re-rendering LockerRoomPage
│       │   ├── useGroupEvents.ts          # Locker Room activity feed subscriber. event_type union includes MICRO_BANTER (V4 Sprint 14) alongside AI_BANTER; user_id is string | null (both AI event types have no owning user)
│       │   ├── useGroupMatchPredictions.ts
│       │   ├── useLeaderboard.ts
│       │   ├── useLeagueStats.ts          # Fetches ESPN standings + leaders for Stats Hub; pass null to skip (used for custom-view leagues like World Cup)
│       │   ├── useLiveClock.ts            # Ticking clock for live matches
│       │   ├── useMatches.ts              # Fetches + Realtime + goalbet:synced listener
│       │   ├── useMatchSync.ts            # Manual sync ONLY (Settings button) — 60s timeout
│       │   ├── useMicroPrediction.ts      # V4 Sprint 14 — active group's live open/locked micro-prediction question + caller's own bet, group_id-filtered Realtime, submitBet() mirrors usePredictions.ts's optimistic-then-authoritative-reconcile shape
│       │   ├── useNewPointsAlert.ts       # Toast on newly earned points since last visit
│       │   ├── useNotifications.ts        # Persistent notifications feed subscriber
│       │   ├── usePredictions.ts          # TanStack Query mutation wrapping submit_prediction (V4 Sprint 11) — single RPC call, no separate client upsert to predictions
│       │   ├── useStatsArena.ts           # V4 Sprint 15 — TanStack Query wrapper around get_stats_arena_payload (migration 044). staleTime ~2min, deliberately outside AppShell's auto-sync (rule 4.3) since this data moves at the pace of match resolutions, not live scores
│       │   ├── useWorldCupMatches.ts       # Fetches all synced league-4480 rows (+ realtime) for the WC bracket live overlay
│       │   └── useRTLDirection.ts         # Sets document.dir from active language
│       ├── lib/
│       │   ├── authSchema.ts              # Password validation: strength, requirements, error mapping
│       │   ├── constants.ts               # FOOTBALL_LEAGUES, LEAGUE_ESPN_SLUG, POINTS, COIN_COSTS, ROUTES
│       │   ├── featureFlags.ts            # Feature flag registry (currently no active flags)
│       │   ├── i18n.ts                    # EN + HE translations, TranslationKey type
│       │   ├── oklch.ts                    # V4 Sprint 15 — hand-crafted OKLCH interpolation for the heatmap's diverging scale. interpolateDiverging(ratio) linearly lerps L/C/H (shortest-path hue lerp) between the --arena-cold/mid/hot anchors, read live via getComputedStyle at call time — the tokens in index.css stay the single source of truth, never duplicated as hardcoded numbers here. Deliberately not CSS color-mix(): a discrete color + its resolved lightness (for contrast-aware label ink) are both needed per cell
│       │   ├── push.ts                     # Sprint 8 — Web Push client: getPushStatus() / enablePush() / disablePush(); VAPID key gate; iOS-non-standalone detection (checked BEFORE apiSupported so iPhone Safari shows the install hint, not nothing)
│       │   ├── queryClient.ts             # TanStack Query client (refetchOnWindowFocus off — AppShell owns sync)
│       │   ├── shareCard.ts                # V4 Sprint 11 — zero-dependency shareable recap card. drawRecapCard() hand-draws rank/points/streak to an offscreen Canvas (same philosophy as Sparkline.tsx — no html2canvas/html-to-image); colors resolved from live CSS custom properties via getComputedStyle at draw time so the PNG matches the active theme; RTL handled explicitly (ctx.direction + right-anchored text). shareRecapCard() is the 3-tier fallback: navigator.share with a file → navigator.share text-only → clipboard copy + explicit PNG download
│       │   ├── supabase.ts                # Supabase client (anon key) + all TypeScript table types
│       │   ├── svgPath.ts                  # V4 Sprint 15 — smoothPath() (Catmull-Rom → cubic Bézier) extracted from Sparkline.tsx so every hand-built SVG chart shares one spline implementation. Sparkline.tsx and GroupDistributionChart.tsx both import it
│       │   ├── utils.ts                   # calcBreakdown() (client-side scoring mirror), cn()
│       │   └── worldCup2026.ts            # Static FIFA WC 2026 data: 12 groups, R32/R16/QF/SF/3rd/Final with dates + FIFA match numbers + venueId, 16 host stadiums, tournament phases. Consumed by WorldCupBracket
│       ├── pages/
│       │   ├── admin/
│       │   │   └── AdminDashboardPage.tsx # Bento grid KPIs + system health actions
│       │   ├── AuthCallbackPage.tsx       # Handles Supabase OAuth redirect
│       │   ├── HomePage.tsx               # Match feed — All / Upcoming / Live / Results tabs
│       │   ├── LeaderboardPage.tsx        # Group standings with H2H modal
│       │   ├── LockerRoomPage.tsx         # Group activity feed (WON_COINS, predictions, etc.)
│       │   ├── LoginPage.tsx              # Thin wrapper — redirect if logged in, render AuthContainer
│       │   ├── ProfilePage.tsx            # Stats, prediction history, sign-out button
│       │   ├── SettingsPage.tsx           # Group mgmt, leagues, admin tools, Account section
│       │   └── StatsPage.tsx              # Two sub-tabs (V4 Sprint 15): "Leagues" — LeagueDropdown + StandingsTable + LeagueLeaders for ESPN-backed leagues, WorldCupBracket for custom-view tournaments (CUSTOM_VIEW_LEAGUES set, currently World Cup 4480); "My Arena" — BentoArena, the personal/group stats dashboard (§30)
│       └── stores/
│           ├── authStore.ts               # user, profile, session; signInWithGoogle, signOut
│           ├── coinsStore.ts              # coins; synced from DB. V4 Sprint 12 — initCoins() is a plain balance fetch (no longer claims the daily bonus, which pg_cron deposits proactively). App.tsx's AppInitializer effect pairs it with a group_id-filtered Realtime subscription (group_members UPDATE → re-fetch; coin_transactions INSERT with type='daily_bonus' → coin_drop haptic + toast) so an online user sees a midnight deposit live
│           ├── groupStore.ts              # groups[], activeGroupId; persisted to localStorage
│           ├── langStore.ts               # lang ('en'|'he'); persisted to localStorage
│           ├── themeStore.ts              # theme ('dark'|'light'); persisted to localStorage
│           └── uiStore.ts                 # activeModal, toasts[], isSyncing; memory only
│
├── backend/
│   └── src/
│       ├── cron/
│       │   └── scheduler.ts               # Startup catch-up + 30s score poller + daily/weekly crons + every-2-min match-reminder cron (Sprint 8) + every-3-min AI Provocateur batch (Sprint 10) + every-30-min streak-expiry warning (V4 Sprint 12) + every-5s Momentum Bets lock sweep + every-15s resolution sweep (V4 Sprint 14) — each interval-guarded against overlap the same way as the original 30s live poller (livePollerRunning-style booleans)
│       ├── lib/
│       │   └── supabaseAdmin.ts           # Supabase client with service-role key (bypasses RLS)
│       ├── middleware/
│       │   ├── rateLimiter.ts             # express-rate-limit: global 60/min + per-route scores 20/min, matches 10/min
│       │   └── syncAuth.ts                # X-Sync-Key guard for internal cron routes; 403 + fail-closed + constant-time compare
│       ├── routes/
│       │   ├── admin.ts                   # DELETE /api/admin/users/:id · POST /api/admin/reset-password
│       │   ├── health.ts                  # GET /api/health → { status: 'ok' }
│       │   └── sync.ts                    # Public (browser, rate-limited): POST /api/sync/matches · /scores. Internal (X-Sync-Key): POST /api/sync/internal/matches · /internal/scores. Handlers shared
│       ├── scripts/
│       │   ├── manualSync.ts              # npm run sync — dev helper
│       │   └── seed.ts                    # npm run seed — populates dev data
│       └── services/
│           ├── aiProvocateur.ts           # Sprint 10 — runProvocateurBatch(): reads conflicting H2H picks on a just-kicked-off match + group standings, generates EN+HE banter via the shared Groq client (callGroq, exported from aiScout.ts), posts one AI_BANTER group_event per (group, match). Skips no-conflict matches; fires only at/after kickoff (never pre-lock — Sprint 2 privacy)
│           ├── aiScout.ts                 # AI Scout (Sprint 26) + HT Read/Chronicles (Sprint 27) — see §22/§23. callGroq() is exported for reuse by aiProvocateur.ts AND microBanter.ts (V4 Sprint 14) — the single Groq client every AI feature funnels through
│           ├── espn.ts                    # ESPN API client + LEAGUE_ESPN_MAP
│           ├── matchSync.ts               # syncLeague(id), syncAllActiveLeagues()
│           ├── microBanter.ts              # V4 Sprint 14 — triggerMicroBanter(): fires the instant a Momentum Bets question locks (called from momentumBets.ts, fire-and-forget). Reuses callGroq; posts MICRO_BANTER group_events (own dedup index, NOT aiProvocateur's AI_BANTER one — see migration 042). AI generates commentary only, never the question or its resolution
│           ├── momentumBets.ts             # V4 Sprint 14 — In-Play Micro-Predictions lifecycle, separate from scoreUpdater.ts (pure DB-state sweeps, no ESPN calls). lockExpiredMicroQuestions() (5s cadence): atomic per-question claim, stamps locked_at + a score baseline — this is what makes the arbitrage fix real, not just a comment. resolveLockedMicroQuestions() (15s cadence): score-delta resolution against the baseline, or cancel+refund if match data is unavailable. settleBets() claims each bet via settled_at IS NULL — same atomic-claim shape as resolveMatchPredictions — so a crash mid-loop is safely retried regardless of the question's own status
│           ├── pointsEngine.ts            # PURE scoring function — no DB calls, fully testable
│           ├── pushSender.ts              # Sprint 8 — sendMatchReminders(): 15-min pre-kickoff Web Push to ALL opted-in members of groups where the league is active; prunes dead subs (404/410); stamps matches.reminder_sent_at. No-op unless VAPID_* env set. sendPushToUser() (V4 Sprint 11) is the general single-user send, extracted from the same send+prune logic — reused by scoreUpdater's rank-drop notifications and streakGuardian.ts
│           ├── scoreUpdater.ts            # Resolves predictions after FT, writes leaderboard + coins + streak (current_streak/best_streak, Sprint 8). V4 Sprint 11 adds a per-invocation RankTracker + flushRankDropNotifications() (batch before/after rank diff, one push per user per run — see §27). V4 Sprint 14 adds generateMilestoneQuestions() (kickoff/halftime/minute-75 detection, hooked in right before the FT/ET/live branching)
│           ├── sportsdb.ts               # DBMatch type definition (legacy, kept for types)
│           └── streakGuardian.ts          # V4 Sprint 12 — sendStreakExpiryWarnings(): pushes a day-6 "your streak is about to expire" warning via sendPushToUser, gated by leaderboard.streak_warning_sent_at (cleared back to null by scoreUpdater on any resolution, so a saved streak can be warned again on a future idle cycle). The actual decay is pure SQL on pg_cron (decay_idle_streaks(), migration 041) — this file is only the push-send half
│
├── supabase/
│   ├── email-templates/
│   │   ├── confirm-signup.html            # Green-theme onboarding email (paste into Supabase dashboard)
│   │   └── reset-password.html            # Orange-theme recovery email (paste into Supabase dashboard)
│   ├── functions/                         # Currently EMPTY. The dead TheSportsDB-era sync-matches function was deleted (V4 Sprint 13, first commit) before ESPN was even live. "Data Engine 2.0" (moving score resolution to a Supabase Edge Function) is a SHELVED, not-yet-executed plan — see the note at the end of §21 Common Pitfalls before assuming any Edge Function exists here
│   └── migrations/                        # 001 → 023 — auto-deployed via PostToolUse hook on write
│
├── .claude/
│   └── settings.local.json                # PostToolUse hook: auto-runs `supabase db push --linked` on migration writes
│
└── .github/
    └── workflows/
        ├── ci.yml                         # Type-check + build on every push/PR
        └── sync-cron.yml                  # Every 5 min: wake → scores (critical) → fixtures (non-critical)
```

---

## 6. Routing

```
/login           → LoginPage          (public — renders AuthContainer)
/auth/callback   → AuthCallbackPage   (public — Supabase Google OAuth redirect)
/                → HomePage           (protected via AuthGuard → AppShell)
/leaderboard     → LeaderboardPage    (protected via AuthGuard → AppShell)
/locker-room     → LockerRoomPage     (protected via AuthGuard → AppShell)
/stats           → StatsPage          (protected via AuthGuard → AppShell)
/profile         → ProfilePage        (protected via AuthGuard → AppShell)
/settings        → SettingsPage       (protected via AuthGuard → AppShell)
/admin           → AdminDashboardPage (protected via AdminProtectedRoute → AdminLayout)
/admin/users     → UserManagement     (protected via AdminProtectedRoute → AdminLayout)
/admin/groups    → GroupManagement    (protected via AdminProtectedRoute → AdminLayout)
*                → redirect to /
```

**`AuthGuard`** (in `App.tsx`):
- Renders `<PageLoader />` while `!initialized || loading`
- On unexpected session expiry (user was logged in → now null): shows `<ReAuthModal>` instead of redirecting
- On deliberate sign-out with no session: `<Navigate to="/login" replace />`

**`AdminProtectedRoute`** (in `components/admin/AdminProtectedRoute.tsx`):
- Client-side email check: `user.email === 'roychen651@gmail.com'`
- Silently redirects to `/` for any other user — no error message shown
- Server-side: every admin RPC calls `is_super_admin()` as its first action (double protection)

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
  │    ├─ AppShell         → owns ALL automatic sync; manages isSyncing cold-start flag
  │    ├─ SyncProgressBar  → fixed top shimmer; visible while isSyncing=true
  │    ├─ ErrorBoundary    → wraps <Outlet />; catches render errors; bilingual fallback
  │    ├─ useMatches       → queries Supabase + listens for 'goalbet:synced' event + Realtime
  │    └─ useMatchSync     → Settings "Sync Now" button ONLY (manual, never auto-triggered)
  │
  ├─ Supabase Realtime     → pushes match UPDATE/INSERT to subscribed clients
  │
  └─ Render (Express API — free tier, sleeps after ~15 min)
       ├─ POST /api/sync/matches           → (public, rate-limited) syncAllActiveLeagues() — browser callers
       ├─ POST /api/sync/scores            → (public, rate-limited) checkAndUpdateScores() — browser callers
       ├─ POST /api/sync/internal/matches  → (X-Sync-Key) same handler — pg_cron / GH Actions fallback
       ├─ POST /api/sync/internal/scores   → (X-Sync-Key) same handler — pg_cron / GH Actions fallback
       ├─ GET  /api/health        → { status: 'ok' }
       ├─ DELETE /api/admin/users/:id     → hard-delete from auth.users (service role, admin only)
       ├─ POST  /api/admin/reset-password → send password reset email (service role, admin only)
       └─ setInterval 30s         → live score polling while awake
```

**Data flow on page load:**
1. `AppShell` sets `isSyncing = true` → `SyncProgressBar` appears + DELAYED badges show "Syncing…"
2. `AppShell` fires `POST /api/sync/matches` (90s timeout) — wakes Render + pulls fresh fixtures
3. `AppShell` fires `POST /api/sync/scores` immediately (75s timeout) + retries at 25s
4. First successful response: `dispatchAndClearSyncing()` → `isSyncing = false` + `goalbet:synced`
5. `useMatches` hears `goalbet:synced` → calls `fetchMatches()` → UI updates
6. Supabase Realtime also pushes row-level changes for live score diffs

**GitHub Actions as heartbeat:**
`sync-cron.yml` runs every **5 minutes**. Wakes backend → resolves scores (coins) → syncs fixtures. Keeps Render alive 24/7 and data current even with zero active users.

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
  ├─ setSyncing(true)        — SyncProgressBar appears; DELAYED badges swap to "Syncing…" blue
  ├─ POST /api/sync/matches  (90s AbortController timeout) — wakes Render + pulls fixtures
  ├─ POST /api/sync/scores   (75s timeout) — resolves any finished predictions immediately
  ├─ setTimeout 25s → POST /api/sync/scores — backend is warm by now, fast retry
  └─ setInterval 30s → POST /api/sync/scores — live-score polling

Tab restore (hidden > 90s) → force POST /api/sync/scores
POLL_THROTTLE_MS = 30,000  → debounces rapid successive calls
```

All fetches use `AbortController` with explicit timeouts. If the backend times out on cold start, the fetch aborts cleanly — `isSyncing` is never permanently stuck because the 25s retry will succeed once Render is warm.

### Cold-start UX: `isSyncing` flag

`AppShell` sets `isSyncing = true` on mount and clears it exactly once — on the first successful sync response — via `dispatchAndClearSyncing()`:

```typescript
const dispatchAndClearSyncing = useCallback(() => {
  if (!hasSyncedRef.current) {
    hasSyncedRef.current = true;
    setSyncing(false);          // clears SyncProgressBar
  }
  dispatch();                   // fires goalbet:synced
}, [setSyncing]);
```

`hasSyncedRef` prevents `setSyncing(false)` from firing more than once per mount, so polling calls don't flicker the progress bar.

**What `isSyncing` controls:**
- `SyncProgressBar` — fixed top shimmer bar visible during cold start
- `MatchStatusBadge` — DELAYED status shows blue "Syncing…" instead of alarming orange "Delayed"

**Why 75s for score sync?** Render free tier takes 45–60s to cold start. The previous 30s timeout meant score sync was always failing on cold start, causing coin payouts to be delayed until the next GitHub Actions run.

**Why 90s tab restore threshold?** Live games update every minute. The previous 5-minute threshold meant users returning to the tab during a live match would see data up to 5 minutes stale before a forced refresh.

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

`syncLeague()` calls `fetchLeagueMatches(leagueId, daysBack, 90)` — **90 days ahead**, and `daysBack` is **45 for World Cup (4480)** so the whole tournament (group stage from mid-June onward) is captured, **7 for every other league**. (Score resolution uses a tight `fetchLeagueMatches(leagueId, 3, 1)` in `scoreUpdater.ts` — imminent kickoffs only.)

**Off-season gotcha:** the frontend `useMatches` upcoming window (`INITIAL_UPCOMING_DAYS`) must stay wide enough to reach the next fixtures, or the feed shows "No matches found" even though the DB is full. In mid-summer the nearest European fixtures are ~40 days out, so the window is **60 days** (was 30, which hid the entire pre-season slate). The backend 90-day sync window is the ceiling; keep the frontend window ≤ it.

**Force a clean pull of every mapped league** (ignores group `active_leagues`, seeds World Cup): `cd backend && npm run sync:all`, or `POST /api/sync/matches` with body `{ "all": true }`.

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

**ESPN penalty/ET capture (learn from the recurring bug):** ESPN's soccer feeds use **`STATUS_FINAL_PEN`** (not `STATUS_FINAL_PK`) for shootout finals and put the shootout score on **`competitors[].shootoutScore`** — the per-period `linescores` are often entirely empty (e.g. all of `fifa.world`). So `espn.ts` must (1) treat `STATUS_FINAL_PEN` as pens, (2) read `shootoutScore` directly from the scoreboard competitor (primary source; linescores[4] is only a fallback), and (3) when ET/PEN is detected but no per-period split exists, set `regulation_home/away = final score` so the frontend's `wentToET` badge (which keys off `regulation_home != null`) still fires. The frontend `MatchCard` already renders AET/PEN + the winning side + shootout score from these fields — the bug was always **data capture**, not display.

**`went_to_penalties` must ALWAYS be sent as an explicit boolean in the upsert** — never `delete` it when false. The column is `NOT NULL`, and in a bulk PostgREST upsert the INSERT column list is the union of all row keys; if any row keeps the key (a real PEN match) the rows that omitted it are sent `NULL` → the whole batch fails the NOT-NULL constraint. This silently killed WC knockout sync.

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
| Daily login bonus (autonomous, V4 Sprint 12) | **+30** |
| Stake a prediction | **−(sum of tiers played)** — computed **server-side**, see below |
| Tier resolved correctly | **+(points_earned × 2)** |
| Momentum (micro-prediction) bet (V4 Sprint 14) | **−2** fixed stake |
| Momentum bet won | **+4** (2× stake) |
| Momentum bet — question canceled | **+2** refund (full stake back) |

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

`COIN_COSTS` still exists in the frontend for the **optimistic UI guess only** (`calcPredictionCost()` in `usePredictions.ts`/`ProfilePage.tsx`, shown instantly on tap). It is **not** the source of truth for what gets charged — see the `submit_prediction` rule immediately below. If `COIN_COSTS` and the RPC's hardcoded per-tier values (migration 040) are ever changed, they must be changed together or the optimistic guess will visibly "correct itself" on every bet (harmless — `NumberFlow` animates the correction — but confusing to leave mismatched for long).

### ⚠️ Never trust a client-computed cost for a coin-spending RPC (V4 Sprint 11 lesson)

`place_prediction_bet` / `adjust_prediction_bet` / `claim_daily_bonus` **no longer exist** — dropped in migration 040/041. They took a client-supplied `p_cost` and a client-user-supplied `p_user_id` with **no `auth.uid()` check**, meaning any authenticated caller could move another user's coins by passing a different UUID, and any client could bet a full 5-tier prediction while claiming it cost 1 coin. Found and fixed once (§27); the fix is now the mandatory pattern for every new coin-spending RPC:

1. `IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION` — **first action**, no exceptions (same discipline as `is_super_admin()` being first in admin RPCs, rule 4.11).
2. Compute the cost/amount **inside the RPC** from data the RPC itself reads (the actual tier columns, the actual bet row) — never from a parameter the client provides.
3. The RPC performs the **entire** write (balance debit/credit + ledger insert + the domain row itself) in one atomic function — the client never writes the spending-adjacent table directly.

`submit_prediction` (predictions) and `submit_micro_prediction` (Momentum Bets) both follow this shape. Any future coin-spending RPC must too.

### UX rules — never violate

- **Never show negative coin balance.** Clamp at 0.
- **Always show `+coinsBack`** — `coinsBack = pointsEarned × 2`. Always ≥ 0.
- **Only show a "profit" line** when `coinsBack > coinsBet`.

### Daily bonus — autonomous, not client-triggered (V4 Sprint 12)

The daily +30 bonus is no longer claimed by the client on app load. `pg_cron` runs `distribute_daily_allowance()` every 15 minutes (not at a fixed midnight timestamp — see the DST note in §28) and proactively deposits it into every eligible `group_members` row. `(NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE`, not `CURRENT_DATE`, is still the correct "today" expression — inherited directly from the old `claim_daily_bonus`, just evaluated server-side on a timer instead of on request. Eligibility requires `profiles.last_active_at` within the last 3 days — a fully abandoned account accrues a maximum of 90 coins and then stops. See §28 for the full design.

### Key DB functions

```sql
-- Fully IDEMPOTENT after migration 032. Calling this 100× with the same args
-- produces the same result as calling it once. The function tries to INSERT
-- the coin_transactions log row first with ON CONFLICT DO NOTHING against the
-- partial unique index `coin_transactions_bet_won_unique`. If the insert wins,
-- group_members.coins is credited and balance_after is backfilled. If the
-- insert loses (duplicate), the function returns the current balance unchanged.
-- This is the race-condition fix — concurrent score resolvers (GitHub Actions
-- cron + Render scheduler + manual sync) cannot double-credit the same award.
increment_coins(
  p_user_id     UUID,
  p_group_id    UUID,
  p_match_id    UUID,
  p_amount      INTEGER,
  p_description TEXT        DEFAULT 'Prediction won',
  p_created_at  TIMESTAMPTZ DEFAULT NULL  -- when omitted, falls back to NOW()
) RETURNS INTEGER  -- new (or unchanged) balance

-- V4 Sprint 11 (migration 040) — the sole write path for placing/editing a
-- prediction. Computes cost server-side from the tier params it receives
-- (never a client-supplied cost), checks auth.uid() first, upserts the
-- predictions row itself inside the same transaction. See §27.
submit_prediction(
  p_user_id, p_group_id, p_match_id,
  p_predicted_outcome, p_predicted_home_score, p_predicted_away_score,
  p_predicted_corners, p_predicted_btts, p_predicted_over_under
) RETURNS JSONB  -- { success, balance, coins_bet, prediction }

-- V4 Sprint 11 (migration 040) — coin-side of prediction deletion. Reads
-- coins_bet from the row itself (never a client-supplied amount) and
-- re-checks is_resolved server-side so an already-paid-out prediction can
-- never be refunded twice.
refund_prediction(p_user_id, p_group_id, p_match_id) RETURNS JSONB  -- { success, balance }

-- V4 Sprint 12 (migration 041) — pg_cron only, no client GRANT. See §28.
distribute_daily_allowance() RETURNS VOID
decay_idle_streaks() RETURNS VOID
touch_last_active() RETURNS VOID  -- client-callable; the ONLY client-facing function in this group

-- V4 Sprint 14 (migrations 042/043) — Momentum Bets. See §29.
submit_micro_prediction(p_user_id, p_group_id, p_question_id, p_choice) RETURNS JSONB
credit_group_coins(p_user_id, p_group_id, p_amount) RETURNS INTEGER  -- service-role-only atomic increment primitive, never GRANTed to authenticated
```

### Coin transaction created_at — "the times are sacred"

When `scoreUpdater.ts` resolves a prediction, it passes `p_created_at = matchEndAt` (kickoff_time + 105 min) to `increment_coins`. The same `matchEndAt` is also written to the `notifications` and `group_events` rows for that resolution. This means:

- A user who wins coins from a 21:00 match always sees `21:45` (or thereabouts) as the transaction/notification time, regardless of when the backend actually processed it
- Cold-start delays, GitHub Actions schedule jitter, and catch-up resolutions all produce the same "real" time
- The user's words, repeated verbatim: **"גם אם שחקן לא נמצא בתוך האפליקציה עדיין הזמנים הם קודש"** ("even if a player isn't in the app, the times are still sacred")

Never use `NOW()` for derived rows in resolution code paths. Always thread `matchEndAt` through.

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
| `SYNCING` | `isSyncing=true` AND underlying status is `DELAYED` | "Syncing…" (blue) |
| `ET_HT` | Live break between ET halves | "AET HT" (amber) |

Computed in `MatchCard.tsx`, passed to `MatchStatusBadge` as props. Never write them to the database.

**`SYNCING` intercept logic** (in `MatchStatusBadge`):
```typescript
const effectiveStatus = isSyncing && status === 'DELAYED' ? 'SYNCING' : status
```
This prevents the alarming orange "Delayed" badge from flashing during cold start before ESPN data arrives.

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
| FA Cup | 9001 | `eng.fa` |
| League Cup (Carabao) | 9002 | `eng.league_cup` |
| Copa del Rey | 9003 | `esp.copa_del_rey` |
| International Friendlies | 4396 | `fifa.friendly` |
| UEFA Nations League | 4635 | `uefa.nations` |
| World Cup Qualifiers 2026 | 5000 | `uefa.worldq` |
| World Cup 2026 | 4480 | `fifa.world` |

### World Cup 2026 (4480) — live ESPN data + custom bracket view

**As of the 2026 tournament, World Cup 4480 has a live ESPN feed** (slug `fifa.world`, ESPN league id 606) in **both** `LEAGUE_ESPN_MAP` (backend) and `LEAGUE_ESPN_SLUG` (frontend). Once a group activates World Cup, `syncAllActiveLeagues()` pulls real WC fixtures into the `matches` table like any other league, and they appear in the normal HomePage feed with full prediction support.

It is **still rendered by the custom `<WorldCupBracket />` view** in the Stats Hub — `StatsPage.tsx` keeps a `CUSTOM_VIEW_LEAGUES` set (`{ 4480 }`) and the explicit `leagueId === WORLD_CUP_ID` check both still route to the bracket rather than `<StandingsTable>`/`<LeagueLeaders>` (ESPN has no WC standings/leaders feed). `useLeagueStats` is still passed `null` for the custom view.

**Live overlay (do not "replace" the static data with live rows):** the bracket's structure — groups, FIFA match numbers 73–104, 16 stadia, the knockout tree, TBD slots — is static in `lib/worldCup2026.ts` and the DB cannot supply it. `WorldCupBracket.tsx` therefore *hydrates* the static scaffold with live data instead of replacing it:
- `hooks/useWorldCupMatches.ts` fetches all synced league-4480 rows (+ realtime, + `goalbet:synced`).
- A `WCLiveContext` + normalised **team-pair matcher** (`teamPairKey` / `normTeam`, with a `TEAM_ALIASES` table for Türkiye→Turkey, South Korea↔Korea Republic, Ivory Coast↔Côte d'Ivoire, USA, Bosnia, Czechia) maps each static fixture to its live DB row order-independently.
- `LiveScorePill` shows the FT/live score (oriented to the fixture's home side) on group-fixture and knockout cards once a match exists.
- Predict buttons open the **standard `PredictionModal`** (mounted inside the bracket, fed by synced WC matches) for unlocked matches and show a `predicted` state; they gracefully fall back to the `wcPredictSoon` teaser when no synced/unlocked match matches (e.g. placeholder knockout slots like "W 73"). Predictions flow through the existing `submit_prediction` RPC (V4 Sprint 11 — §27) + kickoff lock + `scoreUpdater` atomic claim — WC is fully in the core economy.
- `BracketTreeCard` (ultra-compact, desktop 9-column grid) and `BracketMatchCard` (full-detail, mobile stacked) remain distinct. 4 tabs (groups / fixtures / knockouts / venues); the `overview` tab was removed. Trophy SVG is in `assets/world-cup-trophy.svg`.

- **Euro Championship** (4467) — silently skipped (no custom view yet; only relevant every 4 years).

### Removed leagues

- **Israeli Premier League** (4354 / `isr.1`) — removed April 2026. ESPN only covers the 2024-25 season; all 2026-date queries return 0 events. API-Football free plan blocks season 2025. Removed from `FOOTBALL_LEAGUES`, `LEAGUE_ESPN_SLUG`, and `LEAGUE_ESPN_MAP` entirely.

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

Migrations live in `supabase/migrations/`. Current sequence: **001 → 044** (024 does not exist).
Apply via `supabase db push --linked` (auto-runs via hook on migration file write once logged in).

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
| `017` | Predictions delete policy (idempotent — uses DROP POLICY IF EXISTS) |
| `018` | `penalty_home` / `penalty_away` columns |
| `019` | `red_cards_home` / `red_cards_away` columns |
| `020` | Coins system: `user_coins` table, `increment_coins`, `claim_daily_bonus` |
| `021` | Coins bug fixes |
| `022` | Admin features: group delete policy, group_members delete policy (idempotent) |
| `023` | Admin security RPCs: `is_super_admin`, `admin_get_stats`, `admin_get_users`, `admin_get_groups`, `admin_get_user_coins`, `admin_adjust_coins`, `admin_update_username`, `admin_delete_group`, `admin_delete_user_data`, `admin_rename_group` |
| `025` | AI Scout: `ai_pre_match_insight` + `ai_post_match_summary` nullable TEXT on `matches` (Sprint 26) |
| `026` | Persistent notifications table + RLS |
| `027` | Fix `admin_delete_user_data` to also wipe `coin_transactions` |
| `028` | Group activity feed (`group_events` table for The Locker Room) |
| `029` | `group_events` FK → `profiles(id)` so PostgREST joins work |
| `030` | `increment_coins` accepts explicit `p_created_at` so coin txns reflect match end time, not server clock ("the times are sacred") |
| `031` | One-off cleanup of duplicate `coin_transactions` rows + rebuild `group_members.coins` from cleaned ledger (race-condition aftermath) |
| `032` | **Bulletproof coin dedup**: partial unique index on `coin_transactions (user_id, group_id, match_id, description) WHERE type='bet_won'` + rewrite `increment_coins` as fully idempotent (`INSERT … ON CONFLICT DO NOTHING` first, then credit balance only if insert won the race) |
| `033` | Cleanup of duplicate `group_events` WON_COINS rows + duplicate `notifications` prediction_result rows + matching partial unique indexes (`group_events_won_coins_unique`, `notifications_prediction_result_unique`) as DB-level backstops |
| `034` | AI Scout Hebrew variants: `ai_pre_match_insight_he` + `ai_post_match_summary_he` nullable TEXT on `matches` (Sprint 26 follow-up) |
| `035` | Sprint 27: `ai_ht_insight` + `ai_ht_insight_he` nullable TEXT on `matches`; creates `user_chronicles` table (uuid match_id FK, title, epic_text + _he, predicted/final scores, points_earned) with partial unique index `(user_id, match_id)` for idempotency + RLS (authenticated-read, service-role write) |
| `036` | **Ironclad Sync Engine (V3 Sprint 1):** enables `pg_cron` + `pg_net` + `supabase_vault`; `public.trigger_sync_heartbeat()` (SECURITY DEFINER) reads `SYNC_API_KEY` from Vault and `net.http_post`s to `/api/sync/internal/scores` then `/internal/matches` every 5 min (scores first, fire-and-forget). Idempotent (unschedule-if-exists → reschedule). **Activation requires: (1) `select vault.create_secret('<key>','SYNC_API_KEY')`, (2) `SYNC_API_KEY` env var on Render, (3) `supabase db push`.** Until applied, the 30-min GitHub Actions fallback carries coin resolution. |
| `037` | **Fort-Knox Privacy (V3 Sprint 2):** rewrites `predictions_read_group` so a member's row is hidden from others while the match is `status='NS'` — server-side RLS closes the pre-kickoff leak (own rows always visible; no JOIN — correlated scalar subquery on the `matches` PK, `auth.uid()` initPlan-wrapped, own-row clause short-circuits the hot path). Hardens `prevent_late_prediction()` (pins `search_path`, fails closed on missing match) keeping the 15-min lock + `is_resolved` backend bypass. Re-asserts `predictions_update_own` `WITH CHECK`. Idempotent. |
| `038` | **The Addiction Loop (V3 Sprint 8):** creates `push_subscriptions` (id, `user_id` FK→profiles, `endpoint` UNIQUE, `p256dh`, `auth`, created_at) with own-row RLS (select/insert/update/delete `WHERE user_id = (select auth.uid())`) + `idx_push_subscriptions_user`; adds `matches.reminder_sent_at timestamptz` (each match reminded exactly once). Idempotent. Streaks reuse the existing `leaderboard.current_streak` / `best_streak` columns — **no schema change for streaks**. |
| `039` | **AI Banter (V3 Sprint 10):** adds `AI_BANTER` to the `group_events.event_type` CHECK; makes `group_events.user_id` nullable (the AI has no owning user); partial unique index `group_events_ai_banter_unique` on `(group_id, match_id) WHERE event_type='AI_BANTER'` — one banter per match per group, the concurrency backstop against concurrent cron/Render runs (same discipline as rule 4.15). Idempotent. |
| `040` | **Secure Prediction Cost (V4 Sprint 11):** replaces `place_prediction_bet` + `adjust_prediction_bet` (client-trusted cost) with `submit_prediction()` — computes cost server-side from the actual tier params, checks `auth.uid()` first, upserts the `predictions` row itself in the same transaction. Also validates the league-4396 no-corners rule server-side (previously frontend-only). Adds `refund_prediction()` for the delete-refund path, closing the same client-trusted-amount gap plus a server-side `is_resolved` guard against double-refunding. **Drops both replaced RPCs outright.** Idempotent. |
| `041` | **The Autonomous Economy (V4 Sprint 12):** adds `profiles.last_active_at`; `distribute_daily_allowance()` (pg_cron, every 15 min, DST-proof by design — see §28) replaces client-triggered `claim_daily_bonus`, which is **dropped**; `decay_idle_streaks()` zeroes `leaderboard.current_streak` after 7 days with no prediction in that group; `touch_last_active()` is the one client-callable function in this migration. Idempotent. |
| `042` | **In-Play Micro-Predictions "Momentum Bets" (V4 Sprint 14):** creates `micro_prediction_questions` + `micro_prediction_bets` (group-scoped like every other economy table, zero client-writable columns — every write goes through `submit_micro_prediction()`); RLS on bets mirrors migration 037's privacy shape (own row visible, others hidden until the question locks); adds `MICRO_BANTER` to `group_events.event_type` with its **own** dedup index `(group_id, question_id)` — deliberately not reusing migration 039's `(group_id, match_id)` index, which allows only one `AI_BANTER` row per match per group and would silently drop the 2nd/3rd roast on a match with multiple milestone questions. See §29. Idempotent. |
| `043` | **Momentum Bets settlement primitives (V4 Sprint 14):** adds `micro_prediction_bets.settled_at` (a completion guard deliberately separate from `is_winner` — a canceled/refunded bet has no winner/loser) and `credit_group_coins()`, a minimal atomic balance-increment RPC (service-role-only, never `GRANT`ed to `authenticated`) used because the Supabase JS client can't express `coins = coins + N` atomically without either a race-prone read-then-write or an RPC. Idempotent. |
| `044` | **The Bento Arena (V4 Sprint 15):** adds `get_stats_arena_payload(p_user_id, p_group_id) RETURNS JSONB` — one `SECURITY DEFINER` RPC assembling the entire "My Arena" stats tab (League x Bet-Type heatmap, stake/streak/risk distribution vs. the group, precomputed H2H matrix against every other member) in a single self-join, zero N+1. `auth.uid()` + group-membership guards first, mirroring the coin-RPC discipline even though nothing here spends coins. Every aggregate filters on `predictions.is_resolved = true`, not a literal `matches.status = 'FT'` — see §30 for why that distinction matters for WC2026 knockout matches. Adds supporting index `idx_predictions_group_user_resolved`. Idempotent (`CREATE OR REPLACE`, `CREATE INDEX IF NOT EXISTS`). |

### Migration idempotency

All migrations from 017 onward use `DROP … IF EXISTS` before `CREATE` so they can be re-applied safely without errors. If the Supabase CLI records a migration as applied despite a partial failure, use:

```bash
supabase migration repair --linked --status reverted <version>
supabase db push --linked
```

### CI migration repair

`ci.yml` auto-repairs Supabase migration history for migrations 001–014. This handles the case where migrations were applied manually before the CI was set up.

### Key tables (abbreviated)

**`profiles`** — `id` (FK → auth.users), `username` (unique), `avatar_url`, `group_id`, `created_at`

**`matches`** — `id`, `external_id` (ESPN event ID), `league_id`, `home_team`, `away_team`, `home_team_badge`, `away_team_badge`, `kickoff_time`, `status`, `home_score`, `away_score`, `regulation_home`, `regulation_away`, `went_to_penalties`, `penalty_home`, `penalty_away`, `halftime_home`, `halftime_away`, `corners_total`, `red_cards_home`, `red_cards_away`, `display_clock`, `season`, `round`, `updated_at`

**`predictions`** — `id`, `user_id`, `match_id`, `group_id`, `predicted_outcome` (H/D/A), `predicted_home_score`, `predicted_away_score`, `predicted_halftime_outcome` (legacy), `predicted_corners` (new), `predicted_btts`, `predicted_over_under` (over/under), `points_earned`, `is_resolved`, `created_at`

**`leaderboard`** — `id`, `user_id`, `group_id`, `total_points`, `weekly_points`, `last_week_points`, `predictions_made`, `correct_predictions`, `streak_bonus` (always 0), `updated_at`

**`group_members`** — `user_id`, `group_id`, `coins` ← **this is the authoritative coin balance**, `joined_at`

**`user_coins`** — `id`, `user_id`, `group_id`, `coins`, `last_daily_claim`, `updated_at` (supplementary — created in 020)

### RLS summary

- **profiles**: readable by all; writable by owner (`auth.uid() = id`)
- **matches**: public read; service role writes only (backend)
- **predictions**: readable by group members, but another member's row is hidden while the match is `status = 'NS'` — pre-kickoff privacy is **enforced server-side by RLS** (migration 037), not just the client 🔒. Your own rows are always visible. Writable by owner only, and the `prevent_late_prediction()` trigger rejects any insert/update within 15 min of kickoff (the backend `is_resolved=true` resolution path is exempt; clients can't set `is_resolved` — RLS `WITH CHECK` blocks it)
- **leaderboard**: readable by all group members; service role writes
- **group_members**: readable by group members; service role writes coins

---

## 15. Theme System

**Version: GoalBet v2.0 — "Cold Sea Navy / Frost"**

Dark mode is the default. Light mode toggled via `ThemeToggle` in the top bar.

**Mechanism:** `html.light` class on `<html>` managed by `themeStore.ts`.
**CSS tokens:** defined in `frontend/src/index.css` under `:root` (dark) and `html.light` (light overrides).

### Design tokens — Dark ("Cold Sea Navy")

```css
--color-bg-base: #0a1733              /* Deep Navy */
--color-bg-card: rgba(15,40,84,0.4)   /* Rich navy glass */
--color-accent-green: #BDE8F5         /* Bright Ice Blue — primary accent */
--color-accent-secondary: #4988C4    /* Steel Blue */
--color-accent-orange: #FF3366
--color-text-primary: #FFFFFF
--color-text-muted: rgba(189,232,245,0.60)
--color-border-subtle: rgba(73,136,196,0.20)
--color-border-bright: rgba(189,232,245,0.40)
--glow-green: 0 0 24px rgba(73,136,196,0.40)
```

Body background: navy `#0F2854` ellipse from top + steel blue blooms at bottom corners, fixed attachment.
`body::after`: tactical dot matrix (`24×24px` radial dots at `rgba(189,232,245,0.10)`), masked to fade at top/bottom edges, `z-index: -1`.

### Design tokens — Light ("Frost")

```css
--color-bg-base: #F2F6FA             /* Icy sky */
--color-bg-card: #FFFFFF
--color-accent-green: #1C4D8D        /* Deep Navy */
--color-accent-secondary: #4988C4
--color-text-primary: #0A1733
--color-text-muted: #4988C4
--color-border-subtle: rgba(15,40,84,0.08)
```

Body background: white ellipse bloom from top + ice-blue corner.
`body::after`: navy dot matrix (`rgba(15,40,84,0.05)`), same grid/mask as dark.

### Arena tokens — OKLCH diverging scale (V4 Sprint 15)

```css
/* :root (dark) */
--arena-cold: oklch(78% 0.11 218);   /* win_ratio ≈ 100% */
--arena-mid: oklch(55% 0.015 240);   /* win_ratio ≈ 50%, neutral gray midpoint */
--arena-hot: oklch(65% 0.22 13);     /* win_ratio ≈ 0% */
--arena-glow: oklch(78% 0.11 218 / 0.35);

/* html.light — same hue anchors (218 cold / 13 hot), darker + more saturated for contrast on white */
--arena-cold: oklch(55% 0.14 218);
--arena-mid: oklch(62% 0.015 240);
--arena-hot: oklch(56% 0.20 13);
--arena-glow: oklch(55% 0.14 218 / 0.22);
```

These are **deliberately independent** of `--color-accent-green`/`--color-accent-orange` — those two swap hue between themes (ice-blue ↔ deep navy, red-pink ↔ burnt orange; see the two token tables above), which would make "cold = good performance" mean a different color after a theme toggle. The arena scale keeps the same hue anchor in both modes and only shifts lightness/chroma for contrast. Values were computed from an actual sRGB→OKLab→OKLCH conversion of the brand ice-blue (`#BDE8F5`) and red-pink (`#FF3366`), not hand-guessed. `lib/oklch.ts`'s `interpolateDiverging()` reads these live via `getComputedStyle` and linearly interpolates between them (shortest-path hue lerp) to produce a discrete color per heatmap cell — see §30.

### Fonts

- **`font-display`** / **`font-sans`** / **`font-dm`**: **Inter** + Heebo fallback — all UI body text and numbers
- **`font-barlow`** / **`font-headline`**: Barlow Condensed — labels, stat headers
- **`font-bebas`**: Bebas Neue — score display
- **`font-mono`**: SF Mono / Roboto Mono

### Bento card classes (ProfileBentoV2)

Use semantic CSS classes — never hardcode rgba in bento components:

| Class | Dark | Light |
|-------|------|-------|
| `bento-card-accent` | volt tint | navy tint |
| `bento-card-purple` | purple tint | steel blue tint |
| `bento-card-default` | white/3 | white/90 |
| `bento-hero-card` | volt border | navy border |

### Glass surfaces (frosted, Apple-like)

Dark-mode card glass is tuned for a sharp, saturated frost — `.card-base` uses `backdrop-filter: blur(20px) saturate(150%)` + an inset top-edge highlight; `.card-elevated` uses `blur(28px) saturate(160%)`; `.glass` (nav surfaces) uses `blur(20px) saturate(140%)`. The Tailwind `backdrop-blur-glass` token is `16px` (used by standalone glass: Toast, TacticalPitch, StandingsTable, LeagueLeaders, `MatchCardSkeleton`). **Light mode overrides these with `backdrop-filter: none !important` + solid white** — never remove those `!important` overrides. Don't hardcode blur on cards; use the semantic classes so both themes stay correct.

### Hover effects

- **Match cards** (`MatchCard`): diagonal shimmer sweep on hover entry. No tilt — preserves prediction form UX.
- **Profile bento** (`TiltCardV2`): 3° tilt on a slightly overdamped spring (`stiffness 300, damping 32, mass 0.5, restDelta 0.001`) — responsive tracking, buttery settle, no overshoot. No glare overlay.
- **Buttons** (`MagneticButtonV2`): magnetic pull within 80px radius. Variants: `volt`, `ghost`, `purple`.
- **Cold-start loading** (`MatchCardSkeleton` / `MatchCardSkeletonList`): breathing pulse + diagonal shimmer sweep. `MatchFeed` renders these while `loading` on the all/live tabs AND when the list is empty but `isSyncing` is true (Render cold start), instead of the empty state.

### Light mode contrast overrides

`html.light` in `index.css` remaps `text-white/*` and `border-white/*` opacity variants to navy equivalents. The opacity floors were raised in Sprint 14/15 to improve contrast — do not revert them:

| Tailwind class | Light mode minimum opacity |
|---|---|
| `border-white/8` → `border-white/20` | 0.15 |
| `border-white/15` → `border-white/25` | 0.20 |
| `text-white/25` | 0.45 (was 0.30) |
| `text-white/30` | 0.50 (was 0.38) |

If a new `text-white/XX` or `border-white/XX` class appears invisible in light mode, add an override to the `html.light` block in `index.css`.

### League logos — ESPN dark/light variants

ESPN CDN provides two logo sets:
- Light logos: `https://a.espncdn.com/i/leaguelogos/soccer/500/{id}.png`
- Dark logos: `https://a.espncdn.com/i/leaguelogos/soccer/500-dark/{id}.png`

`MatchCard.tsx` renders **both** `<img>` tags and toggles visibility via CSS:

```css
/* index.css — dark mode (default): show dark variant */
.league-logo-light { display: none; }
.league-logo-dark  { display: inline-block; }

/* Light mode: swap */
html.light .league-logo-light { display: inline-block; }
html.light .league-logo-dark  { display: none; }
```

ESPN logo IDs are in `constants.ts → FOOTBALL_LEAGUES[].espnLogoId`. Set to `null` for leagues with no ESPN logo (World Cup Qualifiers, Euro Championship). Verified working IDs: Premier League=23, La Liga=15, Bundesliga=10, Serie A=12, Ligue 1=9, Champions League=2, Europa League=2310, Conference League=20296, FA Cup=40, League Cup=41, Copa del Rey=80, Nations League=2395, Friendlies=53.

**Do not use Tailwind `dark:` prefix** — this project uses `html.light` class, not Tailwind's dark mode. Use the CSS class toggle pattern above.

### Live match animations (index.css)

| CSS class | Effect | Where used |
|-----------|--------|------------|
| `.animate-live-breathing` | Green glow pulse on card border (opacity 0.20→0.40) + border-color pulse (0.25→0.45) | `MatchCard` — applied to `GlassCard` when match is live |
| `.goal-flash` | Green overlay flash on goal scored | `MatchCard` — applied via `cardRef` when score changes |
| `.pitch-grass` | Subtle dark green gradient background | `TacticalPitch` — pitch surface |

Score flip animation uses Framer Motion `AnimatePresence mode="popLayout"` with spring scale (1.3→1→0.8).

### World Cup CSS classes (index.css)

| CSS class | Effect | Where used |
|-----------|--------|------------|
| `.wc-trophy` | Gold drop-shadow (24px + 12px) | `Trophy2026` component — wraps the SVG `<img>` |
| `.wc-trophy-bob` | Gentle bobbing animation (4.6s, translateY + rotate) | Desktop trophy watermark |
| `.wc-trophy-halo` | Radial gold glow positioned behind trophy | `FinalApex` trophy centerpiece |
| `.wc-halo-breathe` | Breathing scale+opacity animation (5.4s) | Trophy halos (desktop + mobile) |
| `.wc-trophy-watermark` | Absolute positioned, 320×320, hidden <1023px | Hero section — desktop-only watermark |
| `.wc-mobile-trophy-halo` | Radial gold glow with blur, uses halo-breathe animation | Hero section — mobile inline trophy |
| `.wc-mobile-round-header` | Flex strip with gold gradient bg, data-round attribute for QF/SF glow | Mobile knockout bracket round headers |
| `.wc-hero-bg` | Theme-locked dark hero background | Hero section |
| `.wc-bracket-bg` | Theme-locked dark bracket background | Desktop bracket wrapper |
| `.wc-final-bg` | Theme-locked dark final card background | FinalApex card |
| `.wc-phase-strip` | Theme-locked dark phase strip | KnockoutsIntro |
| `.wc-sunburst` | Rotating conic-gradient sunburst (30s linear infinite) | FinalApex background |
| `.wc-final-particle` | Floating gold particle with scale+opacity keyframes | FinalApex ambient particles |
| `.wc-aurora` | Absolute container for tri-host drifting blobs, mix-blend: screen | WC root wrapper |
| `.wc-aurora-blob.mexico\|.usa\|.canada` | Neon green / cyan / crimson blurred blobs with drift keyframes | Inside `.wc-aurora` |
| `.wc-grain` | feTurbulence SVG noise overlay, mix-blend: overlay | WC root wrapper (above aurora) |
| `.wc-brutalist-hollow` | Massive Bebas hollow-stroke text (color: transparent) | Hero backdrop "2026" base layer |
| `.wc-brutalist-fill` | Aurora-gradient text-clip (cyan→green→crimson) | Hero backdrop "2026" scroll-reveal overlay |

### Rules

- **Never hardcode dark hex colors** in modals, tooltips, or cards — they break in light mode
- **Never use Tailwind `dark:` prefix** — this project uses `html.light` class toggle, not Tailwind dark mode
- Use `card-elevated` CSS class instead of raw hex backgrounds
- Use CSS vars (`var(--color-tooltip-bg)`) for dynamic surfaces
- For new bento/stat cards: add a `bento-*` CSS class pair, not inline rgba
- All `text-white/*` opacity variants have `html.light` overrides mapping to navy — if adding a new opacity variant, add it to both sets
- `text-white/85` and below all have overrides; if a new variant is invisible in light mode, add `html.light .text-white\/XX` to `index.css`

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
- **`halfTimeResult` key re-added** (en: `"Half Time"`, he: `"מחצית"`). Use `t('halfTimeResult')` for the backward-compat HT tier label
- **Every visible UI string must go through `t()`** — including `aria-label`, `title`, `placeholder`, and share text. Hardcoded English strings silently break Hebrew mode.

### Parameterized translations

Some keys contain a `{0}` placeholder. These are not template literals — use `.replace()`:

```typescript
// ✅ Correct
t('secsAgo').replace('{0}', String(elapsed))   // → "לפני 12 שניות"
t('minsAgo').replace('{0}', String(minutes))   // → "לפני 3 דקות"

// ❌ Wrong — t() does not interpolate automatically
t(`secsAgo`, { count: elapsed })
```

Always add the key to **both** `en` and `he` blocks in `i18n.ts`. `TranslationKey` is derived from `en` — a missing `en` key causes a TypeScript error; a missing `he` key silently falls back to the `en` value.

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
| `uiStore.ts` | `activeModal`, `toasts[]`, `isSyncing` | Memory only | `openModal(id)`, `addToast(msg, type)`, `setSyncing(bool)` |

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

### Sync heartbeat: `pg_cron` (primary) + `sync-cron.yml` (fallback)

Since V3 Sprint 1 the automated sync heartbeat is **two-tier**:

**Primary — Supabase `pg_cron`, every 5 min** (migration 036, `public.trigger_sync_heartbeat`).
Reads `SYNC_API_KEY` from Vault and `net.http_post`s to the **authenticated internal** routes:
```
POST /api/sync/internal/scores    → resolve predictions + award coins (fired first)
POST /api/sync/internal/matches   → pull ESPN fixtures
```
`net.http_post` is async/fire-and-forget, so the two are independent — a slow/failed fixture sync can never block or delay score resolution (coins). Runs inside Supabase, no external dependency.

**Fallback — `sync-cron.yml`, every 30 min.** Only guards against a `pg_net`/Supabase outage freezing the Render free-tier dyno. Same scores-before-fixtures ordering, `continue-on-error: true` on the fixture step. Now targets the **internal** routes with the `X-Sync-Key: ${{ secrets.SYNC_API_KEY }}` header.

```
1. Check BACKEND_URL secret is set
2. GET  /api/health                  → wake Render, retry 3× with 10s delays
3. POST /api/sync/internal/scores    → resolve + award coins (X-Sync-Key)  ← ALWAYS runs
4. POST /api/sync/internal/matches   → pull ESPN fixtures (X-Sync-Key, continue-on-error: true)
```

**Public vs internal routes (the split model — never collapse them):**
- **Public** `POST /api/sync/{matches,scores}` — called from the **browser** (`AppShell` cold-start, `useMatchSync` "Sync Now", `AdminDashboardPage` force-sync). No auth: a browser can't hold a real secret. Bounded by `express-rate-limit` (see `rateLimiter.ts`).
- **Internal** `POST /api/sync/internal/{matches,scores}` — called only by machine schedulers (`pg_cron`, GitHub Actions fallback) with `X-Sync-Key`. `syncAuth.ts` returns **403** (not 401 — 401 trips the frontend's session-expiry re-auth flow), fails closed if `SYNC_API_KEY` is unset, uses a constant-time compare.

Both route pairs reuse the **same handlers** — zero behavior difference in sync logic, only the gate differs.

> **Why this is not the old `SYNC_SECRET` mistake.** The earlier `SYNC_SECRET` returned **401** and was applied to the routes the browser calls, which broke GitHub Actions and the frontend alike — so it was removed and the routes made public. The V3 model keeps the browser-facing routes public (rate-limited) and puts the key **only** on the separate internal routes, returning **403**. Never add auth back to the public `/api/sync/*` routes — it will 403 the live app's cold-start sync, manual sync, and admin sync (all call them header-less).

### `ci.yml` — every push / PR to main

1. TypeScript type-check (`tsc --noEmit`)
2. Vite build (`npm run build`)
3. Supabase migration history repair (001–014)

### GitHub Secrets

| Secret | Used by | Purpose |
|--------|---------|---------|
| `BACKEND_URL` | `sync-cron.yml` | Production Render URL (`https://goalbet.onrender.com`) |
| `SYNC_API_KEY` | `sync-cron.yml` | X-Sync-Key for the internal sync routes. **Must equal** the Render env var of the same name **and** the Supabase Vault secret `SYNC_API_KEY` |
| `SUPABASE_ACCESS_TOKEN` | `ci.yml` | Supabase CLI auth for migration repair |
| `SUPABASE_PROJECT_REF` | `ci.yml` | Supabase project ID |

`SYNC_SECRET` must **not exist** — the legacy 401-returning secret. The V3 `SYNC_API_KEY` is a different mechanism (403, internal routes only) and must never be applied to the public routes.

---

## 20. Admin Console

The admin console is accessible at `/admin` **only** for `roychen651@gmail.com`. It is invisible to all other users — the route silently redirects to `/`.

### Security model: double protection

| Layer | Mechanism |
|-------|-----------|
| Client-side | `AdminProtectedRoute` checks `user.email === 'roychen651@gmail.com'` before rendering |
| Server-side (RPCs) | Every admin SQL function starts with `IF NOT is_super_admin() THEN RAISE EXCEPTION` |
| Server-side (backend) | `resolveAdminEmail()` verifies JWT via service role; returns 403 if not admin |

**Never remove either layer.** Client-side is UX; server-side is security.

### `is_super_admin()` function

```sql
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT (auth.jwt() ->> 'email') = 'roychen651@gmail.com';
$$;
```

All admin RPCs call this as their first action. They are `SECURITY DEFINER` — they run with the Supabase service role's privileges, so the email check is the only access gate.

### Admin RPCs (migration 023)

| Function | Purpose |
|----------|---------|
| `admin_get_stats()` | Platform KPIs: total users, groups, matches, predictions, coins circulating |
| `admin_get_users()` | All users with email, username, group count, total coins |
| `admin_get_groups()` | All groups with admin email, member count, invite code |
| `admin_get_user_coins(user_id)` | Per-group coin balance for a specific user |
| `admin_adjust_coins(user_id, group_id, delta)` | Add or subtract coins (floor at 0), logs to coin_transactions |
| `admin_update_username(user_id, username)` | Rename any user |
| `admin_rename_group(group_id, name)` | Rename any group |
| `admin_delete_group(group_id)` | Cascade-delete group and all members/predictions |
| `admin_delete_user_data(user_id)` | Wipe all public-schema rows for user (call before backend delete) |

### Admin backend routes

| Method | Path | Purpose |
|--------|------|---------|
| `DELETE` | `/api/admin/users/:userId` | Hard-delete user from `auth.users` (service role) |
| `POST` | `/api/admin/reset-password` | Send password reset email via Supabase admin API |

Both require a valid `Authorization: Bearer <jwt>` from `roychen651@gmail.com`. The `resolveAdminEmail()` middleware calls `supabaseAdmin.auth.getUser(token)` to verify identity server-side.

### User deletion flow (two-step)

```
1. Frontend: supabase.rpc('admin_delete_user_data', { p_user_id })
   → wipes all public-schema rows (predictions, group_members, leaderboard, etc.)

2. Frontend: fetch('DELETE /api/admin/users/:userId', { Authorization: Bearer jwt })
   → backend calls supabaseAdmin.auth.admin.deleteUser(userId)
   → removes the auth.users row permanently
```

Step 1 **must complete before** step 2. Reversing the order leaves orphaned data.

### Admin UI components

**`AdminDashboardPage`** (`pages/admin/AdminDashboardPage.tsx`)
- Calls `admin_get_stats()` on mount
- Bento grid of 5 animated KPI cards (staggered Framer Motion fade-in)
- System health section: Force Score Sync button, Sync Fixtures button, Health Check link

**`UserManagement`** (`components/admin/UserManagement.tsx`)
- Search filter on email / username
- Staggered row animations (`delay: i * 0.025`)
- Edit name → `admin_update_username` RPC
- Manage coins → `admin_get_user_coins` → per-group `admin_adjust_coins`
- Reset password → `POST /api/admin/reset-password`
- Delete → `admin_delete_user_data` RPC then `DELETE /api/admin/users/:id`

**`GroupManagement`** (`components/admin/GroupManagement.tsx`)
- Search filter on name / admin email / invite code
- Rename → `admin_rename_group` RPC
- View members → `group_members` direct query with coins per member
- Delete → `admin_delete_group` RPC wrapped in `DangerModal`

**`DangerModal`** (`components/admin/DangerModal.tsx`)
- Spring animation (`y: 40 → 0`)
- Requires typing `"DELETE"` exactly to enable the confirm button
- Used for both group deletion and user deletion

**`AdminLayout`** (`components/admin/AdminLayout.tsx`)
- Desktop: fixed sidebar with logo + "ADMIN" badge, nav links, "Back to App" button
- Mobile: fixed top bar with nav links
- Renders `<Outlet />` for nested admin routes

---

## 21. Common Pitfalls

### Sync

- **Never add auto-sync to page components.** `AppShell` owns all automatic sync. Two auto-triggers create race conditions.
- **Never remove `AbortController` timeouts** from sync fetches. Without them, the UI hangs indefinitely on Render cold starts (45–60s).
- **Score sync timeout must be ≥ 75s.** Render cold start takes 45–60s. A shorter timeout means score sync always fails on cold start, delaying coin payouts until the next cron run.
- **Score resolution must run before fixture sync in `sync-cron.yml`.** A failed ESPN call must never block coin payouts. `continue-on-error: true` on the fixture step is intentional — never remove it.
- **Adding a league to `FOOTBALL_LEAGUES` without adding it to `LEAGUE_ESPN_MAP`** silently produces no data — no error, no log. Always add to both.
- **Wrong ESPN slug returns 400.** Verify: `curl "https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard"`

### Match display

- **PST / CANC must never appear in Results or Live tabs.** Only `FT` is shown in completed tabs.
- **Stalled NS matches show "Delayed" (orange), not "Live" (green).** Sentinel is `'DELAYED'`, never `'1H'`.
- **MatchTimeline returns null when ESPN has no events.** Do not add an empty state — the section is hidden.
- **League logos use dual `<img>` tags** (dark + light variant), toggled via `.league-logo-dark` / `.league-logo-light` CSS classes. Never use a single `<img>` with a CSS `filter` hack — it doesn't match ESPN's official dark variants.
- **ESPN logo IDs must be verified.** Wrong IDs return 404 silently (broken image). Check `constants.ts → FOOTBALL_LEAGUES[].espnLogoId`. Set `espnLogoId: null` for leagues without ESPN logos.

### Predictions & scoring

- **Old predictions have `predicted_halftime_outcome`; new ones have `predicted_corners`.** Both coexist. `calcBreakdown()` handles both.
- **Scoring always uses `regulation_home` / `regulation_away`** for ET/penalty matches.
- **Corners are hidden for league 4396** (International Friendlies). Do not remove `LEAGUES_WITHOUT_CORNERS`.
- **`halfTimeResult` key re-added** — use `t('halfTimeResult')` for the old HT tier label.

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
- **Bottom-sheet modals must include `onPointerDown={e => e.stopPropagation()}` on scroll containers.** Without this, Framer Motion drag fires instead of scroll on touch devices.
- **Scrollable popovers / dropdowns / horizontal rails must carry `data-lenis-prevent` + `overscroll-contain`.** The app initializes Lenis with `smoothWheel: true` in `App.tsx`, which intercepts wheel events at the window level — without `data-lenis-prevent` on the inner scroller, the mouse wheel does nothing while the cursor is over the popover (user has to drag the scrollbar). Applies to `LeagueDropdown` list, `PhaseTimeline` rail, knockout bracket scroller in `WorldCupBracket`, and any future scrollable overlay.
- **All `<img>` tags must have numeric `width` and `height` attributes.** Omitting them causes CLS on slow connections — even when Tailwind `w-` / `h-` classes are present.
- **`ErrorBoundary` wraps `<Outlet />` in `AppShell`.** Do not remove it. It catches render errors in any page and shows a premium bilingual fallback instead of a white screen.
- **`MatchCard.tsx` is the single active card implementation.** It exports two symbols: `MatchCardCore` (private internal component) and `MatchCard` (public shimmer wrapper). `MatchCardV2.tsx` was deleted in Sprint 17; `USE_V2_CARDS` no longer exists. All card work goes into `MatchCard.tsx`.
- **The share invite string in `SettingsPage.tsx` must be localized.** It is the primary viral surface — a Hebrew user must send a Hebrew message.
- **TacticalPitch player nodes must all be full opacity.** Never use `opacity-30` or similar on subbed-out players — it makes them invisible on the glass pitch. Use the `▼` marker instead.
- **Never use Tailwind `dark:` prefix in this project.** Theme toggle uses `html.light` class, not Tailwind's dark-mode. Use CSS class pairs (e.g., `.league-logo-dark` / `.league-logo-light`) toggled via `html.light` selectors in `index.css`.
- **World Cup bracket has two card types — never merge them.** `BracketTreeCard` is ultra-compact (two slot labels + separator, no header/date/city) for the desktop 9-column grid where columns are ~4.5rem wide. `BracketMatchCard` is full-detail (match number, date, city, vs divider) for the mobile stacked view. Putting full-detail cards in the tree grid causes text overlap. The desktop bracket grid (`BRACKET_SYM_CSS`) uses `min-width: 56rem` and `column-gap: 0.5rem` — keep connector `width` values in sync with the gap.
- **World Cup trophy SVG (`assets/world-cup-trophy.svg`) has 4 layers.** Gold body gradient (fill-rule="nonzero") → specular highlight overlay → green malachite bands (clipped to silhouette) → thin outline stroke. Do not add solid-fill layers that cover the gold — this was the root cause of the "dark blob" bug. The trophy renders via `<img>` tag with `width={181} height={435}`.
- **World Cup CSS classes are theme-locked to dark.** `.wc-hero-bg`, `.wc-bracket-bg`, `.wc-final-bg`, `.wc-phase-strip` all force dark backgrounds in both light and dark modes. Gold colors (`#FFC94A`, `wc-gold`, `wc-gold-muted`) must be used inside these containers, never the site-wide accent vars. `html.light` overrides for `text-white/*` inside these containers are in `index.css`.
- **World Cup parallax uses `useScroll`/`useTransform` (Framer Motion).** The hero maps `scrollY` to `y` transforms on confetti, halo, and trophy layers at different speeds (80px, 120px). This keeps transforms on the compositor thread — never replace with `onScroll` + `setState` which causes main-thread layout thrashing.
- **World Cup floating glass nav is `sticky top-3 z-[60]`.** The TabBar is wrapped in a sticky div, not `position: fixed`. The pill uses `backdrop-blur-xl` + `rgba(10,23,51,0.75)` dark glass. Do not detach it from flow or change to fixed positioning — it breaks scroll behavior.
- **World Cup mobile knockouts use Framer Motion accordion.** One round expanded at a time via `useState<BracketRound>`. Uses `<AnimatePresence>` with `height: "auto"` / `height: 0` + `overflow: hidden`. Do not convert to CSS transitions — Framer handles the auto-height measurement.
- **World Cup predict buttons fire a toast teaser, not a real prediction.** Since WC 2026 matches don't exist in the DB yet, the "Predict" button calls `addToast(t('wcPredictSoon'), 'info')`. When real match data arrives, replace with `openPredictionModal(matchId)`. The `t` prop on `BracketMatchCard` is optional so desktop `BracketTreeCard` (no predict button) isn't affected.
- **World Cup venues have two layouts.** Mobile: horizontal scroll-snap carousel (`snap-x snap-mandatory` + `data-lenis-prevent`). Desktop: CSS grid masonry where marquee venues (final, opening) span 2 columns. These are independent implementations behind `md:hidden` / `hidden md:grid` — changes to one don't affect the other.
- **Tri-Host Aurora lives on the WC root wrapper, not inside Hero.** `.wc-aurora` is an absolutely positioned sibling of the Hero/tabs content inside the WC atmosphere wrapper. It uses `mix-blend-mode: screen` to TINT the navy background, not replace it. Three blobs (`.mexico`, `.usa`, `.canada`) drift with CSS keyframes (22s/27s/32s — desynced on purpose). Do not wrap these in Framer Motion — the CSS is compositor-only and stays 60fps.
- **Brutalist "2026" is two stacked spans.** The base `.wc-brutalist-hollow` stays always visible (hollow stroke). The `.wc-brutalist-fill` overlay uses `-webkit-background-clip: text` with a tri-host gradient and its opacity is driven by `useTransform(scrollY, [0, 260, 460], [0, 0.6, 1])`. Do not collapse into one span — text-clip and stroke can't coexist cleanly on a single element.
- **World Cup card 3D entrances need `transformPerspective: 1000` on the motion element itself.** `GroupCard` and `StadiumCard` animate `rotateX: 15 → 0` + `scale: 0.95 → 1`; without `transformPerspective` on the same element (or `perspective` on the parent), `rotateX` collapses to a 2D scale and the tilt is invisible. Also set `transformStyle: 'preserve-3d'`.
- **Trophy SVG has 5 ordered layers — do not reorder.** (1) Gold body with `filter="url(#wc-3d)"` for drop shadow; (2) left-side specular rim-light gradient; (3) vertical top-down inner-shine gradient; (4) engraved detail group clipped to the silhouette (globe meridians, continents, figure curves, malachite rings separated by a gold band); (5) dark outline stroke. The engraved detail layer uses strokes and low-opacity fills so the gold underneath is never occluded. The base is now **2 malachite rings separated by a gold band** (not 4 bands), matching the authentic Jules Gazzaniga design.

### Coins

- **Never show negative coin amounts.** Clamp at 0.
- **Daily bonus uses Israel timezone** (`Asia/Jerusalem`). `CURRENT_DATE` is wrong.
- **Friend prediction privacy:** predictions are hidden (🔒) when `status = 'NS'` AND `kickoff > now`. Never show pre-kickoff predictions to other group members.
- **H2H modal** opens when clicking ANOTHER user's leaderboard row. Clicking your own row opens `UserMatchHistoryModal`. This is intentional.
- **`increment_coins` is idempotent — do not work around it.** If a re-call appears to have done nothing, it's because the unique index already accepted that exact `(user, group, match, description)` combination. Find out which earlier call inserted it; never bypass the constraint by varying the description (e.g. appending a timestamp). That defeats the dedup and re-introduces the race the user was burned by.
- **Always pass `p_created_at = matchEndAt`** when calling `increment_coins` from a score-resolution path. The user has explicitly told us "the times are sacred" — the transaction must reflect when the match ended, not when the backend processed it. Same rule for `notifications.created_at` and `group_events.created_at` rows inserted in the same resolution block.
- **`group_members.coins` must always equal `SUM(coin_transactions.amount)`** for that user/group. If they ever diverge, the cached balance is wrong and a one-off rebuild migration (see 031) is needed. The reconciliation can be verified with: `SELECT user_id, group_id, coins, (SELECT SUM(amount) FROM coin_transactions ct WHERE ct.user_id = gm.user_id AND ct.group_id = gm.group_id) AS ledger_sum FROM group_members gm`.

### Admin

- **Never skip `is_super_admin()` in admin RPCs.** All `SECURITY DEFINER` functions run with elevated privileges — the email check is the only gate.
- **Always call `admin_delete_user_data()` before `DELETE /api/admin/users/:id`.** Reversing the order leaves orphaned rows in public schema with no foreign-key owner.
- **Admin routes on the backend use service-role JWT verification**, not anon key. Never swap `supabaseAdmin` for the regular `supabase` client in `backend/src/routes/admin.ts`.
- **`DangerModal` requires typing `"DELETE"` exactly.** Do not pre-fill or bypass the input check for "convenience".
- **Migrations that already exist in the remote history** can be force-reapplied with `supabase migration repair --linked --status reverted <version>` then `supabase db push --linked`.

### Data Engine 2.0 — shelved, not shipped (V4 Sprint 13)

- **`supabase/functions/` is currently empty.** A plan exists (moving `checkAndUpdateScores()`'s score-critical path to a Supabase Edge Function, off Render entirely, with a `live-scores` Realtime Broadcast channel as a third client reconciliation tier) but execution was paused after Commit 1 (deleting the dead pre-ESPN `sync-matches` function) specifically because this environment has no Deno runtime and no reachable Docker daemon — meaning Edge Function code cannot be compiled or tested before shipping, unlike every other commit in this codebase, which is gated on `tsc --noEmit` + `npm run build` actually passing. **Do not assume an Edge Function exists or that score resolution has moved off Render** until this sprint is explicitly resumed and completed.
- If resuming: the plan calls for a canary/coexistence period (Edge Function wired to `pg_cron` in parallel with the existing Render heartbeat, not a hard cutover) specifically because this is the score/coin-payout critical path — verify a handful of resolved matches against Render's own output before retiring the Render path.

---

## 22. AI Scout (Sprint 26)

Generative pre-match + post-match insights powered by **Groq (Llama 3.1 8B Instant)**. $0 budget, zero client-side API calls, graceful degradation when Groq fails.

### Architecture — "Compute Once, Serve Infinite"

1. Backend generates text ONCE per match per language and writes it to Supabase
2. Frontend reads plain text — never calls Groq directly
3. If `GROQ_API_KEY` is missing or a call fails/times out, the columns stay NULL and the frontend **completely hides** the AI UI. The app MUST NEVER BREAK.

### Schema

```sql
-- migrations/025 (EN) and 034 (HE)
matches.ai_pre_match_insight       text null
matches.ai_pre_match_insight_he    text null
matches.ai_post_match_summary      text null
matches.ai_post_match_summary_he   text null
```

All four columns are independently nullable — partial coverage is the norm (e.g. EN written, HE pending next cycle).

### Backend — `backend/src/services/aiScout.ts`

| Function | Called from | Purpose |
|----------|-------------|---------|
| `getApiKey()` | all public fns | Returns `null` if `GROQ_API_KEY` is unset → everything becomes silent no-op |
| `callGroq(messages, maxTokens)` | internal | axios POST to Groq, 12s timeout, strips wrapping quotes, clamps to 500 chars, swallows all errors |
| `generatePreMatchInsight(ctx, lang)` | batch | One punchy sentence (≤22 words). `lang` is `'en'` or `'he'` — each has its own system + user prompt |
| `generatePostMatchSummary(ctx, lang)` | batch + ensure | Two witty sentences (≤40 words). Same lang switch |
| `writeInsight(matchId, column, text)` | internal | UPDATE with `.is(column, null)` guard so concurrent workers never overwrite |
| `runPreMatchBatch(limit=2)` | `matchSync.ts` | Processes NS matches in the next 24h missing EN OR HE; fills whichever is null |
| `runPostMatchBatch(limit=3)` | `matchSync.ts` | Backfills FT matches from the last 7 days missing EN OR HE |
| `ensurePostMatchSummary(matchId)` | `scoreUpdater.ts` | On FT transition, generates whichever of EN/HE is still null |

### Why two batch functions and not one per-match trigger

The per-FT-transition `ensurePostMatchSummary` only fires when a score resolver flips a match NS→FT. Every match that was already FT when Sprint 26 shipped — or that had EN but no HE when Sprint 26-HE shipped — never triggers. `runPostMatchBatch` is the sweeper: it runs every sync cycle (every 5 min via `sync-cron.yml`) and chips away at the backlog 3 at a time.

### Frontend rendering

Shared component: `components/ui/AIScoutCard.tsx` — rotating conic-gradient border (Framer Motion, 7s linear), dark navy glass inner card, Sparkles icon with wobble, `tone: 'pre' | 'post'` switches gradient colors.

Three render sites — **all are lang-aware** via `useLangStore`:

```tsx
const { lang } = useLangStore();
const text = (lang === 'he' && match.ai_X_he) || match.ai_X;
```

Graceful fallback: if HE is still null but EN exists, Hebrew users see EN for now (until the next batch cycle fills HE).

| Site | File | Condition |
|------|------|-----------|
| Inline in expanded MatchCard | `MatchCard.tsx` | `match.status === 'NS'` — surfaced above Tactical Intel so it's visible without opening the prediction modal |
| Top of prediction modal | `PredictionForm.tsx` | non-locked NS form — second place users can see it while placing a bet |
| Top of MatchStats | `MatchStats.tsx` | `match.status === 'FT'` — above the ESPN stats collapse button |

The `AIScoutCard` component itself returns `null` when `text` is falsy, so forgetting the lang-aware fallback in a new call site fails gracefully (just shows nothing) instead of breaking.

### mergeMatches must include the AI columns

`useMatches.ts → mergeMatches` preserves object identity for unchanged matches so React's memo bails out of subtree re-renders. All four AI columns MUST be in the identity comparison — without them, a background sync that only wrote an AI column silently drops the new text (stale reference, no re-render). This bit us once; fixed in commit `c905bf4`.

```typescript
p.ai_pre_match_insight     === m.ai_pre_match_insight     &&
p.ai_pre_match_insight_he  === m.ai_pre_match_insight_he  &&
p.ai_post_match_summary    === m.ai_post_match_summary    &&
p.ai_post_match_summary_he === m.ai_post_match_summary_he
```

### Rate limiting

Groq free tier returns **429** after bursts of ~30 requests. The backfill scripts (`backend/src/scripts/backfillPostMatch.ts`, `backfillHebrew.ts`) will hit this — by design they just log and continue; the sync cron fills the rest at 3 matches/cycle over time. Do not add retry/backoff — the silent-fail pattern is correct; the cron is the retry loop.

### i18n keys

```typescript
aiScoutLabel          // "AI Scout" / "סייר AI"
aiScoutPreMatchTitle  // "Scout Insight" / "תובנת הסייר"
aiScoutPostMatchTitle // "Match Recap" / "סיכום המשחק"
```

### Rules

- **Never call Groq from the frontend.** Only the backend has the API key; frontend is pure consumer.
- **Never throw from an AI function.** Every public function in `aiScout.ts` must swallow errors and log at `warn` level. A Groq outage must not break sync, score resolution, or any UI.
- **Never use `.update()` without `.is(column, null)`** when persisting an insight. Concurrent workers (Render scheduler + GitHub Actions cron + backfill script) all run the same queries; the null-guard is the only thing preventing overwrites.
- **Always generate both EN and HE** for a match when producing a new insight. Skipping HE "because the user is in EN mode" defeats the architecture — insights are cached at the DB level per language, not per user session.
- **New render site?** Use the lang-aware pattern shown above. Never hardcode `match.ai_pre_match_insight` — Hebrew users will see English text.
- **Rotate the Groq API key if it ever appears in chat, git, or logs.** Current key lives only in `backend/.env` on Render and the local dev `.env`; both are gitignored.

---

## 23. AI Live Read + Chronicles (Sprint 27)

Two additions on top of the Sprint 26 "compute-once, serve-infinite" foundation. Both follow the same rules as AI Scout — Groq-only backend calls, silent on failure, EN + HE generated in the same batch.

### 23.1 Half-Time Tactical Read (`ai_ht_insight` / `ai_ht_insight_he`)

A **live** one-sentence tactical read that appears on the MatchCard during the HT break. Distinct aesthetic from `AIScoutCard` on purpose: this is a broadcast lower-third overlay, not a pre-match insight box.

**Backend (`aiScout.ts` HT block):**

| Function | Purpose |
|----------|---------|
| `summarizeFirstHalfEvents(events)` | Compresses ESPN `keyEvents` array into a plain string feed for the prompt |
| `generateHTInsight(ctx, lang)` | One punchy sentence predicting the second half (≤22 words). `lang` toggles EN / HE prompts |
| `runHTInsightBatch(limit=2)` | SELECT matches `WHERE status='HT' AND (ai_ht_insight IS NULL OR ai_ht_insight_he IS NULL)`, fetch ESPN keyEvents, generate whichever language is null. Called from `matchSync.syncAllActiveLeagues()` between `runPreMatchBatch` and `runPostMatchBatch` |

Coverage is **only while a match is actually at HT**. Once it flips to `2H` the row is never re-processed — that's intentional. HT is a narrow window (≈15 min) so the batch must run on every sync cycle (every 5 min via `sync-cron.yml`) to hit it.

**Frontend (`components/ui/HTAnalystCard.tsx`):**

- Pure black glass (`linear-gradient(180deg, rgba(0,0,0,0.72), rgba(4,8,16,0.70))`) + `backdrop-blur-2xl` — sits over the team palette like a broadcast graphic, not blending in
- Rotating conic-gradient border: red `#FF4D66` → amber `#FFC94A` → cyan `#BDE8F5` → red. 4.2s linear infinite — faster than `AIScoutCard` (7s) to feel urgent
- Pulsing red dot + `LIVE AI READ` badge (`t('aiLiveReadLabel')`) in Bebas Neue, letter-spacing `0.28em`
- Typewriter reveal: split text on whitespace, each word is a `motion.span` with `{opacity, y, filter: blur}` variants, stagger 0.035s, delayChildren 0.15s
- Subtle scanline overlay via `repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 1px, transparent 1px 3px)` at 0.18 opacity + `mix-blend-overlay`
- Returns `null` when `text` is falsy — forgetting the lang-aware fallback in a new call site fails gracefully

Rendered in `MatchCard.tsx` inside the expanded body when `match.status === 'HT'`, lang-aware: `(lang === 'he' && match.ai_ht_insight_he) || match.ai_ht_insight`.

### 23.2 Hall of Fame Chronicles (`user_chronicles` table)

A personal trophy shelf on the ProfilePage that celebrates the user's **perfect +10** predictions on high-profile matches with a mythical Groq-generated saga.

**Schema (migration 035):**

```sql
CREATE TABLE user_chronicles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES groups(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,        -- "The {Team} Prophecy" or similar
  epic_text       TEXT NOT NULL,        -- EN mythical 3-sentence saga
  epic_text_he    TEXT,                 -- HE saga (may be null if Groq failed one lang)
  predicted_home  INT,
  predicted_away  INT,
  final_home      INT,
  final_away      INT,
  points_earned   INT NOT NULL,         -- always 10+ by gating
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX user_chronicles_user_match_unique ON user_chronicles (user_id, match_id);
-- RLS: readable by any authenticated user; service role writes only
```

The partial unique index is the **concurrency backstop** — same pattern as coin/notification dedup (rule 4.15). Concurrent score resolvers all try to insert, only the first succeeds.

**Backend (`aiScout.ts` Chronicler block):**

| Function | Purpose |
|----------|---------|
| `HIGH_PROFILE_LEAGUE_IDS` | `Set<number>` gating which leagues trigger a chronicle: PL, La Liga, Bundesliga, Serie A, Ligue 1, UCL, UEL, UECL, Nations League, WCQ. Excluded: friendlies, FA Cup, League Cup, Copa del Rey, World Cup (no fixtures yet) |
| `generateChronicleText(seed, lang)` | Three mythical sentences in broadcaster-poet tone. `lang` switches EN / HE prompts |
| `buildChronicleTitle(seed)` | Short EN title like "The Arsenal Prophecy" |
| `ensureChronicle(seed)` | EXPORTED. Idempotent entry point: bails if `pointsEarned < 10`, bails if league not in `HIGH_PROFILE_LEAGUE_IDS`, checks for existing row, fetches username from `profiles`, generates EN + HE in parallel via `Promise.all`, skips INSERT if EN missing, relies on unique index as final backstop |

`ensureChronicle` is called from `scoreUpdater.resolveMatchPredictions` **after the atomic claim succeeds** on FT / ET resolution and in the catch-up loop. It's `void`-prefixed — fire and forget, never awaited, never blocks coin resolution.

**Frontend (`components/profile/HallOfFameChronicles.tsx`):**

- Returns `null` when `chronicles.length === 0` — "don't advertise an empty hall of fame"
- Horizontal scroll-snap carousel, `data-lenis-prevent` so trackpad/wheel scrolls the rail (not the page — see pitfall "Scrollable popovers")
- Each `ChronicleCard` is a real **3D-perspective artefact**, not a glass square:
  - Outer wrapper: `perspective: 1200`, `transformStyle: 'preserve-3d'`
  - Inner: `useMotionValue` for mouse x/y → `useSpring` (stiffness 140, damping 18) → `useTransform` → `rotateX: [8, -8]`, `rotateY: [-10, 10]`
  - Cursor-tracking glare via `useTransform([glareX, glareY], …)` returning a `radial-gradient` string with `mix-blend-mode: screen`
  - Rotating gold/crimson conic-gradient border, 9s linear infinite (slower than HTAnalystCard — this is heritage, not live)
  - Deep radial gradient bg: gold top-left + crimson bottom-right + `linear-gradient(180deg, rgba(12,7,22,0.92), rgba(24,8,20,0.94))` base
  - Title with `WebkitBackgroundClip: text` gold gradient + `transform: translateZ(30px)` for real depth
  - Predicted-score badge (e.g. `3–1`) + footer with date + `+10 PTS` gold→crimson gradient stamp

Lang-aware text: `(lang === 'he' && chronicle.epic_text_he) || chronicle.epic_text`. Mounted in `ProfilePage.tsx` between the analytics bento and prediction sections.

### Rules

- **Chronicler is fire-and-forget.** Always `void ensureChronicle(...)` from `scoreUpdater.ts`. A Groq timeout or rate-limit must never block coin resolution or notification emission.
- **Never re-score the chronicle threshold.** The gate is hardcoded `pointsEarned >= 10` (the Tier 1 + Tier 2 perfect-exact-score combo). If a match is corners-re-scored and bumps someone from +9 to +11, `ensureChronicle` is NOT called a second time. Chronicles are for the initial perfect pick, not top-ups.
- **HIGH_PROFILE_LEAGUE_IDS is in the backend only.** Don't mirror it to the frontend — the frontend reads whatever chronicles exist in the table. If we ever expand the set, old matches will never retroactively produce chronicles (no backfill by design; only live resolutions create them).
- **HT batch limit stays at 2.** Half-time windows are narrow and concurrent across a matchday; a larger batch risks Groq 429s that would starve the pre/post-match batches sharing the same rate budget.
- **Chronicle uniqueness is DB-enforced.** `user_chronicles_user_match_unique` is the source of truth. Application-level "existing row" check is an optimisation; never drop the index.
- **HTAnalystCard and AIScoutCard are intentionally different components.** Don't merge them — the HT card is a live broadcast overlay (pure black glass, red/amber/cyan neon, urgent rotation speed), the AIScout card is a refined insight box (navy glass, navy/accent border, 7s rotation). Collapsing them destroys the "this is happening right now" signal.
- **New i18n keys added this sprint:** `aiLiveReadLabel`, `aiHTAnalystTitle`, `chroniclesTitle`. All three exist in `en` and `he` blocks of `i18n.ts`.

---

## 24. The Addiction Loop — Streaks + Web Push (V3 Sprint 8)

Two engagement systems shipped together (migration 038). Both are **graceful-degradation-first**: a missing key or unsupported browser silently hides the feature — the app never breaks.

### 24.1 Prediction Streak System (display-only 🔥)

A per-group hot-streak counter. **Reuses the existing `leaderboard.current_streak` / `best_streak` columns — no migration for streaks.**

**Backend (`scoreUpdater.ts`, inside the post-atomic-claim leaderboard update):**

```typescript
const newStreak = isCorrect ? existingLB.current_streak + 1 : 0;  // isCorrect = Tier-1 FT result correct
const newBest   = Math.max(existingLB.best_streak, newStreak);
```

- **A streak increments only on a correct Tier-1 (full-time result) pick; an incorrect Tier-1 resets it to 0.** Missing a day does NOT break the streak — only a wrong result does.
- `isCorrect` is `breakdown.correct_prediction` from `pointsEngine.ts` (the same Tier-1 flag used for scoring).
- The update rides inside the existing atomic-claim leaderboard upsert — no new write path, no new race surface.

**Frontend:**
- `LeaderboardRow.tsx` renders a `🔥 N` pill when `entry.current_streak >= 3` (orange, `tabular-nums`, tooltip via `t('streakTooltip')`).
- `ProfileBentoV2` already surfaces the streak client-side via the identical `>= 3` rule.

**Rules:**
- **Streaks are strictly DISPLAY-ONLY.** They must NEVER affect points or coins (no multiplier). This was an explicit product decision.
- **Never re-derive streaks in a separate pass.** The single source of truth is the `scoreUpdater` leaderboard update; a second writer would double-count.
- The `>= 3` visibility threshold is intentional — a "streak" below 3 isn't worth advertising. Keep the frontend and profile thresholds identical.

### 24.2 Native Web Push (zero third-party services)

A self-hosted Web Push engine using VAPID + the `web-push` npm package. No OneSignal/Firebase — $0, fully owned.

**Schema (migration 038):** `push_subscriptions` (own-row RLS) + `matches.reminder_sent_at`.

**Client (`lib/push.ts` + `components/ui/PushToggle.tsx` + `public/sw.js`):**

| Piece | Role |
|-------|------|
| `getPushStatus()` | Returns `'unsupported' \| 'ios-needs-install' \| 'denied' \| 'subscribed' \| 'default'`. **iOS-non-standalone is checked BEFORE `apiSupported()`** — see the critical rule below |
| `enablePush(userId)` | Registers `/sw.js`, requests permission, `pushManager.subscribe` (VAPID key cast `as BufferSource`), upserts the subscription (onConflict `endpoint`) |
| `disablePush()` | Deletes the row + `sub.unsubscribe()` |
| `PushToggle.tsx` | Self-hiding Settings card. `null` when status is `null`/`'unsupported'`; shows the iOS install hint (no button) for `'ios-needs-install'`/`'denied'`; enable/disable button otherwise |
| `public/sw.js` | Minimal service worker: `push` → `showNotification`, `notificationclick` → focus existing tab or `openWindow`. Deliberately does **not** precache app assets |

**Backend (`services/pushSender.ts` + `cron/scheduler.ts`):**
- `sendMatchReminders()` runs every 2 min (`*/2 * * * *`). Selects NS matches with kickoff in the next 15 min and `reminder_sent_at IS NULL`; audience = **ALL opted-in members** of any group where the match's league is active (drives DAU, not just re-engagement); sends *"⚽ {Home} vs {Away} kicks off in 15 mins! Lock in your prediction now."*; prunes dead subs on 404/410; stamps `reminder_sent_at` so each match fires exactly once.
- No-op unless `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` are set on Render — `ensureVapid()` returns false and the whole sender is silent.

**Env vars (never committed):**

| Key | Where | Notes |
|-----|-------|-------|
| `VAPID_PUBLIC_KEY` | **Render** (backend) | from `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | **Render** (backend) | private — Render only, NEVER Vercel |
| `VAPID_SUBJECT` | **Render** (backend) | `mailto:…` |
| `VITE_VAPID_PUBLIC_KEY` | **Vercel** (frontend) | **same** value as `VAPID_PUBLIC_KEY`; inlined at build time |

### Rules

- **iOS Safari exposes `PushManager`/`Notification` ONLY inside an installed PWA.** In a normal iOS tab those APIs are absent, so `apiSupported()` is false. `getPushStatus()` therefore checks `isIosNonStandalone()` **first** and returns `'ios-needs-install'` — otherwise iPhone-Safari users see nothing at all instead of the "add to home screen" hint. Never reorder this back. Web Push itself still only activates from the installed standalone PWA (an Apple restriction, not a bug).
- **`VITE_VAPID_PUBLIC_KEY` is baked into the bundle at build time.** Adding it in Vercel requires a **fresh production build** to take effect — a plain "Redeploy" that reuses a stale build won't surface the toggle. Push a commit (or rebuild without cache).
- **Push is graceful-degradation-first.** No VAPID key, unsupported browser, denied permission → the feature hides itself. It must never throw or block the app.
- **Streaks never touch points/coins.** Display-only, forever.
- **`reminder_sent_at` is the single dedup guard for reminders** — never send without checking/stamping it, or users get spammed on every 2-min tick.

---

## 25. Beautiful Analytics — Themed SVG Charts (V3 Sprint 9)

Premium, fintech-grade data visualization for the Profile page. **Zero new dependencies** — no `recharts`, no `visx`, no `chart.js`. Pure hand-built SVG animated with Framer Motion, which was already the `vendor-framer` bundle chunk, so the entire sprint added ~0 KB to the bundle (verified: no new vendor chunk appears in the build output).

### Components

| Component | File | Role |
|-----------|------|------|
| `Sparkline` | `components/ui/Sparkline.tsx` | Generic area+line micro-chart. Catmull-Rom smoothed path through `data: number[]`. Framer Motion `pathLength` draw-on for the stroke, fade-in for the gradient area fill. `tone: 'accent' \| 'muted'` picks the CSS var driving colour. |
| `FormBars` | `components/ui/FormBars.tsx` | Last-N points-per-match bars. Colour = outcome (`bg-accent-green` correct / `bg-red-500/60` miss), height = magnitude (points earned that match), spring grow-in staggered per bar. |

### Data — zero new DB queries

Both series are derived **client-side** in `ProfilePage.tsx` from the `history` array already fetched once by `fetchHistory()` (last 50 predictions + joined match). No new Supabase query was added for this sprint:

```typescript
// trajectory — cumulative points, chronological (feeds the hero Sparkline)
const trajectory = resolvedChrono.reduce((run, p) => [...run, ...], [])

// formSeries — last 10 result predictions as {pts, correct} (feeds FormBars)
const formSeries = resultPreds.slice(-10).map(p => ({ pts, correct }))
```

### Where they live

- **`ProfileBentoV2.tsx` hero card** — the old fake `Math.sin`-based placeholder bars are replaced by the real `<Sparkline data={trajectory} tone="accent" />`. The hero total now rolls via `@number-flow/react` (`NumberFlow`) instead of a static number, matching the odometer pattern already used in `TopBar.tsx`/`Sidebar.tsx` for coins.
- **`ProfilePage.tsx` Recent Form card** — the flat 5-dot win/loss row is replaced by `<FormBars series={formSeries} />`, which shows both outcome *and* magnitude (a perfect +10 pick visibly towers over a lone +3).

### Theme integration

All stroke/fill/gradient colour comes from CSS vars (`--color-accent-green`, `--color-text-muted`, `--color-border-subtle`) — **never hardcoded hex**. This means both charts flip Navy↔Frost automatically with zero JS branching, consistent with rule "never use Tailwind `dark:` prefix" in §15.

### CLS safety & accessibility

- Both components render inside a **fixed-height container** — no layout shift whether data is loading, empty, or populated.
- `Sparkline` with `< 2` data points (nothing to draw yet) renders a dashed baseline placeholder at the same height, never collapsing the box.
- Both respect `prefers-reduced-motion` (`useReducedMotion` from Framer Motion) — the draw-on/grow-in is skipped and the final state renders immediately.
- Both accept an optional `label` prop: when set, the SVG/bar container gets `role="img"` + a localized `aria-label` (`t('trajectoryLabel')` / `t('recentForm')`); omitted, it's `aria-hidden` (decorative, the surrounding card already has text context).

### Rules

- **Do not add a charting library for future data-viz work without a bundle-size justification.** The whole point of this sprint was proving pure SVG + the already-loaded Framer Motion is sufficient for sparkline-scale charts. Reach for a library only if the visualization genuinely needs scales/axes/legends beyond what a hand-built path can express.
- **Trajectory and form series must stay derived from already-fetched data.** Do not add a new Supabase query for a chart that could be computed from `ProfilePage`'s existing `history` fetch.

---

## 26. Agentic AI — The Locker Room Provocateur (V3 Sprint 10)

Turns the Groq AI from a passive insight generator (AI Scout, §22) into an **agentic** feature: it reads live group dynamics — conflicting head-to-head predictions on a match that just kicked off — and posts witty, provocative banter directly into The Locker Room feed. This is the capstone of the V3 Masterplan.

### Privacy-first timing — the single most important design decision

Predictions are hidden from other group members while a match is `status='NS'` and kickoff is in the future (migration 037, §14 RLS summary). **The Provocateur fires only at or after kickoff — never before.** Posting banter that names picks pre-kickoff would leak locked predictions around the RLS wall and undo Sprint 2's privacy hardening. Once kickoff passes, picks are already publicly visible to the group, so revealing them in banter is both legal and dramatically well-timed (predictions just locked — this is peak tension).

**Never move this trigger earlier "for more hype." If a pre-match teaser is ever wanted, it must not name any user's specific pick** (e.g. "3 of you disagree on Arsenal–Chelsea" is fine pre-kickoff; "Roy picked Chelsea" is not).

### Backend — `backend/src/services/aiProvocateur.ts`

| Function | Purpose |
|----------|---------|
| `runProvocateurBatch(limit=3)` | EXPORTED. Sweeps matches that kicked off in the last 20 minutes (`status` in `NS`/live/ET/PEN — i.e. just-kicked-off through in-progress) across all groups with that league active. For each (group, match): skips if already bantered (query check; the unique index is the true backstop), fetches predictions with a non-null `predicted_outcome`, **skips if fewer than 2 distinct outcomes** (no conflict = nothing to provoke = no wasted Groq call), builds a lean context, generates EN+HE banter in parallel, inserts one `AI_BANTER` `group_events` row |
| `generateBanter(homeTeam, awayTeam, picks, lang)` | Builds the per-language prompt and calls the shared `callGroq()` (exported from `aiScout.ts`) |

**Context assembly — lean, not a DB dump.** Only the users who actually predicted a conflicting outcome are included, with just their username, group rank, total points, predicted outcome, and predicted score if given:

```
MATCH: Arsenal vs Chelsea
PICKS:
- Dan (#1, 142pts) → Arsenal 2-1
- Roy (#3, 96pts) → Chelsea 0-1
- Maya (#2, 110pts) → Draw
```

~120 input tokens, ~60 output tokens ×2 languages. One match candidate per group per run; `limit` caps total banters posted per cron tick to keep Groq bursts small (same rationale as the HT-insight `limit=2` in §23).

### Prompt design

Two-sentence, provocative-but-friendly sports-pundit persona. `SYSTEM_EN` / `SYSTEM_HE` constants in `aiProvocateur.ts` instruct the model to **name names**, reference rank where it lands (leader betting recklessly / underdog's bold call), stay punchy and teasing, **never cruel or profane**, and reply only in the target language. Max 45 words, ~120 max_tokens ceiling on the Groq call.

### Trigger — automated cron, not a button

`cron.schedule('*/3 * * * *', runProvocateurBatch)` in `scheduler.ts`. Automated was chosen deliberately over a "Generate Banter" UI button — a manual trigger would make the user do the AI's job and breaks the "agentic, feels alive" premise. No-op entirely if `GROQ_API_KEY` is unset (same silent-degradation pattern as every other AI function — §22 rule "never throw from an AI function" applies here too).

### Schema — migration 039

`group_events.event_type` CHECK extended with `'AI_BANTER'`; `group_events.user_id` made **nullable** (the AI has no owning user — `user_id: null` on insert); partial unique index `group_events_ai_banter_unique` on `(group_id, match_id) WHERE event_type='AI_BANTER'` is the concurrency backstop, same pattern as the coin/notification dedup indexes in rule 4.15. The insert in `aiProvocateur.ts` treats a unique-violation error as "another worker already posted" and continues silently rather than logging it as a failure.

### Delivery — no new frontend fetch path

`useGroupEvents.ts` already subscribes to `group_events` `INSERT` via Supabase Realtime and re-fetches on any insert (it was built for The Locker Room in migration 028). The AI's insert is delivered through that same existing pipeline — banter appears live with zero new frontend plumbing. `GroupEvent.user_id` is now typed `string | null` and `event_type` gained the `'AI_BANTER'` union member.

### Frontend — `components/groups/ActivityFeed.tsx`

`EventCard` branches to a dedicated `AiBanterCard` for `event_type === 'AI_BANTER'`, styled to be **unmistakably distinct** from human activity cards:

- Rotating conic-gradient border (violet → blue → ice-blue), 6s linear infinite — slower/cooler than `HTAnalystCard`'s urgent 4.2s red/amber/cyan (§23), because this is witty commentary, not a live broadcast overlay
- Dark glass panel (`rgba(6,10,22,0.82)` → `rgba(12,10,26,0.80)`), distinct from the lighter `bg-bg-card/60` human event cards
- Gradient "AI Scout" name (`t('lockerAiName')`) with a `Sparkles` icon avatar in a gradient circle, plus a small bordered **"AI" pill** — no human `Avatar`/profile join, since `user_id` is null
- Distinct violet timeline dot (vs. blue for predictions, accent-green for coin wins, purple for leaderboard climbs)
- Banter text is lang-aware: `(isHe && meta.text_he) || meta.text_en`; returns `null` if both are empty (Groq failure — the card simply doesn't render, feed unaffected)

### Rules

- **Never fire the Provocateur before kickoff.** This is a hard privacy boundary, not a tuning knob — re-read the "Privacy-first timing" note above before touching the match-selection window in `runProvocateurBatch`.
- **Skip matches with <2 distinct predicted outcomes.** Unanimous agreement has no comedic/provocative angle and burns a Groq call for nothing.
- **`callGroq` is exported from `aiScout.ts` and must stay the single Groq client.** Do not create a second axios-to-Groq call site — every AI feature (Scout, HT Read, Chronicles, Provocateur) funnels through the same `getApiKey()` gate, timeout, and response-cleaning logic.
- **One banter per (group, match) — enforced at the DB level.** The unique index is the source of truth; the pre-insert existence check in `aiProvocateur.ts` is purely a Groq-call-avoidance optimization, never rely on it alone for correctness.
- **AI_BANTER events have `user_id = null`.** Any frontend code that assumes `GroupEvent.user_id` is always a string (e.g. joining to `profiles`) will break on this event type — always branch on `event_type` before touching `user_id`.

---

## 27. The Integrity & Viral Loop (V4 Sprint 11)

Two unrelated workstreams shipped together: closing a real client-trust vulnerability in the coin economy, and the first viral-growth mechanic (a shareable recap card).

### The integrity fix — two vulnerabilities, not one

`place_prediction_bet(p_user_id, p_group_id, p_match_id, p_cost)` and `adjust_prediction_bet(..., p_old_cost, p_new_cost)` (migration 020/021) trusted **client-supplied cost values** with no server-side recomputation. A modified client could submit a full 5-tier prediction while claiming `p_cost = 1`. Separately, `ProfilePage.tsx`/`usePredictions.ts` wrote `predictions.coins_bet` directly via a client `.upsert()` — a **second**, independent trust gap, since the value written there didn't have to match what the RPC actually charged, and it's what the delete-refund path (`pred.coins_bet`) later trusts.

**Also found while auditing:** neither RPC checked `p_user_id = auth.uid()`. Any authenticated caller could pass a different UUID and move another user's coins or place a prediction on their behalf.

**Fix — `submit_prediction()` (migration 040):** a single `SECURITY DEFINER` RPC that (1) checks `p_user_id = auth.uid()` first, (2) computes cost natively from the tier params it receives — mirrors `calcPredictionCost()` in `constants.ts` exactly, keep both in sync if `COIN_COSTS` ever changes, (3) validates the league-4396 no-corners rule server-side (previously frontend-only), (4) upserts the `predictions` row itself in the same transaction, so the client never writes `coins_bet` independently again. `refund_prediction()` closes the same gap on the delete path, plus a server-side `is_resolved` check so an already-paid-out prediction can never be refunded twice.

**Both `place_prediction_bet` and `adjust_prediction_bet` were dropped, not just abandoned by the frontend.** Leaving a vulnerable RPC reachable via a direct `supabase.rpc()` call preserves the exact hole being fixed, even after every UI caller stops using it. This is now the mandatory pattern for any future coin-spending RPC — see the new rule in §11.

**Optimistic UI note:** `usePredictions.ts`'s existing optimistic-write + authoritative-reconcile pattern (`onMutate` guesses, `onSuccess` overwrites with the RPC's real response) needed no structural change — it was already correct, just reconciling to a value that used to be untrustworthy. `coinsStore.coins` already renders through `NumberFlow` in the top bar, so any optimistic-guess correction animates smoothly for free.

### Loss-aversion push — batch, not per-write

`scoreUpdater.ts`'s prediction-resolution loop can touch dozens of leaderboard rows in one `checkAndUpdateScores()` tick (multiple matches, multiple users each). A naive per-write push would notify a user multiple times in seconds as their rank bounces around mid-batch.

**`RankTracker`** — a **per-invocation, not module-level** object (`checkAndUpdateScores()` can run concurrently from the 30s poller AND HTTP sync routes; a shared tracker would let them clobber each other's before-snapshots). It captures each user's `total_points` on the **first** touch this run, across every resolution path (main FT loop, ET-transition loop, corners re-score loop, catch-up loop all feed the same tracker instance). At the very end of the invocation, `flushRankDropNotifications()` does **one** before/after rank comparison per touched group and fires at most one `rank_drop` notification per user per invocation, regardless of how many times their points changed in that tick.

Correctness under concurrent workers is inherited from the existing atomic-claim guard (rule 4.14) — a tracker only ever contains users **this specific invocation** actually won claims for, so a worker that loses every claim has an empty tracker and sends nothing. No new dedup table needed.

Delivery is dual-channel, matching the existing `prediction_result` pattern: a persistent `notifications` row (`type='rank_drop'`, `notifications.type` has no CHECK constraint — no migration needed) plus a best-effort push via `sendPushToUser()` — a new, general single-user send extracted from `sendMatchReminders()`'s send+prune logic (`pushSender.ts`), so there's one send+prune implementation, not two. Push copy is English-only, matching the existing match-reminder push — no `profiles.lang` column exists yet to localize against.

### Shareable Recap Card — zero new dependencies

`ShareableRecapCard.tsx` (bottom sheet, swipe-to-close per rule 4.13) + `lib/shareCard.ts` (the actual Canvas draw + share logic) follow the exact zero-dependency precedent Sprint 9 set for `Sparkline.tsx` — a hand-drawn `<canvas>`, not `html2canvas`/`html-to-image`. Colors are resolved from live CSS custom properties via `getComputedStyle(document.documentElement)` **at draw time**, so the exported PNG matches whichever theme is active with zero hardcoded hex. Canvas has no concept of CSS logical properties, so RTL is handled explicitly (`ctx.direction` + right-anchored text placement), mirroring the manual `dir={isRTL ? 'rtl' : 'ltr'}` pattern already used in `HTAnalystCard`/`AiBanterCard`.

Three-tier share fallback in `shareRecapCard()`: `navigator.share` with a file (rich image into WhatsApp/iMessage) → `navigator.share` text-only (some browsers support share without file support) → clipboard copy + explicit PNG download (desktop, unsupported webviews). `AbortError` (user canceled the native share sheet) is a normal outcome, not a retry trigger.

**Rank/points/streak data reuses `useLeaderboard('total')` directly — zero new query**, the same hook `LeaderboardPage` already uses to compute rank client-side (rank is not a stored column anywhere in this schema).

**Privacy-conscious default:** the share text promotes the app generally, never the group's invite code. A recap card is exactly the kind of asset that gets forwarded past its original audience, and invite codes are private by design — leaking one into a widely-shared image would be an accidental foot-gun, not a feature.

### Rules

- **Never let a coin-spending RPC trust a client-supplied cost, and always check `auth.uid()` first.** See the new rule in §11 — this applies to every future coin-spending function, not just the two that got fixed.
- **A deprecated RPC must be dropped, not just stopped-being-called.** Leaving it reachable preserves whatever vulnerability motivated replacing it.
- **`RankTracker` must stay per-invocation, never module-level.** `checkAndUpdateScores()` is genuinely invoked concurrently from multiple entry points; a shared tracker would silently reintroduce the exact class of race this codebase has scar tissue from elsewhere (rule 4.14/4.15).
- **`sendPushToUser()` is the single-user push primitive — reuse it, don't duplicate the send+prune loop.** `streakGuardian.ts` (§28) and `microBanter.ts`'s downstream push needs (§29 doesn't push, but future features will) should call it, not reimplement `webpush.sendNotification` + dead-subscription pruning a third time.
- **Recap-card share text never includes the group's invite code by default.** If a future group-targeted invite flow is added, it must be an explicit opt-in toggle, not a default.

---

## 28. The Autonomous Economy (V4 Sprint 12)

Moves the daily +30 coin bonus from a client-triggered RPC to a proactive `pg_cron` sweep, adds a 3-day inactivity cap, and decays abandoned prediction streaks after 7 days of silence.

### The DST bug the naive design would have shipped

"Run at exactly 00:00 Israel time" sounds simple, but `pg_cron` schedules run against the Postgres server's UTC clock, and Israel alternates between UTC+2 (IST, winter) and UTC+3 (IDT, summer DST). A **fixed** UTC cron expression tuned for one offset drifts a full hour off true midnight for roughly 7 months a year — silently, twice a year, at each DST transition, invisible in manual testing done in a single season.

**The fix:** `distribute_daily_allowance()` doesn't chase a precise instant. It's scheduled every **15 minutes** and is DST-proof by construction — it derives "today" via `(NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE` (the same expression already proven correct in the old `claim_daily_bonus`), and is a cheap no-op outside its real trigger window (the `WHERE` clause matches nothing for 99% of ticks). A missed tick self-heals on the next one; no catch-up logic needed.

### The bonus was always per-group, not per-user

`group_members.last_daily_bonus_date` (not `profiles`) is what the old RPC checked — a user in 3 groups gets +30 **three separate times**, once per group's coin balance, matching the fact that coins themselves are per-group (rule 4.12). `distribute_daily_allowance()` iterates `group_members` rows, not users, for exactly this reason.

### Inactivity cap — matches the "90 coins then stop" spec precisely

`profiles.last_active_at` (new column) is touched **once per app-open** via `touch_last_active()` — piggybacked onto `AppInitializer`'s existing per-user/group-change effect in `App.tsx`, not a new effect, not per-request. Eligibility requires `last_active_at >= today - 3 days`. A user who goes offline has a **frozen** `last_active_at` — days 1-3 after that freeze are still within the 3-day window (measured from the stale timestamp) and accrue; day 4 onward falls outside it and stops. A fully abandoned account accumulates exactly 90 coins (3 × 30) and then plateaus until the user returns and `touch_last_active()` resets the clock.

### Concurrency — `FOR UPDATE OF gm SKIP LOCKED`

The bulk-SQL equivalent of the atomic-claim pattern already governing coin payouts (rule 4.14): the eligible-rows CTE locks candidate `group_members` rows and **skips** any already locked by an overlapping tick rather than blocking or double-crediting them. Combined with the `last_daily_bonus_date IS DISTINCT FROM` idempotency check, this closes the race from both the locking side and the idempotency side.

### Streak decay + day-6 warning — split across SQL and Node on purpose

`decay_idle_streaks()` (pure SQL, `pg_cron`, same 15-min cadence) zeroes `leaderboard.current_streak` per `(user_id, group_id)` — scoped the same way the streak columns themselves are — after 7 days with no `predictions` row in that group. No calendar boundary, safe to run frequently.

The **day-6 warning push** can't live in `pg_cron` — it needs the `web-push` client, which only exists in Node. `streakGuardian.ts`'s `sendStreakExpiryWarnings()` (backend `scheduler.ts`, 30-min cadence — looser than the SQL sweeps since day-scale warnings don't need tight precision) queries active-streak users not yet warned this idle cycle (`leaderboard.streak_warning_sent_at IS NULL`), finds their most recent prediction in that group, and pushes via `sendPushToUser()` (§27) when they're 6-7 days idle. **`streak_warning_sent_at` is cleared back to `null` by `scoreUpdater.ts` on ANY resolution for that `(user, group)`** — without this, a user who saves their streak once and later goes idle again would never be warned a second time, since the guard is an `IS NULL` check, not a recency check.

**Known, accepted limitation:** this push, like the existing 15-min match reminders, depends on Render being awake — not a new regression, but worth naming rather than implying it's as reliable as the pure-SQL decay it's paired with.

### Client cleanup — smaller than expected

There was **no localStorage flag** to remove (a wrong assumption worth correcting for the record) — the old client-side idempotency relied entirely on the server-side `last_daily_bonus_date` check plus an in-memory `useRef` in `App.tsx` that only decided *when* to re-fire the (now-deleted) claim RPC. Removed entirely: `getIsraelDate()`, the `lastInitDateRef` visibility-change midnight-recheck block, and `coinsStore.initCoins`'s RPC call (now a plain balance fetch). `claim_daily_bonus` **dropped outright** (migration 041) — not a security fix like §27's drops, purely a cleanliness call; the RPC was always idempotent and user-scoped, just obsolete once the cron owns this.

**What actually replaces the removed client trigger for the "online at midnight" UX:** a Realtime subscription (new, added in this sprint) — `group_members` UPDATE → re-fetch balance (rule 4.4: never trust a partial payload); `coin_transactions` INSERT with `type='daily_bonus'` → the `coin_drop` haptic + toast that used to come from the RPC's response, now sourced from the cron's deposit. Both channels filter by `group_id` only (Realtime doesn't support compound filters on one subscription) and check `user_id` client-side.

### Rules

- **Any new autonomous `pg_cron` job that needs to land "at midnight Israel time" must use the frequent-sweep + date-comparison pattern, never a fixed UTC cron time.** The DST drift is real and silent.
- **`streak_warning_sent_at` must be cleared on any resolution, not just left to expire.** It's a completion guard, not a cooldown timer — a stale non-null value permanently suppresses future warnings for that user.
- **`touch_last_active()` is the only client-callable function among the Sprint 12 RPCs.** `distribute_daily_allowance()` and `decay_idle_streaks()` are `pg_cron`-only — never `GRANT` them to `authenticated`.

---

## 29. In-Play Micro-Predictions — Momentum Bets (V4 Sprint 14)

Short-fuse (60-second), low-stake (2 coin) in-play propositions — "Goal in the next 10 minutes?" — fired at three milestones (kickoff, half-time, minute 75) to give the 90 minutes of a live match something other than passive waiting.

### The arbitrage fix is structural, not a timing race

The danger in a "goal in the next N minutes" proposition is specific to this codebase: the app is *fast* at delivering live score deltas, so a client could in principle see a goal via Realtime a few seconds before a naive server-side lock takes effect, and bet on a still-open window with the outcome already known. Tightening the server-side clock check narrows this but never eliminates it — it's still a race against network speed.

**The actual fix: the outcome window is always `[locked_at, locked_at + 10 minutes)`, never `[opens_at, opens_at + 10 min)`.** Betting only happens during `[opens_at, locked_at)` — a period that, by construction, ends **before** the outcome window begins. There is no client speed at which the outcome of a window that hasn't started yet can be known. Resolution reads `baseline_home_score`/`baseline_away_score` captured **at lock time** (stamped by the lock sweep, migration 042) — never at question-open time. Any future time-windowed proposition in this codebase must follow this same shape: measure the outcome window from the moment betting closes, not the moment it opened.

### Schema & RLS — Sprint 11's lesson applied from day one

`micro_prediction_questions` / `micro_prediction_bets` (migration 042) have **no client INSERT/UPDATE policy at all** — every write goes through `submit_micro_prediction()`. This isn't a fix, it's §27's lesson (never trust a client-computed cost, never let the client write a bet row directly) built in from the start instead of retrofitted after a vulnerability is found. Bets RLS mirrors migration 037's predictions-privacy shape exactly: own row always visible, another member's bet hidden until the question's `status` leaves `'open'`.

`submit_micro_prediction()` FOR UPDATEs the question row itself (closing the race between a concurrent lock-sweep and a last-second bet) and — critically — does **not** wrap the bet `INSERT` in `ON CONFLICT DO NOTHING`. A pre-check gives a friendly `'already_bet'` error in the common case, but the real backstop is letting a genuine `UNIQUE(question_id, user_id)` violation raise a real exception, which Postgres rolls back automatically — including the coin deduction. Suppressing that error with `ON CONFLICT DO NOTHING` would have been a real double-charge bug: the coins would debit, the conflicting insert would silently no-op, and no bet row would exist to show for it.

### Three cadences, three purposes

- **Milestone generation** stays inside the existing 30s `scoreUpdater.ts` live-poll loop (it needs the fresh ESPN read already happening there) — kickoff/halftime/minute-75 detected by comparing the DB's pre-batch status against the fresh ESPN read, same transition-detection idiom already used for ET capture. Idempotent via `UNIQUE(match_id, group_id, milestone)` + upsert-ignore.
- **Locking** is a new, separate, ESPN-call-free 5-second sweep (`momentumBets.ts`, `lockExpiredMicroQuestions()`) — a 60-second betting window can't tolerate losing up to half its precision to the 30s cadence.
- **Resolution** is a 15-second sweep (`resolveLockedMicroQuestions()`) — looser, since a few seconds' delay after lock doesn't affect fairness (the outcome window is already fixed at lock time regardless).

`goal_next_10` resolves via a **plain score-delta comparison** (current total goals vs. the locked-time baseline) — deliberately not timestamped-event parsing, sidestepping the exact ESPN data-granularity gap that got "next team to win a corner" cut from v1 (corners need per-minute timestamped data this codebase can't reliably get). If match data is unavailable or stale at resolution time (PST/CANC, missing scores), the question is **canceled** and every bet refunded rather than resolved on a guess or left stuck open forever.

### Settlement — a crash-safe primitive worth reusing

`settleBets()` claims each individual bet via `.is('settled_at', null)` — the same atomic-claim shape as `resolveMatchPredictions`'s `is_resolved=false` guard (rule 4.14) — **not** a single all-or-nothing flip on the question. This matters: if a question-level flip alone gated payout, a crash mid-loop through several winning bets would leave the question already `'resolved'` and the remaining winners permanently unpaid on the next sweep (since the outer query no longer matches a `'resolved'` question). Per-bet claiming means a crash leaves unprocessed bets exactly as they were, safely retried regardless of the question's own status.

`settled_at` is **deliberately a separate column from `is_winner`** — a canceled/refunded bet has no winner or loser, so `is_winner` can't double as the "already processed" marker without being either ambiguous or wrong. `credit_group_coins()` (migration 043) is a minimal atomic balance-increment RPC, added because the Supabase JS client can't express `coins = coins + N` without either a race-prone read-then-write or an RPC — it does nothing else (no ledger insert, no dedup index; the caller's own `settled_at` claim is the idempotency guarantee) and is **never `GRANT`ed to `authenticated`**. The ledger row (`type='micro_prediction_won'`/`'micro_prediction_refund'`) is inserted in application code specifically so these payouts render distinctly from real prediction wins in `CoinHistoryModal` — reusing `increment_coins` would have hardcoded `type='bet_won'`, making a 2-coin momentum win indistinguishable from a real prediction payout in coin history.

### AI roast — a new dedup index, deliberately not reusing Sprint 10's

`microBanter.ts`'s `triggerMicroBanter()` fires the instant a question locks (called fire-and-forget from `lockExpiredMicroQuestions()`, `void`-prefixed like `ensureChronicle`), reusing `callGroq` — the same single Groq client every AI feature in this codebase funnels through. **It posts to a new `MICRO_BANTER` event type with its own `(group_id, question_id)` dedup index, not `AI_BANTER`'s `(group_id, match_id)` one.** A match can generate up to 3 milestone questions; migration 039's index allows only one `AI_BANTER` row per match per group total, and reusing it would have silently dropped the 2nd and 3rd roast (`aiProvocateur.ts`'s existing catch block treats a unique-violation as "another worker already posted" and swallows it without logging — a real, easy-to-miss failure mode). `ActivityFeed.tsx`'s `AiBanterCard` renders both event types verbatim — same metadata shape (`text_en`/`text_he`/`home_team`/`away_team`), no reason for a second card component.

### Frontend — isolated countdown, reused patterns throughout

`useCountdown.ts` is a new hook with the **exact same isolated local-state/`setInterval` shape as `useLiveClock`** — a 1Hz tick re-renders only the component that calls it. `MomentumBanner` uses it so the countdown never cascades into `LockerRoomPage` or the `ActivityFeed` list beside it. `MomentumBetSheet` is a standard swipe-to-close bottom sheet (rule 4.13) with `haptic('selection')` on choice tap and `haptic('success')` on confirmed submission; the coin balance update flows through `coinsStore`, which has rendered through `NumberFlow` in the top bar since Sprint 12 — no new animation code needed.

### Rules

- **Any future time-windowed betting mechanic must measure its outcome window from lock time, never open time.** This is the structural arbitrage fix — re-derive it from first principles before assuming a tighter server clock check is sufficient.
- **A coin-spending RPC never wraps its uniqueness-guarding INSERT in `ON CONFLICT DO NOTHING` if a prior step already moved money.** Let the constraint violation raise and roll back the whole transaction; suppressing it silently strands the side effect.
- **Settlement of a batch of financial records (bets, payouts, refunds) must claim each record individually (`settled_at`-style), never gate the whole batch behind a single parent-row status flip.** A crash mid-batch must leave unprocessed records safely retryable — see the design note above for exactly why this matters.
- **`MICRO_BANTER` and `AI_BANTER` are visually identical but must never share a dedup index.** They key on different granularities (per-question vs. per-match) for a structural reason, not a stylistic one.
- **AI never generates the question or determines its resolution — only the commentary after the outcome is already mechanically known.** This applies to every future in-play mechanic, not just this one: an LLM must never touch anything that moves coins.

---

## 30. The Bento Arena — My Arena Stats Dashboard (V4 Sprint 15)

A premium personal + group analytics dashboard, added as a new "My Arena" sub-tab inside `StatsPage.tsx` alongside the pre-existing league browser (now a "Leagues" sub-tab, unchanged). Built to three explicit constraints: no charting library, no N+1 query pattern, and OKLCH color science for the diverging heatmap — all three verified in the implementation, not just claimed in a plan.

### One RPC, not one query per widget

`get_stats_arena_payload(p_user_id, p_group_id) RETURNS JSONB` (migration 044) assembles the entire tab's data in a single round trip: a League x Bet-Type win-ratio heatmap, the caller's stake/streak/risk position against the group, and a precomputed head-to-head matrix against every other group member. The H2H matrix is the actual N+1 kill — it's built from **one self-join** of `predictions p1 JOIN predictions p2 ON p1.match_id = p2.match_id AND p1.group_id = p2.group_id AND p2.user_id != p1.user_id`, grouped by opponent, producing every rival's comparison row in one pass. The frontend opponent-picker (`H2HMatrix.tsx`) then just re-indexes into that already-fetched array — selecting a different rival fires **zero additional network requests**.

Guards, first actions before any aggregation: `p_user_id = auth.uid()`, then group membership. This is read-only — no coins move — but the H2H matrix exposes cross-user comparison data, so it gets the same discipline as every coin-spending RPC in this codebase (rule in §11) rather than being treated as exempt because nothing is being spent.

### The `is_resolved` vs. literal `status = 'FT'` correctness point

Every aggregate filters on `predictions.is_resolved = true`, not a literal `matches.status = 'FT'` string match. `is_resolved` is the authoritative "settled and safe to expose cross-user" flag everywhere else in this codebase (rule 4.14 — it's exactly what gates coin payout, notification emission, and the migration-037 privacy RLS boundary). A knockout match that went to extra time or penalties resolves with `is_resolved = true` while `matches.status` is `'AET'`/`'PEN'`, not `'FT'`. Filtering on the literal string would have silently dropped every World Cup 2026 knockout match — including any match that went to extra time or a shootout — from both the heatmap and the H2H matrix, at the exact time this feature shipped during the live WC2026 knockout stage. `is_resolved` is a strict superset of `status = 'FT'`, so it's not a looser check, just the correct one — this bit was caught before shipping, not after.

### Diverging OKLCH heatmap, not a rainbow

The heatmap encodes win-ratio magnitude with polarity around a 50% baseline (coin-flip breakeven), so it's a genuine **diverging** scale, not a sequential one — and never a literal red↔green gradient, which is the single most common colorblind-accessibility failure (protanopia/deuteranopia can't distinguish red from green). GoalBet's existing brand tokens are already CVD-safe for this: `--color-accent-green` is actually ice-blue and `--color-accent-orange` is red-pink — a blue-family/red-family pair, not green/red. New arena-scoped tokens (`--arena-cold/mid/hot/glow`, §15) hold the same hue anchors in both themes and only shift lightness/chroma for contrast, computed from an actual sRGB→OKLab→OKLCH conversion of the brand hex values, not hand-guessed.

`lib/oklch.ts`'s `interpolateDiverging(ratio)` hand-interpolates L/C/H between those anchors (shortest-path hue lerp, so a 218°→13° sweep goes the short way, not through green/yellow), reading the anchors live via `getComputedStyle` so `index.css` stays the single source of truth — never a second hardcoded copy of the same three colors in JS (the exact dual-source-of-truth trap CLAUDE.md already warns about elsewhere, e.g. `COIN_COSTS`/migration 040). This is deliberately not CSS `color-mix()` — a discrete color *and* its resolved lightness (for contrast-aware label ink) are both needed per cell, and hand-rolled interpolation keeps full control over hue direction and clamping.

**Accessibility is not optional on this chart:** every cell is direct-labeled with its percentage — color is never the only signal. Cells with `sample_size < 3` render a diagonal hatch pattern and "n/a" instead of a misleadingly confident color at a tiny sample. A "view as table" toggle renders the identical data as a real `<table>` with scoped headers. Label ink (white vs. near-black) is chosen per-cell from that cell's own resolved OKLCH lightness for contrast — not from the app theme, and not the series hue itself.

### `GroupDistributionChart` — an emphasis chart, honestly scoped to what the RPC can privacy-safely expose

This is an "emphasis" chart, not a generic distribution plot: one muted-gray curve is context, the caller's own position is the one glowing accent marker breaking through it. The RPC deliberately only exposes the group's mean and standard deviation of average stake — never any individual member's row-level amount — so the curve is a **modeled normal distribution** from those two numbers (a Gaussian PDF sampled and splined), not a true empirical density. This is an honest, privacy-preserving simplification stated plainly in the code, not a fake dataset dressed up as real. The marker sits at the caller's own z-score, clipped to ±3, spring-animated in with the same stiffness/damping as the grid's entrance.

### `.glass-grain` — generalized, not duplicated

The World Cup bracket already had exactly the texture this sprint needed: `.wc-grain`, a `feTurbulence`-based noise overlay. Rather than build a second one, `.glass-grain` (index.css) generalizes it into a reusable utility (tuned quieter via `--arena-grain-opacity` so it reads as glass texture on data-dense cards, not a broadcast backdrop), and `GlassCard.tsx` gained an optional `grain` prop. One real bug was caught and fixed before it shipped: the positioned grain layer (`z-index: 1`) would have painted over plain, non-positioned children in `GlassCard`'s non-interactive render branch per normal CSS stacking order (positioned elements with a positive z-index paint after static in-flow content). Content is now explicitly wrapped in `relative z-10` whenever `grain` is on; every other `GlassCard` call site is untouched (no extra wrapper div when `grain` is unset).

### RTL

`BentoArena.tsx`'s grid root sets `dir={lang === 'he' ? 'rtl' : 'ltr'}` explicitly, the same manual-`dir` pattern already used by `HTAnalystCard`/`AiBanterCard`. `PredictionHeatmap.tsx` mirrors column order and row-label anchor/position via an `isRTL` branch (never a CSS-only flip, since the grid's internal coordinate math needs to know), plus a defensive `clipPath` on row labels so a long name like "Champions League" clips instead of bleeding into the grid cells in either direction.

### Data flow — outside AppShell's auto-sync, on purpose

`useStatsArena.ts` (TanStack Query, `staleTime` ~2 minutes) is deliberately **not** wired into `AppShell`'s automatic sync (rule 4.3) — this data moves at the pace of match resolutions, not live scores, so a 30-second poll would be wasted load for data that only changes a few times a day per group.

### Rules

- **Any future dashboard aggregating data across multiple group members must go through one set-based RPC, never one query per widget or per row.** The H2H matrix's single self-join is the reference pattern — precompute every row the frontend could plausibly need in one pass, and let the frontend index into an already-fetched payload instead of re-fetching per interaction.
- **Never filter a resolution-gated query on a literal `matches.status = 'FT'` string.** Use `predictions.is_resolved = true` (or the equivalent resolution flag on the table in question) — it is the actual authoritative boundary this codebase already trusts everywhere else, and `'FT'` alone silently excludes AET/PEN matches.
- **A diverging color scale must never be a literal red↔green gradient.** Check whether the codebase's existing "green" and "orange"/"red" tokens are already a CVD-safe hue pair (as GoalBet's ice-blue/red-pink accents are) before reaching for a generic traffic-light palette.
- **Every heatmap-style chart cell must be direct-labeled.** Color alone is never a legal encoding of the value on this project — a WARN-band cell (low sample size, low contrast at a ramp's pale end) obligates a visible label or a table-view fallback, not a color-only cell.
- **New OKLCH design tokens read live via `getComputedStyle`, never hardcoded as a second copy of the same numbers in JS.** `lib/oklch.ts` is the pattern to follow for any future hand-rolled color interpolation.
- **A chart may only model data it wasn't given (e.g. a Gaussian from mean/stddev instead of raw samples) when the underlying RPC deliberately withheld the raw data for a real reason (here: privacy).** State the modeling choice in a code comment where it happens — never let a modeled curve look indistinguishable from a real empirical one without saying so.
