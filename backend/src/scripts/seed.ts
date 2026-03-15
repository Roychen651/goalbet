/**
 * Seed script — populates development data by syncing default football leagues
 * Usage: npm run seed
 */
import dotenv from 'dotenv';
dotenv.config();

import { syncLeague } from '../services/matchSync';
import { logger } from '../lib/logger';

// All supported leagues (matches constants.ts in frontend)
const SEED_LEAGUES = [
  { id: 4328, name: 'English Premier League' },
  { id: 4335, name: 'Spanish La Liga' },
  { id: 4331, name: 'German Bundesliga' },
  { id: 4332, name: 'Italian Serie A' },
  { id: 4334, name: 'French Ligue 1' },
  { id: 4346, name: 'UEFA Champions League' },
  { id: 4399, name: 'UEFA Europa League' },
  { id: 4877, name: 'UEFA Conference League' },
  { id: 4354, name: 'Israeli Premier League' },
  { id: 4337, name: 'Dutch Eredivisie' },
  { id: 4338, name: 'Turkish Süper Lig' },
  { id: 4330, name: 'Scottish Premiership' },
  { id: 4344, name: 'MLS' },
  { id: 4351, name: 'Brazilian Série A' },
  { id: 4350, name: 'Argentine Primera' },
];

async function seed() {
  logger.info('=== GoalBet Seed Script ===');
  logger.info(`Syncing ${SEED_LEAGUES.length} leagues...`);

  let totalMatches = 0;
  let errors = 0;

  for (const league of SEED_LEAGUES) {
    logger.info(`\nSyncing: ${league.name} (ID: ${league.id})`);
    try {
      const result = await syncLeague(league.id);
      totalMatches += result.inserted;
      logger.info(`  ✓ Synced ${result.inserted} matches`);
    } catch (err) {
      logger.error(`  ✗ Failed: ${err}`);
      errors++;
    }

    // Rate limit: wait between calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger.info(`\n=== Seed Complete ===`);
  logger.info(`Total matches upserted: ${totalMatches}`);
  logger.info(`Errors: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

seed().catch(err => {
  logger.error('Seed script failed:', err);
  process.exit(1);
});
