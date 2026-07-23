/**
 * The Season Archive — V7 Sprint 56 follow-up.
 *
 * Self-maintained historical standings/leaders lookback, backed by
 * GoalBet's own writes going forward — deliberately NOT a retroactive
 * backfill from ESPN's own historical depth (unverifiable from this
 * sandbox, see migration 070's header comment for the full reasoning).
 *
 * `archiveCompletedSeasons()` snapshots, for every ESPN-covered league, the
 * season that just completed — `currentSeason() - 1`, the EXACT value
 * stats.ts's own getLeagueStats() fallback path already treats as "the
 * most recent table ESPN has fully populated." Reusing that one function
 * (never a second, independently-computed season number) is what
 * guarantees the archive and the live fallback never disagree about which
 * season just ended.
 *
 * Idempotent by construction: checks for an existing archive row BEFORE
 * making any ESPN call (never wastes a fetch on an already-archived
 * season), and the migration's own UNIQUE(league_id, season) constraint is
 * the final backstop against a duplicate insert from an overlapping run.
 * Once written, a season's archive row is NEVER updated — a completed
 * season's final table is frozen, final, by definition.
 */

import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';
import { LEAGUE_ESPN_MAP } from './espn';
import { fetchStandings, fetchLeaders, currentSeason } from './stats';

let archiveRunning = false;

export async function archiveCompletedSeasons(): Promise<void> {
  if (archiveRunning) return; // guard against overlapping runs, same pattern as leagueRegistry.ts
  archiveRunning = true;
  try {
    const completedSeason = currentSeason() - 1;
    const leagueIds = Object.keys(LEAGUE_ESPN_MAP).map(Number);

    for (const leagueId of leagueIds) {
      try {
        // Check-before-fetch: never spend an ESPN call on a season this
        // league already has archived.
        const { data: existing, error: checkErr } = await supabaseAdmin
          .from('league_season_archive')
          .select('id')
          .eq('league_id', leagueId)
          .eq('season', completedSeason)
          .maybeSingle();

        if (checkErr) {
          logger.warn(`[seasonArchive] existence check failed for league=${leagueId} season=${completedSeason}: ${checkErr.message}`);
          continue;
        }
        if (existing) continue; // already archived — nothing to do

        const slug = LEAGUE_ESPN_MAP[leagueId];
        const [standingsResult, leaders] = await Promise.all([
          fetchStandings(slug, completedSeason),
          fetchLeaders(slug, completedSeason),
        ]);

        // A season with zero standings rows isn't genuinely "completed" for
        // this league (e.g. a competition GoalBet only started tracking
        // partway through, or one ESPN simply never populated) — never
        // archive an empty table as if it were a real historical record.
        if (standingsResult.rows.length === 0) continue;

        const { error: insertErr } = await supabaseAdmin
          .from('league_season_archive')
          .insert({
            league_id: leagueId,
            season: completedSeason,
            standings: standingsResult.rows,
            leaders,
          });

        if (insertErr) {
          // A unique-violation here means a concurrent run (or the next
          // scheduled tick) already won — not a real failure. Same
          // message-regex check aiProvocateur.ts already uses for its own
          // "swallow the duplicate, the constraint is the source of truth"
          // AI_BANTER insert race.
          if (!/duplicate|unique/i.test(insertErr.message)) {
            logger.warn(`[seasonArchive] insert failed for league=${leagueId} season=${completedSeason}: ${insertErr.message}`);
          }
          continue;
        }

        logger.info(`[seasonArchive] archived league=${leagueId} season=${completedSeason} (${standingsResult.rows.length} teams)`);
      } catch (err) {
        // Per-league isolation — one league's failure never blocks the rest,
        // matching syncAllActiveLeagues()'s own per-league try/catch shape.
        logger.warn(`[seasonArchive] league=${leagueId} failed: ${err}`);
      }
    }
  } finally {
    archiveRunning = false;
  }
}

export interface ArchivedSeasonSummary {
  season: number;
  archivedAt: string;
}

export async function listArchivedSeasons(leagueId: number): Promise<ArchivedSeasonSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('league_season_archive')
    .select('season, archived_at')
    .eq('league_id', leagueId)
    .order('season', { ascending: false });

  if (error) {
    logger.warn(`[seasonArchive] listArchivedSeasons failed for league=${leagueId}: ${error.message}`);
    return [];
  }
  return (data ?? []).map(row => ({ season: row.season as number, archivedAt: row.archived_at as string }));
}

export interface ArchivedSeasonData {
  leagueId: number;
  season: number;
  archivedAt: string;
  // Same shapes as stats.ts's StandingsRow[]/LeagueLeaders — not re-typed
  // here to avoid a second, drifting copy of those interfaces; consumers
  // (the route handler) already know the real shape from stats.ts.
  standings: unknown;
  leaders: unknown;
}

export async function getArchivedSeason(leagueId: number, season: number): Promise<ArchivedSeasonData | null> {
  const { data, error } = await supabaseAdmin
    .from('league_season_archive')
    .select('league_id, season, standings, leaders, archived_at')
    .eq('league_id', leagueId)
    .eq('season', season)
    .maybeSingle();

  if (error) {
    logger.warn(`[seasonArchive] getArchivedSeason failed for league=${leagueId} season=${season}: ${error.message}`);
    return null;
  }
  if (!data) return null;

  return {
    leagueId: data.league_id as number,
    season: data.season as number,
    archivedAt: data.archived_at as string,
    standings: data.standings,
    leaders: data.leaders,
  };
}
