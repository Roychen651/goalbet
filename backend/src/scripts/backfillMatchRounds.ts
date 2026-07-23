/**
 * Retroactive matches.round backfill — V7 Sprint 57.
 *
 * `round` was hardcoded null on every match upsert for this codebase's
 * entire lifetime until Sprint 48 (§63) added extractRoundName() to the
 * live scoreboard sync path. A match that was already synced (and
 * completed) before that fix landed has round=null frozen forever — the
 * regular sync jobs only ever touch a narrow recent/upcoming date window,
 * never revisit an old FT match. This left every completed knockout-stage
 * match from before Sprint 48 unable to be classified by
 * classifyBracketStage() on the frontend — reported live: Champions
 * League's already-finished 2025/26 knockout stage showed "not started
 * yet" in the bracket view, and the season archive had no knockout data
 * for that same season either (the archive was never the storage for
 * this — the bracket always reads live `matches` rows, filtered by
 * league_id + season; see KnockoutBracketView.tsx/useKnockoutMatches.ts).
 *
 * One path, not two — unlike backfillTeamStats.ts's Path A/B split, there
 * is no DB-to-DB shortcut here: round was never captured anywhere before
 * Sprint 48, so every match needing this backfill requires a live
 * re-fetch. Batched via the same processBatched() primitive Sprint 28
 * built for exactly this kind of bulk historical operation.
 *
 * Whether ESPN's summary endpoint retains a round/headline for matches
 * this old is UNVERIFIED (this sandbox cannot reach ESPN) — every
 * match's real outcome is recorded and reported, never assumed.
 *
 * Usage:
 *   npm run backfill:match-rounds                  -- defaults to the last 365 days
 *   npm run backfill:match-rounds -- --since=2025-06-01
 */
import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../lib/supabaseAdmin';
import { fetchMatchRoundFromSummary } from '../services/espn';
import { processBatched } from '../lib/batch';
import { logger } from '../lib/logger';

interface BackfillMatch {
  id: string;
  external_id: string;
  league_id: number;
}

function parseArgs(): { since: string } {
  const args = process.argv.slice(2);
  const sinceArg = args.find(a => a.startsWith('--since='));
  const since = sinceArg
    ? sinceArg.slice('--since='.length)
    : new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  return { since };
}

// Completed matches only — a match still NS/live has no "round" story to
// tell yet in the sense this backfill cares about (the live sync path
// already captures round for anything synced going forward, completed or
// not; this script exists purely to repair the pre-Sprint-48 gap).
async function getMatchesNeedingBackfill(since: string): Promise<BackfillMatch[]> {
  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select('id, external_id, league_id')
    .in('status', ['FT', 'AET', 'PEN'])
    .is('round', null)
    .gte('kickoff_time', since);

  if (error) {
    logger.error(`[backfillMatchRounds] Failed to fetch matches: ${error.message}`);
    return [];
  }
  return (matches as BackfillMatch[]) ?? [];
}

async function main() {
  const { since } = parseArgs();
  logger.info(`=== Backfill matches.round — completed matches since ${since} with round=null ===`);

  const matches = await getMatchesNeedingBackfill(since);
  if (matches.length === 0) {
    logger.info('Nothing to backfill — every completed match in this window already has a round value (or genuinely has none to find).');
    process.exit(0);
  }
  logger.info(`${matches.length} matches need a round re-fetch.`);

  const outcome = { found: 0, stillUnavailable: 0 };

  await processBatched(matches, async (m) => {
    const round = await fetchMatchRoundFromSummary(m.external_id, m.league_id);
    if (!round) {
      outcome.stillUnavailable++;
      return;
    }
    outcome.found++;
    const { error } = await supabaseAdmin
      .from('matches')
      .update({ round })
      .eq('id', m.id);
    if (error) {
      logger.error(`[backfillMatchRounds] Update failed for match ${m.id}: ${error.message}`);
    }
  });

  // Stated coverage, not promised coverage — some matches WILL come back
  // unavailable if ESPN doesn't retain a round/headline for old events,
  // and that's reported honestly rather than silently treated as success.
  logger.info(`\n=== Backfill complete ===`);
  logger.info(`  round found + written: ${outcome.found}`);
  logger.info(`  still unavailable:     ${outcome.stillUnavailable}`);
  process.exit(0);
}

main().catch(err => {
  logger.error('[backfillMatchRounds] Fatal error:', err);
  process.exit(1);
});
