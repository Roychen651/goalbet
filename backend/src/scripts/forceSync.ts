/**
 * Force sync — pull a CLEAN copy of EVERY ESPN-mapped league right now,
 * bypassing group `active_leagues` config. Use this to seed/repair the
 * matches table (incl. World Cup 4480) when the normal group-scoped sync
 * leaves gaps.
 *
 * Usage: npm run sync:all
 *
 * Prints per-league event/insert counts so you can see exactly which slugs
 * returned data and which came back empty (off-season vs misconfigured).
 */
import dotenv from 'dotenv';
dotenv.config();

import { syncLeague } from '../services/matchSync';
import { LEAGUE_ESPN_MAP } from '../services/espn';
import { checkAndUpdateScores } from '../services/scoreUpdater';
import { logger } from '../lib/logger';

async function forceSync() {
  const leagueIds = Object.keys(LEAGUE_ESPN_MAP).map(Number);
  logger.info(`=== FORCE SYNC — ${leagueIds.length} mapped leagues (ignoring group config) ===`);

  const summary: { leagueId: number; slug: string; inserted: number; errors: number }[] = [];

  for (const leagueId of leagueIds) {
    const slug = LEAGUE_ESPN_MAP[leagueId];
    const result = await syncLeague(leagueId);
    summary.push({ leagueId, slug, inserted: result.inserted, errors: result.errors });
    logger.info(`  • ${String(leagueId).padEnd(5)} ${slug.padEnd(20)} inserted=${result.inserted} errors=${result.errors}`);
    // Be polite to ESPN between leagues.
    await new Promise(r => setTimeout(r, 500));
  }

  const total = summary.reduce((s, r) => s + r.inserted, 0);
  const empty = summary.filter(r => r.inserted === 0).map(r => r.slug);
  logger.info(`\n=== Upserted ${total} matches. Empty leagues (off-season / no fixtures): ${empty.join(', ') || 'none'} ===`);

  logger.info('\nResolving any finished predictions...');
  const scoreResult = await checkAndUpdateScores();
  logger.info(`  ✓ Checked ${scoreResult.checked} matches, resolved ${scoreResult.resolved} predictions`);

  logger.info('\n=== Force sync complete ===');
  process.exit(0);
}

forceSync().catch(err => {
  logger.error('Force sync failed:', err);
  process.exit(1);
});
