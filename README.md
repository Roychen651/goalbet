<div align="center">

# GoalBet

**The football prediction game for you and your friends.**

Predict match outcomes across 5 tiers, stake coins, and compete on a live leaderboard — free, no real money.

[![CI](https://github.com/Roychen651/goalbet/actions/workflows/ci.yml/badge.svg)](https://github.com/Roychen651/goalbet/actions/workflows/ci.yml)

<br />

<p>
  <img src="docs/screenshots/01-match-feed-dark.png" width="260" alt="Match feed — dark mode" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/03-match-feed-light.png" width="260" alt="Match feed — light mode" />
</p>

<sub>Upcoming matches with predictions, dark & light mode</sub>

</div>

---

## The Idea

GoalBet started as a simple question: *what if you could predict every detail of a football match — not just the winner — and compete with your mates in a private group?*

No bookmakers. No real money. Just a points game where being specific pays off more. Predict the exact score, call the corner count, guess BTTS — every tier you nail adds to your tally. A wrong result can still score you points on goals and corners. The leaderboard is live. The rivalry is real.

---

## Pick Your Tiers

Each match has up to 5 prediction tiers. You choose which ones to play — stake coins on each, earn back double per point scored.

Expand a match card to see team form (last 5 results), venue info, and all 5 prediction tiers laid out cleanly.

<p align="center">
  <img src="docs/screenshots/02-prediction-form.png" width="300" alt="Prediction form — all 5 tiers with team form" />
</p>

| Tier | Category | Points |
|------|----------|--------|
| **1** | Full Time Result — Home / Draw / Away | **+3** |
| **2** | Exact Score — stacks on top of Tier 1 | **+7** (= **10** total) |
| **3** | Total Corners — ≤9 / exactly 10 / ≥11 | **+4** |
| **4** | Both Teams to Score — Yes / No | **+2** |
| **5** | Over / Under 2.5 Goals | **+3** |

**Maximum: 19 pts per match.** Getting the exact score right automatically gives you Tier 1 — because the result is implied.

<p align="center">
  <img src="docs/screenshots/16-scoring-guide.png" width="300" alt="Scoring guide modal" />
</p>

---

## After the Whistle

Once a match ends, predictions resolve automatically. Every card shows exactly which tiers hit — green checkmarks for points earned, crosses for misses. BTTS, goal count, corners — all broken down per tier with coin profit displayed.

<p align="center">
  <img src="docs/screenshots/04-results-feed.png" width="260" alt="Results feed — match stats collapsed" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/05-results-breakdown-light.png" width="260" alt="Results breakdown — tier-by-tier scoring in light mode" />
</p>

<p align="center">
  <sub>Left: completed match with stats summary · Right: per-tier breakdown with coin profit (light mode)</sub>
</p>

### Match Details

Expand any completed match to see full stats, timeline, and lineups — all pulled from ESPN.

<p align="center">
  <img src="docs/screenshots/06-match-stats.png" width="220" alt="Match stats — possession, shots, corners" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/07-match-timeline.png" width="220" alt="Match timeline — goals, cards, subs" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/08-lineups.png" width="220" alt="Team lineups with formations" />
</p>

<p align="center">
  <sub>Match stats · Goal-by-goal timeline with commentary · Full lineups with formation</sub>
</p>

---

## The Leaderboard

Standings update in real-time via Supabase Realtime. Three views: **All Time**, **This Week**, **Last Week**.

Your rank card shows total points, accuracy rate, and three insight badges — *On Fire* (top points), *The Sniper* (highest accuracy), *The Grinder* (most predictions).

<p align="center">
  <img src="docs/screenshots/09-leaderboard.jpeg" width="300" alt="Leaderboard — all time standings with insight badges" />
</p>

---

## Head to Head

Tap any player's leaderboard row to open a side-by-side comparison — who called what, who won each match, and the overall H2H tally.

<p align="center">
  <img src="docs/screenshots/10-h2h-locked.png" width="260" alt="H2H modal — locked predictions before kickoff" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/11-h2h-resolved.png" width="260" alt="H2H modal — resolved predictions with points" />
</p>

<p align="center">
  <sub>Left: pre-kickoff picks are locked (no peeking) · Right: resolved picks with point breakdowns</sub>
</p>

Predictions are hidden (locked) for matches that haven't kicked off yet — no tactical copying. Once a match starts, both picks are revealed.

---

## Profile & Analytics

Your profile page is a personal analytics dashboard. Bento-grid layout with total points, FT win rate, prediction count, current streak, and score precision.

Scroll down for personal analytics (best tier, recent form) and full prediction history with per-match breakdowns.

<p align="center">
  <img src="docs/screenshots/12-profile-stats.png" width="260" alt="Profile — bento grid with stats overview" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/13-profile-history.png" width="260" alt="Profile — personal analytics and prediction history" />
</p>

<p align="center">
  <sub>Left: stats overview with streak & precision · Right: analytics + upcoming/resolved prediction history</sub>
</p>

---

## The Coin Economy

Coins keep the game interesting without any real money involved. You stake them when you predict and earn back double per point scored.

<p align="center">
  <img src="docs/screenshots/17-coin-guide.png" width="300" alt="Coin economy guide — earn, stake, and return breakdown" />
</p>

| Event | Coins |
|-------|-------|
| Join bonus (one-time) | **+120** |
| Daily login bonus | **+30 / day** |
| Stake on a prediction | −(cost of tiers) |
| Earn back per correct tier | **points x 2** |

Stake all 5 tiers = 19 coins out. Hit them all = 38 coins back. Your balance is always shown as >= 0.

---

## Notifications

Real-time notifications when your predictions resolve. See which matches scored, how many points and coins you earned — all from the bell icon dropdown.

<p align="center">
  <img src="docs/screenshots/15-notifications.png" width="300" alt="Notification center — prediction results with points and coins" />
</p>

---

## Settings — The Vault

Preferences, account management, and group admin tools — all in one place.

- **Language** toggle (English / Hebrew) with instant RTL switch
- **Theme** toggle (Dark / Light)
- **Live Match Animations** toggle
- **Account** section: email display, change password, sign out

<p align="center">
  <img src="docs/screenshots/14-settings.png" width="300" alt="Settings page — preferences, account, theme toggle" />
</p>

---

## Built for Everyone

Full Hebrew support with automatic RTL layout. Language toggle in Settings. Dark and light mode — toggle from the top bar.

<p align="center">
  <img src="docs/screenshots/19-hebrew-rtl.png" width="260" alt="Hebrew RTL — match stats in right-to-left layout" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/20-hebrew-leaderboard.jpeg" width="260" alt="Hebrew leaderboard — full RTL with insight badges" />
</p>

<p align="center">
  <sub>Full Hebrew RTL: match stats & leaderboard — every element flips correctly</sub>
</p>

### Built-in User Guide

New users? Tap the help icon anywhere in the app. The guide covers: How to Play, Predictions, Results, and Coins — all in a single, tabbed modal.

<p align="center">
  <img src="docs/screenshots/18-user-guide.png" width="300" alt="User guide modal — How to Play tab" />
</p>

---

## Sign In

GoalBet supports two sign-in methods — your choice, both available on the same screen.

**Google OAuth** — one tap, no password to remember. Preferred for most users.

**Email + password** — full account with live password strength validation. Supports:
- Forgot password (reset link via email, link expires in 1 hour)
- Change password at any time from Settings
- Smart identity detection: if you sign up with an email that belongs to a Google account, the UI tells you and offers to switch

Session expiry is handled silently — a re-auth modal slides in over your current page so you never lose context mid-session.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite 5, TypeScript, TailwindCSS 3, Framer Motion |
| **Backend** | Node.js 18, Express, TypeScript, node-cron |
| **Database** | Supabase — PostgreSQL, Row-Level Security, Realtime, Auth |
| **Football data** | ESPN public scoreboard API — free, no key required |
| **State** | Zustand with localStorage persistence |
| **CI/CD** | GitHub Actions — type-check + build on push, sync cron every 5 min |
| **Deployment** | Vercel (frontend) · Render (backend) |

### Why ESPN over TheSportsDB

TheSportsDB's free key (`"3"`) ignores the `?id=` parameter and returns wrong league data. ESPN's public scoreboard endpoint requires no auth, returns reliable real-time data, and covers all major leagues. No API key to manage.

### Why GitHub Actions as a heartbeat

The backend runs on Render's free tier — it sleeps after ~15 min of inactivity. Rather than pay for an always-on dyno, a GitHub Actions cron pings the backend every 5 minutes. This wakes it *and* triggers the sync. Scores and fixtures stay current 24/7 at zero cost.

---

## Supported Leagues

| League | Coverage |
|--------|----------|
| Premier League | Full |
| La Liga | Full |
| Bundesliga | Full |
| Serie A | Full |
| Ligue 1 | Full |
| Champions League | Full |
| Europa League | Full |
| Conference League | Full |
| FA Cup | Full |
| League Cup (Carabao) | Full |
| Copa del Rey | Full |
| UEFA Nations League | Full |
| World Cup Qualifiers 2026 | Full |
| International Friendlies | Full (no corners) |

---

## Project Structure

```
goalbet/
├── frontend/                  # React + Vite SPA
│   └── src/
│       ├── components/
│       │   ├── admin/         # Admin console (super-admin only)
│       │   ├── auth-v2/       # AuthContainer, PasswordStrength, ReAuthModal
│       │   ├── groups/        # Create/Join group modals
│       │   ├── layout/        # AppShell, TopBar, BottomNav, Sidebar
│       │   ├── leaderboard/   # LeaderboardTable, H2HModal, UserMatchHistory
│       │   ├── matches/       # MatchCard, MatchFeed, PredictionForm, Timeline
│       │   └── ui/            # GlassCard, NeonButton, ScoringGuide, CoinGuide,
│       │                      # HelpGuideModal, Avatar, ThemeToggle, Toast...
│       ├── hooks/             # useMatches, usePredictions, useLeaderboard,
│       │                      # useAuthV2, useLiveClock, useNewPointsAlert...
│       ├── lib/               # supabase.ts, i18n.ts, constants.ts, utils.ts
│       ├── pages/             # Home, Leaderboard, Profile, Settings, Login, Admin
│       └── stores/            # authStore, groupStore, coinsStore, langStore,
│                              # themeStore, uiStore (Zustand)
│
├── backend/                   # Express API + cron scheduler
│   └── src/
│       ├── routes/            # health, sync, admin
│       ├── services/          # espn.ts, matchSync.ts, scoreUpdater.ts, pointsEngine.ts
│       └── cron/              # 30s score poller, daily sync, weekly reset
│
├── supabase/
│   ├── migrations/            # SQL migrations 001 → 023
│   └── email-templates/       # Themed signup + reset emails
│
└── .github/workflows/
    ├── ci.yml                 # Type-check + build on push
    └── sync-cron.yml          # 5-min heartbeat: wake → scores → fixtures
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
   `supabase/migrations/001_initial_schema.sql` → `023_admin_security_rpcs.sql`
3. In **Authentication → Providers**:
   - Enable **Email** (already on by default — confirm it's enabled)
   - Enable **Google OAuth** (Client ID + Secret from Google Cloud Console)
4. In **Authentication → URL Configuration**, add:
   - Site URL: `http://localhost:5173`
   - Redirect URL: `http://localhost:5173/auth/callback`
5. *(Optional but recommended)* In **Authentication → Email Templates**, paste the contents of:
   - `supabase/email-templates/confirm-signup.html` → Confirm signup template
   - `supabase/email-templates/reset-password.html` → Reset password template

### 3. Environment variables

`frontend/.env.local`:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BACKEND_URL=http://localhost:3001
```

`backend/.env`:
```env
PORT=3001
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
NODE_ENV=development
```

> No feature flags required. Email + password auth is active by default.

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

1. Connect your GitHub repo to [Vercel](https://vercel.com), root dir = `frontend`
2. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND_URL`
3. In Supabase Auth settings, add your production domain to **Redirect URLs**
4. Auto-deploys on every push to `main`

### Backend → Render

1. Create a **Web Service**, root dir = `backend`
2. Build: `npm run build` · Start: `npm start`
3. Add env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NODE_ENV=production`

On startup the backend runs a catch-up sync (resolves any matches missed while sleeping), then polls for live scores every 30 seconds.

### GitHub Actions — Required Secret

Add one secret in your repo settings:
- `BACKEND_URL` — e.g. `https://goalbet-api.onrender.com`

No other secrets needed. Sync endpoints are intentionally public.

---

## Scoring Reference

| File | Purpose |
|------|---------|
| `backend/src/services/pointsEngine.ts` | Source of truth — pure scoring function |
| `frontend/src/lib/utils.ts → calcBreakdown()` | Client-side mirror of pointsEngine |
| `frontend/src/lib/constants.ts` | Points values, coin costs, league list |
| `frontend/src/lib/i18n.ts` | All UI strings — EN + HE |

---

## License

MIT — free to use, fork, and adapt. No gambling. No real money.
