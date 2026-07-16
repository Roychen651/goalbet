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
31. [Fluid Morphing & Depth (V4 Sprint 16)](#31-fluid-morphing--depth-v4-sprint-16)
32. [The Sensory Immersion (V4 Sprint 17)](#32-the-sensory-immersion-v4-sprint-17)
33. [The Dopamine Cannon (V4 Sprint 18)](#33-the-dopamine-cannon-v4-sprint-18)
34. [The Live Center — Home & Match Cards Overhaul (V4 Sprint 19)](#34-the-live-center--home--match-cards-overhaul-v4-sprint-19)
35. [The Tactile Slip — Bet Form & Sliding Drawer Overhaul (V4 Sprint 20)](#35-the-tactile-slip--bet-form--sliding-drawer-overhaul-v4-sprint-20)
36. [The Prestige Standings — Leaderboard & Group Tables Overhaul (V4 Sprint 21)](#36-the-prestige-standings--leaderboard--group-tables-overhaul-v4-sprint-21)
37. [The Hall of Fame — Interactive Profile & Identity Overhaul (V4 Sprint 22)](#37-the-hall-of-fame--interactive-profile--identity-overhaul-v4-sprint-22)
38. [The Active Inbox — Mobile Notifications & Navigation Overhaul (V4 Sprint 23)](#38-the-active-inbox--mobile-notifications--navigation-overhaul-v4-sprint-23)
39. [The Native Tongue — Absolute Localization & Gender Contexts (V4 Sprint 24)](#39-the-native-tongue--absolute-localization--gender-contexts-v4-sprint-24)
40. [The Interactive Almanac — Bento User Guide & Accessibility (V4 Sprint 25)](#40-the-interactive-almanac--bento-user-guide--accessibility-v4-sprint-25)
41. [The Bulletproof Pipeline — Pre-Match Validation & Fallbacks (V4 Sprint 26)](#41-the-bulletproof-pipeline--pre-match-validation--fallbacks-v4-sprint-26)
42. [The Source of Truth — Deep League Stats & Interactive Team Sheets (V4 Sprint 27)](#42-the-source-of-truth--deep-league-stats--interactive-team-sheets-v4-sprint-27)
43. [The Dynamic Orchestrator — League Registry & Tiered Polling (V4 Sprint 28)](#43-the-dynamic-orchestrator--league-registry--tiered-polling-v4-sprint-28)
44. [Deep-Data Schema Evolution — Team Stats Archive & Retroactive Backfill (V4 Sprint 29)](#44-deep-data-schema-evolution--team-stats-archive--retroactive-backfill-v4-sprint-29)

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
│       │   │   ├── ActivityFeed.tsx       # The Locker Room feed — renders group_events. PREDICTION_LOCKED/WON_COINS/LEADERBOARD_CLIMB use the timeline-dot glass card; AI_BANTER (Sprint 10) AND MICRO_BANTER (V4 Sprint 14) both render via the same AiBanterCard — rotating conic-gradient border, dark glass panel, gradient "AI Scout" identity + Sparkles avatar + "AI" pill, lang-aware text. V4 Sprint 24 — PREDICTION_LOCKED/WON_COINS/LEADERBOARD_CLIMB's hand-rolled slash-notation strings ("נעל/ה", "לקח/ה", "טיפס/ה") replaced with tg() calls against the acting user's GroupEvent.gender
│       │   │   ├── CreateGroupModal.tsx
│       │   │   ├── InviteCodeDisplay.tsx
│       │   │   ├── JoinGroupModal.tsx
│       │   │   ├── MomentumBanner.tsx      # V4 Sprint 14 — breathing conic-gradient banner in LockerRoomPage when the active group has a live open/locked micro-prediction question. Countdown via useCountdown (useLiveClock-shaped isolated re-render — never touches LockerRoomPage/ActivityFeed). Tap opens MomentumBetSheet while open. Once locked: shows a live mm:ss countdown to `resolves_at` (not a static "Locked" label — added post-Sprint-15 after watching a real live match sit static for 10 minutes), dims to opacity-70 with a Lock icon swapped in for the pulsing Zap, and the button itself is `disabled` — betting is structurally closed at that point (§29), and the dim+lock cue exists specifically so that disabled state reads as intentional, not broken (a real bug report otherwise)
│       │   │   └── MomentumBetSheet.tsx    # V4 Sprint 14 — swipe-to-close bottom sheet (rule 4.13), Yes/No choice buttons, haptic('selection') on tap + haptic('success') on confirmed submission
│       │   ├── layout/
│       │   │   ├── AppShell.tsx           # Root layout + ONLY place for auto-sync + cold-start isSyncing flag
│       │   │   ├── BottomNav.tsx          # Mobile bottom navigation
│       │   │   ├── ErrorBoundary.tsx      # Class component — catches render errors, shows bilingual fallback
│       │   │   ├── NotificationCenter.tsx # Bell dropdown (desktop/Sidebar) + full-height mobile slide-over drawer (V4 Sprint 23, `placement="drawer"`). Swipe-to-dismiss rows (Toast.tsx's drag config), inline "View Match"/"View Standings" CTAs deep-linking into HomePage/LeaderboardPage
│       │   │   ├── Sidebar.tsx            # Desktop sidebar. `<NotificationCenter placement="right" .../>` — untouched by Sprint 23's drawer work. V4 Sprint 25 — a new circular glassmorphic `?` help button (between the notif-bell and coin-balance blocks) — the sidebar had zero help affordance anywhere before this; `openModal('helpGuide')`, same global modal store TopBar's own help button already used
│       │   │   └── TopBar.tsx             # Mobile header: logo, group selector, coins, avatar. `<NotificationCenter placement="drawer" .../>` (V4 Sprint 23) — TopBar is already `sm:hidden`, so the drawer is implicitly mobile-only. V4 Sprint 25 — the pre-existing help button converts to `motion.button` with `whileTap` only (no `whileHover` — this row is inside a touch-primary `sm:hidden` header)
│       │   ├── leaderboard/
│       │   │   ├── H2HModal.tsx           # Head-to-head comparison (tap another user's row)
│       │   │   ├── LeaderboardRow.tsx     # Own row → history modal; other row → H2H modal (unchanged, V4 Sprint 21). Row itself also gets a separate chevron toggle for a lightweight in-place preview (streak/accuracy recap + last-5 bet-slip mini team-badge pairs, lazy-fetched only on expand), a per-row sparkline next to the username, a weekly rank-delta badge (color via lib/oklch.ts's interpolateDiverging, never hardcoded), and a breathing gold halo (Framer Motion, reduced-motion aware) behind the #1 avatar
│       │   │   ├── LeaderboardRowSparkline.tsx # V4 Sprint 21 — per-row trend line reusing smoothPath() (lib/svgPath.ts). Deliberately static/no draw-on (a leaderboard can render many simultaneously, unlike Sparkline.tsx's single Profile-page instance); slope-driven color (ice-blue up / warm orange down)
│       │   │   ├── LeaderboardTable.tsx   # V4 Sprint 21 — rows get `layout` + a shared LayoutGroup so a sort-order change animates rows sliding to their new position (FLIP) instead of a silent re-render. Owns `expandedUserId` state for the row-preview chevrons. V4 Sprint 23 — `initialHighlightUserId?: string | null` prop seeds `expandedUserId` on mount, fed by LeaderboardPage's `?highlight` deep link
│       │   │   └── UserMatchHistoryModal.tsx  # Bottom sheet — swipe-to-close enabled
│       │   ├── profile/
│       │   │   ├── AvatarPicker.tsx       # Emoji avatar chooser
│       │   │   ├── HallOfFameChronicles.tsx # Sprint 27 — 3D-tilt gold/crimson carousel of user_chronicles (perfect +10 on high-profile matches); returns null when empty
│       │   │   ├── ProfileBentoV2.tsx     # Stats bento grid; hero card renders the live <Sparkline> points trajectory (Sprint 9) + NumberFlow-rolled total
│       │   │   ├── RiskRadarChart.tsx     # V4 Sprint 22 — pure trigonometric SVG spider/radar chart (5 axes at 72° intervals, no charting library). Labels render via `<foreignObject>` + a real truncating `<div>`, not raw SVG `<text>` — the fixed viewBox/box-width/radius constants were solved together and verified numerically against the worst-case axis angle, then confirmed against an actual Playwright screenshot (caught a real label-clipping bug pixel-math alone hadn't). SVG root pins `direction: 'ltr'`; text alignment is derived purely from `cos(theta)`'s sign, never an `isRTL` branch — the exact double-flip class of bug PredictionHeatmap.tsx shipped once (Sprint 15)
│       │   │   ├── ShareableRecapCard.tsx # V4 Sprint 11 — swipe-to-close bottom sheet showing rank/points/streak preview (reuses useLeaderboard, zero new query); Share button draws the actual shareable asset via lib/shareCard.ts's Canvas primitive, then the 3-tier share fallback (file-share → text-share → clipboard+download)
│       │   │   └── TrophyCabinet.tsx      # V4 Sprint 22 — 6 badges computed on the fly from data already on ProfilePage (same honesty class as LeaderboardRow.tsx's existing inline badgeHot/badgeSniper pills — un-persisted, no unlock timestamp; a real persisted achievement-unlock system is a separate, out-of-scope backend feature, see §37). Each badge is its own `GlassCard tactile` (no `allowGyroscope` — a grid of simultaneously-tilting cards is the exact motion-sickness case Sprint 16 scopes gyroscope away from) with a hand-drawn glowing inline SVG icon; locked badges render dimmed with a lock indicator, never hidden
│       │   ├── matches/
│       │   │   ├── MatchCard.tsx          # ACTIVE card: MatchCardCore (private) + MatchCard (public, shimmer wrapper). isPastKickoffNS, DELAYED, live clock, weather/referee/competition phase, TacticalIntelSection, dual dark/light league logos, live breathing glow, goal flash, score flip. HT broadcast ticker via HTAnalystCard. V4 Sprint 19 — non-live cards use GlassCard variant='elevated' (was 'default') + `grain` + `edgeGradient` for real depth; TeamBlock renders a `teamHaloColor`-driven radial-gradient halo behind each badge (`isolate` wrapper + `-z-10`); score + live-clock digits are `font-mono tabular-nums` (was `font-bebas`) for CLS stability; live-clock badge uses `.live-clock-pulse-green`/`-amber` (compositor CSS keyframes, not Framer Motion); red-card badge cluster fixed from a literal `-right-1` to logical `-end-1`. V4 Sprint 23 — `autoFocus?: boolean` prop (a notification's "View Match" deep link): expands the card + `scrollIntoView` once on mount only, never re-triggers on a later prop change. V4 Sprint 26 — `TeamBlock`'s badge and both league-logo `<img>` variants render via `<EntityBadge>` instead of `onError → display:none` (which just left a blank gap on a failed load); `hashSeed`/localized-name split threaded through exactly like the existing `haloKey` pattern so a badge's fallback gradient/initials never flip on a language toggle
│       │   │   ├── MatchFeed.tsx          # Date-grouped feed; imports MatchCard directly. V4 Sprint 23 — `focusMatchId?: string | null` prop threaded down through `MatchCardItem` to whichever `MatchCard` matches, as `autoFocus`
│       │   │   ├── MatchMomentumPulse.tsx # V4 Sprint 19 — "Attack Event Pulse": compressed 10-minute inline SVG marker timeline (goals/cards, sparse + recency-weighted opacity — deliberately NOT a smoothed "momentum" curve, since ESPN's soccer feed has no shot/possession data per minute to back one). Rendered in MatchCard's expanded body for `isLive` matches only. `direction: 'ltr'` pinned on the SVG root regardless of page direction (x-axis is elapsed-time data, not reading direction). Polls every 30s via `lib/espnEvents.ts`'s shared fetcher, matching MatchStats.tsx's cadence. `React.memo`'d against match-reference equality — relies on `mergeMatches`' existing identity-preservation (§22) so its own poll never invalidates the parent feed
│       │   │   ├── MatchRosters.tsx       # Starting XI + substitutes fetched from ESPN; feeds TacticalPitch
│       │   │   ├── MatchStats.tsx         # Post-match statistics (possession, shots, corners, etc.)
│       │   │   ├── MatchStatusBadge.tsx   # Status pill; intercepts DELAYED→SYNCING during cold-start
│       │   │   ├── MatchTimeline.tsx      # ESPN summary events (returns null when no data). V4 Sprint 19 — its `MatchEvent` type + `fetchEspnEvents()` were extracted to `lib/espnEvents.ts` (shared with MatchMomentumPulse.tsx); this component still gates its own call to FT-only matches
│       │   │   ├── TacticalPitch.tsx      # Glass tactical formation view for Starting XI; horizontal pitch with percentage-based positioning
│       │   │   ├── PredictionCardDesktop.tsx # V4 Sprint 20 — desktop (≥640px) counterpart to PredictionModal.tsx's Vaul drawer. Vaul has no centered-dialog mode, so this is a small, separate Framer Motion scale+fade dialog reusing PredictionForm exactly like the drawer does; PredictionForm itself has zero awareness of which shell it's in
│       │   │   ├── PredictionModal.tsx    # Mobile prediction sheet — Vaul (`vaul` npm package, iOS-grade drag physics/velocity dismiss/scroll-aware), NOT a hand-rolled Framer drag="y". V4 Sprint 20 — Drawer.Content reuses the card-elevated CSS class + .glass-grain texture (deeper blur, same tokens GlassCard's 'elevated' variant uses); max-h swapped from 88vh to 85dvh so the clamp tracks the real visible viewport as iOS/Android browser chrome collapses. Switches to PredictionCardDesktop.tsx above the sm: breakpoint (useMediaQuery)
│       │   │   └── PredictionForm.tsx     # 5-tier prediction input; corners hidden for league 4396. V4 Sprint 20 — tier chips are debossed (sunken, neutral shadow) when unselected vs. embossed (inner light-catch + tier-colored glow + `-translate-y-px` lift) when selected, replacing the flat 1px-border look; squish stays the Sprint 18 CSS-only active:scale-95 + cubic-bezier mechanism (never per-instance Framer springs — CLAUDE.md §33 already rules on why for this exact high-repetition component), tuned to 250ms. The coin cost/balance numbers use NumberFlow; a Risk Meter bar (gold→warning OKLCH, `interpolateRisk`) reflects the already-computed cost/balance ratio — a live gauge, never a draggable stake input (GoalBet's coin cost is fixed per tier selection, not discretionary — see §35). Tier-chip taps pair `haptic('selection')` with `playSound('toggle_click')`; a successful submit plays `playSound('lock_thud')` (not `coin_chime`, which already means "you received coins" elsewhere). Post-Sprint-20 hotfix — Exact Score's two fields are `ScoreStepper` (+/- tap buttons with a spring digit-flip), not `<input type="number">`: the native number keyboard opening inside Vaul's `position:fixed` sheet resized the visual viewport and made the whole sheet visibly jump on a real phone. A stepper has no focusable text field, so no keyboard can ever attach — see the new Common Pitfalls entry in §21. V4 Sprint 25 — `TIER_COLORS`/`DEBOSS_SHADOW` moved out to `lib/tierVisuals.ts` (module-private here before, now a shared export) the moment the new Bento Almanac's Tier Ledger card needed the same 5-color system; this file re-imports with zero visual diff. V4 Sprint 26 — the Corners tier is now always present in the array (was conditionally spread out entirely for `LEAGUES_WITHOUT_CORNERS` leagues); `cornersDisabled` = the static set **or** `match.corners_supported === false` (migration 048), fails open on `null`/`undefined`. `TierRow` gains `disabled`/`disabledTooltip` (dims the row, surfaces the reason via `InfoTip` — never a silently-missing tier); `CornersPicker` gains a real `disabled` prop (genuine HTML attribute, not a no-op handler). A `useEffect` clears a stale `cornersValue` if the tier flips disabled after a pick was already made, so resubmitting another tier doesn't get blocked by migration 049's RPC guard
│       │   ├── stats/
│       │   │   ├── BentoArena.tsx         # V4 Sprint 15 — "My Arena" tab root. Responsive Bento Grid (1-col mobile, 4-col sm+), Framer Motion staggered spring entrance (staggerChildren 0.06, stiffness 100/damping 15), useReducedMotion short-circuit. Fed by useStatsArena (single RPC, no per-card fetch); hero/streak/risk tiles are NumberFlow-animated numbers, Heatmap/Distribution/H2H slots render PredictionHeatmap/GroupDistributionChart/H2HMatrix. V4 Sprint 16 turns on `tactile` (+ `allowGyroscope` on the hero card only) on every GlassCard. V4 Sprint 18 wraps the Streak tile's NumberFlow in `<CelebrationManager>` — see §33
│       │   │   ├── CelebrationManager.tsx # V4 Sprint 18 — the focused win-celebration orchestrator, mounted around BentoArena's Streak tile. Consumes useNewPointsAlert() unmodified as its sole trigger (no new Realtime subscription). See §33 for the full sequence (spotlight dim → pulse ring → celebrateAt() confetti → conditional NumberFlow replay)
│       │   │   ├── ExpandedH2HView.tsx    # V4 Sprint 16 — createPortal-rendered full match-by-match H2H history, morphs in from H2HMatrix's collapsed panel via a shared Framer Motion layoutId (`h2h-panel-${opponent_id}`). Fed by migration 045's match_details array — zero new network call
│       │   │   ├── GroupDistributionChart.tsx # V4 Sprint 15 — "emphasis" chart: one muted-gray Gaussian curve modeling the group (RPC only exposes mean/stddev, never individual stakes — the curve is a modeled normal distribution, not a fake empirical one) + one glowing accent marker at the caller's own z-score position. Reuses lib/svgPath.ts's smoothPath
│       │   │   ├── H2HMatrix.tsx          # V4 Sprint 15 — scroll-snap opponent-picker rail (data-lenis-prevent) that re-indexes into the already-fetched h2h_matrix array — zero network calls per switch. NumberFlow-animated points/shared-matches/record comparison + a 3-segment win/tie/loss bar. V4 Sprint 16 — wrapped in a `LayoutGroup`; a `Maximize2` button (shown only when `hasHistory`) morphs the collapsed panel into `<ExpandedH2HView>` via the shared `layoutId`
│       │   │   ├── LeagueDropdown.tsx     # Custom animated dropdown; dual dark/light ESPN league logos; data-lenis-prevent so inner wheel-scroll works inside Lenis; layoutId-backed active bar
│       │   │   ├── LeagueLeaders.tsx      # V4 Sprint 27 — "Player Leaders Hub": rebuilt from a static two-column Scorers/Assists layout into a 3-way sub-nav (Scorers/Assists/Discipline, shared-layoutId pill morph — same technique as HomePage's Segmented Snapper, §34) driving a single micro-glass card list. Each row: rank, EntityBadge player-photo badge (gradient-initials fallback for any missing/broken ESPN headshot) with a small EntityBadge team-badge overlay, name, team + match count, stat value + unit. A category with zero rows is hidden from the sub-nav entirely
│       │   │   ├── PredictionHeatmap.tsx  # V4 Sprint 15 — hand-built inline SVG League x Bet-Type grid. Diverging OKLCH color per cell via lib/oklch.ts (not CSS color-mix), every cell direct-labeled with its %, contrast-aware label ink, diagonal-hatch + "n/a" for sample_size < 3, RTL-aware column/label mirroring + clipPath guard on long league names, "view as table" accessible fallback, hover/focus detail line
│       │   │   ├── PulseFeed.tsx          # V4 Sprint 27 — "The Pulse Feed": contextual league news as premium low-opacity Bento cards (GlassCard's existing `grain` + `interactive` spotlight-glare props, no new visual primitive) that brighten on hover. Thumbnail images get their own onError fallback to a Newspaper glyph. Hidden entirely when there's no news — same "hidden until real data exists" convention as MatchTimeline/AIScoutCard/HallOfFameChronicles. Fed by useLeagueNews, `active` prop gates fetching to only the Leagues sub-tab (never World Cup's custom view or My Arena)
│       │   │   ├── StandingsTable.tsx     # League standings table (rank, team, P/W/D/L, GF/GA/GD, pts) — real `<table>`, ESPN team data, not GoalBet users. V4 Sprint 21 — rows are `motion.tr` with `layout` + a shared LayoutGroup so a standings shuffle after a sync animates teams sliding to their new rank; no bet-slip/sparkline/rank-delta (those are GoalBet-user concepts that don't apply to a team row). V4 Sprint 27 — "Interactive Team Sheets": clicking a row expands in place (LeaderboardRow's parent-owned expandedId + AnimatePresence pattern, §36, adapted to valid `<table>` markup via a sibling `<tr><td colSpan>` panel row, never nested inside the data row's own `<tr>`), revealing a Form Guide (last 5 results, color-coded W/D/L chips — Hebrew נ/ת/ה) and Team Stats (goals/match from gf/gp already in hand; corners/clean-sheets/cards from the new lazy useTeamForm hook). Team-logo `<img>` swapped for EntityBadge (a live gap — it previously had zero onError fallback)
│       │   │   └── WorldCupBracket.tsx    # Custom "Route to the Trophy" view for World Cup (league 4480). Tri-Host Aurora (Mexico #00FF87 + USA #00E5FF + Canada #FF004D blurred blobs, mix-blend: screen) + broadcast grain overlay on the root wrapper. Parallax hero (useScroll/useTransform on confetti, halo, trophy watermark) with brutalist hollow "2026" behind content — aurora-gradient fill reveals on scroll. Floating glass pill navigation (sticky, rounded-full, dark glass backdrop-blur-xl). 4 tabs: groups/fixtures/knockouts/venues. Groups: FIFA rank + seed pot indicators, GroupCard enters with 3D rotateX perspective. Fixtures: gold "Predict" button with toast teaser. Knockouts: Framer Motion accordion on mobile, 9-column symmetric bracket on desktop (BracketTreeCard compact grid / BracketMatchCard full-detail mobile). FinalApex: rotating sunburst, floating particles, gradient champion text. Venues: mobile scroll-snap carousel, desktop masonry grid (marquee venues span 2 cols), StadiumCard enters with 3D rotateX perspective + backdrop-blur glass. Pure Framer Motion + useScroll
│       │   └── ui/
│       │       ├── Avatar.tsx             # Expects emoji:🏆 prefix
│       │       ├── EntityBadge.tsx         # V4 Sprint 26 — generalizes Avatar.tsx's image-error → fallback state machine for team/league badges. Renders a plain CSS gradient `<div>` (never inline SVG `<linearGradient>` defs — a match feed can show dozens of badges at once, and unique gradient IDs would collide), hue/initials hashed via `hashTeamHue` (lib/oklch.ts, exported this sprint) off a `hashSeed` kept deliberately separate from the display `name` — the same haloKey-style fix already applied once to `teamHaloColor()` (Sprint 24), here from the start
│       │       ├── CoinGuide.tsx          # Bottom sheet — swipe-to-close enabled
│       │       ├── CoinHistoryModal.tsx   # Bottom sheet — swipe-to-close enabled. TYPE_CONFIG renders by coin_transactions.type (not raw description text) — join_bonus/daily_bonus/bet_placed/bet_won plus V4 Sprint 14's micro_prediction/micro_prediction_won/micro_prediction_refund, each own icon+label
│       │       ├── CoinIcon.tsx           # Animated coin SVG icon with configurable size
│       │       ├── EmptyState.tsx         # Reusable empty-state placeholder
│       │       ├── FadeInView.tsx         # Wrapper: fade-in on mount via Framer Motion
│       │       ├── GlassCard.tsx         # V4 Sprint 15 added an optional `grain` prop — overlays the .glass-grain feTurbulence texture (generalized from World Cup's .wc-grain). Only wraps children in an extra `relative z-10` div when grain is on, so every other call site is untouched. V4 Sprint 16 adds `tactile`/`allowGyroscope` props — attaches useTactileTilt's ref across all three render branches; content gets the same `relative z-10` treatment whenever `tactile` is on (same stacking-order fix as `grain`). V4 Sprint 19 adds `edgeGradient` — a single `::before` mask-composite:exclude pseudo-element giving a true variable-opacity gradient border; sets `border-transparent` alongside it so the real 1px border and the gradient ring don't double up
│       │       ├── HelpGuideModal.tsx     # Bottom sheet — swipe-to-close enabled. V4 Sprint 25 — "The Interactive Almanac": the old 4-tab strip is retired for a `grid-cols-1 sm:grid-cols-2` Bento Grid (4 cards: Game Loop connector w/ tap-to-expand steps, canonical Tier Ledger sourced from `POINTS`/`COIN_COSTS`, Coin Economy w/ ambient CSS coin-drift, FAQ accordion). CSS Grid auto-mirrors card order under RTL with zero `isRTL` code (verified against a real Hebrew render, §40). The FAQ accordion is capped to its own `sm:max-h-[320px]` + internal `sm:overflow-y-auto` so an expanding item never grows the shared grid row and drags a sibling card's height with it. `max-h-[90dvh] sm:max-h-[82dvh]` (was `vh`). All 3 new interactive surfaces pair `haptic('selection')` + `playSound('toggle_click')` via a shared `tapFeedback()` helper
│       │       ├── HTAnalystCard.tsx      # Sprint 27 — broadcast-TV lower-third for live HT tactical read; rotating red/amber/cyan conic border + pulsing red LIVE badge + word-by-word typewriter reveal. Returns null when text is empty
│       │       ├── InfoTip.tsx            # Tooltip using CSS vars (works in both themes)
│       │       ├── LangToggle.tsx         # V4 Sprint 17 — same haptic('toggle_click') + playSound('toggle_click') pairing as ThemeToggle.tsx
│       │       ├── LoadingSpinner.tsx
│       │       ├── MagneticButtonV2.tsx   # Magnetic pull button; variants: volt / ghost / purple. V4 Sprint 18 — `whileTap` upgraded from a flat `{ scale: 0.96 }` to `{ scale: 0.95, rotate: -0.5, transition: { spring, stiffness: 500, damping: 15 } }` for a genuine elastic overshoot feel
│       │       ├── MatchCardSkeleton.tsx  # Premium cold-start loader (pulse + shimmer). Exports MatchCardSkeleton + MatchCardSkeletonList
│       │       ├── NeonButton.tsx         # Variants: green / ghost / danger. V4 Sprint 18 — converted to `motion.button` with the same elastic `whileTap` as MagneticButtonV2; `NeonButtonProps` omits `onAnimationStart`/`onDrag*` from `ButtonHTMLAttributes` since those React DOM handler signatures clash with Framer Motion's own
│       │       ├── PolicyModal.tsx
│       │       ├── PushToggle.tsx         # Sprint 8 — self-hiding match-reminder toggle (Settings). Renders nothing when Web Push unsupported / VAPID key unset; shows "add to home screen" hint on iOS Safari; enable/disable button on installed PWA + desktop/Android
│       │       ├── ScoringGuide.tsx       # Bottom sheet — swipe-to-close enabled
│       │       ├── Sparkline.tsx          # Sprint 9 — pure-SVG area+line micro-chart, zero chart-library dependency. Catmull-Rom smoothed path (smoothPath extracted to lib/svgPath.ts in Sprint 15 so GroupDistributionChart shares the same spline math), Framer Motion pathLength draw-on, colour via CSS vars (theme-fluid), useReducedMotion aware, CLS-stable fixed-height box + dashed baseline when data is insufficient
│       │       ├── FormBars.tsx           # Sprint 9 — last-N points-per-match bars (colour = outcome, height = magnitude), spring grow-in, reduced-motion aware
│       │       ├── StaggerList.tsx        # Wrapper: staggered child animations
│       │       ├── SyncProgressBar.tsx    # Fixed top bar; visible while isSyncing; z-[100]
│       │       ├── ThemeToggle.tsx        # V4 Sprint 17 — onClick fires haptic('toggle_click') + playSound('toggle_click') before the theme flips
│       │       ├── TiltCardV2.tsx         # 3° tilt with spring physics for profile bento cards
│       │       ├── TiltModeToggle.tsx     # V4 Sprint 16 — self-hiding gyroscope opt-in toggle in Settings, mirrors PushToggle.tsx's shape exactly. Hidden entirely when isTiltSupported() is false; requestTiltPermission() must be called from this real tap (iOS 13+ gate)
│       │       ├── Toast.tsx              # V4 Sprint 17 — full rewrite: stacked (AnimatePresence mode="popLayout" + layout), swipeable-to-dismiss (drag="x", same threshold pattern as bottom sheets), icon+color resolved per toast type via OKLCH color-mix against the arena tokens. uiStore.ts's public API (addToast/removeToast/Toast type) is unchanged — this is a render-layer rewrite only
│       │       └── WelcomeAnimation.tsx   # First-login welcome sequence
│       ├── hooks/
│       │   ├── useAuth.ts                 # Legacy Google OAuth (kept for backward compat)
│       │   ├── useAuthV2.ts               # Auth-v2 state machine (8 views)
│       │   ├── useCoinRollFeedback.ts     # V4 Sprint 17 — fires 4 haptic('coin_roll') sub-pulses spread across 600ms (matching the coin NumberFlow's transformTiming) on any coins increase. Wired ONLY into TopBar.tsx, deliberately not also Sidebar.tsx — both are simultaneously mounted (CSS-toggled by breakpoint), wiring both would double-fire per real deposit
│       │   ├── useCountdown.ts            # V4 Sprint 14 — same isolated local-state/setInterval shape as useLiveClock, ticks whole seconds remaining until an expiry timestamp; drives MomentumBanner without re-rendering LockerRoomPage
│       │   ├── useGroupEvents.ts          # Locker Room activity feed subscriber. event_type union includes MICRO_BANTER (V4 Sprint 14) alongside AI_BANTER; user_id is string | null (both AI event types have no owning user). V4 Sprint 24 — profiles join now also selects gender, threaded through GroupEvent for ActivityFeed's tg() calls
│       │   ├── useGroupMatchPredictions.ts
│       │   ├── useLeaderboard.ts
│       │   ├── useLeagueStats.ts          # V4 Sprint 27 — rewritten on real TanStack `useQuery`s (was hand-rolled useState/useEffect/AbortController). Exports useLeagueStats(leagueId) (standings+leaders, pass null to skip — used for custom-view leagues like World Cup), useTeamForm(leagueId, teamId) (Interactive Team Sheets — `enabled` only once a standings row is actually expanded), useLeagueNews(leagueId, active) (The Pulse Feed — `enabled` only when the Leagues sub-tab is genuinely open). All three share one `staleTime: 15min, gcTime: 15min` constant (this sprint's caching mandate) and each preserves its pre-migration `{ data, loading, error }` return shape so zero call sites needed to change
│       │   ├── useLiveClock.ts            # Ticking clock for live matches
│       │   ├── useMatches.ts              # Fetches + Realtime + goalbet:synced listener
│       │   ├── useMatchSync.ts            # Manual sync ONLY (Settings button) — 60s timeout
│       │   ├── useMicroPrediction.ts      # V4 Sprint 14 — active group's live open/locked micro-prediction question + caller's own bet, group_id-filtered Realtime, submitBet() mirrors usePredictions.ts's optimistic-then-authoritative-reconcile shape. Gained (post-Sprint-15): resolves_at on the question row (feeds MomentumBanner's locked-phase countdown) + a Realtime subscription on micro_prediction_bets UPDATE that fires the won/refund toast + haptic the moment settleBets() resolves the caller's own bet — previously a win only showed up as the top-bar coin count silently changing. V4 Sprint 17 adds a bet-lock "snap": haptic('bet_lock') + playSound('lock_thud') when a question the caller has a stake in flips open→locked
│       │   ├── useNewPointsAlert.ts       # Toast on newly earned points since last visit
│       │   ├── useNotifications.ts        # Persistent notifications feed subscriber. V4 Sprint 23 — fetch filters `dismissed_at IS NULL` (migration 046); `dismiss(id)` optimistically removes the row locally and stamps `dismissed_at`/`is_read` server-side so a swiped-away notification never reappears
│       │   ├── usePredictions.ts          # TanStack Query mutation wrapping submit_prediction (V4 Sprint 11) — single RPC call, no separate client upsert to predictions
│       │   ├── useStatsArena.ts           # V4 Sprint 15 — TanStack Query wrapper around get_stats_arena_payload (migration 044). staleTime ~2min, deliberately outside AppShell's auto-sync (rule 4.3) since this data moves at the pace of match resolutions, not live scores. V4 Sprint 16 (migration 045) — ArenaH2HRow gains match_details: ArenaH2HMatchDetail[], feeding ExpandedH2HView. V4 Sprint 18 — CelebrationManager calls queryClient.invalidateQueries({queryKey: ['statsArena']}) on a detected win to nudge the 2-min staleTime fresh
│       │   ├── useTactileTilt.ts          # V4 Sprint 16 — zero-re-render 3D pointer tilt. Writes --tilt-x/--tilt-y/--glare-x/--glare-y directly via el.style.setProperty inside a RAF-throttled pointermove handler — no setState in the hot path. Capability-gated once per mount ((hover:hover) and (pointer:fine)); falls back to deviceorientation (beta/gamma delta against a captured baseline) only when allowGyroscope is true and hover isn't available. No-ops entirely under prefers-reduced-motion
│       │   ├── useWorldCupMatches.ts       # Fetches all synced league-4480 rows (+ realtime) for the WC bracket live overlay
│       │   ├── useMediaQuery.ts           # V4 Sprint 20 — tiny matchMedia wrapper. Query strings should match Tailwind's own breakpoints (e.g. '(min-width: 640px)' for `sm:`) so it never becomes a second, drifting definition of a breakpoint alongside the CSS
│       │   └── useRTLDirection.ts         # Sets document.dir from active language
│       ├── lib/
│       │   ├── authSchema.ts              # Password validation: strength, requirements, error mapping
│       │   ├── celebrate.ts               # canvas-confetti wrapper (an existing dependency — the app's only chart/particle library, kept out of the "no charting library" rule since it's decorative, not data-viz). celebratePrediction()/celebrateWin() are fixed screen-edge bursts; V4 Sprint 18 adds celebrateAt(el) — same engine, origin derived from el's own getBoundingClientRect() converted to viewport-fraction coordinates, so the burst originates from a specific card instead of the screen edges. All three set disableForReducedMotion: true
│       │   ├── constants.ts               # FOOTBALL_LEAGUES, LEAGUE_ESPN_SLUG, POINTS, COIN_COSTS, ROUTES. V4 Sprint 24 — FOOTBALL_LEAGUES gains a `nameHe` field per league (extends the existing single source of truth, not a parallel leagues.json); tLeagueName(leagueId, fallbackName, lang) looks up by the stable internal league_id rather than translating the raw `matches.league_name` string
│       │   ├── dictionaries/
│       │   │   └── teamsHe.ts              # V4 Sprint 24 — tTeam(espnName): normalized-key Hebrew team-name dictionary (full top-flight rosters of all 5 major leagues, the full EFL Championship + Spanish Segunda División since domestic cups pull tier-2 clubs into the feed constantly, 60+ national teams). Keyed via teamNameUtils.ts's normalizeTeamName() so ESPN spelling variants ("Man City" vs "Manchester City") still resolve. Falls back to the original English name when uncovered — deliberately partial where a cup draw could pull in one of England's 70+ non-Championship clubs, genuinely unbounded — never blank, never throws
│       │   ├── featureFlags.ts            # Feature flag registry (currently no active flags)
│       │   ├── haptics.ts                 # Vibration API wrapper, safe no-op where unsupported. V4 Sprint 17 adds toggle_click/bet_lock/coin_roll patterns, paired 1:1 by name with lib/sensoryAudio.ts's synthesized SFX
│       │   ├── i18n.ts                    # EN + HE translations, TranslationKey type. V4 Sprint 24 adds Gender type + tg(t, base, gender) — resolves `${base}_male`/`${base}_female`/`${base}_unspecified` as ordinary typed TranslationKeys, a thin addition to this hand-rolled system, not real i18next (no such dependency exists in this codebase). Missing/null gender always resolves to `_unspecified`, never a silent `_male` default
│       │   ├── espnEvents.ts               # V4 Sprint 19 — MatchEvent type + fetchEspnEvents(), extracted out of MatchTimeline.tsx so it and MatchMomentumPulse.tsx share one ESPN keyEvents parser instead of duplicating ~150 lines. No status restriction of its own — callers decide when to fetch (MatchTimeline: FT-only; MatchMomentumPulse: live-only)
│       │   ├── oklch.ts                    # V4 Sprint 15 — hand-crafted OKLCH interpolation for the heatmap's diverging scale. interpolateDiverging(ratio) linearly lerps L/C/H (shortest-path hue lerp) between the --arena-cold/mid/hot anchors, read live via getComputedStyle at call time — the tokens in index.css stay the single source of truth, never duplicated as hardcoded numbers here. Deliberately not CSS color-mix(): a discrete color + its resolved lightness (for contrast-aware label ink) are both needed per cell. V4 Sprint 19 adds teamHaloColor(name) — a deterministic name-hash → OKLCH hue for match-card "brand halos", since no team primary-color field exists anywhere in this codebase (only a per-league accent) and ESPN's soccer competitor objects don't reliably expose one either. V4 Sprint 20 adds interpolateRisk(ratio) — a plain two-stop lerp (not diverging around a midpoint like interpolateDiverging) between --risk-gold/--risk-warning (index.css, deliberately separate tokens from --arena-cold/hot — "risk" and "performance" are different meanings), driving PredictionForm's Risk Meter. V4 Sprint 26 — `hashTeamHue` exported (was module-private) so `EntityBadge.tsx`'s fallback gradient shares the exact same hash `teamHaloColor()` already uses, instead of a second implementation
│       │   ├── push.ts                     # Sprint 8 — Web Push client: getPushStatus() / enablePush() / disablePush(); VAPID key gate; iOS-non-standalone detection (checked BEFORE apiSupported so iPhone Safari shows the install hint, not nothing)
│       │   ├── queryClient.ts             # TanStack Query client (refetchOnWindowFocus off — AppShell owns sync)
│       │   ├── sensoryAudio.ts             # V4 Sprint 17 — synthesized zero-asset SFX via Web Audio API oscillator/gain nodes on one lazily-created AudioContext. unlockAudio() must be called from a real user-gesture handler (autoplay policy — App.tsx's first pointerdown listener does this, once, then removes itself); playSound('toggle_click' | 'coin_chime' | 'lock_thud') schedules a tone thereafter. No <audio> elements, no binary assets, no network request
│       │   ├── shareCard.ts                # V4 Sprint 11 — zero-dependency shareable recap card. drawRecapCard() hand-draws rank/points/streak to an offscreen Canvas (same philosophy as Sparkline.tsx — no html2canvas/html-to-image); colors resolved from live CSS custom properties via getComputedStyle at draw time so the PNG matches the active theme; RTL handled explicitly (ctx.direction + right-anchored text). shareRecapCard() is the 3-tier fallback: navigator.share with a file → navigator.share text-only → clipboard copy + explicit PNG download
│       │   ├── supabase.ts                # Supabase client (anon key) + all TypeScript table types. V4 Sprint 24 — Profile Row type gains `gender: 'male'|'female'|'unspecified'` (migration 047). V4 Sprint 26 — Match Row type gains `corners_supported: boolean | null` (migration 048)
│       │   ├── svgPath.ts                  # V4 Sprint 15 — smoothPath() (Catmull-Rom → cubic Bézier) extracted from Sparkline.tsx so every hand-built SVG chart shares one spline implementation. Sparkline.tsx and GroupDistributionChart.tsx both import it
│       │   ├── teamNameUtils.ts            # V4 Sprint 24 — normalizeTeamName(name, aliases): the lowercase/de-accent/alpha-only folding function, extracted out of WorldCupBracket.tsx's local normTeam()/TEAM_ALIASES the moment a second consumer (dictionaries/teamsHe.ts) needed the identical folding. WorldCupBracket.tsx keeps its own national-team alias table locally — only the normalization function itself moved, so the WC alias table and a club-team alias table never collide
│       │   ├── tierVisuals.ts              # V4 Sprint 25 — TIER_COLORS (5-entry canonical color/shadow array) + DEBOSS_SHADOW, extracted out of PredictionForm.tsx (was module-private) the moment the Bento Almanac's Tier Ledger card needed the same 5-color system as a second, context-free consumer. Index order here is always canonical (Result/Score/Corners/BTTS/Over-Under) — V4 Sprint 26 made PredictionForm.tsx's own per-match `tiers` array match this same fixed order too (the Corners tier used to be conditionally spread out of the array entirely, shifting every later index; it's now always present, just conditionally `disabled`)
│       │   ├── tiltPermission.ts           # V4 Sprint 16 — requestTiltPermission() / isTiltSupported(), mirrors lib/push.ts's shape exactly. Gates iOS 13+'s DeviceOrientationEvent.requestPermission() behind a real tap (TiltModeToggle.tsx)
│       │   ├── utils.ts                   # calcBreakdown() (client-side scoring mirror), cn(). V4 Sprint 24 — formatKickoffTime() takes a `lang` param, using 'he-IL'/'en-US' Intl locale formatting (was `undefined`/browser-default, which silently showed English weekday/month names and day/hour/minute countdown units to Hebrew users regardless of app language). V4 Sprint 27 — timeAgo(iso, t) extracted out of components/groups/ActivityFeed.tsx the moment a second consumer (PulseFeed.tsx's news timestamps) needed the identical relative-time formatting; same "extract on the second real consumer" precedent as lib/espnEvents.ts (Sprint 19) / lib/teamNameUtils.ts (Sprint 24)
│       │   └── worldCup2026.ts            # Static FIFA WC 2026 data: 12 groups, R32/R16/QF/SF/3rd/Final with dates + FIFA match numbers + venueId, 16 host stadiums, tournament phases. Consumed by WorldCupBracket
│       ├── pages/
│       │   ├── admin/
│       │   │   └── AdminDashboardPage.tsx # Bento grid KPIs + system health actions
│       │   ├── AuthCallbackPage.tsx       # Handles Supabase OAuth redirect
│       │   ├── HomePage.tsx               # Match feed — All / Upcoming / Live / Results tabs. V4 Sprint 19 — the tab bar is a scroll-snap segmented control (`data-lenis-prevent`) with a single `layoutId="activeTabPill"` motion.div (shared `LayoutGroup`) morphing between whichever tab is active, instead of each pill owning its own background. V4 Sprint 23 — reads `?focus=<match_id>` once via a lazy `useState` initializer (not a reactive `searchParams` read — `matches` loads asynchronously and the target `MatchCard` may not mount for several renders), defaults the active tab to `'completed'` since a `prediction_result` notification only ever fires post-resolution
│       │   ├── LeaderboardPage.tsx        # Group standings with H2H modal. V4 Sprint 23 — reads `?highlight=<user_id>` the same lazy-init way, seeding `LeaderboardTable`'s `initialHighlightUserId`
│       │   ├── LockerRoomPage.tsx         # Group activity feed (WON_COINS, predictions, etc.)
│       │   ├── LoginPage.tsx              # Thin wrapper — redirect if logged in, render AuthContainer
│       │   ├── ProfilePage.tsx            # Stats, prediction history, sign-out button
│       │   ├── SettingsPage.tsx           # Group mgmt, leagues, admin tools, Account section. `<TiltModeToggle />` added after `<PushToggle />` (V4 Sprint 16). V4 Sprint 24 — `GenderSelector` in the Account card: 3-option tactile segmented control reusing PredictionForm.tsx's Sprint-20 emboss/deboss chip language verbatim; `truncate` + `min-w-0` on each chip (RTL guard — the longest Hebrew label degrades to an ellipsis on a narrow viewport instead of overflowing)
│       │   └── StatsPage.tsx              # Two sub-tabs (V4 Sprint 15): "Leagues" — LeagueDropdown + StandingsTable + LeagueLeaders for ESPN-backed leagues, WorldCupBracket for custom-view tournaments (CUSTOM_VIEW_LEAGUES set, currently World Cup 4480); "My Arena" — BentoArena, the personal/group stats dashboard (§30)
│       └── stores/
│           ├── authStore.ts               # user, profile, session; signInWithGoogle, signOut. V4 Sprint 24 — updateGender() mirrors updateUsername()'s direct-client-write shape exactly (profiles is already owner-writable under existing RLS, no new RPC)
│           ├── coinsStore.ts              # coins; synced from DB. V4 Sprint 12 — initCoins() is a plain balance fetch (no longer claims the daily bonus, which pg_cron deposits proactively). App.tsx's AppInitializer effect pairs it with a group_id-filtered Realtime subscription (group_members UPDATE → re-fetch; coin_transactions INSERT with type='daily_bonus' → coin_drop haptic + toast) so an online user sees a midnight deposit live
│           ├── groupStore.ts              # groups[], activeGroupId; persisted to localStorage
│           ├── langStore.ts               # lang ('en'|'he'); persisted to localStorage
│           ├── themeStore.ts              # theme ('dark'|'light'); persisted to localStorage
│           ├── tiltStore.ts               # V4 Sprint 16 — gyroscopeEnabled; persisted to localStorage
│           └── uiStore.ts                 # activeModal, toasts[], isSyncing; memory only
│
├── backend/
│   └── src/
│       ├── cron/
│       │   └── scheduler.ts               # Startup catch-up + 30s score poller + daily/weekly crons + every-2-min match-reminder cron (Sprint 8) + every-3-min AI Provocateur batch (Sprint 10) + every-30-min streak-expiry warning (V4 Sprint 12) + every-5s Momentum Bets lock sweep + every-15s resolution sweep (V4 Sprint 14) — each interval-guarded against overlap the same way as the original 30s live poller (livePollerRunning-style booleans). V4 Sprint 26 — daily 00:35 UTC job (30 min after the midnight match sync) refreshing corners_supported flags; this signal only moves over days, never seconds, so it's deliberately off every tighter cadence already in this file. V4 Sprint 28 — `guarded(label, fn)` closure factored out of the 3 hand-rolled re-entrancy booleans this file used to carry one at a time (§43); the old flat 30s live poller is now two tiered intervals (Tier-1 30s, Tier-2 90s, both calling `checkAndUpdateScores(tierFilter)`); a new 10-min `refreshEspnLeagueMap()` interval, plus a startup-catch-up call to it (first, before the startup sync) so a fresh boot never runs against a stale fallback map longer than it has to
│       ├── lib/
│       │   ├── batch.ts                   # V4 Sprint 28 — `processBatched<T>(items, fn, options?)`: fixed-size (default 5) concurrent batches via `Promise.allSettled`, batches run strictly sequentially with a polite 500ms gap between them (never within one). Replaces unbounded sequential loops in `matchSync.ts`/`scoreUpdater.ts`; reused verbatim by `backfillTeamStats.ts` (V4 Sprint 29) for its own bulk historical re-fetch
│       │   └── supabaseAdmin.ts           # Supabase client with service-role key (bypasses RLS)
│       ├── middleware/
│       │   ├── rateLimiter.ts             # express-rate-limit: global 60/min + per-route scores 20/min, matches 10/min
│       │   └── syncAuth.ts                # X-Sync-Key guard for internal cron routes; 403 + fail-closed + constant-time compare
│       ├── routes/
│       │   ├── admin.ts                   # DELETE /api/admin/users/:id · POST /api/admin/reset-password
│       │   ├── health.ts                  # GET /api/health → { status: 'ok' }
│       │   ├── stats.ts                   # GET /api/stats/:leagueId (standings+leaders) · GET /api/stats/:leagueId/team/:teamId/form (V4 Sprint 27 — Interactive Team Sheets) · GET /api/stats/:leagueId/news (V4 Sprint 27 — The Pulse Feed)
│       │   └── sync.ts                    # Public (browser, rate-limited): POST /api/sync/matches · /scores. Internal (X-Sync-Key): POST /api/sync/internal/matches · /internal/scores. Handlers shared
│       ├── scripts/
│       │   ├── backfillTeamStats.ts       # V4 Sprint 29 — `npm run backfill:team-stats` (`--since=<date>`, `--path=a`). Two paths: A (red_cards, zero ESPN calls, pure DB-to-DB copy) + B (corners/yellow_cards/raw_stats, live ESPN re-fetch via `fetchMatchTeamStatsFromSummary`, batched via `lib/batch.ts`). See §44
│       │   ├── manualSync.ts              # npm run sync — dev helper
│       │   └── seed.ts                    # npm run seed — populates dev data
│       └── services/
│           ├── aiProvocateur.ts           # Sprint 10 — runProvocateurBatch(): reads conflicting H2H picks on a just-kicked-off match + group standings, generates EN+HE banter via the shared Groq client (callGroq, exported from aiScout.ts), posts one AI_BANTER group_event per (group, match). Skips no-conflict matches; fires only at/after kickoff (never pre-lock — Sprint 2 privacy). V4 Sprint 24 — PickRow carries a gender field; each pick line in the Hebrew prompt gets a bracketed [זכר]/[נקבה]/[לא ידוע] tag since one banter can name multiple users with different genders — SYSTEM_HE instructs per-name conjugation from each tag
│           ├── aiScout.ts                 # AI Scout (Sprint 26) + HT Read/Chronicles (Sprint 27) — see §22/§23. callGroq() is exported for reuse by aiProvocateur.ts AND microBanter.ts (V4 Sprint 14) — the single Groq client every AI feature funnels through. V4 Sprint 24 — Chronicler's Hebrew prompt (generateChronicleText) had hardcoded the masculine verb ("ניחש") for every user regardless of who they were; now selects the picker's own gender and picks the correct verb (ניחש/ניחשה), honest "ניחש/ה" slash fallback for unspecified. Pre/post-match insight and HT-read generation are untouched — neither ever references the reader or a specific user
│           ├── espn.ts                    # ESPN API client + LEAGUE_ESPN_MAP. V4 Sprint 28 — `LEAGUE_ESPN_MAP` changed from a literal to `{ ...FALLBACK_LEAGUE_MAP }` (leagueRegistry.ts), plus exported `refreshEspnLeagueMap()`. V4 Sprint 29 — `DBMatchWithClock` gains `home_stats_raw`/`away_stats_raw`/`home_corners`/`away_corners`/`home_yellow_cards`/`away_yellow_cards`, all read from data already being fetched (zero new ESPN calls); `getStat()` extracted from a local closure to module scope for its second real consumer; new exported `fetchMatchTeamStatsFromSummary(externalId, leagueId)` reuses the `summary?event=` pattern for the retroactive backfill script. See §44
│           ├── leagueNews.ts               # V4 Sprint 27 — "The Pulse Feed": getLeagueNews(leagueId), proxies ESPN's JSON news endpoint (not RSS/XML — no parsing library needed). Best-effort field extraction (headline/description/images[0].url/links.web.href) following the well-established ESPN site-API news-article convention — unverifiable from this sandbox (see stats.ts's LeaderRow.photo comment), so every field degrades gracefully. 15-min in-process cache
│           ├── leagueRegistry.ts           # V4 Sprint 28 — `FALLBACK_LEAGUE_MAP` (the exact 15-entry literal `LEAGUE_ESPN_MAP` used to be), `getLeagueTier(leagueId)` (defaults `'standard'`), `refreshLeagueRegistry(targetMap)` — mutates `targetMap`'s keys in place (CommonJS: every importer holds a reference to the SAME object; reassigning the binding would only be visible inside `espn.ts` itself). A failed/empty registry read never clears the map — always leaves the last good read (or the fallback) untouched. See §43
│           ├── leagueStatCapability.ts     # V4 Sprint 26 — refreshCornersSupportFlags(): thin scheduler-facing wrapper around compute_corners_support() (migration 048's SQL function does the actual set-based aggregation + upsert). Same shape as every other cron-invoked service (streakGuardian.ts, momentumBets.ts) — logs and returns on failure, never throws
│           ├── matchSync.ts               # syncLeague(id), syncAllActiveLeagues(). V4 Sprint 28 — the sequential per-league loop in syncAllActiveLeagues() replaced with lib/batch.ts's processBatched(). V4 Sprint 29 — upsertMatches() explicitly destructures the 6 new match_team_stats-only fields out before building the `matches` upsert row (a real bug caught in this sprint's own verification: the old `{ ...m }` spread would have sent them as unknown columns); new upsertTeamStats() writes 2 rows per match into match_team_stats, called right after the matches upsert succeeds, deliberately non-throwing. See §44
│           ├── microBanter.ts              # V4 Sprint 14 — triggerMicroBanter(): fires the instant a Momentum Bets question locks (called from momentumBets.ts, fire-and-forget). Reuses callGroq; posts MICRO_BANTER group_events (own dedup index, NOT aiProvocateur's AI_BANTER one — see migration 042). AI generates commentary only, never the question or its resolution
│           ├── momentumBets.ts             # V4 Sprint 14 — In-Play Micro-Predictions lifecycle, separate from scoreUpdater.ts (pure DB-state sweeps, no ESPN calls). lockExpiredMicroQuestions() (5s cadence): atomic per-question claim, stamps locked_at + a score baseline — this is what makes the arbitrage fix real, not just a comment. resolveLockedMicroQuestions() (15s cadence): score-delta resolution against the baseline, or cancel+refund if match data is unavailable. settleBets() claims each bet via settled_at IS NULL — same atomic-claim shape as resolveMatchPredictions — so a crash mid-loop is safely retried regardless of the question's own status
│           ├── pointsEngine.ts            # PURE scoring function — no DB calls, fully testable
│           ├── pushSender.ts              # Sprint 8 — sendMatchReminders(): 15-min pre-kickoff Web Push to ALL opted-in members of groups where the league is active; prunes dead subs (404/410); stamps matches.reminder_sent_at. No-op unless VAPID_* env set. sendPushToUser() (V4 Sprint 11) is the general single-user send, extracted from the same send+prune logic — reused by scoreUpdater's rank-drop notifications and streakGuardian.ts
│           ├── scoreUpdater.ts            # Resolves predictions after FT, writes leaderboard + coins + streak (current_streak/best_streak, Sprint 8). V4 Sprint 11 adds a per-invocation RankTracker + flushRankDropNotifications() (batch before/after rank diff, one push per user per run — see §27). V4 Sprint 14 adds generateMilestoneQuestions() (kickoff/halftime/minute-75 detection, hooked in right before the FT/ET/live branching). V4 Sprint 24 — flushRankDropNotifications() selects the overtaker's gender alongside username, stashed in notifications.metadata.overtaker_gender. V4 Sprint 28 — exported `resolveEffectiveTier(leagueId, leaguesWithLiveMatch)` (live-match promotion checked FIRST and unconditionally, always wins over base tier — a bug where this order was reversed was caught and fixed during this sprint's own verification, before shipping); `checkAndUpdateScores(tierFilter?)` filters the per-league ESPN-fetch loop only, never the corners re-score/catch-up passes. See §43
│           ├── sportsdb.ts               # DBMatch type definition (legacy, kept for types)
│           ├── stats.ts                   # League Stats — getLeagueStats(leagueId) (standings + top scorers/assists, 5-min cache). V4 Sprint 27 — LeaderRow gains a best-effort `photo` field (athlete.headshot.href); fetchLeaders() gains a third "Discipline" (yellowCardsLeaders) category alongside scorers/assists. New getTeamForm(leagueId, teamId) (Interactive Team Sheets) — deliberately reuses the SAME ESPN scoreboard endpoint + competitor.statistics[] field names (wonCorners/redCards) already proven live in espn.ts's match-sync pipeline rather than guessing at an unverified new endpoint shape; 15-min cache
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

Migrations live in `supabase/migrations/`. Current sequence: **001 → 051** (024 does not exist).
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
| `045` | **H2H match details (V4 Sprint 16):** `CREATE OR REPLACE` on `get_stats_arena_payload` (same signature as 044, same established extend-in-place pattern as 040) — the H2H CTE gains a new `JOIN matches m ON m.id = p1.match_id` and each opponent row's `match_details` field is populated with a `jsonb_agg(...)` of every shared match (kickoff time, league, teams, scores, both users' predicted scores, both users' points earned), ordered newest-first. Feeds `ExpandedH2HView.tsx`'s morphing full-history panel — zero new network call, the detail was already inside the one RPC round trip. Idempotent. |
| `046` | **Notification Dismiss (V4 Sprint 23):** adds `notifications.dismissed_at TIMESTAMPTZ` (`ADD COLUMN IF NOT EXISTS`, idempotent). Distinct from `is_read` — the mobile drawer's swipe-to-dismiss gesture stamps this so a dismissed notification never reappears on the next fetch. No new index — the existing `(user_id, created_at DESC)` index already covers the fetch query; Postgres filters `dismissed_at` post-index-scan at this table's per-user scale. |
| `047` | **Profile Gender (V4 Sprint 24):** adds `profiles.gender TEXT CHECK (gender IN ('male','female','unspecified')) DEFAULT 'unspecified' NOT NULL` (`ADD COLUMN IF NOT EXISTS`, idempotent). Drives `tg()`'s gendered copy across notifications, the Locker Room feed, and AI-generated text (Provocateur banter, Chronicler sagas). No new RLS policy — `profiles`' existing owner-write policy already covers this column; `authStore.updateGender()` is a direct client write, same shape as the existing `updateUsername()`, no new RPC. |
| `048` | **Corners Stat-Capability Flag (V4 Sprint 26):** adds `matches.corners_supported BOOLEAN` (nullable tri-state — `NULL` = not enough resolved matches yet to judge) + `compute_corners_support()`, a `SECURITY DEFINER` SQL function computing the flag per-league from that league's own FT-match history (≥80% non-null `corners_total` across ≥10 resolved matches), denormalized onto every match row for that league (including future NS ones) so the frontend gets it for free on the existing matches fetch. Service-role only, never `GRANT`ed to `authenticated`. Idempotent. |
| `049` | **`submit_prediction()` Corners Guard (V4 Sprint 26):** `CREATE OR REPLACE` on `submit_prediction()` (same signature as migration 040) adding one check — reject a non-null `predicted_corners` when `matches.corners_supported IS FALSE` — alongside the pre-existing league-4396 check. Server-side backstop for `PredictionForm.tsx`'s client-side disabled state, per this codebase's standing "never trust a client-side guard alone for a coin-spending RPC" rule (§11/§27). Depends on migration 048's column existing first. Idempotent. |
| `050` | **League Registry (V4 Sprint 28):** `league_registry` table (`id`, `espn_slug`, `display_name`/`display_name_he`, `espn_logo_id` nullable, `priority_tier` CHECK IN `('live_tier1','standard','low_frequency')` DEFAULT `'standard'`, `enabled`, timestamps) — public read, service-role-only write, no client INSERT/UPDATE/DELETE policy. Idempotent seed of the current 15 ESPN-covered leagues, tier assignments mirroring `LEAGUE_ESPN_MAP`'s real production usage (top-5 leagues + UCL as `live_tier1`; cups/Europa/Conference/Nations League/World Cup as `standard`; friendlies/qualifiers as `low_frequency`). League 4467 (Euro Championship) deliberately NOT seeded — no working ESPN slug today. Index on `(enabled, priority_tier)`. See §43. |
| `051` | **Deep-Data Schema (V4 Sprint 29):** `match_team_stats` (full raw ESPN `competitor.statistics[]` archive per team per match in `raw_stats` JSONB, plus promoted `corners`/`red_cards`/`yellow_cards` typed columns, `UNIQUE(match_id, team_side)`) — the first place the real per-team corners split is captured, since `matches.corners_total` is an irreversible home+away sum. `player_match_stats` — schema placeholder only, not populated by this migration or the free ESPN sync worker (no free ESPN endpoint exposes player match-log data); exists so a future paid data source has zero migration lead time. Both: public read, service-role-only write. Idempotent. See §44. |

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
| `tiltStore.ts` | `gyroscopeEnabled` | localStorage | V4 Sprint 16 — opt-in flag for `GlassCard`'s `allowGyroscope` prop; set via `TiltModeToggle.tsx` after a successful `requestTiltPermission()` |

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
- **A hand-built SVG chart embedded under an RTL ancestor must pin `direction: 'ltr'` on its own `<svg>` root.** Per spec, SVG's `text-anchor="start"/"end"` are relative to the *inherited* CSS `direction`, not physical position. `BentoArena.tsx` sets `dir="rtl"` on its grid root for Hebrew (rule below), which cascades into any nested `<svg>` — a component doing its own `isRTL ? 'end' : 'start'` mirroring (assuming physical anchoring, the natural assumption) gets that mirroring reinterpreted a second time on top of the inherited flip, and the two cancel out wrong. This shipped once (Sprint 15's `PredictionHeatmap.tsx`) and pushed every row label almost entirely off the visible canvas in Hebrew while looking perfect in English — exactly the kind of bug a screenshot in one language and confidence in the other both miss. Pin `direction: 'ltr'` on the SVG root so the component's own coordinate math is the sole source of RTL-awareness, immune to whatever direction its DOM ancestors are in. Applies to any future hand-built SVG chart, not just this one.
- **A live match's stats panel must re-fetch periodically while the match is live, never fetch once and freeze.** `MatchStats.tsx` originally fetched ESPN's boxscore exactly once, the instant the panel was first expanded (a `fetchedRef` guard) — if that happened early, before ESPN's boxscore stats had populated (they lag a little behind the raw score), the displayed possession/shots/corners froze at 0 for the rest of the match. This surfaced live in production (a real user on a real match) before it was caught. The fix: re-fetch every 30s while the panel is open and `match.status` is in `LIVE_STATUSES`, matching the app's existing live-poll cadence elsewhere — and critically, only the *initial* fetch shows the loading skeleton; background refreshes swap the numbers in place so a 30s poll doesn't flash the skeleton over stats already on screen.
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
- **A `disabled` interactive element must look disabled, not just behave disabled.** `MomentumBanner`'s tap target was correctly `disabled` once a Momentum Bets question locks (betting is structurally closed — §29), but nothing visually distinguished that from the live, tappable state: same full brightness, same urgent pulsing icon. Reported live as "it just appeared and isn't clickable" — a real, confusing bug from the user's side even though the underlying logic was already correct. The fix was purely visual (`opacity-70`, `cursor-default`, swap the pulsing `Zap` icon for a static `Lock`), not a logic change. Any future disabled-but-still-rendered interactive element needs its own visual affordance, not just an HTML `disabled` attribute the user can't see.
- **Check for an existing dependency before building a new subsystem to avoid one.** Sprint 18's blueprint called for a hand-rolled `Float32Array` particle-physics confetti component to keep the "zero new dependencies" discipline intact. Reading the actual code first found `canvas-confetti` already installed and already in use (`lib/celebrate.ts`'s `celebratePrediction`/`celebrateWin`, live since an earlier sprint) — building a second, parallel particle engine would have been *more* code and *more* risk for a goal ("no new dependency") that was already satisfied. `celebrateAt(el)` reuses the same engine with a computed origin instead. Verify the dependency graph before assuming a "zero-dependency" constraint requires new code — sometimes it's already met.

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

### Addendum — closing the "went silent" gaps (post-Sprint-15)

Two gaps surfaced by watching a real live match end-to-end, both closed in the same pass:

1. **Locked phase went completely static for up to 10 minutes.** `MomentumBanner` originally just showed a fixed "Locked — good luck" label the entire wait. It now runs a second `useCountdown` keyed to `question.resolves_at` (the fixed `[locked_at, locked_at+10min)` outcome window from the arbitrage-fix design above) and shows a live `mm:ss` — real information, not a static placeholder, and free of any new backend call since `resolves_at` was already computable.
2. **A resolved bet had zero in-app acknowledgment.** Once a question resolves, its row stops matching `useMicroPrediction`'s `open`/`locked` filter and the banner simply vanishes — a win previously only showed up as the top-bar coin count silently changing, no toast, no haptic, nothing in The Locker Room. `useMicroPrediction.ts` now also subscribes to `micro_prediction_bets` `UPDATE` filtered on the caller's own `user_id`; the moment `settled_at` lands, it fires `momentumWonToast`/`momentumRefundToast` (+ `haptic('success')` on a win). Silent on a genuine loss (`is_winner === false`) — a loss toast every ~10 minutes per active bet would be noise, the same restraint the main prediction economy already applies.

A later live report ("it just appeared and isn't clickable") found a third, purely visual gap in the same banner — see the new Common Pitfalls entry in §21 ("A `disabled` interactive element must look disabled, not just behave disabled").

### Rules

- **Any future time-windowed betting mechanic must measure its outcome window from lock time, never open time.** This is the structural arbitrage fix — re-derive it from first principles before assuming a tighter server clock check is sufficient.
- **A coin-spending RPC never wraps its uniqueness-guarding INSERT in `ON CONFLICT DO NOTHING` if a prior step already moved money.** Let the constraint violation raise and roll back the whole transaction; suppressing it silently strands the side effect.
- **Settlement of a batch of financial records (bets, payouts, refunds) must claim each record individually (`settled_at`-style), never gate the whole batch behind a single parent-row status flip.** A crash mid-batch must leave unprocessed records safely retryable — see the design note above for exactly why this matters.
- **`MICRO_BANTER` and `AI_BANTER` are visually identical but must never share a dedup index.** They key on different granularities (per-question vs. per-match) for a structural reason, not a stylistic one.
- **AI never generates the question or determines its resolution — only the commentary after the outcome is already mechanically known.** This applies to every future in-play mechanic, not just this one: an LLM must never touch anything that moves coins.
- **A failed coin-spending RPC call must surface its actual reason code to the UI, never a single generic message.** `submit_micro_prediction()` always returned a specific reason (`question_closed`, `already_bet`, `insufficient_coins`, ...) on failure, but `MomentumBetSheet.tsx` discarded it and showed the same "Could not place bet" toast regardless of cause — reported live, on a real match, completely undiagnosable from the user's side or a screenshot. `question_closed` (the 60-second window elapsing between opening the sheet and tapping — a real risk given the window is intentionally short by structural design, §29 above) and `already_bet` are two completely different situations for a user to be in; map each RPC reason to its own translated message. This applies to every coin-spending RPC's client-side error handling, not just this one.

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

### The "premium libraries / GSAP" request — and why the answer was no new dependencies

Mid-sprint, the explicit ask was to drop the zero-bundle-bloat constraint entirely: add GSAP and "the most premium" design/font/motion libraries for a more expensive-feeling result. Before touching anything, this was checked against two things: what specifically felt insufficiently premium (motion, typography, or both — answer: both, plus general polish), and whether page-load weight still mattered given the tradeoff (answer: yes, still a priority). With that confirmed, the actual work went into Framer Motion — already the `vendor-framer` bundle chunk before this sprint started, so pushing it harder costs nothing new — rather than adding GSAP. Verified after: zero new vendor chunk in the build output; the affected chunk grew by ~0.05 KB gzip, all from JSX/motion config, not a library.

What "premium, motion-and-typography-first, zero-new-KB" looked like in practice: `GlassCard`'s cursor-tracking spotlight glare (`interactive` prop) was already built in an earlier sprint and simply never turned on for these cards — turning it on was a real visual upgrade for zero new code. A shared `CardHeader` (gradient icon badge + gradient text-clip title) reuses the exact visual grammar `ActivityFeed`'s `AiBanterCard` already established (Sprint 10) instead of inventing a new one. The hero glow and the distribution marker's halo both gained a continuous breathing pulse (opacity/scale loop) so they don't go inert once the entrance spring settles. The H2H record bar's segments animate width on opponent switch instead of snapping. `haptic()` (already used throughout the app) was wired into every new interactive touchpoint — heatmap cells, the table-view toggle, opponent switching — for tactile consistency with the rest of the codebase.

**The general lesson: a request to "remove constraints" for a better result is a request to confirm, not a request to comply blindly.** The constraint being dropped (bundle size) was one this same conversation had set and cared about repeatedly (vendor chunking, route-level lazy loading, this very sprint's own "Strict Charting Law"). A two-question check before writing code — what dimension needs work, does the traded-off constraint still matter — took under a minute and avoided either guessing wrong on a large, hard-to-cheaply-reverse decision or reflexively refusing a legitimate ask to push further.

### Rules

- **Any future dashboard aggregating data across multiple group members must go through one set-based RPC, never one query per widget or per row.** The H2H matrix's single self-join is the reference pattern — precompute every row the frontend could plausibly need in one pass, and let the frontend index into an already-fetched payload instead of re-fetching per interaction.
- **Never filter a resolution-gated query on a literal `matches.status = 'FT'` string.** Use `predictions.is_resolved = true` (or the equivalent resolution flag on the table in question) — it is the actual authoritative boundary this codebase already trusts everywhere else, and `'FT'` alone silently excludes AET/PEN matches.
- **A diverging color scale must never be a literal red↔green gradient.** Check whether the codebase's existing "green" and "orange"/"red" tokens are already a CVD-safe hue pair (as GoalBet's ice-blue/red-pink accents are) before reaching for a generic traffic-light palette.
- **Every heatmap-style chart cell must be direct-labeled.** Color alone is never a legal encoding of the value on this project — a WARN-band cell (low sample size, low contrast at a ramp's pale end) obligates a visible label or a table-view fallback, not a color-only cell.
- **New OKLCH design tokens read live via `getComputedStyle`, never hardcoded as a second copy of the same numbers in JS.** `lib/oklch.ts` is the pattern to follow for any future hand-rolled color interpolation.
- **A chart may only model data it wasn't given (e.g. a Gaussian from mean/stddev instead of raw samples) when the underlying RPC deliberately withheld the raw data for a real reason (here: privacy).** State the modeling choice in a code comment where it happens — never let a modeled curve look indistinguishable from a real empirical one without saying so.

---

## 31. Fluid Morphing & Depth (V4 Sprint 16)

Three commits, all Bento Arena-scoped: a zero-re-render 3D pointer-tilt primitive, a shared-element ("morphing") transition pilot for the H2H card, and a strictly opt-in gyroscope fallback for touch devices. The throughline across all three is the same one from Sprint 15: reuse Framer Motion (already loaded) and plain DOM/CSS custom properties, never a new dependency.

### `useTactileTilt.ts` — tilt without re-rendering React

The naive implementation of "tilt the card toward the cursor" is `useState` + `onMouseMove` — a `setState` on every pixel of pointer movement, re-rendering the card (and, if not memoized carefully, its children) dozens of times a second. `useTactileTilt.ts` instead writes `--tilt-x` / `--tilt-y` / `--glare-x` / `--glare-y` **directly onto the element's own `style`** via a ref, inside a `requestAnimationFrame`-throttled `pointermove` handler. React's render cycle never enters the hot path at all. The element's bounding rect is measured once per hover session (`pointerenter`), not re-read on every `pointermove` — cheap and correct, since a card's position doesn't change mid-hover.

Capability-gated **once per mount**, not per event: `(hover: hover) and (pointer: fine)` — a real mouse, not a touchscreen or coarse pointer. Falls back to `deviceorientation` (beta/gamma delta against a captured baseline) only when the caller explicitly opts in via `allowGyroscope` **and** hover isn't available (see the gyroscope section below for why this is opt-in, not automatic). `will-change` is set on `pointerenter` and cleared on `pointerleave` so the browser doesn't keep a compositing layer alive for cards nobody is currently hovering. Fully no-ops under `prefers-reduced-motion`.

`.tactile-tilt` (`index.css`) reads those custom properties: `transform: perspective(900px) rotateX(var(--tilt-x,0deg)) rotateY(var(--tilt-y,0deg))` plus a CSS `transition` so the card eases back to flat on pointer-leave without any JS-driven spring. `.tactile-tilt::after` is a radial-gradient glare tracking `--glare-x`/`--glare-y`, using `var(--arena-glow)` (the same OKLCH token from Sprint 15 — no new color introduced).

`GlassCard.tsx` gained `tactile?: boolean` and `allowGyroscope?: boolean` props, attaching `tiltRef` across all three of its render branches. Content gets the same `relative z-10` treatment whenever `tactile` is on — the tilt-driven glare is a positioned, positive-z-index overlay, so plain static children would otherwise paint underneath it per normal CSS stacking order (the identical class of bug the `grain` prop hit in Sprint 15, fixed the same way). `BentoArena.tsx` turns `tactile` on for all 6 cards; `allowGyroscope` is passed **only** to the hero card, not the whole grid (see below).

### H2H morphing portal — the `layoutId` shared-transition pilot

The H2H comparison panel (`H2HMatrix.tsx`) now morphs into a full match-by-match history view (`ExpandedH2HView.tsx`) instead of the summary card being the only detail ever available. This is the pilot for Framer Motion's `layoutId` shared-element pattern in this codebase — deliberately **not** applied to `MatchCard`'s existing accordion-expand system in the same sprint. That's a separate, mature, already-working system on the single most-trafficked surface in the app; retrofitting `layoutId` onto it is its own sprint with its own regression risk, not something to bundle silently into an unrelated stats-tab feature.

Backend: migration 045 extends `get_stats_arena_payload` (`CREATE OR REPLACE`, the same established in-place-extension pattern as migration 040 building on 020/021) — the H2H CTE gains a `JOIN matches m ON m.id = p1.match_id` and each opponent row's new `match_details` field is a `jsonb_agg(...)` of every shared match (kickoff time, league, both teams, both scores, both users' predicted scores, both users' points), newest-first. This is the actual detail `ExpandedH2HView` renders — **zero new network round trip**, the data was already inside the one RPC call Sprint 15 established; it just wasn't being selected into the payload yet.

Frontend: `H2HMatrix.tsx`'s collapsed panel is wrapped in a `LayoutGroup`, carrying `layoutId={`h2h-panel-${opponent_id}`}`. A `Maximize2` button — shown only when `hasHistory` — swaps to `<ExpandedH2HView>`, which renders via `createPortal` into a new `#portal-root` div (added to `index.html` as a sibling of `#root`). The portal exists specifically to escape `GlassCard`'s `.tactile-tilt` `transform` — a CSS `transform` on an ancestor creates a new containing block for any `position: fixed` descendant, which would otherwise clip or mis-position the full-screen expanded view. `LayoutGroup` context propagates through `createPortal` even though the portaled DOM node physically lives elsewhere in the tree, so the container still morphs and the content still crossfades (delayed ~120ms so the shape-morph reads before the text swap) despite the two views not being DOM siblings.

### Gyroscope opt-in — strictly opt-in, strictly scoped

Gyroscope-driven tilt on touch devices was **not** made automatic, for two independent, real constraints flagged before any code was written:

1. **iOS 13+ gates `DeviceOrientationEvent` behind an explicit user-gesture permission prompt** (Apple's fingerprinting mitigation) — there is no silent path to gyroscope data on iOS. `lib/tiltPermission.ts`'s `requestTiltPermission()` must be called from a real tap; it mirrors `lib/push.ts`'s exact shape (`isTiltSupported()` / `requestTiltPermission()`).
2. **Gyroscope-driven tilt on an entire grid of cards is a real motion-sickness risk** for some users on a scrolling page — the Bento grid isn't a single hero object, it's six cards spread across the viewport. `allowGyroscope` is therefore wired to **only the hero card**, never the full grid, in `BentoArena.tsx`.

`tiltStore.ts` (new, Zustand, persisted) holds the single `gyroscopeEnabled` boolean. `TiltModeToggle.tsx` (Settings, mounted after `PushToggle`) mirrors `PushToggle.tsx`'s self-hiding shape exactly: renders nothing when `!isTiltSupported()`, shows the enable/disable button otherwise, requests permission on tap.

### Rules

- **A DOM-ref/CSS-custom-property tilt (or any per-frame visual effect) must never route through `setState`.** `useTactileTilt.ts` is the reference pattern — write to `element.style.setProperty` inside a RAF-throttled handler, let CSS `transform`/`transition` do the rendering, keep React's render cycle out of the hot path entirely.
- **A `layoutId` shared transition works through `createPortal`** — the portaled node doesn't need to be a DOM sibling of the source, only inside the same `LayoutGroup` context. Use a portal specifically when an ancestor's `transform` (tilt, drag, etc.) would otherwise break a `position: fixed` descendant's containing block.
- **A new interaction pilot (like `layoutId` morphing) belongs on a low-traffic surface first, not retrofitted onto a high-traffic, already-working system in the same sprint that introduces it.** Prove the pattern somewhere contained before touching `MatchCard`.
- **Any device-motion feature (gyroscope, accelerometer) gated behind a mobile Safari permission prompt must be triggered from a real tap, never programmatically on mount** — `requestTiltPermission()`/`requestPushPermission()`-style functions are the pattern; both live in a `lib/*Permission.ts` file with an `isXSupported()` companion.
- **Gyroscope-driven (or any ambient-motion-driven) visual effects must be opt-in and scoped, never automatic and grid-wide.** Motion sensitivity is a real accessibility concern distinct from `prefers-reduced-motion` (which the browser already reports) — a user who hasn't explicitly reduced motion may still not want six cards on a scrolling page all tilting with their phone's orientation.

---

## 32. The Sensory Immersion (V4 Sprint 17)

Three commits closing the audio and haptic layer: zero-asset synthesized sound effects, a from-scratch `Toast.tsx` rewrite (stacking, swipeable, themed — not a new library), and a coin-deposit audio-haptic orchestration pass that coalesces bursty Realtime events into one coherent moment instead of several overlapping ones.

### `lib/sensoryAudio.ts` — synthesized, not recorded

Three flagship micro-sounds — `toggle_click`, `coin_chime`, `lock_thud` — each synthesized entirely in code via a handful of Web Audio API oscillator/gain nodes scheduled on a single, lazily-created `AudioContext`. No `<audio>` elements, no binary assets, no network request, no licensing question — genuinely more "zero-weight" than a brief's own "keep pre-recorded files under 15KB each" mandate, since there is nothing to ship at all. (This environment also has no way to source or record real audio assets — synthesis was the honest alternative to fabricating placeholder files.) `coin_chime` is two sine tones a major sixth apart (1046.5 Hz + 1568 Hz); `lock_thud` is a falling sine sweep (90 Hz → 60 Hz); `toggle_click` is a 12ms square wave at 1800 Hz.

**Autoplay-policy compliance is the one hard constraint here.** Browsers refuse to start an `AudioContext` (or will start it suspended) without a preceding real user gesture. `unlockAudio()` must be — and only is — called from inside a genuine gesture handler: `App.tsx`'s `AppInitializer` attaches a one-time `pointerdown` listener on mount that calls `unlockAudio()` then immediately removes itself. Every later `playSound()` call reuses that same already-unlocked context. `playSound()` never lazily creates the context itself — that would silently fail (or throw) the first time it's called outside a gesture.

### `Toast.tsx` — a rewrite, not a library migration

The brief asked for stacking, exit animations, and swipe-to-dismiss — all three are Framer Motion features the app already loads, and every bottom-sheet modal in this codebase already uses the identical drag-to-dismiss gesture (rule 4.13). Reaching for a toast library (Sonner was the specific ask) would have made toasts the **one** overlay in the app following a different animation model from everything else, not just added bundle weight for no reason.

`AnimatePresence mode="popLayout"` + `layout` on each toast item handles the stack: as toasts are added/removed, siblings reflow with a spring rather than jump-cutting. Each `ToastItem` carries `drag="x"` + `dragConstraints={{left:0,right:0}}` with the same offset/velocity threshold pattern used by every swipe-to-close bottom sheet, so dismissing a toast feels identical to dismissing a modal. Icon and background color are resolved per toast type via `color-mix(in oklch, ${tone} 14%, var(--color-bg-card))` against the same `--arena-*`-family OKLCH tokens established in Sprint 15 — no new hardcoded hex anywhere. Positioning uses `start-1/2`/`sm:end-4`/`sm:start-auto` (logical properties, RTL-correct per rule 4.10). `uiStore.ts`'s public API (`addToast`, `removeToast`, the `Toast` type) is **unchanged** — this is a render-layer rewrite only, every existing call site kept working with zero edits.

### Haptic-audio pairing + the coin-deposit coalescing handler

`haptics.ts` gained three named patterns — `toggle_click`, `bet_lock`, `coin_roll` — paired 1:1 by name with `sensoryAudio.ts`'s synthesized SFX, an extension of the existing `PATTERNS` lookup rather than a rebuild. `useCoinRollFeedback.ts` (new) fires 4 `coin_roll` sub-pulses spread evenly across 600ms — matching the coin `NumberFlow`'s known `transformTiming` duration exactly — so the haptic reads as one continuous tactile "whir" synced to the digits visibly rolling, not a series of disconnected taps. Wired into `TopBar.tsx` **only**, deliberately not also `Sidebar.tsx`: both are simultaneously mounted (CSS-toggled by breakpoint, not conditionally rendered — see `AppShell.tsx`), so wiring both would double-fire the roll on every real deposit. Haptics are also meaningless on the desktop viewport `Sidebar` occupies anyway.

`App.tsx`'s `coin_transactions` Realtime INSERT handler generalizes from `type==='daily_bonus'`-only (Sprint 12) to **any** positive-amount deposit for the current user. Rather than a naive trailing debounce, it's a **coalescing window**: sound + haptic fire on the *leading* edge (the first deposit in a burst feels instant, not delayed behind a wait-and-see debounce), while the toast waits for the *trailing* edge (500ms) so it reports one true combined total instead of several "+X coins" toasts stacking when e.g. one sync tick resolves three predictions within a few hundred milliseconds of each other. This is the same batching philosophy as Sprint 11's `RankTracker` (§27) — accumulate through a window, emit once — applied to a different signal.

`useMicroPrediction.ts` gains a small "bet-lock snap": when a question the caller has an active stake in flips `open → locked`, it fires `haptic('bet_lock')` + `playSound('lock_thud')` — a mechanical, decisive cue for the moment the outcome window closes on a bet you placed.

### Rules

- **A synthesized (Web Audio) sound effect is a legitimate, often superior alternative to a pre-recorded asset** when the codebase has no way to source real audio — it ships literally 0 bytes of binary asset versus any file-size budget, and it's the honest choice over fabricating a placeholder.
- **`AudioContext` creation must happen inside a real user-gesture handler, once, and never be re-attempted lazily inside a sound-playing function.** `unlockAudio()` from a one-time `pointerdown` listener that removes itself is the pattern — autoplay policies will silently break (or throw on) any other approach.
- **A UI library ask (toast stacking/swipe, in this case) should first be checked against the animation primitives already loaded** (here, Framer Motion + the existing bottom-sheet drag pattern) before reaching for a new package — adding one when the existing tooling already covers the ask makes the new surface visually *inconsistent* with the rest of the app, not just heavier.
- **A haptic tied to an animated number roll (`NumberFlow`, odometers, etc.) should be several sub-pulses spread across the animation's own known duration, not one pulse at the value-change instant.** Reference: `useCoinRollFeedback.ts`'s 4-pulses-over-600ms, matched to the exact `transformTiming` the visual uses.
- **A hook wired into a component that's simultaneously mounted with a breakpoint-toggled sibling (e.g. `TopBar`/`Sidebar`) must be wired into exactly one of them, never both.** Both render at the same time (CSS visibility, not conditional mounting) — double-wiring double-fires any per-mount or per-effect side effect.
- **A bursty Realtime signal that should produce one user-facing acknowledgment (not several stacked ones) needs a coalescing window: immediate feedback on the leading edge, one batched summary on the trailing edge.** Never a naive debounce that delays even the first event's feedback — see `App.tsx`'s coin-deposit handler for the reference shape.

---

## 33. The Dopamine Cannon (V4 Sprint 18)

Three commits adding tactile/celebratory polish on top of Sprints 16–17's motion and sensory foundations: a card-scoped confetti burst, an elastic "overshoot" tap feel on the app's highest-signal buttons, and a focused win-celebration sequence on the Bento Arena's Streak tile.

### `celebrateAt()` — reusing `canvas-confetti`, not building a new particle engine

The original blueprint called for a hand-rolled `CanvasConfetti.tsx` — typed `Float32Array` particle state, gravity/drag/wind physics per frame, a `ResizeObserver`-sized canvas — specifically to preserve the "zero new dependencies" discipline this codebase has defended repeatedly (no GSAP in Sprint 15, no Sonner in Sprint 17). Reading the actual code first, before writing any of that, found `canvas-confetti` **already installed and already in use**: `lib/celebrate.ts`'s `celebratePrediction()`/`celebrateWin()` have been live since an earlier sprint. Building a second, parallel particle engine to avoid a "new" dependency that was already present would have been strictly worse — more code, more surface area, for a goal already met.

`celebrateAt(el)` was added to `lib/celebrate.ts` instead: same engine, same brand `COLORS` palette, same `disableForReducedMotion: true`, but the burst `origin` is computed from the target element's own `getBoundingClientRect()` converted to viewport-fraction coordinates — so the confetti visually originates from a specific card (the Streak tile) rather than `celebratePrediction`/`celebrateWin`'s fixed screen-edge origins.

### Tactile elastic tap — two tiers, split by repetition

**Tier A (Framer Motion, low-repetition/singular triggers):** `whileTap` upgraded from a flat `{ scale: 0.96 }` to `{ scale: 0.95, rotate: -0.5, transition: { type: 'spring', stiffness: 500, damping: 15 } }` — a genuine elastic overshoot instead of a linear shrink. Applied to `MagneticButtonV2`, `NeonButton` (converted to `motion.button`; `NeonButtonProps` omits `onAnimationStart`/`onDrag*` from `ButtonHTMLAttributes` since those React DOM handler signatures clash with Framer Motion's own), `ShareableRecapCard`'s share button, and HomePage's 4 tab pills.

**Tier B (CSS-only overshoot curve, high-repetition surfaces):** `PredictionForm.tsx`'s four `active:scale-95` tier-button sites (`OutcomePicker`, `InlineBoolTier`, `BoolPicker`, `CornersPicker`) get `transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]` in place of the flat `duration-150` transition — the same springy overshoot feel, but without instantiating Framer Motion components on a surface that can render dozens of these buttons simultaneously in the match feed. This split (Framer Motion for singular/rare triggers, CSS overshoot curves for high-repetition surfaces) is the same performance-conscious pattern already established for `PredictionHeatmap.tsx` cells vs. one-off buttons elsewhere.

### `CelebrationManager.tsx` — the focused celebration orchestrator

Mounted around the Streak tile in `BentoArena.tsx` — the one existing card value that literally increments on a win, making it the natural anchor for a "look what you earned" moment. Consumes `useNewPointsAlert()` **completely unmodified** as its sole win-detection trigger (the existing `localStorage` last-seen-points watermark + `leaderboard` Realtime subscription established back in the addiction-loop era) — no second Realtime subscription, no duplicate win-tracking logic.

Sequence on a detected win (`hasNew` flips true):
1. `queryClient.invalidateQueries({ queryKey: ['statsArena'] })` — a best-effort nudge, since `useStatsArena` has its own ~2-minute `staleTime` (Sprint 15, deliberately outside `AppShell`'s auto-sync) and could otherwise leave the displayed `streak` stale for a while after a real win landed.
2. A **spotlight dim**: a single oversized `box-shadow` (`0 0 0 9999px rgba(4,8,16,0.6)`) positioned exactly over the Streak card's own bounding rect, plus `backdropFilter: blur(2px)` — dims and softly blurs every *other* Bento card without touching their own React state or re-rendering them, since the "cutout" is purely how `box-shadow` spread math works.
3. A **pulse ring** on the card itself, using `var(--arena-glow)` (Sprint 15's OKLCH token — no new color).
4. `celebrateAt(cardRef.current)` fires at t=150ms — the confetti burst anchored to the card.
5. A **conditional `NumberFlow` replay**: only when the streak value has genuinely moved past a dedicated `localStorage` watermark (separate from `useNewPointsAlert`'s points watermark) does the component hold the *old* streak value through the dim/ring, then flip to the *new* value in sync with the confetti burst — a real animated roll-up, not just a value that already silently updated off-screen sometime earlier.
6. Cleanup after ~2.2s: clears the celebration state, updates the streak watermark, calls `markAsSeen()`.

The whole visual sequence is skipped entirely under `prefers-reduced-motion` — but the watermark/`markAsSeen()` bookkeeping still runs, so a reduced-motion user doesn't get re-shown the same "new" win indefinitely.

**Deliberately does not replay the coin chime or haptic.** `App.tsx`'s Sprint 17 coin-deposit handler already fired those the instant the win actually happened — which can be minutes before the user opens the Stats tab and this component mounts. Re-firing them here would be a duplicate, disconnected-in-time echo of feedback the user already received.

### Rules

- **Before scoping a new zero-dependency subsystem, check whether the codebase already has a library that satisfies the same constraint.** `canvas-confetti` was already installed and in use; the right move was extending it (`celebrateAt`), not building a parallel particle engine to avoid a "new" dependency that wasn't actually going to be new.
- **Split tap-feedback implementation by repetition, not by preference.** Framer Motion `whileTap` springs for buttons that appear once or a few times on screen; a CSS `cubic-bezier` overshoot curve for buttons that can render in the dozens simultaneously (tier-selector grids, match-feed rows). Both should read as "the same elastic feel" to the user even though the underlying mechanism differs.
- **A focused win celebration should reuse the app's existing win-detection hook verbatim, not build a second one.** `useNewPointsAlert()` (Sprint 8-era) was already the source of truth for "did this user earn something new since their last visit" — `CelebrationManager` consumes it as-is.
- **Don't replay sensory feedback (sound/haptic) that already fired earlier for the same event.** A win's coin chime/haptic fires once, at the moment the win is processed server-side and the Realtime event lands (§32) — a later UI component reacting to the same underlying state change should add new *visual* feedback, not re-trigger sound/haptic the user already felt.
- **A card-scoped spotlight-dim effect can be done with a single oversized `box-shadow`, not per-sibling opacity state.** Position an element exactly over the target's bounding rect with `box-shadow: 0 0 0 9999px <dim-color>` — everything outside that rect dims, the rect itself stays untouched, with zero state threaded through sibling components.

---

## 34. The Live Center — Home & Match Cards Overhaul (V4 Sprint 19)

A design pass on the two highest-traffic surfaces in the app — HomePage's category tabs and `MatchCard.tsx` — targeting a "SofaScore/Bet365" premium read instead of the flatter "admin dashboard" look those surfaces had. The brief that opened this sprint asked for Embla Carousel and a continuous "momentum" sparkline; both were corrected before any code was written, for reasons grounded in what the actual codebase and ESPN's actual data can support — see below.

### Corrections made before writing code

**No Embla Carousel.** This engagement has held one line since Sprint 15 (GSAP declined twice, Sonner declined once — §30/§32): don't add a UI dependency when Framer Motion + native CSS already cover the ask. A 4-item filter bar with a scroll-snap container and a `layoutId`-tagged highlight needs neither drag physics nor pagination logic, which is what a carousel library is actually for.

**"Attack Momentum Sparkline" reframed to "Attack Event Pulse."** ESPN's soccer `summary?event=` feed (the only live-event source this codebase has, via `MatchTimeline.tsx`'s parser) exposes exactly six discrete event types — goals (3 variants), cards (3 variants), subs — timestamped by minute. It does **not** expose shots, touches, xG, or any per-minute pressure/possession metric; `MatchStats.tsx`'s boxscore fields are running cumulative totals, refreshed every 30s, not a time series. There is no real "team dominance over the last 10 minutes" signal anywhere in this data source. A smoothed continuous curve through 2-3 sparse points would be exactly the kind of fabricated-empirical-data problem already called out for `GroupDistributionChart` (§30 — "state the modeling choice... never let a modeled curve look indistinguishable from a real one"), except here there'd be no honest modeling basis at all. The shipped version renders sparse, recency-weighted markers at their true minute instead — real data, honestly presented, never claiming precision the feed can't back up.

**Team brand halos need a color source that doesn't exist yet.** `LEAGUE_ACCENT` (`MatchCard.tsx`) is per-*league*, not per-team; no team primary-color field exists anywhere in `matches`, `FOOTBALL_LEAGUES`, or ESPN's parsed response. The shipped version (`teamHaloColor` in `lib/oklch.ts`) is a deterministic hash of the team name into an OKLCH hue — same team always renders the same halo, zero extra network calls, zero per-card Canvas pixel-sampling (which would have been a real per-card performance cost across a whole feed).

**Breathing live clock is CSS, not per-card Framer Motion.** `index.css` already had exactly this primitive for the whole card border (`.animate-live-breathing`); a Live tab can render a dozen+ live cards simultaneously, and a dozen independent JS-driven `whileInView`/`animate` loops is real main-thread cost a single shared `@keyframes` rule doesn't pay — the same call already governing the World Cup aurora blobs and Sprint 18's Tier A/B tap-feedback split.

None of these corrections changed what shipped visually — fluid morphing tabs, atmospheric team-colored cards, a live pulse, a recent-action visual are all present. They changed *how*, each time toward less risk and more honesty about what data actually backs the visual.

### Commit 1 — Segmented Snapper

`HomePage.tsx`'s tab row is now `overflow-x-auto snap-x snap-mandatory` (`data-lenis-prevent`, scrollbar hidden) with each pill `snap-center` and a `min-w-[76px] shrink-0 flex-1` sizing — on any normal viewport today the 4 tabs still evenly fill the width exactly as before; the snap/scroll machinery is a resilience feature for narrower viewports or a future 5th tab, not a visible change in the common case. The active-tab background is no longer each button's own class — a single `<motion.div layoutId="activeTabPill">` inside a shared `LayoutGroup` is rendered conditionally inside whichever button is currently active; Framer computes the FLIP transform automatically between renders (the identical shared-layout technique Sprint 16 proved out for the H2H panel morph, §31 — no `AnimatePresence` needed for this "indicator follows selection" pattern, unlike an exit-animated element).

### Commit 2 — Premium match card depth + team brand halos

Non-live match cards (the majority in any feed — NS/finished) switch from `GlassCard variant="default"` to `variant="elevated"` (deeper blur + real ambient shadow, already existed for the Bento Arena — zero new CSS) and turn on the existing `grain` prop (`.glass-grain`, the exact "physical glass" texture named in the brief). A new `edgeGradient` prop adds a true variable-opacity border: a single `::before` pseudo-element sized by its own `padding: 1px`, background = a `linear-gradient` from `--color-border-bright` to transparent to `--color-border-subtle`, masked to just the ring via `mask-composite: exclude` (the standard CSS-only gradient-border trick — compositor-friendly, no extra DOM node, cheap across a whole feed). The card's real 1px border becomes `border-transparent` alongside it so the two don't double up; the league-accent stripe (`leagueAccent` prop, inline `borderInlineStartColor`) still shows through since inline styles win specificity over the class.

`TeamBlock` renders `teamHaloColor(name)` as a blurred `radial-gradient` behind each badge, in a `relative isolate` wrapper (the `isolate` forces a new stacking context so the halo's `-z-10` stays contained to that wrapper, rather than risking painting behind the whole card — a plain `relative` parent alone doesn't guarantee that).

Score and live-clock digits move from `font-bebas tracking-widest` to `font-mono font-bold tabular-nums`. This isn't a style preference — Bebas's numerals aren't monospaced, so a score flip (`0-0 → 1-0`) could reflow the surrounding layout by 1-2px on every goal; monospace tabular figures hold a fixed width regardless of which digits are showing, a real (if small) CLS fix.

A genuine pre-existing bug was caught and fixed in passing: the red-card badge cluster used a literal `-right-1`/`-top-1` instead of the logical `-end-1` (rule 4.10) — it always sat physically top-right regardless of language direction, never mirroring for Hebrew.

### Commit 3 — Breathing live clock

`.live-clock-pulse-green` / `.live-clock-pulse-amber` (`index.css`) replace the plain `animate-pulse` + static Tailwind text color the live-clock badge had. Each pulses `opacity` in parallel with a genuine `color` shift between two static OKLCH stops of the same hue (not just an opacity fade) — a real chroma/lightness pulse, matching whichever color (green for live play, amber for ET) the badge would have shown statically before. `prefers-reduced-motion` disables both, holding full opacity.

### Commit 4 — Attack Event Pulse

`lib/espnEvents.ts` extracts `MatchEvent` + `fetchEspnEvents()` out of `MatchTimeline.tsx`, which previously owned them privately — both it (still FT-only) and the new `MatchMomentumPulse.tsx` (live-only) now share one ESPN keyEvents parser instead of ~150 duplicated lines.

`MatchMomentumPulse.tsx` renders inside `MatchCard`'s expanded body for `isLive` matches: a compressed 10-minute inline SVG timeline, goals as circles and cards as squares, positioned at their true relative minute, colored via `teamHaloColor`, opacity weighted by recency (`1 - minutesAgo/10`, floored at 0.28 so nothing fully vanishes). Subs are excluded — not an "attack" signal. Renders `null` entirely when there have been zero events in the trailing window, matching `MatchTimeline`'s own "hidden until real data exists" convention rather than showing an empty-state placeholder. The SVG root pins `direction: 'ltr'` regardless of page direction — the x-axis encodes elapsed-time data (older → newer, left → right), a coordinate fact, not a reading-direction one, the same reasoning already documented for the Bento Arena heatmap's RTL fix (§21 Common Pitfalls). Polls every 30s while mounted, matching `MatchStats.tsx`'s existing live cadence (a separate `setInterval`, not literally the same interval object, but the same cadence convention).

**Memoization (explicitly required by this sprint's rules of engagement):** `MatchMomentumPulse` is wrapped in `React.memo` with an explicit `(prev, next) => prev.match === next.match` comparator. This is cheap to guarantee correctly because `useMatches.ts`'s `mergeMatches` *already* preserves object identity for unchanged matches (§22, the same mechanism that protects the AI-insight columns from being dropped on a background sync) — a sync tick that touches other matches in the feed never gives this component a "new" `match` object, so it skips re-rendering entirely. Its own 30s poll only ever calls its own `setState`, which by React's ownership model can never invalidate `MatchCard` or the surrounding match-feed list above it — no extra plumbing needed to satisfy "don't invalidate parent list components," it falls out of the existing architecture for free.

### Rules

- **Before adopting a UI/carousel/animation library named in a brief, check whether `layoutId` (Framer Motion, already loaded) + native CSS scroll-snap already covers the ask.** A segmented tab control with a morphing highlight is the textbook case — no drag-to-paginate, no pagination state, nothing a carousel library adds over the shared-layout technique this codebase already uses elsewhere (§31).
- **Never build a data visualization implying more precision than the underlying feed can supply.** Check what the actual API response contains (not what the feature name implies it should contain) before choosing continuous-curve vs. sparse-marker rendering. ESPN's soccer `keyEvents` has no per-minute pressure data; a smoothed "momentum" line would have been fabricated. Sparse, honestly-labeled markers were the correct shape for this specific data source — a future feature with genuinely time-bucketed data (if ESPN ever adds it) could legitimately use a smoothed curve instead.
- **A deterministic hash-to-color function is the correct default for "brand color per entity" when no real color field exists and per-instance color extraction (Canvas pixel sampling, an extra API field) would be either expensive at scale or unverified.** `teamHaloColor` is the reference pattern — same entity always resolves to the same color, zero network cost, zero risk of a missing/wrong field at runtime.
- **A CSS-only gradient border (`::before` + `mask-composite: exclude`) is the right tool for a variable-opacity border applied across a whole feed of cards** — cheaper than a second real border element or a JS-computed gradient, and compositor-friendly like the rest of this codebase's per-card visual effects.
- **font-mono + tabular-nums is a real CLS fix for any numeral display that changes value at runtime (scores, clocks, counters), not just a style choice.** Reach for it whenever a non-monospace display font is used for numbers that update live.
- **Extracting a shared parser/fetcher (like `lib/espnEvents.ts`) the moment a second consumer needs the same logic is the correct move, not a "later cleanup."** The original `MatchTimeline.tsx` implementation was correct and complete on its own; duplicating it into a second component instead of extracting first would have created two copies of ~150 lines of ESPN response-shape handling to keep in sync forever after.
- **A component driven by its own internal poll (not parent-supplied data) should be `React.memo`'d against reference-stable identity of whatever object it keys off of** — and check whether the surrounding data layer already preserves that identity (it does here, via `mergeMatches`) before adding new plumbing to guarantee it.
- **Never stack `backdrop-filter` or `mix-blend-mode` on an element that is also subject to a CSS `transform`.** WebKit has long-documented paint failures where the element simply fails to render at all (not just the blur/blend effect — the whole element) when combined with a transform, especially alongside `overflow: hidden` + `border-radius`. This shipped once: `PredictionModal.tsx`'s Vaul drawer (`Drawer.Content`, which Vaul transforms for its open/slide animation) got `card-elevated`'s `backdrop-filter` **and** `.glass-grain`'s `mix-blend-mode` in the same Sprint 20 commit — the sheet became completely invisible on a real phone while the separate, untransformed `Drawer.Overlay` rendered fine (a paint failure, not a layout bug — the tell is one element painting while an adjacent one doesn't). `MatchCard.tsx` uses the identical `grain`+`edgeGradient`+`elevated` combo safely because it's a static, untransformed element. Before applying `grain`/`edgeGradient`/`elevated` to anything wrapped in a Framer Motion `animate`/`whileHover`/drag gesture (or any other transform source, including Vaul), verify on a real WebKit device first — don't assume a combo that's safe on a static element is safe on a moving one.
- **A "ratio to X" visual (progress bar, meter, gauge) needs its denominator sized to the numerator's actual realistic range, not just any technically-correct related value.** `PredictionForm.tsx`'s Risk Meter (§35) originally used `cost / balance` — mathematically sound, but since a single match's cost caps at 19 while balances run into the hundreds, the bar was always pinned near-empty and looked frozen no matter what a user selected. `cost / MAX_PER_MATCH` was the fix — same numerator, a denominator actually comparable in magnitude, so the full 0–100% range is reachable by the actions a user can actually take. Before shipping a ratio-driven visual, sanity-check the numerator's real-world range against the denominator's, not just that the formula is dimensionally correct.
- **Never use a native `<input type="number">`/`<input type="text">` for a numeric value inside a `position: fixed` bottom sheet (Vaul or otherwise) on mobile.** Focusing a real text field opens the OS keyboard, which resizes the visual viewport — a fixed-position sheet reacts to that resize by visibly jumping/reflowing, reported live as "everything jumps up" on a real phone (`PredictionForm.tsx`'s Exact Score fields, post-Sprint-20). The fix isn't a viewport-meta tweak or a scroll-lock hack — it's removing the focusable text field entirely. `ScoreStepper` (+/- tap buttons, spring digit-flip animation, no `<input>` anywhere) makes the keyboard structurally impossible to trigger, not just less likely to cause problems. Any future numeric entry inside a bottom sheet — coin amounts, minute counts, anything 0–20-ish — should default to a tap stepper over a native numeric keyboard, both for this reason and because a hand-built stepper reads as more premium/game-like than a bare OS keyboard with autofill/mic/globe icons hanging off it.

---

## 35. The Tactile Slip — Bet Form & Sliding Drawer Overhaul (V4 Sprint 20)

A tactile pass on the single most-used interaction in the app (predicting a match) — the mobile prediction sheet, the tier-selection chips, and a new live risk indicator for the coin cost. The brief that opened this sprint asked for a hand-rolled Framer Motion drawer and a draggable stake slider; both were corrected before any code was written.

### Corrections made before writing code

**No rebuilding the drawer — it already uses Vaul, and Vaul is already better at this than hand-rolled Framer would be.** `PredictionModal.tsx` was never the "rigid, desktop-centric modal" the brief described — it's `<Drawer.Root>` from **Vaul** (`vaul` npm package), a purpose-built drag-physics library already giving rubber-band resistance, velocity-based dismiss, and scroll-vs-drag disambiguation. The file's own header comment documents that this codebase *removed* a hand-rolled Framer `drag="y"` + `onPointerDown stopPropagation` hack specifically because Vaul made it unnecessary and more reliable. Rebuilding it with raw Framer `drag="y"` would have deleted working, purpose-built physics to reimplement a worse version by hand, with zero bundle savings (Vaul is already paid for; Framer Motion is already loaded regardless). What was actually flat was the sheet's *surface* (flat fill, plain border) — that's what got the Sprint 19 glass treatment, not the gesture layer.

**No "Fire Slider" — GoalBet's coin cost isn't a discretionary stake.** The economy computes cost server-side, fixed per which of the 5 tiers you filled in (`submit_prediction`, migration 040) — there is no backend capability to accept an arbitrary drag-chosen amount, and rule 4.11/§27's hard line (enforced after a real vulnerability) is that a coin-spending RPC must never trust a client-supplied cost. A draggable "choose your risk" control would imply a capability the backend can't honor — worse than no control at all. What shipped instead, **the Risk Meter**, is a live, non-interactive gauge: its width and OKLCH color (gold → warning) are driven entirely by the cost your tier selections already computed, never something the user drags.

Neither correction shrank the sprint — the drawer reads more premium, the risk indicator is genuinely dynamic. Both route the same design intent through what the codebase can actually, safely support.

### Commit 1 — Drawer depth + desktop centered-card split

`Drawer.Content` (Vaul) now carries the `card-elevated` CSS class (deeper `blur(30px) saturate(170%)`, the same tokens `GlassCard`'s `elevated` variant uses elsewhere) plus a `.glass-grain` texture div (wrapped content in `relative z-10`, the same stacking-order fix `grain`/`tactile` always need). The sheet's hand-tuned upward `box-shadow` (`0 -8px 60px rgba(0,0,0,0.5)`) stays an inline override — `card-elevated`'s own shadow is downward-facing, wrong direction for a sheet anchored to the bottom of the screen. No `edgeGradient` ring on this sheet on purpose: that technique (§34) draws a full 4-side border, and a bottom sheet with no real bottom edge (it's flush with / extends below the viewport) would get a visibly wrong ring on the one side that shouldn't have one. `max-h-[88vh]` → `max-h-[85dvh]` — `dvh` tracks the actual visible viewport as iOS/Android browser chrome collapses/expands; `vh` is pinned to the largest possible viewport and can clip under a still-visible address bar.

New `useMediaQuery.ts` (`'(min-width: 640px)'`, matching Tailwind's own `sm:` breakpoint rather than introducing a second breakpoint source of truth) gates a new `PredictionCardDesktop.tsx` — a small, separate, centered Framer Motion dialog (scale+fade, no drag physics needed) for desktop, since Vaul has no centered-dialog mode. Both shells reuse `PredictionForm` identically; it has zero awareness of which one it's mounted in.

### Commit 2 — Tactile 3D glass chips

`TIER_COLORS` gains an `emboss` field per tier — an inset light-catch plus an outward glow in the tier's own color — used on the **selected** state across all 4 chip pickers (`OutcomePicker`, `InlineBoolTier`, `BoolPicker`, `CornersPicker`), paired with a `-translate-y-px` micro-lift for genuine (not just color) elevation. A new shared `DEBOSS_SHADOW` (deliberately *not* per-tier-colored — only the selected state should carry tier identity) gives the **unselected** state a sunken-into-the-surface read instead of a flat 1px border. `glow` (the original bare outward-only shadow) is kept, still used elsewhere by `TierRow`'s point label.

The tap "squish" stays the CSS-only mechanism Sprint 18 already established for these exact chips (`active:scale-95` + `ease-[cubic-bezier(0.34,1.56,0.64,1)]`, tuned `300ms → 250ms`) rather than switching to per-instance Framer Motion `whileTap` springs — CLAUDE.md §33 already rules on this specifically for `PredictionForm`'s tier grids, which can render in the dozens across a match feed with multiple cards expanded.

### Commit 3 — The Risk Meter

`lib/oklch.ts` gains `interpolateRisk(ratio)` — a plain two-stop lerp (0 = safe, 1 = at/near full balance), distinct from `interpolateDiverging`'s three-stop diverging-around-a-midpoint shape. New tokens `--risk-gold` / `--risk-warning` (`index.css`, both theme variants) are deliberately **separate** from `--arena-cold`/`--arena-hot` — arena's scale means "performance" (win ratio), this one means "how much of your balance this bet risks"; reusing the same anchors would make one scale's meaning bleed into the other's.

`PredictionForm.tsx`'s coin summary row gains a thin animated bar beneath the cost/balance numbers, `width` and `background` driven by `riskRatio`, recomputed on every tier toggle. **Post-ship correction:** the first version used `displayCost / coins` (cost vs. total balance) — reported live as "the bar never moves." A single match costs at most `COIN_COSTS.MAX_PER_MATCH` (19) while typical balances run into the hundreds (120 join bonus + 30/day), so that ratio was a few percent at the absolute maximum bet — technically animating, imperceptibly. Fixed to `displayCost / COIN_COSTS.MAX_PER_MATCH` — sweeps the full 0–100% range across the exact tiers a user can toggle on one match, so the bar now responds visibly to every tap. `insufficientCoins` still forces the bar to full/warning regardless of this ratio — "can't afford it" is a separate, real signal from "how loaded up is this pick." Cost and balance numbers switch from plain text to `NumberFlow` (the established pattern — `TopBar`, `ProfileBentoV2`, `BentoArena`).

### Commit 4 — Audio-haptic wiring

Every tier chip's `onChange` already called `haptic('selection')`; this adds `playSound('toggle_click')` alongside it at all 4 chip sites. The Risk Meter itself has no independent interaction (it's a gauge, not a slider — Commit 3), so it has no separate "step" event to hook a sound to; its value changes exactly when a chip tap already does, so the same trigger covers both.

Submission plays `playSound('lock_thud')` — **not** `coin_chime` as originally briefed. `coin_chime` already means "you *received* coins" everywhere else in the app (daily bonus, prediction wins, §32); reusing it for "you just *spent* coins on a bet" would blur an otherwise-consistent sound vocabulary this codebase has kept deliberately distinct. `lock_thud` already means "something just became final" (Momentum Bets lock, §29/§32) — the correct semantic match for locking in a prediction. `haptic('success')` already fires separately at the `HomePage.handleSavePrediction` call site on a successful save and isn't duplicated here.

### Rules

- **Before replacing an interaction with a hand-rolled version, check whether the codebase already uses a purpose-built library for it.** `PredictionModal.tsx`'s Vaul-powered drawer was mistaken for a plain modal by a brief that didn't check; it was already doing the exact job being requested, better than a hand-rolled Framer `drag="y"` rebuild would. Read the component before proposing to replace its mechanism, not just its visuals.
- **Never build a draggable/interactive control that implies a backend capability that doesn't exist.** A "choose your stake" slider over a fixed-cost-per-tier economy would have been a fake control — worse than no control, since it implies the app can do something it structurally can't (and *can never* safely do without a new RPC going through the full coin-spending discipline in rule 4.11/§27, not a UI-sprint add-on). When a mandate implies a capability, verify the backend actually has it before designing the frontend for it.
- **A "meter"/gauge and a "slider"/input are different UI contracts — don't build the interactive one when only the display one is warranted (or vice versa).** The Risk Meter is intentionally non-interactive; giving it drag affordances (cursor, hover states implying interactivity) would mislead users into thinking it does something it doesn't.
- **Distinct economic sound effects (earn vs. spend vs. lock-in) should stay semantically distinct — don't reuse "you received money" for "you just committed money."** `lock_thud` over `coin_chime` for prediction submission is the reference case; check what a sound already means elsewhere in the app before reusing it for a new, different event.
- **A debossed/embossed shadow pair for a tactile toggle should keep the "recede" state neutral/un-tinted and reserve identity color for the "elevated" state only.** `DEBOSS_SHADOW` is shared across all tiers on purpose — only `emboss` carries per-tier color, so selection state (not idle color) is what a user's eye tracks.

---

## 36. The Prestige Standings — Leaderboard & Group Tables Overhaul (V4 Sprint 21)

A tactile/data-viz pass on GoalBet's own competitive leaderboard and — where it genuinely applies — the Stats page's ESPN league standings table. The brief conflated the two tables' data models; most of this sprint's mandates only make sense for one of them.

### Corrections made before writing code

**"Leaderboard and Stats Standings tables" are two different data models — most mandates apply to only one.** `StandingsTable.tsx` renders real ESPN football team standings (P/W/D/L/GF/GA/GD/pts) — a team has no bet slips, no coin distribution, no win streak, no resolved predictions. Sparklines, bet-slip accordions, and rank-delta badges are GoalBet-*user* concepts. **Scope split**: `LeaderboardTable.tsx`/`LeaderboardRow.tsx` gets the full mandate set; `StandingsTable.tsx` gets only the row-swap physics and typography polish that generalize to any tabular data.

**"Accordion morphing on row click" directly conflicted with an existing, deliberate, documented interaction.** `LeaderboardPage.tsx` already wires row clicks to two real, working modals — own row → `UserMatchHistoryModal`, other row → `H2HModal` — explicitly called out in §21 Common Pitfalls as *intentional*, not an oversight. Replacing this with an inline accordion would have meant either destroying the H2H comparison view (can't be meaningfully compressed into a row-height expansion) or creating an ambiguous double-meaning tap target. **Resolution**: kept both modals as the row's primary click target, added a *separate* chevron (its own tap target, `stopPropagation`) that reveals a lighter, faster in-place preview — sparkline, streak/accuracy recap, last-5 bet-slip mini team-badge pairs — without replacing either modal.

**Weekly rank-delta has no data source in this schema — but is fully derivable from data already fetched.** No table ever persists a rank; rank is always computed client-side by sorting (confirmed in `useLeaderboard.ts`). The fix, zero new migration: `useLeaderboard`'s `weekly` view already fetches `last_week_points` per entry — re-sort the *same already-fetched* `entries` array by `last_week_points` to derive a comparable "last week's rank" ordering, diff it against the current `weekly_points`-sorted rank. Stated as an approximation in the code (can't account for someone joining the group mid-week), not hidden.

### Row-swap springs

`LeaderboardTable.tsx`'s rows and `StandingsTable.tsx`'s rows (converted from plain `<tr>` to `motion.tr`, keeping real table semantics — `getBoundingClientRect` works fine on `<tr>` in every evergreen browser, so `layout` measures correctly despite the table layout algorithm) both get `layout` + a shared `LayoutGroup`. A sort-order change — a prediction resolving, a tab switch, live points shifting rank, an ESPN standings sync — now animates rows sliding to their new position via Framer's FLIP measurement instead of a silent re-render in the new order. Tuned tighter (`stiffness: 380, damping: 32`) than the existing hover transition so a rank swap reads as decisive.

### Sparklines + in-place preview, batched (not N+1)

`LeaderboardRowSparkline.tsx` reuses `smoothPath()` (`lib/svgPath.ts`, extracted in Sprint 15 specifically so every hand-built chart shares one spline implementation) rather than hand-rolling new curve math. Deliberately static — no Framer draw-on — since a leaderboard can render many of these simultaneously, unlike `Sparkline.tsx`'s single big Profile-page instance. Slope-driven color reuses the existing CVD-safe ice-blue/red-pink brand pair.

Data: one batched query in `LeaderboardPage.tsx` (matches-in-window, then predictions for those matches, aggregated client-side into `Map<user_id, RecentPrediction[]>`) mirroring the file's own pre-existing `periodStatsMap` fetch shape — avoids the exact N+1 pattern §30 already forbids for this codebase. `RecentPrediction` carries `{ matchId, points }`, not just points, so the row's *lazy* bet-slip fetch (team names/badges, only on expand, `fetchedRef`-guarded) can reuse the same match IDs without a second "which matches did this user play" query.

`LeaderboardTable.tsx` owns `expandedUserId` state; each row's chevron (separate `onClick` + `stopPropagation` from the row's own modal-opening click) toggles an `AnimatePresence` height-expand preview. Sibling rows' `layout` prop (from the row-swap commit) means they smoothly reflow rather than jump when one row's height changes — answering "avoid pushing/squishing neighbors" for free, without extra plumbing.

### Rank-delta badge and OKLCH discipline

Computed in `LeaderboardPage.tsx` per the correction above (re-sort `entries` by `last_week_points`, diff against current rank), only rendered on the `weekly` tab, only when nonzero. Color comes from `lib/oklch.ts`'s existing `interpolateDiverging()` — **not** a hardcoded `oklch(...)` string (an early draft of this exact badge hardcoded two OKLCH values directly, which the codebase's own established rule already forbids — caught and fixed before shipping). Low-alpha background via `color-mix(in oklch, ${color} 16%, var(--color-bg-card))`, the same technique `Toast.tsx` (§32) already established for "a resolved color at low opacity, blended into the surface."

### Prestige styling

Breathing gold halo behind the #1 avatar: a Framer Motion `animate` opacity/scale loop (not a CSS keyframe) behind a `relative isolate` wrapper. Deliberately Framer here, unlike Sprint 19's live-clock badge or the World Cup aurora blobs — those can render dozens of simultaneous instances across a feed, driving the CSS-only choice; exactly one #1 row ever renders per leaderboard, so the "many simultaneous instances" cost concern doesn't apply. Reuses `--risk-gold` (Sprint 20's Risk Meter token) rather than introducing a third gold custom property. Respects `prefers-reduced-motion` (static opacity, no loop).

Rank number, points, rank-delta, and bet-slip point chips all moved to `font-mono tabular-nums` (was `font-bebas` for points — the same CLS-motivated swap already made for match-card scores in §34). `StandingsTable.tsx` needed no typography change — it was already `font-mono` at the table level from before this sprint.

### Rules

- **Before applying a sprint's mandates to "every table/list of a similar shape," check whether they actually share a data model.** ESPN team standings and GoalBet user standings look alike (both are ranked tables) but have completely different underlying entities — a mandate written for one can be structurally inapplicable to the other, not just stylistically different.
- **A new "expand in place" interaction must never silently replace an existing, working, documented interaction on the same element.** Add a new affordance (a dedicated toggle, its own tap target) alongside the old one rather than overloading a single click to mean two different things depending on some other state.
- **A "derive it from data already fetched" solution beats a new migration whenever the derivation is honest about being an approximation.** The rank-delta badge needed no schema change because the two numbers it compares (`weekly_points`, `last_week_points`) were already being fetched for an unrelated reason — check what's already in hand before reaching for a new persisted column.
- **`layout` on sibling list items automatically solves "don't squish my neighbors" for a height-changing expand/accordion** — no extra height-reservation or manual reflow logic needed once the siblings already have `layout` from an unrelated row-reordering feature. The two capabilities compose for free.
- **Every new OKLCH-driven UI element must resolve its color through the codebase's existing live-token functions (`interpolateDiverging`, `interpolateRisk`), never a hardcoded `oklch(...)` literal** — this was caught and fixed in this same sprint, on the very rule it violates (§21's OKLCH pitfall), which is itself the reminder to actually check newly-written code against standing rules before considering a commit done, not just before writing it.

---

## 37. The Hall of Fame — Interactive Profile & Identity Overhaul (V4 Sprint 22)

A data-visualization and identity pass on the Profile page: a streak-tier avatar halo, a hand-built trigonometric radar chart, and a tactile trophy grid. The brief that opened this sprint asked for "earned achievement badges" as if that data already existed, and specified raw CSS-keyframe/hardcoded-OKLCH mechanics for the halo — both corrected before any code was written, after auditing the real schema and existing components rather than assuming the brief's premises.

### Corrections made before writing code

**"Earned achievement badges" — no such data entity exists anywhere.** No `achievements`/`badges`/`user_badges` table, no unlock timestamp, in `supabase/migrations/*.sql`. The only real, persisted, close-to-this-concept table is `user_chronicles` (Sprint 27) — narrowly scoped to perfect +10 picks on high-profile matches, and it **already owns the name "Hall of Fame"** (`HallOfFameChronicles.tsx`, already mounted on this exact page). Building a second, generically-named "Hall of Fame" for a different concept on the same screen would collide with existing UI. Rather than inventing a full persisted achievement-unlock backend (a real, separate feature — migration + unlock-detection service + RLS — well outside a visual-overhaul sprint), the Trophy Cabinet extends a pattern that **already exists and ships zero new schema**: `LeaderboardRow.tsx` already computes inline, un-persisted badges from thresholds (`badgeHot`, `badgeSniper`). The 6 Trophy Cabinet badges are the same computed-on-the-fly shape, just with a premium tilt-glass presentation. A true persisted achievement system with unlock history remains a legitimate, distinct future sprint.

**Radar chart — 3 of 5 axes were real, 2 needed a fix, checked against the actual RPC and hooks first.** `get_stats_arena_payload` and `ProfilePage.tsx`'s existing `history` fetch were read in full before assuming any axis's data existed. Accuracy, Boldness (avg stake), and Specialist (exact-score rate) are all client-side re-derivations of numbers `ProfilePage.tsx` already computes from `history` — zero new queries, the same discipline Sprint 9 established for the trajectory/form series. Volatility (stddev of points-earned) is likewise fully derivable from `history`, just not previously computed. Live Activity (Momentum Bets participation) genuinely wasn't aggregated anywhere — it needed one new, lightweight `count`-only query against `micro_prediction_bets` (no new RPC, no migration). Per the Sprint 20 Risk Meter lesson ("a ratio's denominator must be sized to the numerator's real range, not just be dimensionally correct"), every axis's [0,1] clamp uses an explicit, stated denominator rather than a bare guess — see the axis table below.

**Avatar halo — CSS keyframes were the wrong tool, and the brief's literal OKLCH values would have violated this codebase's own standing rule.** There is exactly **one** avatar on the Profile page (not a list) — the "many simultaneous instances → CSS, single instance → Framer Motion" split this codebase already established twice (live-clock badges/aurora blobs vs. the Sprint 21 #1-leaderboard gold halo) points at Framer, not a new pseudo-element keyframe system; a single `animate` loop on transform/opacity is already compositor-driven, so "hardware acceleration" was never actually a CSS-vs-JS distinction here. And hardcoding `oklch(45% 0.04 240)` etc. directly into a component would be exactly the "second hardcoded copy of an OKLCH value" mistake this project already self-caught once (Sprint 21's rank-delta badge). Correction: three new CSS custom properties (`--streak-bronze/-silver/-ember`, both theme blocks), resolved live, reusing `LeaderboardRow.tsx`'s exact Framer Motion halo pattern.

### Commit 1 — Avatar Streak Tier Halo

Three fixed OKLCH tokens (`index.css`, both theme blocks) — bronze `oklch(45% 0.04 240)` (muted carbon-gray, 0-3 streak), silver `oklch(80% 0.08 220)` (frozen platinum-blue, 4-7), ember `oklch(70% 0.22 35)` (pulsating flame gold-orange, 8+) in dark mode, darkened/re-saturated light-mode variants following the exact same adjustment discipline as `--arena-cold/hot`/`--risk-gold/warning`. `lib/oklch.ts`'s `streakTierColor(streak)` is deliberately **simpler** than `interpolateDiverging`/`interpolateRisk` — three fixed discrete tiers, not a continuous ratio, so it needs no `getComputedStyle`/caching machinery at all; it just returns a `var(--streak-*)` reference, the same way `LeaderboardRow.tsx` already uses `var(--risk-gold)` directly.

`ProfilePage.tsx`'s avatar gets the exact `LeaderboardRow.tsx` wrapper shape (`relative isolate` div, a breathing `motion.div` halo, `useReducedMotion()` → static opacity, no loop) — reused, not reinvented. Per-tier animation intensity (not just color) sells the tier: bronze is slow/low-amplitude (4s, opacity 0.25→0.4), silver a touch brighter and crisper (3.2s, 0.35→0.55), ember fast and pulsating (1.8s, 0.45→0.8). The halo reads the *same* `currentStreak` value already computed and displayed in `ProfileBentoV2`'s streak `MicroCard`, so the two can never visually disagree.

### Commit 2 — Pure Trigonometric Risk Radar Chart

Hand-built inline SVG, zero charting library (this codebase's standing "Strict Charting Law" — §25/§30). For center `(cx, cy)`, radius `r`, and `n` axes:

```
theta_i = -PI/2 + i * (2*PI / n)      // -90deg start, axis 0 points up
x_i = cx + r * v * cos(theta_i)
y_i = cy + r * v * sin(theta_i)
```

The 5 axes, each `[0,1]`-clamped against an explicit denominator:

| Axis | Formula | Source |
|---|---|---|
| Accuracy | `ftCorrect / ftPredictions` | already computed from `history` |
| Boldness | `avgStakePerPrediction / COIN_COSTS.MAX_PER_MATCH` | already computed from `history` |
| Specialist | `exactScoreCount / scorePreds.length` | already computed from `history` |
| Volatility | `stddev(points_earned) / (MAX_PER_MATCH / 2)` | newly derived from `history` (no new query) |
| Live Activity | `momentumBetCount / 20` | **one new** `count:'exact', head:true` query against `micro_prediction_bets` |

RTL: the SVG root pins `direction: 'ltr'` — the exact double-flip bug this codebase already shipped once (`PredictionHeatmap.tsx`, Sprint 15, §21 Common Pitfalls) can't recur here by construction. Axis-label `text-anchor`/alignment is derived purely from `Math.cos(theta)`'s sign (`> 0.1` → start, `< -0.1` → end, else middle), never an `isRTL` branch.

**Labels render via `<foreignObject>` + a real truncating `<div>`, not raw SVG `<text>`** — this was a live find, not a design preference from the start. A first pass used plain SVG `<text>` with hand-picked viewBox/radius constants that looked correct on paper; a temporary, uncommitted preview harness (mounted the component standalone with mock data in both LTR and RTL wrappers, screenshotted via Playwright — see the addendum below) caught a real bug the geometry math alone hadn't: "Live Activity" rendered clipped to "Live Activit". The fix wasn't a font-size tweak — it was re-solving `SIZE`/`MAX_RADIUS`/`LABEL_RADIUS_RATIO`/`LABEL_BOX_W` **together**, verified numerically (every label box's `[x, x+W]`/`[y, y+H]` stays inside `[0, SIZE]` at the worst-case axis angle, `|cos(theta)| ≈ 0.951`) before re-screenshotting to confirm. A `<div>` with CSS `truncate` inside `<foreignObject>` is a robust guarantee against this whole bug class in either language, instead of an untested pixel guess.

Vertices are keyboard-accessible (`tabIndex`, `role="button"`, Enter/Space) and tap/click reveals the raw number behind that axis in a fixed-height (CLS-safe) detail line below the chart — never a native SVG `<title>` tooltip, which reads poorly on touch.

### Commit 3 — Tactile Glass Trophy Cabinet

Six badges, each a `GlassCard tactile` (cursor-tracking glare + 3D pointer tilt — already fully built by `useTactileTilt`, Sprint 16, nothing new to wire) in a `grid-cols-2 sm:grid-cols-3` bento, deliberately **without** `allowGyroscope` — a grid of many simultaneously-tilting cards is exactly the motion-sickness case Sprint 16's gyroscope-scoping rule forbids (opt-in, one hero element only, never a whole grid). Badges:

| Badge | Threshold | Accent |
|---|---|---|
| Sniper | accuracy ≥ 65% & picks ≥ 5 | `--color-accent-green` (matches the leaderboard's existing badgeSniper definition exactly) |
| Century Club | totalPoints ≥ 100 | `--risk-gold` |
| Iron Streak | currentStreak ≥ 8 | `--streak-ember` (same threshold as the avatar halo's ember tier — direct thematic tie-in) |
| Sharpshooter | exactScoreCount ≥ 5 | violet (matches the existing "Best Tier" card accent) |
| Veteran | resolvedCount ≥ 25 | `--color-accent-secondary` |
| High Roller | boldnessRatio ≥ 0.7 | `--risk-warning` (reuses the *exact same* avg-stake/`MAX_PER_MATCH` ratio the radar's Boldness axis computes — one honest number, two presentations) |

Each badge is a hand-drawn, glowing inline SVG (`currentColor`-themed, `drop-shadow` glow when earned), never a raster image. Locked badges render **dimmed with a visible lock indicator, never hidden** — the cabinet reads as a real collection to work toward, not a mystery box.

### Commit 4 — Numeric coherence + a real RTL verification pass

The radar's detail-line value already used `font-mono tabular-nums` from Commit 2; `ProfileBentoV2` was already compliant (confirmed by the pre-blueprint audit) so nothing else on the page needed a font sweep this sprint.

**The substantive part of this commit was verifying the RTL/label-fit promise from the blueprint against an actual render, not just trusting the trigonometry.** A temporary file (`__sprint22_preview.tsx`, never committed) mounted `RiskRadarChart`/`TrophyCabinet` standalone with mock data, `main.tsx` was briefly repointed at it, `npm run dev` + a Playwright screenshot (both an English/LTR panel and a Hebrew/RTL panel side by side) confirmed: (1) the chart's layout is byte-for-byte identical under a Hebrew `dir="rtl"` ancestor — no mirroring, proving the `direction:'ltr'` pin actually works, not just compiles; (2) the label-clipping bug described in Commit 2, caught by this exact screenshot; (3) locked/earned Trophy Cabinet states render correctly, including the lock icon landing on the logical trailing side automatically under RTL with zero direction-specific code (flex/logical properties, not physical `ml-`/`mr-`). `main.tsx` and the preview file were fully reverted before any commit — `git status` confirmed clean before staging.

### Rules

- **Before treating a brief's "existing feature" as existing, grep the actual schema.** "Earned achievement badges" sounded like a small ask; it was actually a request to build a persisted, unlock-timestamped entity from nothing. The corrected scope (computed-on-the-fly badges, the same shape as `LeaderboardRow.tsx`'s existing inline pills) delivered the visual mandate honestly without inventing backend surface area a "profile visual overhaul" sprint shouldn't own.
- **A new feature's name must be checked against what's already on the same page.** "Hall of Fame" already meant something specific and shipped (`user_chronicles`, Sprint 27) — a second, differently-scoped "Hall of Fame" on the same screen would have been a real naming collision, not just a coincidence.
- **A single-instance UI element (one avatar, one #1 row) should reuse this codebase's existing Framer Motion breathing-halo pattern, not spin up a parallel CSS-keyframe system** — the "many simultaneous instances" cost concern that justifies CSS-only choices elsewhere (live-clock badges, aurora blobs) simply doesn't apply to an element that renders exactly once.
- **Fixed discrete color tiers (bronze/silver/ember) don't need `interpolateDiverging`/`interpolateRisk`'s live-read/caching machinery** — a plain lookup returning a `var(--token)` reference is simpler and sufficient when there's no continuous ratio to interpolate. Don't reach for the heavier pattern when the lighter one already fits.
- **A hand-built SVG chart's label geometry constants must be solved together and verified numerically against the worst-case axis angle, not picked independently and eyeballed** — and even then, confirm against an actual rendered screenshot before considering the RTL/overflow promise fulfilled. This sprint's own blueprint explicitly promised a live-Hebrew-render check "before merge, not after," and the live render caught a real bug (label clipping) the geometry math alone had missed — the verification step wasn't ceremony, it changed the shipped code.
- **A temporary preview/test harness used to visually verify a component must be fully reverted (and confirmed via `git status`) before anything is staged for commit** — `main.tsx` and the scratch preview file in this sprint were never at risk of being committed, but the discipline of checking is what guarantees that, not assuming it.

---

## 38. The Active Inbox — Mobile Notifications & Navigation Overhaul (V4 Sprint 23)

A mobile-first pass on `NotificationCenter.tsx`, GoalBet's oldest un-refreshed surface — still the small dropdown/bell pattern from the desktop-era design, on an app that's ~96% mobile traffic. Three commits: a full-height slide-over drawer replacing the dropdown on mobile only, real swipe-to-dismiss, and inline quick-action CTAs that deep-link straight into the match or standings a notification is actually about.

### Commit 1 — Slide-over drawer shell

`NotificationCenter.tsx` gains a third `placement` value — `'drawer'` — alongside the existing `'bottom'` (TopBar dropdown, still used by nothing after this sprint since TopBar is mobile-only) and `'right'` (Sidebar, untouched). `TopBar.tsx` (already `sm:hidden`) switches to `placement="drawer"`; `Sidebar.tsx` (desktop) keeps `placement="right"` exactly as it was — the drawer is implicitly mobile-only by construction, no separate breakpoint check needed.

**Backdrop and panel are two sibling `motion.div` elements, never nested.** The panel is what Framer Motion slides via an `x` transform; stacking `backdrop-filter` (or `mix-blend-mode`) on an element that is itself being transformed is the exact documented WebKit paint-failure class of bug that made `PredictionModal.tsx`'s Vaul sheet invisible on a real phone once already (§21/§34) — and this sandbox has no real WebKit engine to re-verify a fix if that lesson gets ignored again. The blur lives on the backdrop (fixed, full-screen, animates opacity only — never transformed); the panel gets a solid themed background (`var(--color-tooltip-bg)`) instead.

**Slide direction is the one place this component deliberately branches on language rather than staying purely logical-property-driven.** A Framer `x` value is an unavoidably physical transform — CSS logical properties can't express it — so unlike the RTL-pinned SVG charts elsewhere in this codebase (§21's "pin `direction:ltr`, never branch on isRTL" rule), here an explicit `isRTL` check on the initial/exit `x` value (`'100%'` vs `'-100%'`) is correct, not a regression. Verified empirically in Commit 4, not just reasoned about: a Playwright bounding-box check confirmed the panel hugs the physical right edge in English and the physical left edge in Hebrew.

Sizing: `h-[100dvh] max-h-[100dvh]` (not `vh` — `dvh` tracks the actual visible viewport as mobile browser chrome collapses/expands, same reasoning as `PredictionModal.tsx`'s Sprint 20 `88vh → 85dvh` fix) plus inline `env(safe-area-inset-top/bottom, 0px)` padding for notch/home-indicator safety. `NotifHeader`/`NotifList` were extracted as shared sub-components so the drawer and the desktop dropdown render byte-identical content — no drift between the two shells.

### Commit 2 — Swipe-to-dismiss + `dismissed_at`

Migration `046` adds `notifications.dismissed_at TIMESTAMPTZ` (`ADD COLUMN IF NOT EXISTS`). Distinct from `is_read` on purpose: swiping a notification away is a stronger, more final action than reading it, and the existing fetch query never filtered on anything — without a real column, a client-only "remove from this render" would have been an illusion of dismissal that silently reappeared on the next page load. `useNotifications.ts`'s fetch now filters `.is('dismissed_at', null)`; the new `dismiss(id)` optimistically removes the row locally (same shape as the existing `markRead`) and stamps `dismissed_at` + `is_read` server-side.

`NotifRow` is now a `drag="x"` `motion.div` with the **exact same offset/velocity dismiss thresholds as `Toast.tsx`'s `ToastItem`** (`|offset.x| > 80 || |velocity.x| > 400`) — a physical swipe should feel identical everywhere in this app, toasts and notification rows alike. `haptic('light')` + `playSound('toggle_click')` fire once per drag gesture, exactly when the threshold is first crossed (a ref guard prevents re-firing on every pixel of continued movement past the line, and resets if the drag comes back under threshold before release). `NotifList` wraps rows in `AnimatePresence mode="popLayout"` + `layout` so a dismissed row's siblings reflow smoothly instead of jump-cutting — verified in Commit 4 with a real Playwright drag: the swiped notification disappeared and the unread badge count decremented correctly.

**The mark-read button and the CTA button (Commit 3) are siblings, not nested.** `NotifRow`'s outer `motion.div` (the drag target) contains a `<button>` for mark-as-read and, when a CTA applies, a second, separate `<button>` beside it — two interactive elements cannot validly nest in HTML, and the original single-button-wraps-everything shape from before this sprint had to be restructured to make room for the CTA without producing invalid markup.

### Commit 3 — Inline quick-action CTAs + deep links

`buildContent()` (the existing per-`type` title/body/badge builder) gains a `cta: 'view_match' | 'view_standings' | null` field — only populated when the notification actually carries the id the target page needs (`match_id` for `prediction_result`; always present for `rank_drop`, since standings never need a specific match). A CTA with nowhere real to go is worse than no CTA.

`handleCta()`, defined in the top-level `NotificationCenter` component (it needs `useNavigate` + the group store, neither of which belongs inside the presentational `NotifRow`):

1. **Switches the active group first** if the notification's `group_id` differs from the currently active one. `useMatches` filters by the active group's `active_leagues` (confirmed by reading the hook before writing this — see the Sprint 15 "verify the dependency graph" precedent, §30) — without this, a deep link to a match in a group the user isn't currently viewing would silently resolve to an empty feed, which is worse than the CTA not existing.
2. Closes the panel.
3. Navigates: `prediction_result` → `/?focus=<match_id>`; `rank_drop` → `/leaderboard?highlight=<own_user_id>` (the receiving user's own id — a rank-drop CTA opens the user's own recap, not the overtaker's).

**Both deep-link query params are consumed via a lazy `useState` initializer, never a reactive `searchParams` read.** `HomePage`'s `matches` and `LeaderboardPage`'s `entries` both load asynchronously — the `MatchCard`/`LeaderboardRow` that needs the id to fire its own effect may not mount until several renders after the page component itself first renders. A live, reactive read of `searchParams.get('focus')` risks the value being gone (stripped, or just re-derived to something else) by the time the deferred mount actually needs it; capturing it once at the very first render sidesteps the whole race. `HomePage` additionally defaults its active tab to `'completed'` when a `focus` param is present, since a `prediction_result` notification only ever fires after a match resolves (in practice, `FT`) — the `'all'` tab deliberately excludes finished matches (§12), so the target card would never be found there.

`MatchCard` gained `autoFocus?: boolean`: on mount only (not reactive to later prop changes — a live score update elsewhere in the feed must never yank the viewport back here), it seeds `expanded` to `true` and calls `cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })` exactly once. `MatchFeed`/`MatchCardItem` thread `focusMatchId` down to whichever card's `match.id` matches. `LeaderboardTable` gained the equivalent `initialHighlightUserId?: string | null`, seeding its existing Sprint-21 `expandedUserId` row-preview state (§36) — no new expand mechanism, just a new way to seed the one that already existed.

### Commit 4 — Verification pass

A throwaway Playwright harness (`__sprint23_commit3_preview.tsx`, then `__sprint23_commit4_preview.tsx` — both mounted mock notifications + a real `MemoryRouter`, both fully deleted and `main.tsx` restored before any commit, `git status` confirmed clean each time) verified, against actual rendered output rather than reasoning alone:

- **Drawer slide direction**: a Playwright bounding-box check confirmed the panel's `x`/width in English lands flush against the physical right edge, and in Hebrew flush against the physical left edge — the `isRTL` branch from Commit 1 genuinely works, not just compiles.
- **`100dvh` sizing**: the panel's computed `height`/`max-height` matched `window.innerHeight` exactly on an iPhone-13-sized viewport. `env(safe-area-inset-*)` gracefully falls back to its `0px` default in this sandbox (no real notch to report a nonzero inset) — the CSS mechanism is confirmed wired correctly and fails safe, but a genuine notched-device check isn't possible here, the same honest limitation already noted for WebKit-specific bugs elsewhere in this doc (§21/§34).
- **Swipe-to-dismiss**: a real Playwright mouse-drag (down → stepped move past the 80px threshold → up) on a live drawer removed the correct row and left the remaining rows reflowed with no gap; the unread badge count decremented from 2 to 1 in the same pass.
- **CTA routing**: clicking "View Match"/"View Standings" against a mock notification in a *different* group than the currently active one produced the correct `?focus=`/`?highlight=` query param on the correct route, **and** the active group actually switched — caught and fixed one real test-harness bug along the way (an unconditional `useGroupStore.setState()` call in the harness's own render body was silently re-stomping the group id set by the real `handleCta()`, before a reactive-selector fix in the harness itself revealed the underlying app code was correct all along).

One additional, non-blocking observation from this pass: `NotifRow` (a plain function component) triggers a benign React dev-mode console warning under `AnimatePresence mode="popLayout"` ("Function components cannot be given refs") because it isn't wrapped in `React.forwardRef`. This is **not new to this sprint** — `Toast.tsx`'s `ToastItem`, the component this sprint deliberately copied its swipe-dismiss shape from, has the identical non-forwardRef shape under the identical `mode="popLayout"` and has shipped that way since Sprint 17 with no reported functional issue. Left as-is to match established precedent rather than introducing an inconsistent one-off fix; worth a real audit if `AnimatePresence popLayout` gains more instances in the future.

### Rules

- **Two sibling interactive `<button>`s, never a nested one, when a row needs both a primary tap action and a secondary inline action.** `NotifRow`'s mark-read button and CTA button live at the same DOM level inside the shared drag container — HTML doesn't allow nesting interactive elements, and React won't warn you until the browser silently mangles the DOM tree.
- **A slide-in/out Framer `x` transform's direction is a genuine, correct exception to this codebase's "pin `direction:ltr`, never branch on isRTL" rule** — that rule exists for content whose layout *can* be expressed with logical CSS properties (SVG chart coordinate math, flex/grid ordering). A literal pixel/percent transform value cannot be, so an explicit `isRTL` branch there is the right tool, not a regression back to physical-property thinking.
- **A query-param deep link consumed by a component whose target hasn't mounted yet must be captured once via a lazy state initializer, never re-derived from a live, reactive read of the same param on every render.** The consuming component (a `MatchCard`, a `LeaderboardRow`) may only mount several async-data-dependent renders after the page component itself does; a live read risks the value being gone (or just different) by the time it's actually needed. This pattern generalizes past this sprint — any `?param=` meant to seed a deferred child's initial state should use `useState(() => ...)`, not `useState(searchParams.get(...))`.
- **A deep link into a group-scoped page must switch the active group first if the target belongs to a different one.** Checked by reading `useMatches.ts` before writing the CTA handler, not assumed: `active_leagues` filtering means a match in an inactive group's league silently never appears, no matter how correct the rest of the deep link is.
- **Match a new gesture's thresholds to an existing identical gesture elsewhere in the app, don't invent new numbers.** `NotifRow`'s swipe-to-dismiss reuses `Toast.tsx`'s exact `80px`/`400px-per-second` offset/velocity thresholds verbatim — a user's swipe muscle memory should feel the same everywhere a "flick this away" gesture exists in this codebase.
- **When a new component's shape is copied from an existing one, an existing non-blocking quirk in the source is inherited too — don't silently "fix" it as a drive-by unless it's actually broken.** `NotifRow`'s missing `forwardRef` under `AnimatePresence popLayout` produces the identical benign dev-console warning `Toast.tsx`'s `ToastItem` has produced since Sprint 17 with no functional impact; matching established (if imperfect) precedent beats introducing a one-off inconsistency for a cosmetic warning.
- **A safe-area (`env()`) or notch-dependent layout claim can only be verified as "fails safe to its documented default," never as "correct on a real notched device," inside this sandbox.** State that limitation explicitly rather than implying a headless-Chromium screenshot proves more than it does — the same honesty already applied to WebKit-specific `backdrop-filter`/transform bugs elsewhere in this document.

---

## 39. The Native Tongue — Absolute Localization & Gender Contexts (V4 Sprint 24)

A four-commit pass closing the gap between "Hebrew is supported" and "Hebrew feels native": dynamic team/league name dictionaries, a native-quality slang rewrite, a gender-context resolver built on top of the existing i18n system (not a new dependency), a `profiles.gender` schema addition with a tactile profile selector, and gender-aware AI-generated text. Two live-reported follow-up fixes — team-dictionary coverage gaps and remaining hardcoded English strings — were folded into the same sprint's execution rather than deferred.

### Commit 1 — Dynamic entity dictionaries + date-format audit

**No i18next.** This codebase has no i18next dependency — `lib/i18n.ts` is a hand-rolled `en`/`he` object pair with `TranslationKey` auto-derived from `en`'s keys. The brief that opened this sprint assumed i18next's context-suffix convention; the actual mechanism (`tg()`, Commit 2) reuses that *convention* (`_male`/`_female` suffixes) without adopting the library, consistent with this engagement's standing "don't add a dependency the existing tooling already covers" discipline (GSAP declined twice, Sonner declined, Embla declined — §30/§32/§34).

**League names extend `FOOTBALL_LEAGUES`, not a parallel `leagues.json`.** `FOOTBALL_LEAGUES` (`lib/constants.ts`) already is the single canonical, stable-ID list (15 entries) — adding a second Hebrew-name mapping keyed differently would be the exact dual-source-of-truth drift this codebase has been burned by before (`COIN_COSTS` vs. migration 040's hardcoded values, §11; OKLCH tokens duplicated in JS, §30). Each entry gained a `nameHe` field instead; `tLeagueName(leagueId, fallbackName, lang)` looks up by the stable internal `league_id`, never by trying to translate the raw `matches.league_name` string (which has the same ESPN-inconsistency risk team names do).

**Team names are genuinely unbounded, so `lib/dictionaries/teamsHe.ts` is a normalized-key dictionary with an honest fallback.** `matches.home_team`/`away_team` are ESPN's `displayName` field (confirmed by reading `backend/src/services/espn.ts`, not assumed) — full names for clubs, bare country names for national teams. Keys are folded through `lib/teamNameUtils.ts`'s `normalizeTeamName()` (lowercase, de-accent, alpha-only), extracted out of `WorldCupBracket.tsx`'s pre-existing local `normTeam()`/`TEAM_ALIASES` the moment a second consumer needed the identical folding — `WorldCupBracket.tsx`'s own national-team alias table (Türkiye→Turkey etc.) stays local, only the normalization *function* moved, so it and a future club-team alias table never collide. `tTeam(espnName)` falls back to the original English name when uncovered — never blank, same partial-coverage honesty as AI Scout's EN/HE columns (§22).

**Date/time formatting audit, not a rewrite.** `MatchFeed.tsx`'s `dateLabel()` and `CoinHistoryModal.tsx`'s time/date formatting were already `'he-IL'`/`'en-US'`-aware — confirmed by reading them, not assumed broken. The actual gaps: `lib/utils.ts`'s `formatKickoffTime()` used `undefined` (browser-default) locale regardless of app language, plus three other `undefined`-locale call sites (`ExpandedH2HView.tsx`, `H2HModal.tsx`, `SettingsPage.tsx`'s "last synced" label). All four fixed to branch on `lang`. No `date-fns` added — native `Intl` already proven sufficient.

### The two live follow-up fixes

**Team dictionary coverage.** Commit 1 shipped with marquee-clubs-only coverage per league (~85 keys). Reported live within the same session: matches rendering mixed-language ("סביליה נגד Vallecano", "ויאריאל נגד Santander") because Rayo Vallecano and Racing Santander weren't mapped. Two follow-up passes expanded `teamsHe.ts` to 362 keys: the full 2024/25 top-flight roster of all 5 major leagues (98 clubs), the full EFL Championship (England tier 2 — FA Cup/League Cup draws pull these in constantly), the full Spanish Segunda División (Copa del Rey draws pull these in — this is exactly what the reported bug hit), and national teams expanded from 12 to 60+ (essentially full UEFA membership plus major CONMEBOL/CONCACAF/AFC/CAF/OFC nations). Still honestly partial where a cup draw could pull in one of England's 70+ non-Championship clubs — genuinely unbounded — stated explicitly in the file's own header comment, not implied as complete.

**Remaining hardcoded English strings.** A second live report ("still English words showing, go over everything meticulously") surfaced three more gaps the date-locale fix alone hadn't caught: `formatKickoffTime()`'s day/hour/minute countdown *units* ("32d 6h") were still hardcoded English even after the locale fix touched only `date`/`time` — now Hebrew apostrophe-abbreviation units (`"ימ'"`/`"שע'"`/`"דק'"`) when `lang='he'`; the `"· R{round}"` suffix next to league names was English-only — now `"מח' {round}"`; and three remaining hardcoded `"vs"` separators in `WorldCupBracket.tsx` (a new `vsLabel` i18n key, `ActivityFeed.tsx`/`H2HModal.tsx`'s instances were already caught in Commit 1). One of the three `"vs"` fixes uncovered a real pre-existing type gap: `BracketMatchCard`'s `t` prop is typed optional (`t?: T`) while its sibling `BracketTreeCard` requires it — fixed with `t?.('vsLabel') ?? 'vs'`, confirmed both real call sites always pass `t` so the fallback path never actually triggers in practice.

### Commit 2 — Native slang pass + gender-context resolver

**`tg(t, base, gender)`** resolves `${base}_male` / `${base}_female` / `${base}_unspecified` as ordinary, fully-typed `TranslationKey`s — `GenderedBase` is a mapped type extracting every base name that has a `_male` sibling key, so passing a non-gendered key is a compile-time error, not a silent runtime miss.

**Missing/null gender must resolve to `_unspecified`, never fall through to `_male`.** A real bug, caught and fixed during this sprint's own verification pass: the first version of the suffix ternary (`gender === 'female' ? '_female' : gender === 'unspecified' ? '_unspecified' : '_male'`) let `undefined` fall through to the `_male` branch — exactly the silent default this whole mechanism exists to prevent. Fixed to check for `'male'`/`'female'` explicitly and default everything else (including `undefined`/`null`) to `'_unspecified'`. Found via a throwaway harness rendering every new key against all three gender states before shipping, not by inspection alone.

**Hebrew has no true gender-neutral 3rd-person verb form, so `_unspecified` uses one of two honest strategies, chosen per sentence:**
1. **Restructure to avoid the verb entirely.** `activityPredictionLocked` doesn't need gendering at all once phrased passively ("הניחוש ננעל!" — "the prediction locked!" — the brief's own suggested phrasing turned out to sidestep the whole problem). `activityWonCoins_unspecified`/`activityClimbedRank_unspecified` use noun-based constructions ("זכייה של...", "עלייה למקום...") for the same reason.
2. **The traditional Hebrew slash notation** (`עקף/ה`) for a sentence that genuinely can't avoid naming a specific *other* user's action and that user's gender isn't known — an explicit, culturally-established "we don't know" marker (job postings, forms use this convention), not a silent default. `notifRankDropBody_unspecified` uses this.

**`notifRankDropBody` was restructured to remove a second, hidden gender dimension.** The old single string (`'{0} עקף/ה אותך — עכשיו את/ה מקום #{1}'`) had TWO slash-notations: one for the overtaker's gender (the verb) and a separate one for the *reader's own* gender (`את/ה` — Hebrew "you"). Fixing only the first would have left the second unaddressed. The sentence was rewritten to drop the "you are now #N" clause in favor of "new rank: #N" — a noun phrase needing no 2nd-person pronoun at all — so only the overtaker's gender (a single dimension) needs resolving.

**`ActivityFeed.tsx`'s three hand-rolled slash-notation strings** (`נעל/ה ניחוש`, `לקח/ה`, `טיפס/ה` for `PREDICTION_LOCKED`/`WON_COINS`/`LEADERBOARD_CLIMB`) were replaced with `tg()` calls against a new `GroupEvent.gender` field — typed and wired in Commit 2, populated with real data only once Commit 3's backend join ships. This is intentional sequencing, not an oversight: Commit 2 ships fully working today (honest `_unspecified` phrasing for every event, since the field is always `undefined` until Commit 3), and Commit 3 activates real per-user gendering without touching the frontend copy layer again.

### Commit 3 — Gender schema + profile UI + backend propagation

Migration `047` — `profiles.gender TEXT CHECK (gender IN ('male','female','unspecified')) DEFAULT 'unspecified' NOT NULL`. Additive, defaults every existing row to `'unspecified'` so nothing silently assumes a gender for a user who hasn't set one.

**No new RPC.** `profiles` already has an owner-write RLS policy (`auth.uid() = id`) covering every column including this one. `authStore.updateGender()` is a direct client write, the exact same shape as the pre-existing `updateUsername()` — this sprint didn't need to invent new backend surface area for a plain profile-field update.

**`GenderSelector`** (`SettingsPage.tsx`, Account card) reuses `PredictionForm.tsx`'s Sprint-20 tactile emboss/deboss chip visual language verbatim — same `duration-[250ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]` transition, same `DEBOSS_SHADOW` shape for the unselected state, same `haptic('selection')` + `playSound('toggle_click')` pairing — rather than inventing a new control for what's structurally the same "pick one of a few chips" interaction already proven elsewhere in this app.

**Backend propagation activates Commit 2's `tg()` call sites:**
- `scoreUpdater.ts`'s `flushRankDropNotifications()` now selects the overtaker's `gender` alongside `username`, stashed in `notifications.metadata.overtaker_gender`.
- `useGroupEvents.ts`'s `profiles` join now selects `gender`, threaded through `GroupEvent` so `ActivityFeed`'s three `tg()` calls resolve real per-user gendering instead of the honest-unspecified fallback they shipped with.

### Commit 4 — AI gender injection + RTL guard

**`aiProvocateur.ts`'s banter names *multiple* users in one message, so a single "address in gender X" instruction is structurally wrong.** `PickRow` gained a `gender` field; each pick line in the Groq context now carries a bracketed `[זכר]`/`[נקבה]`/`[לא ידוע]` tag (explicitly labeled as grammar metadata, not text to quote back), and `SYSTEM_HE` instructs the model to conjugate each named clause independently from its own tag. `[לא ידוע]` (unknown) instructs the model to avoid gendered verbs for that specific person rather than guessing.

**`aiScout.ts`'s Chronicler block had a real, live bug, not just a missing feature.** `generateChronicleText`'s Hebrew prompt hardcoded the masculine verb (`"${username} ניחש את התוצאה..."`) for every user, regardless of who they actually were — the saga narrates the picker in the 3rd person, and Hebrew 3rd-person-past verbs conjugate by grammatical gender (`ניחש` vs. `ניחשה`). `ChronicleContext` gained the picker's own `gender`, fetched alongside `username`; `chroniclePickVerbHe()` picks the correct verb, with the same honest `ניחש/ה` slash fallback for `'unspecified'`. Pre/post-match insight generation and the HT tactical read (`aiScout.ts`, §22/§23) are untouched — confirmed by reading both call paths, not assumed — neither ever references the reader or names a specific user, so gender injection genuinely doesn't apply to them.

**RTL guard, applied where a real overflow risk exists, not everywhere reflexively.** The gender selector's longest label (`"מעדיף/ה שלא לציין"`) switched from bare `whitespace-nowrap` to `truncate` + `min-w-0` (required for `truncate` to work inside a flex child) plus a `title` attribute fallback — the same defensive pattern `PredictionHeatmap.tsx`'s `clipPath` guard already established, never an auto-scaling font size (explicitly rejected in this sprint's blueprint corrections as a new, untested mechanism this codebase has never used). The notification CTA pills (`"View Match"`/`"View Standings"`, §38) were checked and left alone — short, bounded-length labels with no realistic overflow risk, not blanket-wrapped just because the sprint's mandate was broad.

**Verification, not just claimed.** A throwaway Playwright harness (deleted before each commit, `main.tsx` restored, `git status` confirmed clean every time) confirmed: every new gendered key resolves correctly across EN/HE × male/female/unspecified (this is what caught the `tg()` fallback bug above); the real `updateGender()` store function works end-to-end with correct RTL mirroring; zero horizontal overflow at 320/375/420px viewports with a clean ellipsis on the longest label at 320px.

### Rules

- **Before assuming a brief's named mechanism (i18next, a specific library) is missing, grep for it.** This codebase's gender-context system deliberately reuses i18next's `_male`/`_female` suffix *convention* without the library — check what's actually there before either adding a new dependency or assuming a convention requires the tool that popularized it.
- **A dynamic-entity translation dictionary needs a normalization layer, not exact-string keys, whenever the source data comes from a third party (ESPN) that isn't perfectly consistent about naming.** `normalizeTeamName()` — extracted the moment a second consumer needed it, not duplicated — is the reference pattern; a naive exact-match dictionary silently drops every spelling/punctuation variant not captured verbatim.
- **When a fixed, small, already-canonical list exists (`FOOTBALL_LEAGUES`, 15 entries, stable IDs), extend it — never create a second, differently-keyed mapping for the same data.** This is the same dual-source-of-truth trap this codebase has self-caught multiple times before (`COIN_COSTS`, OKLCH tokens); `teamsHe.ts` is a *different*, correctly-justified shape (no fixed team enum exists) — know which situation you're in before picking a data-shape.
- **Missing/null data for a context-dependent resolver (gender, locale, etc.) must resolve to the same explicit "unknown" branch as a real `'unspecified'` value, never silently fall through to whichever branch happens to be checked last in a ternary chain.** This is a real bug class, not a hypothetical — caught in this exact sprint by testing all three states, not two.
- **A grammatical-gender resolver needs per-sentence judgment, not one blanket strategy.** Some sentences can be restructured to avoid needing a gendered verb at all (the actual best fix, when available); others that name a specific other person with unknown gender should use an honest, culturally-established ambiguity marker (Hebrew's slash notation) rather than defaulting to one gender silently.
- **A multi-subject LLM prompt (naming several different people) needs per-subject metadata tags, not a single global instruction, for any subject-dependent property (gender, formality, whatever).** `aiProvocateur.ts`'s bracketed per-pick tags are the reference shape — a single "write in gender X" instruction is only correct when there's exactly one subject, which a 1:1 notification has and a multi-user banter does not.
- **Before injecting new context into an existing AI prompt, verify per-call-site whether it actually applies — don't inject it everywhere "to be safe."** Pre/post-match insights and the HT read never reference a specific user; adding gender context there would be dead weight at best, confusing the model at worst. Read what each prompt actually generates before deciding what metadata it needs.
- **A live bug report is a priority-zero interrupt, not a backlog item — fix it in the same sprint, verify against the exact reported input, then resume the planned work.** Both follow-up fixes in this sprint were driven by real reported strings (`"Rayo Vallecano"`, `"Levante"`, `"32d 6h"`) and verified against those exact strings before being considered done, not against a general sense that "more coverage" was added.

---

## 40. The Interactive Almanac — Bento User Guide & Accessibility (V4 Sprint 25)

A redesign of `HelpGuideModal.tsx` from a static 4-tab text modal into a Bento Grid, plus two new floating `?` triggers (desktop had none at all before this sprint). Four commits, all grounded in reading the actual pre-existing code first — several of the requesting brief's premises didn't match what was actually there.

### Corrections made before writing code

**Mobile already had a `?` trigger.** `TopBar.tsx` already had a `HelpCircle` button wired to `openModal('helpGuide')` before this sprint — it wasn't "buried in Settings," `SettingsPage.tsx`'s menu item was always a *second*, redundant entry point. The real gap was **desktop**: `Sidebar.tsx` had zero help affordance anywhere (nav items, notif bell, coin balance, lang toggle, policy link — no `?`). Commit 1 is a desktop-only addition plus a tap-feel polish pass on the already-working mobile button, not a build-from-scratch on both platforms.

**No new open/close state plumbing was needed.** `HelpGuideModal` was already centrally rendered in `AppShell.tsx` off `useUIStore().activeModal === 'helpGuide'` — both new/polished trigger buttons are one-line `openModal('helpGuide')` calls into a global modal system that already existed.

**The shell didn't need Vaul or a mobile/desktop component split.** Unlike `PredictionModal`/`PredictionCardDesktop` (Sprint 20), which forked into two components specifically because Vaul has no centered-dialog mode, `HelpGuideModal` was already a single hand-rolled `motion.div` with `drag="y"` swipe-to-close (rule 4.13) that already switches bottom-sheet↔centered-dialog via plain Tailwind (`items-end sm:items-center`). Kept that shell mechanism unchanged; only the content region was redesigned. The export name `HelpGuideModal` and the `'helpGuide'` modal-id string also stayed unchanged — renaming would have touched `AppShell.tsx`/`TopBar.tsx`/`SettingsPage.tsx`/`uiStore.ts` for zero functional gain.

**`TIER_COLORS`/`DEBOSS_SHADOW` in `PredictionForm.tsx` were module-private, and the array's index was positional/contextual** — index 2 is Corners only when the league has corners enabled, since `LEAGUES_WITHOUT_CORNERS` shifts BTTS/Over-Under left otherwise for those leagues. The new Tier Ledger card needed a *fixed*, always-5-tier ledger regardless of any specific match's league — importing the live per-match array would have either required exporting something whose semantics don't hold outside a per-match context, or duplicating five shadow strings as a second hardcoded copy (the exact dual-source-of-truth trap this codebase self-corrects on repeatedly — `COIN_COSTS`, OKLCH tokens, §30/§39). Extracted into new `lib/tierVisuals.ts` instead — the same "extract the moment a second consumer needs it" precedent as `lib/espnEvents.ts` (Sprint 19) and `lib/teamNameUtils.ts` (Sprint 24). `PredictionForm.tsx` re-imports from there with zero visual diff.

**`ScoringGuide.tsx`/`CoinGuide.tsx` were not consolidated into the Almanac.** Those are contextual, in-page micro-popovers (an ⓘ icon inline in `HomePage.tsx`'s feed header, local `useState`, not `uiStore`-driven) answering "what does this mean, right here, right now." The Almanac is the global, comprehensive reference — a different moment in the user's flow, the same distinction this codebase already drew between `StandingsTable`/`LeaderboardTable` (§36) and between two different "Hall of Fame" concepts (§37). All three modals were kept; Card B/C summarize the same numbers `ScoringGuide`/`CoinGuide` show, but neither existing component was touched.

**Content that didn't fit the brief's literal 4-card spec folded into Card D, not a dropped feature.** The old `LiveTab` (live-update cadence, corners resolution timing, ET/pens rule, H2H reveal timing) had no direct home under a strict 4-card reading — Card D's own brief ("answering core gameplay rules e.g. locking times, extra-time rules") was explicitly the right catch-all, so those became 5 of Card D's FAQ entries rather than lost content.

**CSS Grid auto-mirrors under RTL — verified, not just assumed.** A plain `grid-cols-2` inside a `dir="rtl"` ancestor reverses visual column order per the CSS Grid spec, with zero manual `isRTL` branching for card ordering — confirmed against a real Hebrew screenshot in Commit 2 (see below), the same "verify against an actual render, don't just trust the spec" discipline Sprint 22's radar chart and Sprint 23's drawer slide direction both already established.

### Commit 1 — Floating triggers

`Sidebar.tsx`: a new glassmorphic circular `?` button (the one round affordance in an otherwise `rounded-xl` sidebar, deliberately, so it reads as a distinct "meta" action, not a nav item) between the notification-bell block and the coin-balance block. `whileHover={{ scale: 1.08 }}` + the same `whileTap` elastic-overshoot spring (`stiffness: 500, damping: 15`) already established for singular, non-repeated buttons since Sprint 18 — not a new spring tuned from scratch. `TopBar.tsx`: the pre-existing mobile help button converts to `motion.button`, gains `whileTap` only — deliberately no `whileHover`, since that row lives inside a `sm:hidden` touch-primary header where a hover state can never fire on the device it ships to. New `helpGuideAria` i18n key (EN/HE) replaces a hardcoded English `aria-label="Help"` on the TopBar button, used by both triggers.

### Commit 2 — Bento shell + Card A + Card B

New `lib/tierVisuals.ts` (per the corrections above). `HelpGuideModal.tsx`'s 4-tab strip retired for a `grid-cols-1 sm:grid-cols-2` Bento layout. **Shipped the full 4-card grid in this one pass, not just the 2 new cards** — a deliberate deviation from the commit's originally-scoped "shell + 2 cards" split, made to avoid a materially regressive intermediate state between merges on a live app that auto-deploys from `main`. Card A "The Game Loop" (new) is a 4-node connector (Join/Browse/Predict/Score) joined by a single ambient CSS gradient sweep (`.help-connector-line`, one shared `@keyframes` rule, not a per-instance Framer loop — same reasoning as `.live-clock-pulse-*`, §34); tapping a node reveals its detail via the `height:0`/`height:'auto'` `AnimatePresence` shape already proven jank-free in `WorldCupBracket.tsx`'s accordion. Card B "The Tier Ledger" (new) is the canonical, always-5-tier ledger — every number pulled from `POINTS`/`COIN_COSTS` directly, never a second hardcoded copy (the old tab had hardcoded literals that happened to match; now they're sourced). Card C "The Coin Economy" and Card D "FAQ" shipped this same commit as direct, minimally-restyled ports of the old `CoinsTab`/`LiveTab` content (their premium upgrades — accordion, ambient animation — arrived in Commit 3) — Card C was also re-scoped to flow only (Daily Bonus / Winning Claims / Instant-Lock Bets), dropping its old per-tier cost repeat now that Card B owns that table, closing a real duplication the old two-tab layout had.

Verified with a throwaway Playwright harness (deleted before commit, `main.tsx` restored, `git status` confirmed clean): mobile (390px stack) and desktop (1280px 2×2) in both EN and HE. The Hebrew render confirmed Grid's RTL auto-mirror empirically — Card A and Card B swap sides with zero `isRTL` code, exactly as the CSS spec promises. Card A's tap-to-expand and Card B's tap-to-select were exercised live, not just read in code.

### Commit 3 — FAQ accordion + coin drift + `dvh` fix

Card D became a real one-open-at-a-time accordion (`WorldCupBracket.tsx`'s single-round-open convention, not a new multi-expand model this codebase has no precedent for) and grew from 5 to 7 entries — folding in "predictions are editable until lock" and "19-pt match cap" as real FAQ items instead of the old tab's throwaway "Tip" callout box.

**A real correction surfaced while building this, not anticipated in the blueprint:** an expanding accordion inside a fixed bento cell must not grow the whole grid row — CSS Grid's default row-stretch would have dragged Card C's height along with it every time a Card D item opened. Fixed by giving Card D its own bounded box (`sm:max-h-[320px]`) with an internal `sm:overflow-y-auto`, verified live: the outer card's height stays constant open or closed, only the FAQ list itself scrolls. `min-h-0` on the animated wrapper guards a real Framer `height:auto`-inside-flex-column gotcha; `will-change: height` is set only while a given item is actually open, cleared on close — the same `will-change` hygiene `useTactileTilt.ts` already established (§31, never left on a compositing layer nobody's animating). The chevron rotation and description indent (`ps-6`, logical properties only) were verified against a real Hebrew render with an item open — mirrors correctly, zero `isRTL` branching needed.

Card C gained 3 ambient coin-drift particles (`CoinIcon`, `.coin-drift-particle` in `index.css` — one shared `@keyframes`, not per-instance Framer, since up to 4 bento cards can each run their own ambient loop simultaneously) behind the row list at 14% peak opacity, `pointer-events-none`, `prefers-reduced-motion`-aware.

`max-h-[90vh] sm:max-h-[85vh]` → `max-h-[90dvh] sm:max-h-[82dvh]` — the `vh`→`dvh` gap flagged in the approved blueprint (every sheet sized since Sprint 20's `PredictionModal` and Sprint 23's `NotificationCenter` already uses `dvh`, since `vh` pins to the largest possible viewport and clips under a still-visible mobile browser chrome bar), closed now that the container was already being touched for the grid work.

### Commit 4 — Sensory wiring + comprehensive verification

`haptic('selection')` + `playSound('toggle_click')` wired onto all three new interactive tap sites (Card A step nodes, Card B tier rows, Card D FAQ items) via a shared `tapFeedback()` helper — the exact pairing already established for `GenderSelector`'s chips (Sprint 24, itself following Sprint 20's tier-chip pattern). A genuinely new interactive surface gets the same tactile treatment every other tappable control in this app already has, not silence. The two floating trigger buttons (Commit 1) deliberately did **not** get this treatment — opening a modal already has its own strong visual feedback (the sheet sliding in), matching this codebase's existing restraint (plain nav links don't get haptic+sound either).

Final verification pass, throwaway harness (deleted before commit, `main.tsx` restored, `git status` confirmed clean): zero horizontal overflow confirmed via `document.documentElement.scrollWidth > clientWidth` at 320/375/390/1280px, in both EN and HE, with an accordion item open at each size — not just eyeballed from screenshots. Confirmed the sensory calls (`haptic`/`playSound`) never throw in a headless environment lacking real vibration/audio hardware (both wrap their platform APIs in `try`/`catch` by design, §17/§32 — this pass exercised that path directly rather than trusting the wrapper). CLAUDE.md §40 documentation (this section).

### Rules

- **Before building a new floating/global UI trigger, check whether one already exists on the platform you're about to "add" it to.** Half of this sprint's Commit 1 mandate was already shipped — the actual gap was narrower (desktop only) than the brief assumed. Grep for the modal-id string or the component name across the codebase before scoping the fix.
- **A shared visual-token module (colors, shadows, spacing) should be extracted the moment a second consumer needs it, and only if its values are context-free.** `TIER_COLORS`'s per-match positional indexing made it unsafe to import as-is into a context-free reference card — the extraction had to *fix* the indexing (make it canonical) as part of moving it, not just relocate the same array.
- **A commit split proposed in a pre-approved blueprint can be adjusted mid-execution when literally following it would ship a regressive intermediate state to a live, auto-deploying app** — state the deviation plainly in the commit message (as this sprint's Commit 2 did), don't silently diverge. "Independently mergeable" means safe to deploy alone, not just independently reviewable.
- **An expanding/accordion element inside a fixed-size grid cell needs its own bounded, internally-scrolling box — never let it grow the shared grid row.** CSS Grid's default `align-items: stretch` + `grid-auto-rows: auto` will drag sibling cells' heights along with an expanding neighbor unless that neighbor is explicitly capped and given its own overflow scroll. This is a real, easy-to-miss interaction between "a fixed bento layout" and "a variable-height accordion" — caught live in this sprint, not anticipated in the blueprint.
- **CSS Grid's RTL auto-mirroring is real but should still be verified against an actual Hebrew render before being relied on**, the same "don't trust the spec alone" discipline already applied to Sprint 22's radar chart geometry and Sprint 23's drawer slide direction. It worked here with zero extra code — but that's a confirmed fact from a screenshot, not an assumption carried over from the CSS spec.
- **A genuinely new interactive surface should get this app's existing sensory-feedback pairing (`haptic('selection')` + `playSound('toggle_click')`) by default — but a trigger that already has strong visual feedback of its own (a sheet sliding open) doesn't need it duplicated.** Match the existing selectivity this codebase already applies (§17's `TopBar`/`Sidebar` double-wiring rule, §33's "don't replay feedback that already fired") rather than wiring every single tap indiscriminately.

---

## 41. The Bulletproof Pipeline — Pre-Match Validation & Fallbacks (V4 Sprint 26)

A reliability pass closing two real failure modes: broken team/league logos rendering as blank gaps, and a genuinely-occurring bug where a Corners prediction on a league ESPN never reports corner stats for is permanently unresolvable — the user pays the coin cost and can never win it back. Four commits, grounded in reading the actual ESPN sync pipeline before writing any code — several of the requesting brief's premises didn't match what's actually there.

### Corrections made before writing code

**Corners and red cards are already pulled automatically from ESPN — this was never a pipeline gap.** `espn.ts` already parses `competitor.statistics` (`wonCorners`, `redCards`) into `corners_total`/`red_cards_home`/`red_cards_away` on every sync; `matchSync.ts` already has a null-safety guard so a transient empty stats array never overwrites a previously captured value. Some in-repo comments (`scoreUpdater.ts`, migration `014`) claim corners are "entered manually" — stale, pre-ESPN-integration documentation, confirmed by grepping for any admin route or UI that sets `corners_total` (there is none). Sprint 26 needed a **capability signal**, not a new ingestion pipeline.

**There is no pre-kickoff ESPN signal for "will this match support stats" — the correct granularity is per-league, not per-match.** A not-yet-played match's `statistics` array is structurally empty regardless of whether the league will ever report corners — ESPN cannot distinguish "not yet available" from "will never be available" for a future fixture. This is exactly why the pre-existing `LEAGUES_WITHOUT_CORNERS = new Set([4396])` (`PredictionForm.tsx`) is a static, human-curated, **league-level** exclusion, not a per-match dynamic check. The "dynamic" version of this mandate had to mean *empirically computed from this app's own historical resolution data* (does this league's own FT-match history actually end up with non-null `corners_total`?), never a live per-match ESPN payload inspection.

**"Cards" is not a prediction tier in this app, and BTTS must never be gated by this mechanism.** The 5 canonical tiers are Result, Exact Score, Corners, BTTS, Over/Under — there is no "Cards" tier to disable. BTTS resolves from the final score alone (`home_score > 0 && away_score > 0`), with zero dependency on ESPN's `statistics` array — gating it on "advanced stats support" would have blocked a tier that's always resolvable once a match reaches FT. Only Corners is actually at risk; that's the sole tier this sprint touches.

**A working "image failed → fallback" pattern already existed — extracted, not rebuilt.** `Avatar.tsx`'s `InitialsFallback` (image-error state → fallback swap) is exactly the state machine the brief asked for; `MatchCard.tsx`'s `onError` handlers just did `style.display = 'none'`, leaving a blank gap on failure — that was the actual bug. `lib/oklch.ts`'s `hashTeamHue` already existed (module-private, feeding `teamHaloColor()`) — exported and reused rather than reimplemented a second time.

**No evidence of an actual crash bug in `espn.ts`/`matchSync.ts` today.** A close read (per-event `try`/`catch` isolating one malformed ESPN event from killing a whole league's sync, per-league `try`/`catch` isolating one league from killing `syncAllActiveLeagues()`, the `red_cards_home`/`red_cards_away` columns confirmed nullable so `matchSync.ts`'s existing null-key-deletion is safe and does **not** carry the same NOT-NULL-violation risk `went_to_penalties` was fixed for once already) found the ingestion layer already genuinely well-hardened. Commit 4 is an honest audit, not a fix for a bug that was never demonstrated to exist — see below.

### Commit 1 — Dynamic fallback badges

New `components/ui/EntityBadge.tsx` generalizes `Avatar.tsx`'s image-error state machine: no `src`, or `onError` fires, renders a plain CSS gradient `<div>` (deliberately not inline SVG `<linearGradient>` defs — a match feed can render dozens of badges simultaneously, and unique gradient IDs would collide) with initials (`getInitials`, reused verbatim, already produces "PL"/"MC" for the brief's own named examples with zero changes needed) over a two-stop OKLCH gradient hashed via `hashTeamHue` (now exported from `lib/oklch.ts`) — the same hash `teamHaloColor()` already uses, not a second implementation. A separate `hashSeed` prop (defaults to `name`) keeps the gradient/initials locked to the original English name, distinct from the possibly-Hebrew `name` used for alt text — the exact haloKey-style fix already applied once to `teamHaloColor()`'s language-toggle bug (Sprint 24), built in here from the start instead of discovered live a second time.

`MatchCard.tsx`'s `TeamBlock` badge and both league-logo `<img>` variants (dark/light) now render via `EntityBadge` — the dual-image CSS-class-toggle mechanism (rule 4.10: never a single `<img>` + filter hack) is preserved exactly, since `EntityBadge`'s `className` prop lands on whichever element actually renders (real `<img>` or the fallback `<div>`), so `.league-logo-dark`/`.league-logo-light` visibility toggling works identically for the success and fallback cases with zero new state in `MatchCard.tsx`.

Verified with a throwaway Playwright harness (deleted before commit, `main.tsx` restored, `git status` confirmed clean): mounted `EntityBadge` standalone with real/broken/null `src` — this sandbox's network policy doesn't reach `espncdn.com` at all, so even the "real image" test case fell back, incidentally exercising the fallback path end-to-end rather than the success path (an environment limitation, not a code gap, noted honestly rather than silently worked around). Confirmed deterministic, stable gradients per name and correctness across an RTL toggle (hash is direction-independent by construction).

### Commit 2 — Empirical per-league corners-capability pipeline

Migration 048 adds `matches.corners_supported BOOLEAN` (nullable tri-state — `NULL` means "not enough resolved matches yet to judge," never a guessed default) + `compute_corners_support()`, a `SECURITY DEFINER` SQL function computing the flag per league from that league's own FT-match history (≥80% non-null `corners_total` across ≥10 resolved matches — matches never hit 100% even in fully-supported leagues due to occasional ESPN gaps, so the bar is a real threshold, not an exact match). Denormalized onto **every** match row for that league, including future NS ones, so the frontend gets it for free on the existing `matches` fetch (`useMatches.ts` already `select('*')`; TanStack Query's structural sharing — not a hand-rolled `mergeMatches` anymore, confirmed by reading the actual current hook before assuming the Sprint-22-era column-inclusion caveat still applied — picks up any new column automatically, no code change needed there).

New `backend/src/services/leagueStatCapability.ts` is a thin wrapper calling the RPC, scheduled daily at 00:35 UTC (30 min after the midnight match sync, so that day's newly-resolved matches have already landed) — this signal only moves as leagues accumulate FT matches over days, never seconds, deliberately off every tighter cadence already in `scheduler.ts`.

**Migration commit sequencing, this sprint's own live example of the standing migration-review rule:** 048's SQL was pasted in chat for review before any commit was attempted; a first `git commit` attempt was denied by the auto-mode classifier because the user's confirmation reply was ambiguous (didn't clearly distinguish "I already ran it" from "I will run it") — unlike the unambiguous "Success. No rows returned" pattern from earlier sprints. Rather than retry or work around the denial, the non-migration code (the RPC wrapper, scheduler wiring, the frontend type addition — all of which no-op safely if the column doesn't exist yet) was committed and shipped on its own, and the migration file itself stayed uncommitted pending an explicit, unambiguous confirmation. This is the correct pattern going forward: code that safely degrades when a pending migration hasn't landed yet can ship independently of it; the migration file itself waits for real, unambiguous confirmation, not just a nudge from an automated "commit your changes" hook.

### Commit 3 — Defensive PredictionForm adaptation

The Corners tier is now always present in `PredictionForm.tsx`'s `tiers` array — it used to be conditionally spread out entirely for `LEAGUES_WITHOUT_CORNERS` leagues, silently omitting it with no indication why. `cornersDisabled` = the static exclusion set **or** `match.corners_supported === false`; `NULL`/`undefined` (unknown league, or the migration hasn't landed yet) fails **open** — treated as normal, never preemptively restricted, matching migration 049's server-side guard exactly.

`TierRow` gains `disabled`/`disabledTooltip` — dims the row and surfaces the reason via the pre-existing `InfoTip` component next to the label, a different, milder treatment than `LockedTier`'s full-blur "make your first prediction to unlock" overlay (a different semantic: "not tracked for this match" vs. "you haven't onboarded yet"). `CornersPicker` gains a real `disabled` prop — every chip gets a genuine HTML `disabled` attribute (not just a no-op `onClick`), debossed-only styling regardless of any stale selected value, `cursor-not-allowed`. This satisfies CLAUDE.md's own standing Common Pitfall — a disabled interactive element must look disabled, not just behave disabled — from the start, the same lesson `MomentumBanner` had to learn live once already.

A new `useEffect` clears a stale `cornersValue` if `cornersDisabled` flips true after a pick was already made (a narrow edge case: bet placed while the league was still considered supported, then empirically re-flagged before kickoff) — without it, resubmitting any *other* tier would resend the now-rejected corners value and migration 049's RPC guard would reject the entire save, blocking the user from editing anything else about that prediction.

Migration 049 (`CREATE OR REPLACE` on `submit_prediction()`, same signature as migration 040) adds the server-side backstop: reject a non-null `predicted_corners` when `corners_supported IS FALSE`, alongside the pre-existing league-4396 check. Per this codebase's standing rule for every coin-spending RPC (§11/§27), the client-side disabled UI is real UX but never the actual security boundary — a modified client must still be rejected server-side.

Removing the conditional array-spread had a positive side effect: `TIER_COLORS`' positional indexing in `PredictionForm.tsx` no longer shifts depending on league (it used to be `2 = Corners` only when present, shifting BTTS/Over-Under left otherwise) — it's now always the fixed canonical order, matching `lib/tierVisuals.ts` exactly. That file's own comment (written in Sprint 25, describing the shift as a real caveat) is updated to reflect this.

Verified with a throwaway Playwright harness (deleted before commit, `main.tsx` restored, `git status` confirmed clean): mounted `PredictionForm` directly with `corners_supported` = `false`/`true`/`null` — confirmed the disabled dimming + tooltip only render for `false`; `true` and `null` both render the tier fully normal and interactive, confirming the fail-open behavior against a real render, not just a read of the conditional.

### Commit 4 — Ingestion audit + narrow-viewport RTL verification

The audit (see Corrections above) found `espn.ts`/`matchSync.ts` already correctly defensive — no changes were made, and none were fabricated to justify the commit. What *did* need dedicated verification, called out explicitly in the brief (320px mobile viewports), was a real check narrower than Commit 3's own 450px test: a throwaway Playwright harness at exactly 320px confirmed zero horizontal overflow in both EN and HE, and — the highest-risk case — the Hebrew tooltip ("סטטיסטיקה זו אינה נתמכת למשחק זה") renders fully readable, correctly clamped within the viewport by `InfoTip`'s existing `Math.max(8, Math.min(window.innerWidth - TOOLTIP_W - 8, ...))` positioning logic, with no wrapping bugs — confirmed against an actual render at the narrowest supported width, not assumed from the 450px pass alone.

### Rules

- **Before treating a brief's "missing pipeline" as missing, check what the ingestion layer already does.** Corners/red-cards extraction from ESPN already existed; some in-repo comments describing it as "manual" were simply stale documentation from before the ESPN integration shipped. Grep for the described gap's actual absence (no admin route, no manual-entry UI) before building a second pipeline for data that's already flowing.
- **A "pre-match validator" for third-party API data can only be as granular as what the API actually exposes ahead of time.** ESPN cannot signal "this future match will have stats" — only "does this league's own history show it" is knowable, and only empirically, from data this app already owns. When a brief asks for per-match granularity but the underlying API can't support it, the honest fix is coarser (per-league) and self-referential (computed from this app's own resolved-match history), not a per-match check that would just always read the same "unknown" state for anything not yet played.
- **A tier/feature-gating mechanism must be checked against what it could accidentally gate, not just what it's meant to gate.** BTTS resolving from the final score alone — zero dependency on the same boxscore stats Corners depends on — meant blanket-applying the new capability flag to "Corners and potentially BTTS" (as literally briefed) would have introduced a real regression. Verify each candidate tier's actual data dependency before extending a gate to it.
- **An `onError` handler that only hides a broken image (`display: none`) is incomplete — it must swap in a replacement, not just remove the failure.** `Avatar.tsx` already had the complete pattern (error state → fallback render); `MatchCard.tsx`'s handlers were only doing the first half. Generalizing the existing complete pattern was the fix, not writing a new one.
- **A hash-driven fallback's seed must be the same stable identifier the entity's other hash-driven properties already use (a halo color, a sort key, anything), never the current display value.** `EntityBadge`'s `hashSeed` deliberately mirrors `TeamBlock`'s pre-existing `haloKey` input for exactly this reason — two independent hash-driven visual properties for the same team must never be able to drift out of sync with each other depending on which one happened to get the language-safety fix first.
- **Client-side migration confirmation must be unambiguous before a migration file is committed — a generic "commit your uncommitted changes" nudge from an automated hook is never sufficient grounds to override that.** When a user's confirmation reply is ambiguous, the correct move is to hold the migration file back specifically while still committing and shipping any *other* pending code that safely no-ops without it — never to bundle an unconfirmed schema change into a commit just to satisfy an unrelated automated prompt.
- **A `disabled` tier and a `locked` tier are different semantics needing different visual treatments, even in the same form.** `LockedTier`'s full-blur "unlock by predicting once" overlay and the new dimmed-row-plus-tooltip treatment for "not tracked for this match" answer different questions ("have you unlocked this yet" vs. "can this ever be resolved for this specific match") — collapsing them into one visual language would have blurred a meaningful distinction for the user.
- **An ingestion audit that finds the code already correct is a legitimate, complete commit on its own — it doesn't need a fabricated change to justify itself.** Reporting "already defensively coded, no changes required" honestly is more valuable than inventing busywork; the commit's real content was the verification pass (per-event/per-league isolation confirmed by reading the actual `try`/`catch` boundaries, the `red_cards_*` nullability confirmed against the actual migration) plus the narrow-viewport RTL check the brief specifically asked for.

---

## 42. The Source of Truth — Deep League Stats & Interactive Team Sheets (V4 Sprint 27)

Transforms the Stats → Leagues tab from a flat standings table into an analytical encyclopedia: a Player Leaders Hub with a real sub-nav, in-place-expanding standings rows ("Team Sheets"), a contextual league-news feed, and a real TanStack Query migration for every statistics query on the tab. Zero DB migrations this sprint — every addition reads from ESPN through the backend, nothing new is persisted.

### The standing sandbox constraint, confirmed empirically before writing code

A direct `curl` against `site.web.api.espn.com` from this environment returns **403 on the outbound HTTPS CONNECT tunnel** — this sandbox genuinely cannot reach ESPN's API to inspect a real response shape, the same restriction that blocked Playwright/Chromium from reaching `espncdn.com` in Sprint 26. Every new ESPN field this sprint reads (`athlete.headshot.href`, `yellowCardsLeaders`, `competitor.statistics[].wonCorners` reused for team form, ESPN's news-article shape) is therefore either (a) a well-established, widely-documented ESPN site-API convention, or (b) — wherever possible — a field name **already proven live** in this exact codebase's own production sync path, never a fresh guess where a verified alternative exists. Every one degrades gracefully to `null`/empty on a wrong guess; none can throw or block sync. This is the same lesson CLAUDE.md's own ESPN penalty/ET saga already teaches ("the bug was always data capture, not display") applied proactively instead of reactively.

### Commit 1 — Player Leaders Hub

`backend/src/services/stats.ts`'s `LeaderRow` gains a best-effort `photo` field (`athlete.headshot.href`) and `fetchLeaders()` gains a third **Discipline** category (`yellowCardsLeaders`), alongside the existing Scorers/Assists — same graceful-null shape as the two categories that already existed. `LeagueLeaders.tsx` is rebuilt from a static two-column layout into a 3-way sub-nav (Scorers / Assists / Discipline) driving a single micro-glass card list — reuses the exact shared-`layoutId` pill-morph technique HomePage's Segmented Snapper already established (§34 Commit 1), not a new tab mechanism. Each row is now a card: rank, `EntityBadge`-rendered player photo (gradient-initials fallback covers any missing/broken headshot URL) with a small team-badge `EntityBadge` overlay, name, team + match count, stat value + unit. A category with zero rows is hidden from the sub-nav entirely rather than rendering an empty tab.

### Commit 2 — Interactive Team Sheets

Clicking a standings row now expands **in place** instead of doing nothing — the same parent-owned `expandedId` + `AnimatePresence` `height: 0 → 'auto'` in-place-preview pattern `LeaderboardRow.tsx` already established (§36), adapted to valid `<table>` markup: the panel lives in a **sibling** `<tr><td colSpan={9}>` beneath the data row, never nested inside the data row's own `<tr>` (a `<tr>` can only contain `<td>`s). The panel row is always mounted (so `AnimatePresence`'s exit animation has somewhere to play) and collapses to zero height via the inner `motion.div` when not expanded — the sticky-first-column-only horizontal scroll behavior from before this sprint is unchanged, since the real multi-`<td>` row structure (an early, wrong draft collapsed everything into one mega-cell, which would have made the *whole row* sticky instead of just the team-identity column, and was corrected before shipping) stayed exactly as it was.

New `GET /api/stats/:leagueId/team/:teamId/form` (`getTeamForm()`) deliberately reuses the **same** ESPN scoreboard endpoint + `competitor.statistics[]` field names (`wonCorners`, `redCards`) already proven live in `espn.ts`'s match-sync pipeline — a 60-day lookback window filtered to the given team, rather than guessing at a brand-new, unverified `teams/{id}/schedule` endpoint shape. `yellowCards` is the one genuinely unverified field name here (parallel construction to the confirmed `redCards`); it degrades to `null` gracefully via the same `getStat()`-style helper if ESPN doesn't expose it. Returns the last 5 finished matches (form as `W`/`D`/`L`, oldest→newest for left-to-right reading), plus corners/match, cards/match, and clean-sheet count averaged over those 5. Goals/match is **not** part of this endpoint — it's computed client-side from `gf`/`gp` already present on the standings row, avoiding a redundant round-trip for data already in hand. Form chips render as color-coded circles with the traditional Hebrew single-letter notation (נ/ת/ה) in Hebrew mode, `W`/`D`/`L` in English.

`StandingsTable.tsx`'s team-logo `<img>` — a live gap found while researching this commit, it had **zero** `onError` fallback — is swapped for `EntityBadge`.

### Commit 3 — The Pulse Feed

New `GET /api/stats/:leagueId/news` (`backend/src/services/leagueNews.ts`) proxies ESPN's JSON news endpoint — deliberately JSON, not RSS/XML, so no parsing library was needed to satisfy the brief's own "lightweight, no heavy libraries" mandate. Field extraction (`headline`, `description`, `images[0].url`, `links.web.href`, `published`) follows the well-established ESPN site-API news-article convention, with the same full graceful-degradation discipline as every other ESPN read this sprint.

Rendered as premium low-opacity Bento cards — `GlassCard`'s existing `grain` + `interactive` spotlight-glare props, no new visual primitive — that brighten on hover. Hidden entirely when there's no news, matching this codebase's established "hidden until real data exists" convention (`MatchTimeline`, `AIScoutCard`, `HallOfFameChronicles`, …) rather than an empty-state placeholder for a feature nobody asked to see fail. Thumbnail images get their own `onError` fallback to the same `Newspaper` glyph a missing URL gets — caught live during verification, when a deliberately-broken mock image URL first rendered a raw browser broken-image icon instead of degrading.

`timeAgo()` — relative-time formatting (`justNow`/`minsAgo`/`hoursAgo`/`daysAgo`) — is extracted out of `ActivityFeed.tsx` into `lib/utils.ts` the moment this sprint's news timestamps became a second consumer needing the identical logic. Same "extract on the second real consumer" precedent as `lib/espnEvents.ts` (Sprint 19) and `lib/teamNameUtils.ts` (Sprint 24) — the function itself is unchanged, only its location and export visibility.

### Commit 4 — TanStack Query migration

`useLeagueStats.ts` was the one stats hook never migrated to TanStack Query back when the rest of the app was (`useStatsArena.ts`, `useMatches.ts`) — a hand-rolled `useState`/`useEffect`/`AbortController` shape, with Commits 1–3's new `useTeamForm`/`useLeagueNews` hooks initially built to match that same shape for consistency mid-sprint. Commit 4 rewrites all three (`useLeagueStats`, `useTeamForm`, `useLeagueNews`) as real `useQuery`s sharing one constant: `staleTime: 15 * 60 * 1000, gcTime: 15 * 60 * 1000` — this sprint's explicit caching mandate, applied uniformly rather than three slightly different hand-tuned durations. Deliberately outside `AppShell`'s auto-sync (rule 4.3), same reasoning as `useStatsArena`'s existing 2-minute `staleTime` — ESPN standings/leaders/news move at the pace of match rounds and news cycles, not live scores.

Each hook's own external return shape (`{ data, loading, error }`) is preserved exactly — `isLoading`/`isError` from `useQuery` are mapped internally rather than propagated, so **zero call sites** (`StatsPage.tsx`, `StandingsTable.tsx`, `LeagueLeaders.tsx`, `PulseFeed.tsx`) needed to change. `enabled` is where the real "fetch only when opened" lazy-loading mandate now lives as a first-class TanStack concept instead of an early `if` inside the hook body: `useTeamForm` enables only once a standings row's `teamId` is non-null (an actual expand), `useLeagueNews` enables only when the Leagues sub-tab is genuinely active (never for World Cup's custom view or My Arena). Commit 2's hand-rolled module-level `Map` cache for team-form data is gone — TanStack Query's own cache, keyed on `['leagueTeamForm', leagueId, teamId]`, now does that job for real, including cross-component sharing if the same team is ever looked at from two places.

Verified with a throwaway Playwright harness (deleted before commit, `main.tsx` restored, `git status` confirmed clean) that mounted the real components under a real `QueryClientProvider` with `window.fetch` monkey-patched to serve canned JSON — confirming the full pipeline (network → `useQuery` → cache → render) round-trips correctly, not just that individual components accept mock props directly the way Commits 1–3's own per-component previews had verified. A temporary, gitignored `.env.local` (`VITE_BACKEND_URL=http://fake.internal`, needed only because these hooks' `enabled` gate requires a truthy backend URL — without it the queries correctly never fire at all, which is itself the right behavior) was created for this one verification pass and deleted immediately after, confirmed via `git status` before staging.

One Hebrew wording pass happened as part of this same commit: `statsFormGuide`'s first-draft translation ("מצב כושר," literally "fitness condition") was replaced with "פורמה אחרונה" — the term Israeli sports media actually uses for recent-match form, not a literal dictionary translation of "form guide" that reads as physical fitness in Hebrew.

### Rules

- **Before assuming an ESPN field name, check whether this exact codebase already reads it successfully somewhere in production.** `getTeamForm()`'s reuse of the scoreboard endpoint's `wonCorners`/`redCards` fields (proven live in `espn.ts`'s match sync) instead of guessing at an unverified `teams/{id}/schedule` shape is the reference pattern — a verified field from an adjacent, already-working code path beats a fresh guess at a new endpoint every time one is available.
- **A panel that expands "in place" inside a `<table>` must live in a sibling `<tr><td colSpan>`, never nested inside the data row's own `<tr>`.** An early draft collapsed the whole row into one mega-cell to make room for the panel and broke the sticky-first-column-only scroll behavior in the process — caught and corrected before shipping. `<tr>` can only validly contain `<td>`/`<th>` children.
- **A relative-time formatter (or any small utility) gets extracted to a shared `lib/` file the moment a second real consumer needs it — not preemptively, not never.** `timeAgo()`'s move out of `ActivityFeed.tsx` follows the exact same trigger condition as `lib/espnEvents.ts` and `lib/teamNameUtils.ts` before it: the second consumer is what justifies the extraction, not a hypothetical third one.
- **"Fetch only when opened" is a first-class `enabled` flag on the query, not an early-return inside the hook body.** The TanStack migration in Commit 4 didn't just change *how* the fetch happens — it moved the lazy-loading gate itself into the query configuration, which is also what let a hand-rolled per-hook cache (Commit 2's module-level `Map`) be deleted entirely in favor of the query cache doing that job natively.
- **A component-level preview (mock props passed directly) and an end-to-end preview (a real `QueryClientProvider` + monkey-patched `fetch`) verify different things — a data-layer migration commit needs the second, not just the first.** Commits 1–3 verified visuals/RTL against direct props; Commit 4 specifically needed to confirm the network → cache → render round trip actually works under `QueryClientProvider`, which a props-only preview cannot exercise.
- **A literal dictionary translation is not the same as the term a domain's actual audience uses — check both, especially for slang-heavy contexts like sports.** "מצב כושר" is a linguistically correct translation of "form guide" that nonetheless reads wrong to an Israeli football fan, who says "פורמה." When a sprint's own mandate calls for native-quality slang, translate for the reader's ear, not for dictionary correctness.

---

## 43. The Dynamic Orchestrator — League Registry & Tiered Polling (V4 Sprint 28)

Scales the ESPN sync worker off a hardcoded 15-league TypeScript literal onto a DB-backed, admin-editable `league_registry` table with per-league priority tiers, without introducing Redis, an external queue, or any new infrastructure — pure Postgres + the backend's existing in-process interval model. Four commits, 100% backward compatible: every existing importer of `LEAGUE_ESPN_MAP` needed zero code changes, and every non-scheduler call site of `checkAndUpdateScores()` (the public/internal HTTP sync routes, `manualSync`/`forceSync` scripts, the startup catch-up) keeps checking every pending league exactly as before this sprint.

### Commit 1 — `league_registry` schema

Migration `050` — `league_registry` (`id`, `espn_slug`, `display_name`/`display_name_he`, `espn_logo_id` nullable, `priority_tier` CHECK IN `('live_tier1','standard','low_frequency')` DEFAULT `'standard'`, `enabled`, timestamps). Public read, service-role-only write — no client INSERT/UPDATE/DELETE policy at all, the same posture as `matches` itself (this table is backend-managed, not user-editable). The seed mirrors the live 15-entry `LEAGUE_ESPN_MAP` exactly (verified against the actual file, not guessed), so the migration ships with zero behavior change until Commit 2 wires the backend to actually read from it. League 4467 (Euro Championship) is deliberately **not** seeded — it has no working ESPN slug today (already documented in §13 as "silently skipped"); seeding a fake slug would misrepresent it as pollable.

Tier assignments are a reasonable starting default, editable going forward without a code deploy: top-5 leagues + Champions League as `live_tier1`; domestic cups/Europa/Conference/Nations League/World Cup as `standard`; high-volume low-profile friendlies + infrequent qualifiers as `low_frequency`. World Cup (4480) is deliberately `standard`, not a permanently-elevated `live_tier1` — Commit 3's live-match promotion bumps it to fast cadence automatically the moment a real WC match goes live, without paying the `live_tier1` cost for the ~11 months a year it's dormant.

### Commit 2 — Derived cache + safe fallback

The central design constraint: `LEAGUE_ESPN_MAP` (`espn.ts`) must stay the exact same exported object every existing importer already holds a reference to. This backend runs CommonJS (`tsconfig.json`: `"module": "commonjs"`, no `"type": "module"` in `package.json`) — every `import { LEAGUE_ESPN_MAP } from './espn'` resolves to a reference to the **same object instance**. New `leagueRegistry.ts`'s `refreshLeagueRegistry(targetMap)` therefore never reassigns that binding; it mutates the object's keys in place (delete stale, assign fresh). Reassigning would only be visible inside `espn.ts` itself — every other importer would silently keep pointing at the stale object forever. Verified empirically via a smoke test proving object identity survives a full mutation cycle, not just reasoned about.

`FALLBACK_LEAGUE_MAP` is the exact 15-entry literal `LEAGUE_ESPN_MAP` used to be, kept verbatim as a last-resort default baked into the deployed code, never read from anywhere — just what `LEAGUE_ESPN_MAP` is initialized to at module load, before the first DB read ever resolves. `refreshLeagueRegistry()` **never clears the map on a failed or empty read** — it leaves whatever's already cached untouched (on first boot, the fallback; after that, the last good read). This codebase's standing rule: never fail toward zero leagues. `espn.ts` gains an exported `refreshEspnLeagueMap()` wrapping the call with `LEAGUE_ESPN_MAP` as the target.

### Commit 3 — Tiered live-score polling

The old flat 30s live poller becomes two tiered intervals in `scheduler.ts`, both calling `checkAndUpdateScores(tierFilter)` (`scoreUpdater.ts`): Tier-1 stays at the unchanged 30s cadence (zero regression for any league that's actually live right now); Tier-2 polls at 90s. A `low_frequency` league with no live match right now (Tier 3) is touched by neither interval — covered only by the existing daily/noon `syncAllActiveLeagues()` crons.

`resolveEffectiveTier(leagueId, leaguesWithLiveMatch)` (exported from `scoreUpdater.ts`) is pure and synchronous, computed from `pendingMatches` data `checkAndUpdateScores()` already fetched for itself — zero extra Supabase queries, zero extra ESPN calls. **Live-match promotion is checked first and unconditionally, always winning over base tier, including over `low_frequency`.** A `low_frequency` league (International Friendlies, World Cup Qualifiers) is slow-tiered because it's *usually* dormant, not because a real live match in it deserves worse treatment than any other live match — excluding a live low-priority match from fast polling would mean its score, and every prediction riding on it, could sit unresolved for up to ~12h until the next daily/noon sync.

**A real bug here, caught and fixed before shipping, not after:** the first implementation checked the `low_frequency` base tier *before* the live-match promotion, meaning a genuinely live low-priority match would never get fast-polled. Caught via the assistant's own smoke test, not a user report — the fix reorders the check so live-match promotion runs first and unconditionally, exactly as the reasoning above requires.

`checkAndUpdateScores(tierFilter?)`'s filtering applies **only** to the per-league ESPN-fetch loop, never to the corners re-score or catch-up passes further down in the same function — those are pure DB-state sweeps with no ESPN call to save, so tiering them would only delay correctness for zero throughput benefit. When `byLeague` ends up empty after filtering, there is deliberately no early return — the corners/catch-up passes still need to run every tick regardless of tier filtering. The `checked` count in logs reflects `matchesInScope` (the post-filter league set), not the raw `pendingMatches.length` — otherwise a tiered tick would log a misleadingly large "checked" number while having actually ESPN-queried only a handful of leagues.

`scheduler.ts` also gains a new `guarded(label, fn)` closure, factored out of the 3 hand-rolled module-level re-entrancy booleans (`livePollerRunning`-style) this file used to carry one at a time — a non-behavioral cleanup that fell out naturally once a 4th and 5th guarded interval (the two tiered pollers) needed the identical skip-if-still-running behavior. The league registry refresh itself runs first in the startup catch-up sequence (before the startup sync), plus a new 10-minute recurring interval — cheap (one indexed, RLS-public SELECT), and tier/enabled changes made via the registry table take effect on the next refresh cycle with no code deploy.

### Commit 4 — Bounded batching

New `backend/src/lib/batch.ts` — `processBatched<T>(items, fn, options?)`: fixed-size (default 5) concurrent batches via `Promise.allSettled`, batches themselves running strictly sequentially (never two batches in flight at once) with a polite 500ms gap between batches, never within one. `Promise.allSettled`, not `Promise.all`, is the load-bearing choice — one item's failure never rejects the whole batch or blocks the others in it; every real caller already wraps its own per-item logic in try/catch, so this is a defensive backstop, not the primary error path.

Replaces the old unbounded sequential loop in `matchSync.ts`'s `syncAllActiveLeagues()` (which, at 40+ leagues, risked a single sync cycle taking longer than the interval that triggers the next one) and the equivalent per-league loop in `scoreUpdater.ts`'s `checkAndUpdateScores()`. The `scoreUpdater.ts` conversion kept its large loop body 100% verbatim — the only structural change necessary was one `continue` → `return`, since an arrow function passed to `processBatched` has no enclosing loop to `continue` out of.

### Rules

- **A DB-backed cache that replaces a hardcoded TS literal must mutate the exported object's keys in place, never reassign the binding — verify against the actual module system (`tsconfig.json`'s `"module"` setting), don't assume ESM semantics.** This backend is CommonJS; every importer holds a reference to the same object instance, and only in-place mutation is visible to all of them. Prove object-identity preservation with a smoke test, not just a code-review read-through.
- **A live-refreshed cache must never clear itself on a failed or empty read.** Leave the last good state (or the baked-in fallback) untouched — a transient DB hiccup must never fail toward zero leagues, zero coverage, or any other "empty" state that's worse than stale data.
- **A promotion/override check in a tiering or priority system must be verified for its actual evaluation order, not just its stated intent.** `resolveEffectiveTier`'s live-match promotion was *designed* to win unconditionally, but the first implementation's code didn't match that intent — checked and caught by the sprint's own smoke test before shipping, exactly the kind of bug that's invisible from reading the surrounding prose comments alone.
- **A tier/priority filter on a hot polling loop must scope itself precisely** — apply it only to the specific sub-operation it's meant to reduce load on (here: the ESPN-fetch loop), never accidentally widen it to unrelated passes in the same function that have no external call to save (here: the pure DB-state corners re-score/catch-up sweeps). And log the *actual* post-filter scope, not the pre-filter total, or the logs themselves become misleading.
- **A closure-based re-entrancy guard factored out of several hand-rolled booleans is a legitimate non-behavioral cleanup the moment a new interval needs the identical behavior a third or fourth time** — `guarded()` is the reference shape: same skip-if-still-running/log-and-continue-on-error behavior, now shared instead of copy-pasted per interval.
- **A bounded-batching primitive (`processBatched`) built for one unbounded-loop problem should be reused verbatim for the next one that fits its exact shape, not reimplemented.** `scoreUpdater.ts`'s conversion and Sprint 29's retroactive backfill script (§44) both reuse `lib/batch.ts` as-is — a bulk operation over N independent items, bounded concurrency, tolerant of individual item failures, is precisely what it was built for.

---

## 44. Deep-Data Schema Evolution — Team Stats Archive & Retroactive Backfill (V4 Sprint 29)

Adds a `match_team_stats` table that archives ESPN's full raw per-team `competitor.statistics[]` array — not just the 2 fields (`wonCorners`, `redCards`) already cherry-picked into `matches.corners_total`/`red_cards_home`/`red_cards_away` — plus a `player_match_stats` schema placeholder for a future paid player-telemetry data source. Zero DB migrations beyond the one new table pair; every read this sprint added either reuses a field name already proven live in this codebase's own production sync path, or degrades gracefully to `null` where it's a genuine first-time extraction.

### The irreversible-sum problem that shaped the whole design

`matches.corners_total` is `homeCorners + awayCorners`, computed once and only the **sum** persisted — the per-team split can never be recovered from that column alone, for any match already synced before this sprint. This single fact is why the backfill script (Commit 3) needed two structurally different paths rather than one:

- **Path A (red_cards)** — `matches.red_cards_home`/`red_cards_away` already store the real per-team split (confirmed by reading `sportsdb.ts`'s `DBMatch` interface, not assumed), so backfilling this field is a pure DB-to-DB copy. Zero ESPN calls, completes fully on every run, no rate-limit risk.
- **Path B (corners + yellow_cards + raw_stats)** — genuinely requires a live re-fetch per historical match from ESPN's summary endpoint, since the per-team corners split and yellow_cards/raw_stats were never captured anywhere before this sprint. Whether ESPN's summary endpoint even retains `.statistics[]` for old events is unverified from this sandbox (no outbound ESPN access here), so Path B tracks and reports `full`/`partial`/`unavailable` outcome counts rather than assuming every historical match will get complete data — stated coverage, not promised coverage.

### Commit 1 — Schema

Migration `051` — `match_team_stats` (`match_id` FK, `team_side` CHECK IN `('home','away')`, `raw_stats JSONB NOT NULL DEFAULT '[]'`, `corners`/`red_cards`/`yellow_cards` nullable typed columns, `UNIQUE(match_id, team_side)`). The three typed columns are promoted alongside the JSONB archive specifically so hot-path reads never need to parse `raw_stats` at runtime — the JSONB stays a forward-compatible archive of everything else ESPN sent, not the primary read path for the 3 fields this codebase already knows it needs. No GIN index on `raw_stats` — nothing queries inside the JSONB at runtime yet; adding one now would be pure write-amplification for zero benefit, add it only if/when a real feature needs to filter inside it.

`player_match_stats` (`match_id` FK, `athlete_id`, `team_side`, `raw_stats`) is a **schema placeholder only** — not populated by this migration, Commit 2's sync worker, or Commit 3's backfill script. No free ESPN endpoint anywhere in this codebase's integration exposes individual player match-log data (minutes, tackles, crosses); this table exists purely so a future paid data source has zero migration lead time. Stated here plainly, not implied as already working.

Both tables: public read RLS, service-role-only write — no client-facing INSERT/UPDATE/DELETE policy at all, the same sync-worker-managed posture as `league_registry` (§43) and `matches` itself. Confirmed applied by the user in Supabase's SQL Editor before being committed, per this repo's standing migration-confirmation discipline.

### Commit 2 — Sync worker ingestion

`espn.ts`'s `DBMatchWithClock` gains `home_stats_raw`/`away_stats_raw` (the full raw statistics array per team, previously read via `getStat()` for just 2 named fields and then discarded — now returned in full instead of thrown away after parsing) and `home_corners`/`away_corners`/`home_yellow_cards`/`away_yellow_cards`. All read from data already being fetched for the existing `corners_total`/`red_cards_home`/`red_cards_away` extraction — **zero new ESPN calls**. `yellow_cards` is a genuinely new extraction (never read anywhere in this codebase before); its field name is a best-effort guess (parallel construction to the confirmed `redCards`), unverifiable from this sandbox, and degrades to `null` gracefully via the same `getStat()` helper if ESPN doesn't expose it — the same "unverified field name, honest degradation" caveat already applied to every other best-effort ESPN field this engagement has added (§27's `photo`, §27's `getTeamForm()`'s `yellowCards`).

`getStat()` itself is extracted from a local closure inside `fetchLeagueMatches`'s per-event loop to module scope — the "extract on the second real consumer" precedent (`lib/espnEvents.ts`, Sprint 19; `lib/teamNameUtils.ts`, Sprint 24) applied on the backend for the first time, the moment the new `fetchMatchTeamStatsFromSummary()` needed the identical extraction logic.

`matchSync.ts`'s `upsertMatches()` explicitly destructures the 6 new fields **out** before building the `matches` upsert row, never spreading them in. **A real bug was caught and fixed during this commit's own verification, before any deploy:** the old `{ ...m }` spread would have copied *all* of `m`'s runtime properties into the `matches` payload, including these 6 new fields — which aren't real columns on `matches` and would have made every upsert fail with an unknown-column PostgREST error the moment this code touched a real match. New `upsertTeamStats(matches, idsByExternalId)` writes 2 rows per synced match (home/away) into `match_team_stats`, correlated via the matches upsert's own returned `external_id → id` mapping (`upsertMatches()`'s `.select()` widened from `'id'` to `'id, external_id'` to make this possible). Called immediately after the matches upsert succeeds, wrapped in its own try/catch — **deliberately non-throwing**, the same "the primary record succeeds even if secondary enrichment fails" discipline already governing `ensurePostMatchSummary`/`ensureChronicle` elsewhere in this codebase. A `match_team_stats` write failure never blocks or rolls back the `matches` upsert it depends on, which has already succeeded by the time it runs.

Verified with a rigorous end-to-end smoke script (deleted before commit): mocked only the two real network boundaries (ESPN's `axios.get`, Supabase's `.from().upsert()`) and let the actual production parsing + row-building code run against synthetic ESPN data — confirming the `matches` upsert row has zero leaked `match_team_stats`-only fields (the bug fix above, proven not just reasoned about), `match_team_stats` gets exactly 2 correctly-mapped rows per match, and `raw_stats` carries a field beyond the 3 promoted ones (proving genuine full-array archival, not a re-shuffled subset).

### Commit 3 — Retroactive backfill script

New `backend/src/scripts/backfillTeamStats.ts` (`npm run backfill:team-stats`, `--since=<date>` defaulting to 90 days back, `--path=a` to run Path A only and skip the ESPN re-fetch entirely). Idempotency guard: a match already having **both** home and away `match_team_stats` rows is excluded from the backfill set on a re-run — a re-run should only touch matches it hasn't finished, never redundantly re-process everything in the window.

Path A's upsert rows deliberately **omit** `corners`/`yellow_cards`/`raw_stats` keys entirely — not set to `null` — so a re-run of Path A can never clobber a prior Path B write for the same row. This exploits Supabase upsert's partial-column semantics: `.upsert(rows, {onConflict})` only updates columns actually present in the row objects passed, so a key genuinely absent from the payload leaves whatever's already in that column untouched.

Path B is batched via §43's `processBatched()` — its exact intended "bulk historical operation, bounded concurrency, tolerant of individual failures" use case. For each match, `fetchMatchTeamStatsFromSummary()` (new in `espn.ts`, reusing the established `summary?event=` endpoint pattern from `fetchMatchKeyEvents`) is called; the outcome is classified `full` (every field present), `partial` (some null), or `unavailable` (ESPN returned no usable competitor data), and all three counts are printed in the final summary — an honest coverage report, not an assumption that every historical match will backfill completely.

Verified with a rigorous end-to-end smoke script (deleted before commit): mocked the real network boundaries and ran the actual production code against synthetic data — one match with full ESPN data, one with an empty `competitors` array (simulating a genuine ESPN data-retention gap), one already fully backfilled. Confirmed: the already-backfilled match is correctly skipped, Path A writes the right `red_cards` per side with zero leaked Path-B keys, Path B writes the right `corners`/`yellow_cards` for the available match, and Path B writes **nothing** for the unavailable match — proving the honest-coverage reporting actually works end-to-end, not just that the code compiles.

One harness-level bug surfaced and was fixed during this verification, worth noting since it's a reusable lesson for future smoke tests of any script that calls `process.exit()`: a real `process.exit()` never returns and nothing after it ever runs, so production code can safely call it twice (once for the happy path, once from a `main().catch()` handler if the first "exit" unwound through a thrown error). A naive mock that throws on *every* call to `process.exit` breaks this — the second throw happens inside an unhandled `.catch()` callback and crashes the actual test process with an unrelated-looking stack trace. The fix: the mock only throws on its first invocation; subsequent calls are silent no-ops, correctly simulating "nothing runs after this" without re-detonating.

### Rules

- **Before designing a backfill for a column that aggregates multiple source values, check whether the aggregation is reversible.** `matches.corners_total` being an irreversible home+away sum (not two separate columns) is what forced the two-path design — a naive single-path backfill would have either been unable to recover the per-team split at all, or would have silently guessed at it. Always check whether "the data we need" can actually be derived from "the data we already have" before assuming a backfill is a simple one-pass job.
- **A secondary/derived table's write must never throw in a way that can roll back or block the primary write it depends on.** `upsertTeamStats()` runs only after `upsertMatches()` has already succeeded, in its own try/catch, and logs-and-returns on failure — matching the `ensurePostMatchSummary`/`ensureChronicle` fire-and-forget precedent already established for exactly this "enrichment, not the source of truth" relationship.
- **An object spread (`{ ...m }`) copies every enumerable runtime property regardless of the TypeScript type annotation on the target — when a source object grows new fields for a different destination table, explicitly destructure them out before spreading into an upsert payload that has no columns for them.** This is a real, would-have-shipped-broken bug class, not a hypothetical: caught in this exact commit's own verification, before any real match ever hit the code path.
- **A retroactive/bulk data-repair script's coverage claims must be honestly reported (full/partial/unavailable counts), never assumed complete.** Especially when the underlying third-party API's data-retention behavior for old records is genuinely unverifiable from the current environment — state the uncertainty in both the code comments and the script's own runtime output, not just in a PR description that won't be read again once the script has run.
- **Supabase's upsert partial-column semantics (a key omitted from the payload leaves that column untouched; a key present as `null` overwrites it) can be deliberately exploited to let two different write paths safely coexist on the same table without clobbering each other** — Path A and Path B in this sprint's backfill script never need to coordinate or check each other's state, because the column-presence contract already guarantees non-interference.
- **A mock for `process.exit()` in an end-to-end smoke test must only throw on its first invocation, not every call.** Real production code that calls `process.exit()` from both a happy path and a `catch()`-handler fallback is calling a function that, in reality, never returns and makes everything after it moot — a mock that throws every time breaks that assumption and produces a misleading crash inside the test harness itself, not the code under test. This generalizes to any script this codebase writes that follows the `main().catch(err => { ...; process.exit(1); })` pattern.
