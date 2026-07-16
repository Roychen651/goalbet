import cron from 'node-cron';
import { syncAllActiveLeagues } from '../services/matchSync';
import { checkAndUpdateScores, resetWeeklyPoints } from '../services/scoreUpdater';
import { sendMatchReminders } from '../services/pushSender';
import { runProvocateurBatch } from '../services/aiProvocateur';
import { sendStreakExpiryWarnings } from '../services/streakGuardian';
import { lockExpiredMicroQuestions, resolveLockedMicroQuestions } from '../services/momentumBets';
import { refreshCornersSupportFlags } from '../services/leagueStatCapability';
import { refreshEspnLeagueMap } from '../services/espn';
import { logger } from '../lib/logger';
import { withSyncTelemetry } from '../lib/syncTelemetry';
import { SyncResult } from '../services/matchSync';

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

  // Momentum Bets lock sweep — runs every 5 seconds. A 60-second betting
  // window can't tolerate the 30s live-poll cadence (up to half the window's
  // precision lost); this is deliberately its own tighter, ESPN-call-free
  // interval — it only reads/writes already-stored DB state.
  setInterval(guarded('Momentum lock sweep', async () => { await lockExpiredMicroQuestions(); }), 5_000);

  // Momentum Bets resolution sweep — every 15s. Looser than the lock sweep
  // since a resolution a few seconds late doesn't affect fairness (the
  // outcome window is already fixed at lock time either way).
  setInterval(guarded('Momentum resolution sweep', async () => { await resolveLockedMicroQuestions(); }), 15_000);

  // Weekly points reset every Sunday at 00:00 UTC (week = Sun 00:00 → Sat 23:59 UTC)
  cron.schedule('0 0 * * 0', async () => {
    logger.info('[scheduler] Running weekly points reset');
    try {
      await resetWeeklyPoints();
    } catch (err) {
      logger.error('[scheduler] Weekly reset failed:', err);
    }
  });

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

  logger.info('[scheduler] All cron jobs started');
}
