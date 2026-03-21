# GoalBet ⚽

> **A full-stack football prediction game for friend groups.**
> Predict match outcomes across 5 tiers, stake coins, compete on a live leaderboard — all free, no real money.

![CI](https://github.com/Roychen651/goalbet/actions/workflows/ci.yml/badge.svg)
![Sync](https://github.com/Roychen651/goalbet/actions/workflows/sync-cron.yml/badge.svg)

---

## Features

| Feature | Description |
|---------|-------------|
| 🎯 **Multi-tier predictions** | Up to 5 prediction types per match: full-time result, exact score, total corners, BTTS, over/under 2.5 |
| 🪙 **Coin economy** | Stake coins on your predictions — correct tiers pay back 2× points earned |
| 🏆 **Group leaderboards** | Compete in private groups, weekly & all-time standings |
| 🚩 **Corners prediction** | Predict ≤9 / exactly 10 / ≥11 corners |
| 📊 **Points breakdown** | After each match, see exactly which of your tiers scored |
| ⚔️ **Head-to-Head** | Tap any player's leaderboard row to open a side-by-side H2H comparison — match wins tally, per-match outcomes, green winner highlight |
| 👥 **Friend presence** | See who in your group has already predicted (without revealing their picks) |
| ✏️ **Edit predictions** | Update any prediction up to 15 minutes before kickoff |
| 🔒 **Auto-lock** | Predictions lock automatically 15 min before kickoff |
| 🌍 **Hebrew + English** | Full RTL support, language toggle in Settings |
| ☀️ **Dark & Light mode** | Full theme support — toggle in Settings |
| 📱 **Mobile-first** | Responsive design with bottom navigation on mobile |
| ⚡ **Real-time** | Supabase Realtime keeps leaderboard live across all devices |
| 🔄 **Always synced** | GitHub Actions cron runs every 30 min — scores and fixtures update even when the backend is asleep |

---

## Scoring System

| Tier | Category | Points |
|------|----------|--------|
| 1 | Full-time result (Home / Draw / Away) | **+3** |
| 2 | Exact score — stacks on top of Tier 1 | **+7** (= **10 total** with outcome) |
| 3 | Total corners: ≤9 / exactly 10 / ≥11 | **+4** |
| 4 | Both teams to score (Yes/No) | **+2** |
| 5 | Over/Under 2.5 total goals | **+3** |

**Maximum per match: 19 pts**

Getting the exact score right automatically awards Tier 1 (the outcome is implied).

---

## Coin Economy

Coins are a fun in-game currency — no real money involved.

| Event | Coins |
|-------|-------|
| Join bonus (one-time) | +120 🪙 |
| Daily login bonus | +30 🪙 |
| Stake on a prediction | −(cost of tiers selected) |
| Earn back per correct tier | points_earned × 2 |

Staking costs mirror the points available: Result = 3, Exact Score = 10, Corners = 4, BTTS = 2, O/U = 3. If you predict all tiers you stake 19 coins and can earn up to 38 back.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, TypeScript, TailwindCSS 3, Framer Motion |
| **Backend** | Node.js 18, Express, TypeScript, node-cron |
| **Database** | Supabase (PostgreSQL, Row-Level Security, Realtime, Auth) |
| **Football data** | ESPN public scoreboard API — free, no API key required |
| **State management** | Zustand with localStorage persistence |
| **CI/CD** | GitHub Actions — type-check/build on push + sync cron every 30 min |
| **Deployment** | Vercel (frontend) · Render or Railway (backend) |

---

## Project Structure

```
goalbet/
├── frontend/                  # React + Vite SPA
│   └── src/
│       ├── components/
│       │   ├── layout/        # AppShell, TopBar, BottomNav, Sidebar
│       │   ├── matches/       # MatchCard, MatchFeed, PredictionForm, MatchTimeline
│       │   ├── leaderboard/   # LeaderboardTable, LeaderboardRow, UserMatchHistoryModal
│       │   ├── groups/        # CreateGroupModal, JoinGroupModal
│       │   ├── profile/       # AvatarPicker
│       │   └── ui/            # GlassCard, NeonButton, ScoringGuide, CoinGuide,
│       │                      # InfoTip, ThemeToggle, LangToggle, Toast, Avatar...
│       ├── hooks/             # useMatches, usePredictions, useLeaderboard,
│       │                      # useGroupMatchPredictions, useMatchSync,
│       │                      # useNewPointsAlert, useLiveClock, useRTLDirection
│       ├── lib/               # supabase.ts, utils.ts, i18n.ts, constants.ts
│       ├── pages/             # HomePage, LeaderboardPage, ProfilePage, SettingsPage, LoginPage
│       └── stores/            # authStore, groupStore, coinsStore, langStore,
│                              # themeStore, uiStore (Zustand)
│
├── backend/                   # Express API + cron scheduler
│   └── src/
│       ├── routes/            # GET /health · POST /api/sync/matches · POST /api/sync/scores
│       ├── services/
│       │   ├── espn.ts        # ESPN API client — fetches match data by league slug
│       │   ├── matchSync.ts   # Syncs ESPN data into Supabase (7 days back, 21 days ahead)
│       │   ├── scoreUpdater.ts# Resolves predictions after FT, updates leaderboard + coins
│       │   └── pointsEngine.ts# Pure scoring function — zero side effects, unit-testable
│       ├── cron/              # Scheduler: startup sync, daily sync, score poller (30s), weekly reset
│       └── lib/               # supabaseAdmin.ts (service role), logger.ts
│
├── supabase/
│   └── migrations/            # SQL migrations 001 → 021 (run in order)
│
└── .github/
    └── workflows/
        ├── ci.yml             # TypeScript + Vite build check on every push/PR
        └── sync-cron.yml      # Runs every 30 min: syncs fixtures + resolves scores
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- Google OAuth credentials (Client ID + Secret from Google Cloud Console)

### 1. Clone & install

```bash
git clone https://github.com/Roychen651/goalbet.git
cd goalbet
cd frontend && npm install
cd ../backend && npm install
```

### 2. Supabase setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Open the **SQL Editor** and run migrations in order:
   `supabase/migrations/001_initial_schema.sql` → `021_fix_coins.sql`
3. In **Authentication → Providers**, enable Google OAuth
4. In **Authentication → URL Configuration**, add:
   - Site URL: `http://localhost:5173`
   - Redirect URL: `http://localhost:5173/auth/callback`

### 3. Environment variables

Create `frontend/.env.local`:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BACKEND_URL=http://localhost:3001
```

Create `backend/.env`:
```env
PORT=3001
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
NODE_ENV=development
```

> ⚠️ Never commit `.env` files — they are in `.gitignore`.

### 4. Run locally

```bash
# Terminal 1 — Frontend at http://localhost:5173
cd frontend && npm run dev

# Terminal 2 — Backend at http://localhost:3001
cd backend && npm run dev
```

---

## Deployment

### Frontend → Vercel

1. Connect your GitHub repo to [Vercel](https://vercel.com)
2. Set root directory to `frontend`
3. Add environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND_URL`)
4. Deploy — auto-deploys on every push to `main`

### Backend → Render / Railway

1. Create a **Web Service** pointing at the repo, root dir = `backend`
2. Build command: `npm run build` · Start command: `npm start`
3. Add environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NODE_ENV=production`
4. The backend runs on startup:
   - **5s after start** — catch-up sync (resolves matches missed while sleeping)
   - **Every 30s** — live score poller
   - **Daily at 00:05 + 12:00 UTC** — full fixture sync
   - **Sunday 00:00 UTC** — weekly leaderboard reset

### GitHub Actions Cron (keeps sync alive even when backend sleeps)

The `sync-cron.yml` workflow runs every 30 minutes and calls:
- `POST /api/sync/matches` — fetches fixtures 21 days ahead from ESPN
- `POST /api/sync/scores` — resolves any finished match predictions

**Required GitHub Secret (one-time setup):**
- `BACKEND_URL` — your backend URL, e.g. `https://goalbet-api.onrender.com`

No other secrets needed. The sync endpoints are public.

---

## CI/CD Pipeline

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | Every push / PR | TypeScript type-check + Vite production build |
| `sync-cron.yml` | Every 30 min (schedule) | Sync fixtures + resolve predictions via backend API |

**The CI build must pass before any merge.** This catches type errors and broken imports before production.

---

## Database Schema

```sql
profiles        id (uuid, FK auth.users), username, avatar_url, coins
groups          id, name, invite_code (unique 8-char), active_leagues (int[])
group_members   group_id + user_id (composite PK)
matches         id, external_id, league_id, teams, scores, status, kickoff_time,
                regulation_home/away, went_to_penalties, penalty_home/away,
                red_cards_home/away, corners_total
predictions     user_id + match_id + group_id (unique), all tier fields,
                predicted_corners, coins_bet, points_earned, is_resolved
leaderboard     user_id + group_id (unique), total_points, weekly_points,
                last_week_points, predictions_made, correct_predictions
coin_transactions user_id, amount, type, created_at
```

**Row-Level Security** is enforced on every table. All data is scoped to groups the authenticated user belongs to.

---

## Key Design Decisions

**ESPN over TheSportsDB** — TheSportsDB's free API key (`"3"`) ignores the `?id=` parameter and returns wrong data. ESPN's public scoreboard endpoint requires no auth and returns reliable real-time data.

**GitHub Actions as sync heartbeat** — Free-tier backends (Render, Railway) sleep after inactivity. Rather than pay for an always-on dyno, a GitHub Actions cron pings the backend every 30 minutes. This wakes the server and triggers the sync, keeping everything current 24/7.

**Pure points engine** — `backend/src/services/pointsEngine.ts` is a pure function with zero side effects. The same logic is mirrored client-side in `frontend/src/lib/utils.ts → calcBreakdown()` to show per-tier results without a round-trip.

**Corners over Half-time** — Tier 3 was changed from half-time result (H/D/A) to total corners (≤9/10/≥11). Old predictions retain their half-time data for display; new predictions use corners.

**Positive coin UX** — We never show negative coin numbers. When a user spends 16 coins and earns 10 back, we show `+10` (what they earned), not `-6` (the net loss). The brain processes earnings as joy; losses as pain — we lean into joy.

**Head-to-Head privacy rule** — Friend's prediction is hidden (🔒) for any match that hasn't kicked off yet (`status === 'NS' && kickoff > now`). Once a match starts or finishes, both picks are revealed for comparison. This prevents tactical copying while keeping the rivalry alive post-match.

---

## License

MIT — free to use, fork, and adapt. No gambling, no real money.
