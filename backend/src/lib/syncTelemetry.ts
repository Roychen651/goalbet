/**
 * Sync telemetry wrapper — V4 Sprint 31 Commit 2.
 *
 * Wraps an entire sync/score-check invocation and writes exactly one summary
 * row to sync_run_log, regardless of how the wrapped call actually exits.
 *
 * Deliberately lives at the CALL SITE (scheduler.ts), not inside
 * checkAndUpdateScores()/syncAllActiveLeagues() themselves. Two reasons:
 *
 * 1. checkAndUpdateScores() has a real exit path beyond its two `return`
 *    statements — flushRankDropNotifications() runs at the very end with no
 *    surrounding try/catch, so a genuine exception there propagates as an
 *    uncaught throw. Internal instrumentation would need to restructure that
 *    function's control flow to catch it — real surgery on a function this
 *    codebase already treats as delicate (rule 4.14, coin-resolution
 *    correctness). A wrapper here catches it for free, from the outside, by
 *    simply wrapping the whole call in try/catch.
 * 2. Both functions are also called from non-scheduler call sites (the
 *    public/internal HTTP sync routes, manualSync/forceSync scripts) that
 *    have no slot in sync_run_log.run_type's 3-value CHECK constraint.
 *    Scoping instrumentation to scheduler.ts's own call sites means those
 *    other callers are simply unaffected — not silently miscategorized.
 *
 * The insert itself is deliberately NON-THROWING — a telemetry write failure
 * must never be able to break the sync it's instrumenting. Same "the primary
 * operation succeeds even if secondary enrichment fails" discipline already
 * governing upsertTeamStats()/ensurePostMatchSummary() elsewhere.
 */

import { supabaseAdmin } from './supabaseAdmin';
import { logger } from './logger';

export type SyncRunType = 'live_poll' | 'daily_sync' | 'startup_catchup';
export type SyncTier = 'tier1' | 'tier2';

interface TelemetryCounts {
  leaguesChecked?: number;
  matchesChecked?: number;
  matchesResolved?: number;
  errors?: { scope: string; message: string }[];
}

export async function withSyncTelemetry<T>(
  runType: SyncRunType,
  tier: SyncTier | null,
  fn: () => Promise<T>,
  extractCounts: (result: T) => TelemetryCounts,
): Promise<T> {
  const startedAt = new Date();
  let result: T;
  let errors: { scope: string; message: string }[] = [];
  let counts: TelemetryCounts = {};

  try {
    result = await fn();
    counts = extractCounts(result);
    errors = counts.errors ?? [];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors = [{ scope: 'fatal', message }];
    await writeRow(runType, tier, startedAt, {}, errors);
    throw err; // the wrapper observes, it never swallows — the caller (scheduler.ts's own guarded()) still handles this exactly as it does today
  }

  await writeRow(runType, tier, startedAt, counts, errors);
  return result;
}

async function writeRow(
  runType: SyncRunType,
  tier: SyncTier | null,
  startedAt: Date,
  counts: TelemetryCounts,
  errors: { scope: string; message: string }[],
): Promise<void> {
  const completedAt = new Date();
  try {
    const { error } = await supabaseAdmin.from('sync_run_log').insert({
      run_type: runType,
      tier,
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      leagues_checked: counts.leaguesChecked ?? null,
      matches_checked: counts.matchesChecked ?? null,
      matches_resolved: counts.matchesResolved ?? null,
      errors,
      duration_ms: completedAt.getTime() - startedAt.getTime(),
    });
    if (error) {
      logger.warn(`[syncTelemetry] Failed to write sync_run_log row (${runType}/${tier ?? '-'}): ${error.message}`);
    }
  } catch (err) {
    // Table may not exist yet if migration 052 hasn't been applied — degrade
    // silently, never block the sync this is instrumenting.
    logger.warn(`[syncTelemetry] sync_run_log insert threw (${runType}/${tier ?? '-'}):`, err);
  }
}
