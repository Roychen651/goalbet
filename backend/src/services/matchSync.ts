import { supabaseAdmin } from '../lib/supabaseAdmin';
import { fetchLeagueMatches, LEAGUE_ESPN_MAP, DBMatchWithClock } from './espn';
import { DBMatch } from './sportsdb';
import { logger } from '../lib/logger';
import { processBatched } from '../lib/batch';
import { runPreMatchBatch, runPostMatchBatch, runHTInsightBatch } from './aiScout';

export interface SyncResult {
  leagueId: number;
  inserted: number;
  updated: number;
  errors: number;
}

async function upsertMatches(matches: DBMatchWithClock[]): Promise<{ inserted: number; updated: number; idsByExternalId: Map<string, string> }> {
  if (matches.length === 0) return { inserted: 0, updated: 0, idsByExternalId: new Map() };

  // Don't send null for these fields on upsert — it would overwrite previously captured values.
  // Only include them when ESPN actually returned data.
  const rows = matches.map(m => {
    // V4 Sprint 29 — the 6 match_team_stats-only fields are explicitly
    // destructured OUT here, never spread into the `matches` upsert payload.
    // `matches` has no columns for these; object spread copies every
    // enumerable runtime property regardless of the TS type annotation
    // below, so leaving them in `m` would have sent an unknown-column
    // upsert that PostgREST rejects outright. upsertTeamStats() (below)
    // is what actually persists them, into match_team_stats.
    const { home_stats_raw: _hsr, away_stats_raw: _asr, home_corners: _hc, away_corners: _ac, home_yellow_cards: _hyc, away_yellow_cards: _ayc, ...matchFields } = m;
    const row: Partial<DBMatch> & { external_id: string } = { ...matchFields };
    if (row.corners_total === null) delete row.corners_total;
    if (row.regulation_home === null) delete row.regulation_home;
    if (row.regulation_away === null) delete row.regulation_away;
    if (row.penalty_home === null) delete row.penalty_home;
    if (row.penalty_away === null) delete row.penalty_away;
    if (row.red_cards_home === null) delete row.red_cards_home;
    if (row.red_cards_away === null) delete row.red_cards_away;
    // went_to_penalties is NOT NULL. It MUST always be sent as an explicit boolean:
    // in a bulk upsert PostgREST builds one INSERT from the union of all row keys,
    // so if ANY row in the batch keeps this key (a real PEN match) the false rows
    // that omitted it get sent as NULL → NOT-NULL violation → the whole batch dies.
    // Detection is now shootoutScore-based (stable for finished matches), so a
    // transient re-sync flip is effectively impossible and self-heals next cycle.
    (row as Record<string, unknown>).went_to_penalties = row.went_to_penalties === true;
    return row;
  });

  const { data, error } = await supabaseAdmin
    .from('matches')
    .upsert(rows, {
      onConflict: 'external_id',
      ignoreDuplicates: false,
    })
    .select('id, external_id');

  if (error) {
    // TEMP DEBUG: surface the exact PostgREST error (schema/constraint issues
    // were a suspected cause of "events fetched but nothing in the DB").
    logger.error(`[matchSync][debug] Upsert FAILED for ${rows.length} rows: ${error.message} | details=${error.details ?? '-'} | hint=${error.hint ?? '-'}`);
    throw error;
  }

  // TEMP DEBUG: rows sent vs rows the DB acknowledged.
  logger.info(`[matchSync][debug] upsert ok: sent=${rows.length} acknowledged=${data?.length ?? 0}`);
  const idsByExternalId = new Map((data ?? []).map(r => [r.external_id as string, r.id as string]));
  return { inserted: data?.length ?? 0, updated: 0, idsByExternalId };
}

// V4 Sprint 29 — writes the per-team stats split (raw_stats archive +
// promoted corners/red_cards/yellow_cards) into match_team_stats, 2 rows
// per match (home + away). Deliberately non-throwing: a team_stats write
// failure must never block or roll back the matches upsert it depends on —
// same "the primary record succeeds even if secondary enrichment fails"
// discipline already applied to ensurePostMatchSummary/ensureChronicle
// being fire-and-forget elsewhere in this codebase.
async function upsertTeamStats(matches: DBMatchWithClock[], idsByExternalId: Map<string, string>): Promise<void> {
  const rows = matches.flatMap(m => {
    const matchId = idsByExternalId.get(m.external_id);
    if (!matchId) return [];
    return [
      { match_id: matchId, team_side: 'home', raw_stats: m.home_stats_raw ?? [], corners: m.home_corners, red_cards: m.red_cards_home, yellow_cards: m.home_yellow_cards },
      { match_id: matchId, team_side: 'away', raw_stats: m.away_stats_raw ?? [], corners: m.away_corners, red_cards: m.red_cards_away, yellow_cards: m.away_yellow_cards },
    ];
  });
  if (rows.length === 0) return;

  const { error } = await supabaseAdmin
    .from('match_team_stats')
    .upsert(rows, { onConflict: 'match_id,team_side' });

  if (error) {
    logger.error(`[matchSync] team_stats upsert failed for ${rows.length} rows: ${error.message}`);
  }
}

