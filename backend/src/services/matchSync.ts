import { supabaseAdmin } from '../lib/supabaseAdmin';
import { fetchLeagueMatches, LEAGUE_ESPN_MAP } from './espn';
import { DBMatch } from './sportsdb';
import { logger } from '../lib/logger';

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
    // went_to_penalties is always included (false = not a PK final, true = was a PK final)
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
    logger.error('[matchSync] Upsert error:', error);
    throw error;
  }

  return { inserted: data?.length ?? 0, updated: 0 };
}

export async function syncLeague(leagueId: number): Promise<SyncResult> {
  logger.info(`[matchSync] Syncing league ${leagueId}`);
  let inserted = 0;
  let errors = 0;

  try {
    const matches = await fetchLeagueMatches(leagueId, 7, 42);

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

  return results;
}
