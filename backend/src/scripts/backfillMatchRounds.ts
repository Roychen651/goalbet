/**
 * Manual on-demand entry point for the matches.round backfill — the real
 * logic lives in services/matchRoundBackfill.ts, which scheduler.ts now
 * also calls automatically (startup + daily). This script stays useful
 * for an operator who wants to force a specific window on demand; it is
 * NOT the only way this backfill runs anymore — see CLAUDE.md for the
 * automation this same sprint added after shipping this as manual-only
 * the first time.
 *
 * Usage:
 *   npm run backfill:match-rounds                  -- defaults to the last 365 days
 *   npm run backfill:match-rounds -- --since=2025-06-01
 */
import dotenv from 'dotenv';
dotenv.config();

import { backfillMatchRounds } from '../services/matchRoundBackfill';
import { logger } from '../lib/logger';

function parseArgs(): { since: string } {
  const args = process.argv.slice(2);
  const sinceArg = args.find(a => a.startsWith('--since='));
  const since = sinceArg
    ? sinceArg.slice('--since='.length)
    : new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  return { since };
}

async function main() {
  const { since } = parseArgs();
  logger.info(`=== Backfill matches.round — completed matches since ${since} with round=null ===`);

  const outcome = await backfillMatchRounds(since);
  if (outcome.scanned === 0) {
    logger.info('Nothing to backfill — every completed match in this window already has a round value (or has been checked and genuinely has none).');
    process.exit(0);
  }

  // Stated coverage, not promised coverage — some matches WILL come back
  // unavailable if ESPN doesn't retain a round/headline for old events,
  // and that's reported honestly rather than silently treated as success.
  logger.info(`${outcome.scanned} matches needed a round re-fetch.`);
  logger.info(`\n=== Backfill complete ===`);
  logger.info(`  round found + written: ${outcome.found}`);
  logger.info(`  checked, unavailable:  ${outcome.markedUnavailable}`);
  process.exit(0);
}

main().catch(err => {
  logger.error('[backfillMatchRounds] Fatal error:', err);
  process.exit(1);
});