export async function syncLeague(leagueId: number): Promise<SyncResult> {
  logger.info(`[matchSync] Syncing league ${leagueId}`);
  let inserted = 0;
  let errors = 0;

  try {
    // World Cup 4480: use a wide back-window so the whole tournament (group stage
    // from mid-June through the final) is captured, not just the last week. Other
    // leagues keep the tight 7-day back-window (results older than that already
    // resolved). 90 days forward is the ceiling for all leagues.
    const daysBack = leagueId === 4480 ? 45 : 7;
    const matches = await fetchLeagueMatches(leagueId, daysBack, 90);

    if (matches.length > 0) {
      const result = await upsertMatches(matches);
      inserted = result.inserted;
      logger.info(`[matchSync] League ${leagueId}: upserted ${matches.length} matches`);

      // V4 Sprint 29 — best-effort, never throws. A team_stats write
      // failure must never fail syncLeague() or roll back the matches
      // upsert above, which already succeeded.
      try {
        await upsertTeamStats(matches, result.idsByExternalId);
      } catch (err) {
        logger.error(`[matchSync] team_stats upsert threw for league ${leagueId}:`, err);
      }
    } else {
      logger.info(`[matchSync] League ${leagueId}: no matches from ESPN (league may not be covered)`);
    }
  } catch (error) {
    logger.error(`[matchSync] Failed to sync league ${leagueId}:`, error);
    errors++;
  }

  return { leagueId, inserted, updated: 0, errors };
}

// Get all distinct league IDs that are active in any group
async function getActiveLeagueIds(): Promise<number[]> {
  const { data, error } = await supabaseAdmin
    .from('groups')
    .select('active_leagues');

  if (error) {
    logger.error('[matchSync] Failed to fetch active leagues:', error);
    return [];
  }

  const leagueSet = new Set<number>();
  for (const row of data || []) {
    for (const id of row.active_leagues || []) {
      leagueSet.add(id);
    }
  }

  return Array.from(leagueSet);
}

export async function syncAllActiveLeagues(): Promise<SyncResult[]> {
  let leagueIds = await getActiveLeagueIds();

  if (leagueIds.length === 0) {
    const defaults = [4328, 4335, 4331, 4332, 4334, 4346, 4399, 4877];
    logger.info('[matchSync] No active groups found, syncing default leagues:', defaults);
    leagueIds = defaults;
  }

  // Only sync leagues ESPN actually covers
  leagueIds = leagueIds.filter(id => id in LEAGUE_ESPN_MAP);

  logger.info(`[matchSync] Syncing ${leagueIds.length} leagues: ${leagueIds.join(', ')}`);

  // V4 Sprint 28 Commit 4 — bounded batching replaces the old unbounded
  // sequential loop (which, at 40+ leagues, risked a single sync cycle
  // taking longer than the interval that triggers the next one). syncLeague
  // never throws (its own try/catch already turns a failure into an
  // `errors: 1` result), so Promise.allSettled's rejection path is a pure
  // backstop here — every real failure still shows up in `results` exactly
  // as before. Batches of 5, sequential, with the same 500ms polite gap this
  // loop already used — just applied between batches instead of every
  // single league.
  const results: SyncResult[] = [];
  await processBatched(leagueIds, async (leagueId) => {
    const result = await syncLeague(leagueId);
    results.push(result);
  });

  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
  logger.info(`[matchSync] Complete. Inserted/updated: ${totalInserted}, errors: ${totalErrors}`);

  // AI Scout — small batches each cycle so we never spam Groq.
  // Silent no-op if GROQ_API_KEY isn't set. Fully try/catch'd internally.
  await runPreMatchBatch(2);
  await runHTInsightBatch(2);
  await runPostMatchBatch(3);

  return results;
}
