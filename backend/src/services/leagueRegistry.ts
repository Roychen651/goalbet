/**
 * League Registry — V4 Sprint 28 "Dynamic Orchestration & Tiered Polling".
 *
 * Backs `LEAGUE_ESPN_MAP` (espn.ts) with a DB-driven, admin-editable table
 * instead of a hand-maintained TS literal, while keeping that export's exact
 * shape/type so every existing importer needs zero changes.
 *
 * Two things make that safe:
 *
 * 1. `LEAGUE_ESPN_MAP` stays a real, mutable object exported from espn.ts.
 *    This module never reassigns that binding — it mutates the object's keys
 *    in place (delete stale, assign fresh). Under this backend's CommonJS
 *    module system (tsconfig.json: "module": "commonjs"), every importer
 *    (`import { LEAGUE_ESPN_MAP } from './espn'`) holds a reference to the
 *    SAME object instance. Reassigning the binding would only be visible
 *    inside espn.ts itself — every other file's reference would silently
 *    keep pointing at the stale object forever. Mutation-in-place is the
 *    only correct mechanism here.
 *
 * 2. A failed or empty registry read NEVER clears the map. It leaves
 *    whatever's already cached untouched — which on first boot is the
 *    FALLBACK_LEAGUE_MAP below, and after that is the last good read. This
 *    codebase's standing rule: never fail toward zero leagues.
 */

import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';

export type PriorityTier = 'live_tier1' | 'standard' | 'low_frequency';

// The exact 15-entry LEAGUE_ESPN_MAP literal this replaces, kept verbatim as
// a last-resort default baked into the deployed code — never read from
// anywhere, just always available. This is what espn.ts's LEAGUE_ESPN_MAP is
// initialized from at module load, before the first DB read ever resolves.
export const FALLBACK_LEAGUE_MAP: Record<number, string> = {
  4328: 'eng.1',
  4335: 'esp.1',
  4331: 'ger.1',
  4332: 'ita.1',
  4334: 'fra.1',
  4346: 'uefa.champions',
  4399: 'uefa.europa',
  4877: 'uefa.europa.conf',
  9001: 'eng.fa',
  9002: 'eng.league_cup',
  9003: 'esp.copa_del_rey',
  4396: 'fifa.friendly',
  4635: 'uefa.nations',
  5000: 'uefa.worldq',
  4480: 'fifa.world',
};

// Tier cache — populated by the same refresh call that updates
// LEAGUE_ESPN_MAP, read synchronously by Sprint 28 Commit 3's tier-promotion
// logic. Defaults every league to 'standard' if the registry hasn't loaded
// yet (or a league is genuinely missing a tier row) — never 'live_tier1' by
// default, since over-polling an unknown league is a smaller risk than
// under-polling a real marquee one, but 'standard' (not 'low_frequency')
// keeps it eligible for the Tier-2 poller rather than silently dropped.
const tierCache = new Map<number, PriorityTier>();

export function getLeagueTier(leagueId: number): PriorityTier {
  return tierCache.get(leagueId) ?? 'standard';
}

let refreshRunning = false;

export async function refreshLeagueRegistry(targetMap: Record<number, string>): Promise<void> {
  if (refreshRunning) return; // guard against overlapping refreshes, same pattern as scheduler.ts's sweeps
  refreshRunning = true;
  try {
    const { data, error } = await supabaseAdmin
      .from('league_registry')
      .select('id, espn_slug, priority_tier')
      .eq('enabled', true);

    if (error) {
      logger.warn(`[leagueRegistry] refresh failed, keeping cached map: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      logger.warn('[leagueRegistry] refresh returned zero rows, keeping cached map');
      return;
    }

    // Mutate targetMap's keys in place — see the module doc comment for why
    // this must never be a reassignment.
    for (const key of Object.keys(targetMap)) {
      delete targetMap[Number(key)];
    }
    for (const row of data as { id: number; espn_slug: string; priority_tier: PriorityTier }[]) {
      targetMap[row.id] = row.espn_slug;
      tierCache.set(row.id, row.priority_tier);
    }

    logger.info(`[leagueRegistry] refreshed: ${data.length} leagues loaded`);
  } catch (err) {
    logger.warn(`[leagueRegistry] refresh threw, keeping cached map: ${err}`);
  } finally {
    refreshRunning = false;
  }
}
