/**
 * Retroactive match_team_stats backfill — V4 Sprint 29 Commit 3.
 *
 * Two genuinely different paths, not one:
 *
 *   Path A (red cards) — zero ESPN calls. matches.red_cards_home/away
 *   already store the real per-team split (confirmed in sportsdb.ts's
 *   DBMatch interface), so this is a pure DB-to-DB copy. Instant, no rate
 *   limit risk, completes fully every run.
 *
 *   Path B (corners + yellow_cards + raw_stats) — requires a live re-fetch
 *   per historical match from ESPN's summary endpoint, since
 *   matches.corners_total is an IRREVERSIBLE home+away SUM (confirmed in
 *   espn.ts) and yellow_cards/raw_stats were never captured anywhere
 *   before this sprint. Batched via the same processBatched() primitive
 *   Sprint 28 built for exactly this kind of bulk historical operation.
 *   Whether ESPN's summary endpoint even exposes .statistics[] for old
 *   events is UNVERIFIED (this sandbox cannot reach ESPN) — every match's
 *   real outcome is recorded and reported, never assumed.
 *
 * Usage:
 *   npm run backfill:team-stats                  -- defaults to the last 90 days
 *   npm run backfill:team-stats -- --since=2026-01-01
 *   npm run backfill:team-stats -- --since=2026-01-01 --path=a   (red cards only, skip the ESPN re-fetch)
 */
import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../lib/supabaseAdmin';
import { fetchMatchTeamStatsFromSummary } from '../services/espn';
import { processBatched } from '../lib/batch';
import { logger } from '../lib/logger';

interface BackfillMatch {
  id: string;
  external_id: string;
  league_id: number;
  red_cards_home: number | null;
  red_cards_away: number | null;
}

function parseArgs(): { since: string; pathAOnly: boolean } {
  const args = process.argv.slice(2);
  const sinceArg = args.find(a => a.startsWith('--since='));
  const pathArg = args.find(a => a.startsWith('--path='));
  const since = sinceArg
    ? sinceArg.slice('--since='.length)
    : new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  return { since, pathAOnly: pathArg?.slice('--path='.length) === 'a' };
}

async function getMatchesNeedingBackfill(since: string): Promise<BackfillMatch[]> {
  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select('id, external_id, league_id, red_cards_home, red_cards_away')
    .eq('status', 'FT')
    .gte('kickoff_time', since);

  if (error) {
    logger.error(`[backfillTeamStats] Failed to fetch matches: ${error.message}`);
    return [];
  }
  if (!matches || matches.length === 0) return [];

  // Idempotency: skip matches that already have BOTH home+away rows —
  // a re-run of this script should only touch matches it hasn't finished.
  const { data: existing } = await supabaseAdmin
    .from('match_team_stats')
    .select('match_id')
    .in('match_id', matches.map(m => m.id));

  const doneIds = new Set<string>();
  const seenOnce = new Set<string>();
  for (const row of existing ?? []) {
    const id = row.match_id as string;
    if (seenOnce.has(id)) doneIds.add(id); // 2nd sighting = both home+away rows exist
    else seenOnce.add(id);
  }

  return (matches as BackfillMatch[]).filter(m => !doneIds.has(m.id));
}

// Path A — red cards only, straight from data already in `matches`.
async function runPathA(matches: BackfillMatch[]): Promise<void> {
  const rows = matches.flatMap(m => [
    { match_id: m.id, team_side: 'home', red_cards: m.red_cards_home },
    { match_id: m.id, team_side: 'away', red_cards: m.red_cards_away },
  ]);
  if (rows.length === 0) return;

  // Deliberately omits corners/yellow_cards/raw_stats from the payload
  // entirely (not set to null) — supabase-js's upsert only updates columns
  // actually present in the row object, so a re-run of Path A can never
  // clobber values a prior Path B run already wrote for the same row.
  const { error } = await supabaseAdmin
    .from('match_team_stats')
    .upsert(rows, { onConflict: 'match_id,team_side' });

  if (error) {
    logger.error(`[backfillTeamStats] Path A upsert failed: ${error.message}`);
  } else {
    logger.info(`[backfillTeamStats] Path A: ${matches.length} matches, ${rows.length} rows (red_cards only, zero ESPN calls)`);
  }
}

// Path B — live re-fetch per match, bounded concurrency.
async function runPathB(matches: BackfillMatch[]): Promise<{ full: number; partial: number; unavailable: number }> {
  const outcome = { full: 0, partial: 0, unavailable: 0 };

  await processBatched(matches, async (m) => {
    const stats = await fetchMatchTeamStatsFromSummary(m.external_id, m.league_id);

    if (!stats || (stats.home_corners === null && stats.away_corners === null && stats.home_yellow_cards === null && stats.away_yellow_cards === null)) {
      outcome.unavailable++;
      return;
    }

    const allFieldsPresent = [stats.home_corners, stats.away_corners, stats.home_yellow_cards, stats.away_yellow_cards].every(v => v !== null);
    if (allFieldsPresent) outcome.full++;
    else outcome.partial++;

    const updates = [
      { match_id: m.id, team_side: 'home', corners: stats.home_corners, yellow_cards: stats.home_yellow_cards, raw_stats: stats.home_stats_raw ?? [] },
      { match_id: m.id, team_side: 'away', corners: stats.away_corners, yellow_cards: stats.away_yellow_cards, raw_stats: stats.away_stats_raw ?? [] },
    ];
    const { error } = await supabaseAdmin
      .from('match_team_stats')
      .upsert(updates, { onConflict: 'match_id,team_side' });
    if (error) {
      logger.error(`[backfillTeamStats] Path B upsert failed for match ${m.id}: ${error.message}`);
    }
  });

  return outcome;
}

async function main() {
  const { since, pathAOnly } = parseArgs();
  logger.info(`=== Backfill match_team_stats — matches since ${since} ===`);

  const matches = await getMatchesNeedingBackfill(since);
  if (matches.length === 0) {
    logger.info('Nothing to backfill — every FT match in this window already has match_team_stats rows.');
    process.exit(0);
  }
  logger.info(`${matches.length} matches need backfill.`);

  await runPathA(matches);

  if (pathAOnly) {
    logger.info('=== Backfill complete (Path A only, --path=a) ===');
    process.exit(0);
  }

  logger.info('Path B: re-fetching corners/yellow_cards/raw_stats from ESPN (batched, may take a while)...');
  const outcome = await runPathB(matches);

  // Stated coverage, not promised coverage — some matches WILL come back
  // unavailable if ESPN doesn't retain advanced stats for old events, and
  // that's reported honestly rather than silently treated as success.
  logger.info(`\n=== Backfill complete ===`);
  logger.info(`  full (corners + cards):     ${outcome.full}`);
  logger.info(`  partial (some fields null): ${outcome.partial}`);
  logger.info(`  unavailable (ESPN empty):   ${outcome.unavailable}`);
  process.exit(0);
}

main().catch(err => {
  logger.error('[backfillTeamStats] Fatal error:', err);
  process.exit(1);
});
