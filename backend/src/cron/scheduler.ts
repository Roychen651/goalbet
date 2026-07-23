import cron from 'node-cron';
import { syncAllActiveLeagues } from '../services/matchSync';
import { checkAndUpdateScores } from '../services/scoreUpdater';
import { sendMatchReminders } from '../services/pushSender';
import { runProvocateurBatch } from '../services/aiProvocateur';
import { runCommissionerBriefBatch } from '../services/aiCommissioner';
import { sendStreakExpiryWarnings } from '../services/streakGuardian';
import { lockExpiredMicroQuestions, resolveLockedMicroQuestions } from '../services/momentumBets';
import { resolveLiveDuels } from '../services/liveDuels';
import { refreshCornersSupportFlags } from '../services/leagueStatCapability';
import { archiveCompletedSeasons } from '../services/seasonArchive';
import { backfillMatchRounds } from '../services/matchRoundBackfill';
import { refreshEspnLeagueMap } from '../services/espn';
import { refreshActiveBattleScores } from '../services/groupBattles';
import { logger } from '../lib/logger';
import { withSyncTelemetry, getLastCompletedLivePoll, getRecentLivePollRuns } from '../lib/syncTelemetry';
import { SyncResult } from '../services/matchSync';

// V4 Sprint 31 Commit 3 — self-healing watchdog + alerting thresholds.
const WATCHDOG_INTERVAL_MS = 60_000;
const TIER1_STALENESS_THRESHOLD_MS = 90_000; // 3x the 30s Tier-1 cadence
const CONSECUTIVE_FAILURE_THRESHOLD = 5;

// V4 Sprint 31 — shared by the daily/noon/startup sync steps: turns a
// SyncResult[] (matchSync.ts's per-league return shape) into the counts
// shape withSyncTelemetry() expects. Extracted once rather than duplicated
// at the 3 call sites that all need the identical mapping.
function syncResultsToCounts(results: SyncResult[]): { leaguesChecked: number; errors: { scope: string; message: string }[] } {
  return {
    leaguesChecked: results.length,
    errors: results
      .filter(r => r.errorMessage)
      .map(r => ({ scope: `league:${r.leagueId}`, message: r.errorMessage as string })),
  };
}

// V4 Sprint 28 — small closure-based re-entrancy guard, factored out of the
// 3 module-level booleans (livePollerRunning/momentumLockRunning/
// momentumResolveRunning) this file used to hand-roll one at a time. Same
// behavior (skip a tick if the previous run of THIS SAME interval is still
// in flight, log-and-continue on error), now shared instead of copy-pasted —
// a non-behavioral cleanup that falls out naturally now that a 4th and 5th
// guarded interval (the two tiered pollers) are being added.
function guarded(label: string, fn: () => Promise<void>): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      logger.error(`[scheduler] ${label} failed:`, err);
    } finally {
      running = false;
    }
  };
}

