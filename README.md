# GoalBet ⚽

> **A full-stack football prediction game for friend groups.**
> Predict match outcomes across 5 tiers, compete on a live leaderboard, and earn streak bonuses — all free, no real money.

![CI](https://github.com/roychen/goalbet/actions/workflows/ci.yml/badge.svg)

---

## Features

| Feature | Description |
|---------|-------------|
| 🎯 **Multi-tier predictions** | Up to 5 prediction types per match: full-time result, exact score, half-time result, BTTS, over/under 2.5 |
| 🏆 **Group leaderboards** | Compete in private groups, weekly & all-time standings |
| 🔥 **Streak bonuses** | 3+ correct picks in a row earns +2 pts per subsequent pick |
| 📊 **Points breakdown** | After each match, see exactly which of your tiers scored and earned points |
| 👥 **Friend presence** | See who in your group has already predicted (without seeing their picks) |
| ✏️ **Edit predictions** | Update any prediction up to 15 minutes before kickoff, including from the Profile page |
| 🔒 **Auto-lock** | Predictions lock automatically 15 min before kickoff — countdown shown on every card |
| 🌍 **Hebrew + English** | Full RTL support, language toggle in Settings |
| 📱 **Mobile-first** | Responsive design with bottom navigation on mobile |
| ⚡ **Real-time** | Supabase Realtime keeps leaderboard live across all devices |

---

## Scoring System

| Tier | Category | Points |
|------|----------|--------|
| 1 | Full-time result (Home / Draw / Away) | **+3** |
| 2 | Exact score — stacks on top of Tier 1 | **+7** (= **10 total** with outcome) |
| 3 | Half-time result | **+4** |
| 5 | Both teams to score (Yes/No) | **+2** |
| 6 | Over/Under 2.5 total goals | **+3** |
| 🔥 | Streak bonus — 3+ correct in a row | **+2/pick** |

**Maximum per match: 19 pts** (+ streak bonus on top)

Getting the exact score right automatically awards Tier 1 (the outcome is implied), so you never need to predict both independently.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, TypeScript, TailwindCSS 3, Framer Motion |
| **Backend** | Node.js 18, Express, TypeScript, node-cron |
| **Database** | Supabase (PostgreSQL, Row-Level Security, Realtime, Auth) |
| **Football data** | ESPN public scoreboard API — free, no API key required |
| **State management** | Zustand with localStorage persistence |
| **CI/CD** | GitHub Actions (type-check + build on every push) |
| **Deployment** | Vercel (frontend) · Render or Railway (backend) |

---

## Project Structure

```
goalbet/
├── frontend/                  # React + Vite SPA
│   └── src/
│       ├── components/
│       │   ├── layout/        # AppShell, TopBar, BottomNav, Sidebar
│       │   ├── matches/       # MatchCard, MatchFeed, PredictionForm
│       │   ├── leaderboard/   # LeaderboardTable, LeaderboardRow, UserMatchHistoryModal
│       │   ├── groups/        # CreateGroupModal, JoinGroupModal
│       │   ├── profile/       # AvatarPicker
│       │   └── ui/            # GlassCard, NeonButton, ScoringGuide, Toast, Avatar...
│       ├── hooks/             # useMatches, usePredictions, useLeaderboard,
│       │                      # useGroupMatchPredictions, useMatchSync, useNewPointsAlert
│       ├── lib/               # supabase.ts, utils.ts, i18n.ts, constants.ts
│       ├── pages/             # HomePage, LeaderboardPage, ProfilePage, SettingsPage, LoginPage
│       └── stores/            # authStore, groupStore, langStore, uiStore (Zustand)
│
├── backend/                   # Express API + cron scheduler
│   └── src/
│       ├── routes/            # GET /health · POST /api/sync/matches · POST /api/sync/scores
│       ├── services/
│       │   ├── espn.ts        # ESPN API client — fetches match data by league slug
│       │   ├── matchSync.ts   # Syncs ESPN data into Supabase matches table
│       │   ├── scoreUpdater.ts# Resolves predictions after FT, updates leaderboard
│       │   └── pointsEngine.ts# Pure scoring function — zero side effects, unit-testable
│       ├── cron/              # Scheduler: daily sync, score resolution, weekly reset
│       └── lib/               # supabaseAdmin.ts (service role), logger.ts
│
├── supabase/
│   ├── migrations/            # SQL migrations (run in order: 001 → 004)
│   └── functions/
│       └── sync-matches/      # Deno edge function for serverless match sync
│
└── .github/
    └── workflows/
        └── ci.yml             # CI: TypeScript + Vite build check on push/PR
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- Google OAuth credentials (Client ID + Secret from Google Cloud Console)

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/goalbet.git
cd goalbet

cd frontend && npm install
cd ../backend && npm install
```

### 2. Supabase setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Open the **SQL Editor** and run the migrations **in order**:
   ```
   supabase/migrations/001_initial_schema.sql
   supabase/migrations/002_rls_policies.sql
   supabase/migrations/003_functions_triggers.sql
   supabase/migrations/004_fixes.sql
   ```
3. In **Authentication → Providers**, enable Google OAuth (Client ID + Secret)
4. In **Authentication → URL Configuration**, add your local URL:
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
SYNC_SECRET=any-random-secret-you-choose
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

### 5. Seed match data

Click **⟳ Sync Now** in the app's Settings page, or run:

```bash
cd backend && npm run sync
```

This pulls the last 7 days + next 14 days of matches for all active leagues via the ESPN API.

---

## Deployment

### Frontend → Vercel

1. Connect your GitHub repo to [Vercel](https://vercel.com)
2. Set the **root directory** to `frontend`
3. Add your environment variables (same as `.env.local`)
4. Deploy — Vercel will auto-deploy on every push to `main`

### Backend → Render

1. Create a **Web Service** on [Render](https://render.com) pointing at the repo
2. Set root directory to `backend`
3. Build command: `npm run build`
4. Start command: `npm start`
5. Add environment variables
6. The cron scheduler starts automatically and runs:
   - **Daily at 00:05 UTC** — sync all active leagues from ESPN
   - **Every 60 seconds** — resolve finished matches + award points
   - **Monday at 00:00 UTC** — reset weekly leaderboard points

### Supabase Edge Function (alternative to backend sync)

If you prefer serverless over a persistent backend for match syncing:

```bash
# Requires Supabase CLI
supabase functions deploy sync-matches

# Set secrets for the function
supabase secrets set SUPABASE_SERVICE_KEY=your-service-role-key
```

The edge function is invoked automatically by `useMatchSync` in the frontend when the match feed is empty.

---

## CI/CD Pipeline

Every push to `main` (or any PR) triggers the CI workflow:

```yaml
# .github/workflows/ci.yml
- Frontend: TypeScript type-check + Vite production build
- Backend:  TypeScript compilation check (tsc --noEmit)
```

**The build must pass before any merge.** This catches type errors and broken imports before they reach production.

To view CI runs: `GitHub repo → Actions tab`

---

## Database Schema

```sql
profiles        id (uuid, FK auth.users), username, avatar_url
groups          id, name, invite_code (unique 8-char), active_leagues (int[])
group_members   group_id + user_id (composite PK)
matches         id, external_id ("espn_XXXXXX"), league_id, teams, scores, status, kickoff_time
predictions     user_id + match_id + group_id (unique), all tier fields, points_earned, is_resolved
leaderboard     user_id + group_id (unique), total_points, weekly_points, current_streak, best_streak
```

**Row-Level Security** is enforced on every table. The key rule: all data is scoped to groups the authenticated user belongs to. A `SECURITY DEFINER` function `get_my_group_ids()` avoids recursive RLS policy calls.

---

## Key Design Decisions

**ESPN over TheSportsDB** — TheSportsDB's free API key (`"3"`) ignores the `?id=` parameter and returns the same wrong league for every request. ESPN's public scoreboard endpoint requires no authentication and returns reliable, real-time data.

**No live scores** — Score resolution polls ESPN ~100 minutes after kickoff. No WebSocket connection to a live data feed. This is intentional: prediction games don't need sub-minute accuracy.

**Pure points engine** — `backend/src/services/pointsEngine.ts` is a pure function with zero side effects. The same logic is mirrored client-side in `frontend/src/lib/utils.ts → calcBreakdown()` to show per-tier results without a round-trip.

**Tier 1 + Tier 2 stacking** — Getting the exact score right auto-awards Tier 1 (3 pts) since the outcome is implied. Tier 2 adds 7 more = 10 pts total. Users never need to select both.

---

## Contributing

```bash
# Create a feature branch
git checkout -b feat/your-feature

# Make changes, then commit
git add .
git commit -m "feat: describe your change"

# Push and open a PR
git push origin feat/your-feature
```

CI must pass before merging to `main`.

---

## License

MIT — free to use, fork, and adapt. No gambling, no real money.
