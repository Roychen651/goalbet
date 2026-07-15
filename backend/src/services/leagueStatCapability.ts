/**
 * League Stat-Capability (V4 Sprint 26) — refreshes matches.corners_supported.
 *
 * The actual computation lives in Postgres (compute_corners_support(),
 * migration 048) as one set-based aggregation + upsert — this file is just
 * the scheduler-facing wrapper, the same shape as every other cron-invoked
 * service in this codebase (streakGuardian.ts, momentumBets.ts).
 *
 * Deliberately not run on the tight 30s live-poll cadence — this signal only
 * moves as fast as leagues accumulate newly-resolved (FT) matches, which is
 * a matter of days, not seconds. Daily is more than enough precision.
 */
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';

export async function refreshCornersSupportFlags(): Promise<void> {
  const { error } = await supabaseAdmin.rpc('compute_corners_support');
  if (error) {
    logger.warn(`[leagueStatCapability] compute_corners_support failed: ${error.message}`);
    return;
  }
  logger.info('[leagueStatCapability] corners_supported flags refreshed');
}
