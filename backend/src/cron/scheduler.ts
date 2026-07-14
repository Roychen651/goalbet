import cron from 'node-cron';
import { syncAllActiveLeagues } from '../services/matchSync';
import { checkAndUpdateScores, resetWeeklyPoints } from '../services/scoreUpdater';
import { sendMatchReminders } from '../services/pushSender';
import { runProvocateurBatch } from '../services/aiProvocateur';
import { sendStreakExpiryWarnings } from '../services/streakGuardian';
import { lockExpiredMicroQuestions, resolveLockedMicroQuestions } from '../services/momentumBets';
import { logger } from '../lib/logger';

let livePollerRunning = false;
let momentumLockRunning = false;
let momentumResolveRunning = false;

export function startScheduler(): void {
  logger.info('[scheduler] Starting cron jobs...');

  // Startup catch-up — runs once 5 s after server start.
  // Ensures stale matches (e.g. while the server was sleeping on a free tier)
  // get their scores refreshed and unresolved predictions resolved immediately.
  setTimeout(async () => {
    logger.info('[scheduler] Running startup catch-up sync & score check');
    try {
      await syncAllActiveLeagues();
    } catch (err) {
      logger.error('[scheduler] Startup sync failed:', err);
    }
    try {
      const result = await checkAndUpdateScores();
      logger.info(`[scheduler] Startup score check: checked=${result.checked} resolved=${result.resolved}`);
    } catch (err) {
      logger.error('[scheduler] Startup score check failed:', err);
    }
  }, 5_000);

  // Daily match sync at 00:05 UTC — fetch upcoming and recent matches for all active leagues
  cron.schedule('5 0 * * *', async () => {
    logger.info('[scheduler] Running daily match sync');
    try {
      await syncAllActiveLeagues();
    } catch (err) {
      logger.error('[scheduler] Daily sync failed:', err);
    }
  });

  // Live score poller — runs every 30 seconds using setInterval.
  // Polls ESPN for any match that has kicked off and isn't finished yet.
  // This gives ~30s latency on live score updates.
  setInterval(async () => {
    if (livePollerRunning) return; // skip if previous run still in progress
    livePollerRunning = true;
    try {
      const result = await checkAndUpdateScores();
      if (result.checked > 0) {
        logger.info(`[scheduler] Live poll: checked=${result.checked} resolved=${result.resolved}`);
      }
    } catch (err) {
      logger.error('[scheduler] Live poll failed:', err);
    } finally {
      livePollerRunning = false;
    }
  }, 30_000);

  // Momentum Bets lock sweep — runs every 5 seconds. A 60-second betting
  // window can't tolerate the 30s live-poll cadence (up to half the window's
  // precision lost); this is deliberately its own tighter, ESPN-call-free
  // interval — it only reads/writes already-stored DB state.
  setInterval(async () => {
    if (momentumLockRunning) return;
    momentumLockRunning = true;
    try {
      await lockExpiredMicroQuestions();
    } catch (err) {
      logger.error('[scheduler] Momentum lock sweep failed:', err);
    } finally {
      momentumLockRunning = false;
    }
  }, 5_000);

  // Momentum Bets resolution sweep — every 15s. Looser than the lock sweep
  // since a resolution a few seconds late doesn't affect fairness (the
  // outcome window is already fixed at lock time either way).
  setInterval(async () => {
    if (momentumResolveRunning) return;
    momentumResolveRunning = true;
    try {
      await resolveLockedMicroQuestions();
    } catch (err) {
      logger.error('[scheduler] Momentum resolution sweep failed:', err);
    } finally {
      momentumResolveRunning = false;
    }
  }, 15_000);

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
    logger.info('[scheduler] Running midday match sync');
    try {
      await syncAllActiveLeagues();
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
