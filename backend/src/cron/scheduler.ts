import cron from 'node-cron';
import { syncAllActiveLeagues } from '../services/matchSync';
import { checkAndUpdateScores, resetWeeklyPoints } from '../services/scoreUpdater';
import { logger } from '../lib/logger';

export function startScheduler(): void {
  logger.info('[scheduler] Starting cron jobs...');

  // Daily match sync at 00:05 UTC — fetch upcoming and recent matches for all active leagues
  cron.schedule('5 0 * * *', async () => {
    logger.info('[scheduler] Running daily match sync');
    try {
      await syncAllActiveLeagues();
    } catch (err) {
      logger.error('[scheduler] Daily sync failed:', err);
    }
  });

  // Score resolution every 60 seconds — checks if pending matches have finished
  // Smart: only makes API calls when matches are expected to have finished
  cron.schedule('* * * * *', async () => {
    try {
      const result = await checkAndUpdateScores();
      if (result.checked > 0) {
        logger.info(`[scheduler] Score update: checked=${result.checked} resolved=${result.resolved}`);
      }
    } catch (err) {
      logger.error('[scheduler] Score update failed:', err);
    }
  });

  // Weekly points reset every Monday at 00:00 UTC
  cron.schedule('0 0 * * 1', async () => {
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
