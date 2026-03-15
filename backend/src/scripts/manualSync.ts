/**
 * Manual sync script — trigger match sync and score update manually
 * Usage: npm run sync
 */
import dotenv from 'dotenv';
dotenv.config();

import { syncAllActiveLeagues } from '../services/matchSync';
import { checkAndUpdateScores } from '../services/scoreUpdater';
import { logger } from '../lib/logger';

async function manualSync() {
  logger.info('=== Manual Sync ===');

  logger.info('\n[1/2] Syncing matches...');
  const syncResults = await syncAllActiveLeagues();
  const totalSync = syncResults.reduce((sum, r) => sum + r.inserted, 0);
  logger.info(`  ✓ Upserted ${totalSync} matches across ${syncResults.length} leagues`);

  logger.info('\n[2/2] Checking scores...');
  const scoreResult = await checkAndUpdateScores();
  logger.info(`  ✓ Checked ${scoreResult.checked} matches, resolved ${scoreResult.resolved} predictions`);

  logger.info('\n=== Done ===');
  process.exit(0);
}

manualSync().catch(err => {
  logger.error('Manual sync failed:', err);
  process.exit(1);
});