export function startScheduler(): void {
  logger.info('[scheduler] Starting cron jobs...');

  // Startup catch-up — runs once 5 s after server start.
  // Ensures stale matches (e.g. while the server was sleeping on a free tier)
  // get their scores refreshed and unresolved predictions resolved immediately.
  //
  // V4 Sprint 28 — the league registry refresh runs FIRST, so the very first
  // sync/score-check of a fresh boot already has whatever's actually enabled
  // in `league_registry` rather than waiting a full 10-min cycle. It's a
  // no-op-safe call either way: LEAGUE_ESPN_MAP is already seeded from
  // FALLBACK_LEAGUE_MAP at module load, so a slow/failed registry read here
  // just means the sync below runs against the fallback instead — never a
  // blocked or empty sync. checkAndUpdateScores() here is called with NO
  // tier filter deliberately — a "just woke up, catch up on everything"
  // pass must check every pending league, not just the fast tier.
  setTimeout(() => {
    // V4 Sprint 31 — the 3 steps below still each keep their own try/catch
    // (unchanged behavior: one step's failure never blocks the next), but
    // now collect into a shared errors[] instead of only logging, so the
    // withSyncTelemetry wrapper around the whole block can see everything
    // that happened and write ONE honest sync_run_log row for this run —
    // never rethrowing internally, so this stays functionally identical to
    // the pre-Sprint-31 unguarded setTimeout callback.
    void withSyncTelemetry<{ leaguesChecked: number; matchesResolved: number; errors: { scope: string; message: string }[] }>(
      'startup_catchup',
      null,
      async () => {
        logger.info('[scheduler] Running startup catch-up sync & score check');
        const errors: { scope: string; message: string }[] = [];
        let leaguesChecked = 0;
        let matchesResolved = 0;

        try {
          await refreshEspnLeagueMap();
        } catch (err) {
          logger.error('[scheduler] Startup league registry refresh failed:', err);
          errors.push({ scope: 'startup_registry_refresh', message: err instanceof Error ? err.message : String(err) });
        }
        try {
          const syncResults = await syncAllActiveLeagues();
          const counts = syncResultsToCounts(syncResults);
          leaguesChecked = counts.leaguesChecked;
          errors.push(...counts.errors);
        } catch (err) {
          logger.error('[scheduler] Startup sync failed:', err);
          errors.push({ scope: 'startup_sync', message: err instanceof Error ? err.message : String(err) });
        }
        try {
          const result = await checkAndUpdateScores();
          matchesResolved = result.resolved;
          logger.info(`[scheduler] Startup score check: checked=${result.checked} resolved=${result.resolved}`);
          errors.push(...result.errors);
        } catch (err) {
          logger.error('[scheduler] Startup score check failed:', err);
          errors.push({ scope: 'startup_score_check', message: err instanceof Error ? err.message : String(err) });
        }

        return { leaguesChecked, matchesResolved, errors };
      },
      (r) => r,
    ).catch(err => logger.error('[scheduler] Startup telemetry wrapper threw unexpectedly:', err));
  }, 5_000);

  // League registry refresh — every 10 min. Cheap (one indexed, RLS-public
  // SELECT), and league tier/enabled changes made via the registry table
  // don't need a code deploy to take effect — just this refresh cycle.
  setInterval(guarded('League registry refresh', refreshEspnLeagueMap), 10 * 60_000);

  // Season Archive (V7 Sprint 56 follow-up) — a one-shot-per-season snapshot,
  // not a live-tracking concern, so this deliberately never shares a
  // cadence with anything above. A single staggered startup call (20s,
  // after the 5s startup catch-up above has already had its own tick, so
  // the two never compete for the same moment) means the very first
  // archived season lands within seconds of this feature deploying rather
  // than waiting up to 24h for the daily cron below.
  setTimeout(() => {
    archiveCompletedSeasons().catch(err => logger.error('[scheduler] Startup season archive failed:', err));
  }, 20_000);
  cron.schedule('50 0 * * *', async () => {
    try {
      await archiveCompletedSeasons();
    } catch (err) {
      logger.error('[scheduler] Season archive failed:', err);
    }
  });

  // matches.round backfill (V7 Sprint 57, automated same-day follow-up) —
  // this shipped ONCE ALREADY as a manual-only CLI script
  // (`npm run backfill:match-rounds`), which is why a completed knockout
  // season still showed "no data" in production after that PR merged:
  // nobody had actually run it. Never again — this now runs on its own,
  // no operator step required. Staggered 30s after the season-archive
  // startup call (itself 20s after the 5s startup catch-up) so none of
  // these compete for the same tick. A wider 730-day (2yr) lookback than
  // the CLI script's own 365-day default, specifically for this automatic
  // first run, so a genuinely stale deploy can self-heal its whole
  // existing backlog without anyone choosing a --since date by hand.
  // Safe to run daily forever: matches.round is written as '' (never left
  // null) the moment ESPN is confirmed to have nothing for a given match,
  // so `.is('round', null)` naturally narrows to only genuinely-new gaps
  // on every later run — see matchRoundBackfill.ts's own header comment.
  setTimeout(() => {
    const since = new Date(Date.now() - 730 * 86_400_000).toISOString().slice(0, 10);
    backfillMatchRounds(since)
      .then(outcome => logger.info(`[scheduler] Startup round backfill: ${outcome.found} found, ${outcome.markedUnavailable} unavailable, ${outcome.scanned} scanned`))
      .catch(err => logger.error('[scheduler] Startup round backfill failed:', err));
  }, 50_000);
  cron.schedule('10 1 * * *', async () => {
    try {
      const since = new Date(Date.now() - 730 * 86_400_000).toISOString().slice(0, 10);
      const outcome = await backfillMatchRounds(since);
      if (outcome.scanned > 0) {
        logger.info(`[scheduler] Daily round backfill: ${outcome.found} found, ${outcome.markedUnavailable} unavailable, ${outcome.scanned} scanned`);
      }
    } catch (err) {
      logger.error('[scheduler] Daily round backfill failed:', err);
    }
  });

  // Daily match sync at 00:05 UTC — fetch upcoming and recent matches for all active leagues
  cron.schedule('5 0 * * *', async () => {
    try {
      await withSyncTelemetry('daily_sync', null, async () => {
        logger.info('[scheduler] Running daily match sync');
        return syncAllActiveLeagues();
      }, syncResultsToCounts);
    } catch (err) {
      logger.error('[scheduler] Daily sync failed:', err);
    }
  });

  // ── Tiered live-score pollers (V4 Sprint 28) ────────────────────────────
  // Replaces the old single flat 30s poller. Tier is resolved per-league,
  // per-tick, inside checkAndUpdateScores() itself — from league_registry's
  // priority_tier PLUS live-match promotion (any league with a currently
  // live match is always treated as Tier 1, regardless of its base tier).
  // See scoreUpdater.ts's resolveEffectiveTier() for the exact logic; it
  // costs zero extra Supabase queries and zero extra ESPN calls, since it's
  // computed from data checkAndUpdateScores() already fetches for itself.
  //
  // Tier 1 (marquee leagues OR anything currently live): unchanged 30s
  // cadence — zero regression versus pre-Sprint-28 behavior for any league
  // that's actually live right now.
  setInterval(guarded('Tier-1 live poll', async () => {
    const result = await withSyncTelemetry('live_poll', 'tier1', () => checkAndUpdateScores('tier1'), (r) => ({
      matchesChecked: r.checked,
      matchesResolved: r.resolved,
      errors: r.errors,
    }));
    if (result.checked > 0) {
      logger.info(`[scheduler] Tier-1 poll: checked=${result.checked} resolved=${result.resolved}`);
    }
  }), 30_000);

  // Tier 2 (active in a group, no live match right now): 90s — still
  // responsive, at roughly a third of the request rate Tier 1 leagues get.
  // Tier 3 (low_frequency AND no live match right now) is never touched by
  // either interval — covered only by the daily 00:05 / noon
  // syncAllActiveLeagues() crons. A low_frequency league WITH a live match
  // is NOT Tier 3 — live-match promotion overrides base tier unconditionally
  // (resolveEffectiveTier() checks it first), so a real live friendly/
  // qualifier match still gets the full 30s Tier-1 cadence, not a ~12h wait
  // for the next daily sync.
  setInterval(guarded('Tier-2 poll', async () => {
    const result = await withSyncTelemetry('live_poll', 'tier2', () => checkAndUpdateScores('tier2'), (r) => ({
      matchesChecked: r.checked,
      matchesResolved: r.resolved,
      errors: r.errors,
    }));
    if (result.checked > 0) {
      logger.info(`[scheduler] Tier-2 poll: checked=${result.checked} resolved=${result.resolved}`);
    }
  }), 90_000);

  // Self-healing watchdog + consecutive-failure alerting (V4 Sprint 31
  // Commit 3) — every 60s. Two independent checks share one tick since both
  // read from the same sync_run_log table and neither is expensive.
  setInterval(guarded('Sync watchdog', async () => {
    // Gate: never act in the first 90s after boot. A cold start (this app's
    // NORMAL operating mode — Render's free tier sleeps after ~15 min idle)
    // guarantees "last successful poll" looks stale, since the server was
    // genuinely asleep — that's not a missed tick, it's expected, and the
    // existing unconditional startup catch-up above already handles it.
    // Applying the staleness check here too would just fire it a second
    // time, redundantly, on every single wake.
    if (process.uptime() < 90) return;

    // ── Staleness check: has Tier-1 actually stopped succeeding? ──────────
    // This is the failure mode the brief actually describes — the process
    // is awake and ticking, but the 30s interval itself silently stopped
    // producing successful runs (a real hang/bug), not "we just woke up."
    const last = await getLastCompletedLivePoll('tier1');
    const staleMs = last ? Date.now() - last.completedAt.getTime() : null;
    const isStale = staleMs === null || staleMs > TIER1_STALENESS_THRESHOLD_MS;

    if (isStale) {
      logger.warn(`[scheduler] Self-healing: last successful Tier-1 live_poll is ${staleMs === null ? 'missing entirely' : `${staleMs}ms old`} (threshold ${TIER1_STALENESS_THRESHOLD_MS}ms) — triggering out-of-cycle catch-up`);
      // Self-limiting by construction: a successful out-of-cycle run here
      // immediately produces a fresh sync_run_log row, resetting the
      // staleness clock until the NEXT genuine gap — this can't spam-fire
      // every 60s just because one catch-up already ran.
      const result = await withSyncTelemetry('live_poll', 'tier1', () => checkAndUpdateScores('tier1'), (r) => ({
        matchesChecked: r.checked,
        matchesResolved: r.resolved,
        errors: r.errors,
      }));
      logger.info(`[scheduler] Self-healing catch-up: checked=${result.checked} resolved=${result.resolved}`);
    }

    // ── Consecutive-failure alerting ──────────────────────────────────────
    // A single greppable log line — no webhook, no external dependency (none
    // exists anywhere in this codebase today, and a "dummy" webhook calling
    // nowhere real would be fake infrastructure). This is the natural hook
    // point for host-level log alerting (Render, or a future dedicated
    // webhook sprint) without fabricating one now. Never fires on an
    // isolated blip — only when EVERY one of the last 5 live_poll runs
    // failed or crashed; one clean run anywhere in that window resets it.
    const recent = await getRecentLivePollRuns(CONSECUTIVE_FAILURE_THRESHOLD);
    const allFailed = recent.length === CONSECUTIVE_FAILURE_THRESHOLD
      && recent.every(r => r.completedAt === null || r.errors.length > 0);
    if (allFailed) {
      logger.error(`[SRE_ALERT_SYNC_DOWN] ${CONSECUTIVE_FAILURE_THRESHOLD} consecutive live_poll failures — see sync_run_log`);
    }
  }), WATCHDOG_INTERVAL_MS);

  // Momentum Bets lock sweep — runs every 5 seconds. A 60-second betting
  // window can't tolerate the 30s live-poll cadence (up to half the window's
  // precision lost); this is deliberately its own tighter, ESPN-call-free
  // interval — it only reads/writes already-stored DB state.
  setInterval(guarded('Momentum lock sweep', async () => { await lockExpiredMicroQuestions(); }), 5_000);

  // Momentum Bets resolution sweep — every 15s. Looser than the lock sweep
  // since a resolution a few seconds late doesn't affect fairness (the
  // outcome window is already fixed at lock time either way).
  setInterval(guarded('Momentum resolution sweep', async () => { await resolveLockedMicroQuestions(); }), 15_000);

  // Live Duels resolution sweep — every 15s, same cadence and reasoning as
  // Momentum Bets' resolution sweep above (the outcome window is already
  // fixed at accept/lock time, so a few seconds' delay here doesn't affect
  // fairness). No separate "lock" sweep needed — accept_duel_wager()
  // (migration 065) both locks AND activates a duel in the same RPC call,
  // unlike Momentum Bets' pre-generated-question shape.
  setInterval(guarded('Live Duel resolution sweep', async () => { await resolveLiveDuels(); }), 15_000);

  // Weekly points reset — V7 Sprint 51 hotfix (migration 069). Fully
  // pg_cron-native now, matching distribute_daily_allowance()/
  // decay_idle_streaks()'s established "pg_cron-only, zero Node
  // cron.schedule() involvement" shape (§28). The old fixed
  // `cron.schedule('0 0 * * 0', ...)` here drifted a real hour off true
  // Israel-midnight for ~7 months a year (IDT, UTC+3) — the exact DST-drift
  // bug flagged (not fixed) in CLAUDE.md §69, now closed the same way §28's
  // daily bonus and §63's weekly promotion sweep already were: a frequent
  // (15-min) pg_cron sweep deriving the real Israel-local week boundary
  // from arena_current_week_start(), idempotent via weekly_points_reset_log.
  // See migration 069 for reset_weekly_points_if_needed().

  // Additional sync at noon UTC to catch mid-day schedule updates
  cron.schedule('0 12 * * *', async () => {
    try {
      await withSyncTelemetry('daily_sync', null, async () => {
        logger.info('[scheduler] Running midday match sync');
        return syncAllActiveLeagues();
      }, syncResultsToCounts);
    } catch (err) {
      logger.error('[scheduler] Midday sync failed:', err);
    }
  });

  // Match reminders — every 2 min so a match entering the 15-min pre-kickoff
  // window is caught promptly. No-op unless VAPID keys are set. Each match is
  // reminded exactly once (matches.reminder_sent_at).
  cron.schedule('*/2 * * * *', async () => {
    try {
      await sendMatchReminders();
    } catch (err) {
      logger.error('[scheduler] Match reminders failed:', err);
    }
  });

  // AI Locker Room Provocateur — every 3 min so a match that just kicked off is
  // caught promptly. Fires banter at T-0 only (picks are public once kickoff
  // passes — never before, to honour prediction privacy). No-op without a Groq
  // key. Each (group, match) bantered exactly once (partial unique index).
  cron.schedule('*/3 * * * *', async () => {
    try {
      await runProvocateurBatch();
    } catch (err) {
      logger.error('[scheduler] Provocateur batch failed:', err);
    }
  });

  // AI Commissioner weekly brief — V7 Sprint 51. Deliberately a frequent
  // (30-min) setInterval sweep, NEVER a fixed weekly cron.schedule(). A
  // fixed UTC weekly cron (the exact shape the pre-existing weekly-reset
  // job used to use, before the hotfix above closed that same DST-drift
  // bug) would drift up to an hour off true Israel-week boundaries for
  // ~7 months a year. This sweep instead re-derives "the current week" from
  // arena_current_week_start() (migration 066, Asia/Jerusalem-aware) on
  // every tick and relies on the unique index
  // (group_id, metadata->>week_start) to make posting idempotent —
  // matching §28's daily-bonus and §63's weekly-promotion precedent
  // exactly. No-op without a Groq key.
  setInterval(guarded('Commissioner weekly brief batch', async () => { await runCommissionerBriefBatch(); }), 30 * 60_000);

  // Corners stat-capability refresh — daily, 30 min after the midnight sync
  // so that day's newly-resolved matches have already landed. This signal
  // (V4 Sprint 26) only moves as leagues accumulate FT matches over days,
  // never seconds — no reason to run it on a tighter cadence.
  cron.schedule('35 0 * * *', async () => {
    try {
      await refreshCornersSupportFlags();
    } catch (err) {
      logger.error('[scheduler] Corners support refresh failed:', err);
    }
  });

  // Streak-expiry push warning — day-6 idle detection (V4 Sprint 12). The
  // actual decay is pure SQL on pg_cron (migration 041, runs even while this
  // dyno sleeps); this is only the push-send half, which needs the web-push
  // client. 30 min is enough precision for a 24h warning window and keeps
  // this off the tighter cadences used for coin/score correctness.
  cron.schedule('*/30 * * * *', async () => {
    try {
      await sendStreakExpiryWarnings();
    } catch (err) {
      logger.error('[scheduler] Streak expiry warnings failed:', err);
    }
  });

  // Group Battles score refresh (V5 Sprint 36) — same 30-min cadence as
  // streak-expiry warnings, for the same reason: a battle runs over hours
  // or days, so a tight poll would be wasted load for a signal that only
  // moves this slowly.
  cron.schedule('*/30 * * * *', async () => {
    try {
      await refreshActiveBattleScores();
    } catch (err) {
      logger.error('[scheduler] Group Battles score refresh failed:', err);
    }
  });

  logger.info('[scheduler] All cron jobs started');
}
