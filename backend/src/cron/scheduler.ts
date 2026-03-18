import cron from 'node-cron';
import { syncAllActiveLeagues } from '../services/matchSync';
import { checkAndUpdateScores, resetWeeklyPoints } from '../services/scoreUpdater';
import { logger } from '../lib/logger';

let livePollerRunning = false;

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

  logger.info('[scheduler] All cron jobs started');
}
