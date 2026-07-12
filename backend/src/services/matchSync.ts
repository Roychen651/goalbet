import { supabaseAdmin } from '../lib/supabaseAdmin';
import { fetchLeagueMatches, LEAGUE_ESPN_MAP } from './espn';
import { DBMatch } from './sportsdb';
import { logger } from '../lib/logger';
import { runPreMatchBatch, runPostMatchBatch, runHTInsightBatch } from './aiScout';

export interface SyncResult {
  leagueId: number;
  inserted: number;
  updated: number;
  errors: number;
}

async function upsertMatches(matches: DBMatch[]): Promise<{ inserted: number; updated: number }> {
  if (matches.length === 0) return { inserted: 0, updated: 0 };

  // Don't send null for these fields on upsert — it would overwrite previously captured values.
  // Only include them when ESPN actually returned data.
  const rows = matches.map(m => {
    const row: Partial<DBMatch> & { external_id: string } = { ...m };
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
    .select('id');

  if (error) {
    // TEMP DEBUG: surface the exact PostgREST error (schema/constraint issues
    // were a suspected cause of "events fetched but nothing in the DB").
    logger.error(`[matchSync][debug] Upsert FAILED for ${rows.length} rows: ${error.message} | details=${error.details ?? '-'} | hint=${error.hint ?? '-'}`);
    throw error;
  }

  // TEMP DEBUG: rows sent vs rows the DB acknowledged.
  logger.info(`[matchSync][debug] upsert ok: sent=${rows.length} acknowledged=${data?.length ?? 0}`);
  return { inserted: data?.length ?? 0, updated: 0 };
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

  const results: SyncResult[] = [];
  for (const leagueId of leagueIds) {
    const result = await syncLeague(leagueId);
    results.push(result);
    // Small delay between API calls to be polite
    await new Promise(resolve => setTimeout(resolve, 500));
  }

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
