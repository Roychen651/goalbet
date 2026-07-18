/**
 * Match Oracle — deterministic historical form stats. V5 Sprint 33.
 *
 * Thin wrapper around compute_match_oracle_stats() (migration 053) — the SQL
 * function does the actual aggregation, this file just calls it and persists
 * the result. Same "thin backend wrapper around a SQL function" shape as
 * leagueStatCapability.ts. Write path uses the exact same idempotency guard
 * as aiScout.ts's writeInsight() (.is(column, null)) so concurrent callers
 * (this batch + a future manual trigger) can never double-write.
 *
 * Deliberately separate from aiScout.ts: computing oracle_stats is pure SQL,
 * has nothing to do with Groq, and must work even when GROQ_API_KEY is unset
 * (unlike every other AI Scout feature, which is a no-op without a key). AI
 * narration (aiScout.ts's generateOracleNarration) only ever narrates numbers
 * this file already computed and persisted — it never computes them itself.
 */
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';

// Migration 059 — over25_pct/btts_pct are `null` (not `0`) at sample_size=0.
// A real 0% (checked N matches, none qualified) and "zero matches to check"
// are different facts; see the migration's own header comment.
export interface TeamForm {
  wins: number;
  draws: number;
  losses: number;
  over25_pct: number | null;
  btts_pct: number | null;
  sample_size: number;
}

export interface OracleStats {
  home: TeamForm;
  away: TeamForm;
}

/**
 * Computes (via the SQL function) and persists oracle_stats for a match.
 * Returns the computed stats on success — including when another writer won
 * the .is(column, null) race, since the caller (runOracleBatch) still needs
 * the numbers to narrate from, just didn't need to be the one to write them.
 * Returns null only on genuine computation/query failure. Never throws.
 */
export async function computeOracleStats(matchId: string): Promise<OracleStats | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('compute_match_oracle_stats', { p_match_id: matchId });

    if (error) {
      logger.warn(`[matchOracle] compute_match_oracle_stats failed for ${matchId}: ${error.message}`);
      return null;
    }
    if (!data) return null;

    const stats = data as OracleStats;

    const { error: writeError } = await supabaseAdmin
      .from('matches')
      .update({ oracle_stats: stats })
      .eq('id', matchId)
      .is('oracle_stats', null);

    if (writeError) {
      logger.warn(`[matchOracle] Failed to persist oracle_stats for ${matchId}: ${writeError.message}`);
    }

    return stats;
  } catch (err) {
    logger.warn(`[matchOracle] computeOracleStats crashed for ${matchId}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
