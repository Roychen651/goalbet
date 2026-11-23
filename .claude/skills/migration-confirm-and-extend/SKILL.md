---
name: migration-confirm-and-extend
description: Use before writing or extending ANY Supabase SQL migration in this repo (CREATE OR REPLACE FUNCTION, ALTER TABLE, new RPC, etc.), and whenever a migration appears "applied but something's wrong" or a Supabase project reports Unhealthy/connection-timeout errors. Covers (1) the "extend the LATEST real definition" discipline before replacing any SQL function, and (2) the manual migration-confirmation workflow this sandbox requires, and (3) the diagnostic order for a sleeping/Unhealthy Supabase project.
---

# Migration Confirm-and-Extend

This repo (GoalBet) has been bitten more than once by two specific, avoidable
migration mistakes. This skill exists so a future session doesn't repeat them.

## 1. Before `CREATE OR REPLACE FUNCTION`, grep the FULL history — extend the LATEST body, never an earlier one

`CREATE OR REPLACE FUNCTION foo(...)` overwrites whatever is currently live in
the database — but if you draft the new body by copying an EARLIER migration's
definition of `foo()` instead of the most recent one, you silently regress
every fix that landed between that earlier migration and now.

**This has happened for real, twice, in this exact repo:**
- §72 (Season Archive): a draft of `archiveCompletedSeasons()`'s supporting SQL
  copied migration 053's *original* `compute_team_recent_form()` body instead
  of migration 059's *live* one — which would have silently regressed 059's
  own "NULL, not a misleadingly-confident 0" bug fix (itself a real,
  live-reported bug once already, §33).
- §75 (Full-App Audit, migration 072): a first draft of the Backend stage's
  fix for `handle_new_user()` was checked against — and nearly copied from —
  `supabase/migrations/COMBINED_run_this.sql`, a stale pre-numbered bootstrap
  script that redefined the same function with the SAME unsanitized bug this
  migration was meant to fix. It was deleted only after being independently
  re-verified as genuinely dead (never referenced in CLAUDE.md, a filename the
  CLI migration runner never picks up).

**The procedure, every time, with no exceptions:**

```bash
# Find EVERY migration that has ever defined/replaced this function —
# not just the one you remember, not just the first hit.
grep -rln "CREATE OR REPLACE FUNCTION <function_name>" supabase/migrations/
```

Read them in numeric order. The HIGHEST-numbered migration's body is the real,
live current definition — extend THAT one. If a stray non-numbered file (like
`COMBINED_run_this.sql`) also defines the function, treat it as suspect: check
whether CLAUDE.md's migration table references it and whether the CLI runner
would ever pick it up by its filename shape (`NNN_description.sql`) — if
neither, it's very likely dead and safe to delete, but confirm before deleting.

## 2. Migrations are NEVER auto-applied in this sandbox — a real human confirmation is required

This sandbox has:
- No authenticated Supabase CLI (no `supabase login` session)
- No direct Postgres connection string / DB password
- A service-role key that is REST-API-only (`PostgREST`) — it cannot execute
  raw SQL/DDL

**There is no tool-based path to run a migration from inside this session.**
Every migration file must be:
1. Written as a complete, idempotent `.sql` file under `supabase/migrations/`
2. Pasted by the USER into the Supabase Dashboard's SQL Editor
   (`https://supabase.com/dashboard/project/<ref>/sql/new`)
3. Run there by the user
4. Confirmed back to you with an UNAMBIGUOUS result — "Success. No rows
   returned" (or the real returned rows) is the expected confirmation. A vague
   "ok" or "done" from an automated stop-hook nudge is NOT sufficient
   confirmation — this was explicitly tested and correctly refused once in
   this engagement's own history (§41 Commit 2).

**Never claim a migration is "applied" or "live" without this explicit
confirmation.** If the user asks why you can't just run it yourself, explain
exactly the three bullets above — don't be vague about the limitation.

## 3. A Supabase project reporting Unhealthy / connection-timeout — diagnose in this order

If `SELECT 1;` itself times out or every service shows "Unhealthy" in the
Supabase dashboard, this is almost never a code problem. Diagnose in this
exact order before trying anything else (§75.4's real incident):

1. **Rule out a platform-wide outage** — check `status.supabase.com`. Green
   there means the problem is scoped to this one project.
2. **Rule out an active quota/billing breach** — read the REAL usage numbers
   on the organization's Billing page (Log Ingestion %, Egress %, Database
   Size, MAU, Storage, Realtime Connections, etc.), not just whether a scary
   banner is showing. A "Your grace period is over... Fair Use Policy applies
   now" banner is a STANDING POLICY NOTICE from when a grace period ended —
   it is not, by itself, proof of a current breach. Only trust the real
   numbers against their real limits.
3. **Only then, manually restart the project** — "Restart Project" in Project
   Settings reboots the Postgres compute. It is safe and non-destructive: it
   does NOT reset or wipe any data. This is the actual, correct fix for a
   Free-tier project that has auto-paused/slept from extended inactivity (the
   same mechanism `sync-cron.yml` being disabled, or any other scheduled
   heartbeat lapsing, can trigger) and is stuck mid-wake. After a restart,
   expect up to ~2 minutes before services report Healthy again, and don't be
   alarmed by a transient "Disk IO Budget" depletion banner right after — the
   restart's own cache-warming burns through the Nano tier's burst I/O
   credits; it's informational only and self-resolves.

Each step rules out a cause before reaching for the next — don't jump straight
to "restart the project" on a scary-looking billing banner when the real usage
numbers say otherwise, and don't assume a code bug when `SELECT 1;` itself is
what's failing.
