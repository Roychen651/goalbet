import { Router, Request, Response } from 'express';
import { syncAllActiveLeagues, syncLeague, SyncResult } from '../services/matchSync';
import { LEAGUE_ESPN_MAP } from '../services/espn';
import { checkAndUpdateScores } from '../services/scoreUpdater';
import { logger } from '../lib/logger';
import { matchesSyncLimiter, scoresSyncLimiter } from '../middleware/rateLimiter';
import { syncAuth } from '../middleware/syncAuth';
import { processBatched } from '../lib/batch';

const router = Router();

// Full-app audit, Nov 2026 — a module-level re-entrancy guard for the
// `all:true` path specifically. This route is PUBLIC and only bounded by
// matchesSyncLimiter's 10-req/min-per-IP budget — nothing previously
// stopped a second `{all:true}` call from starting a SECOND full fan-out
// across every mapped league while the first was still running. Both
// calls' individual ESPN requests already serialize safely through the
// single process-wide espnLimiter (concurrencyLimiter.ts), so this was
// never a true concurrency-burst risk — but it WAS a real elevated total
// request-volume risk: two overlapping ~270s runs mean roughly 2x the
// total ESPN calls in the same calendar window, which is exactly the kind
// of pattern that already got this exact endpoint IP-blocked once before
// (independently confirmed, Oct 2026). A second call while one is already
// in flight is now a cheap, immediate no-op instead of a second expensive
// operation — this never affects a legitimate single admin click, which
// is this route's only real documented use of `all:true` (§19).
let forceSyncAllInFlight = false;

// ── Handlers (shared by the public browser routes and the internal cron routes) ──
//   body: { leagueIds?: number[] }  → sync only those leagues
//   body: { all: true }             → force-sync EVERY ESPN-mapped league,
//                                      ignoring group config (seeds WC etc.)
//   body: {}                        → sync all leagues active in some group
async function syncMatchesHandler(req: Request, res: Response): Promise<void> {
  const { leagueIds, all } = req.body as { leagueIds?: number[]; all?: boolean };

  try {
    let results;
    if (all) {
      if (forceSyncAllInFlight) {
        logger.warn('[sync] FORCE sync already in progress — rejecting overlapping request');
        res.status(409).json({ success: false, error: 'A full force-sync is already running' });
        return;
      }
      forceSyncAllInFlight = true;
      try {
        const mapped = Object.keys(LEAGUE_ESPN_MAP).map(Number);
        logger.info(`[sync] FORCE sync triggered for ALL ${mapped.length} mapped leagues`);
        results = [];
        for (const id of mapped) {
          results.push(await syncLeague(id));
          await new Promise(r => setTimeout(r, 300));
        }
      } finally {
        forceSyncAllInFlight = false;
      }
    } else if (leagueIds && leagueIds.length > 0) {
      // Full-app audit, Nov 2026 — dedupe + cap. No legitimate caller
      // (AppShell, useMatchSync, admin force-sync) ever sends more than a
      // handful of real, unique league IDs; there are only ~15 mapped
      // leagues total. Without this, a body like
      // {"leagueIds":[4328,4328,...×500]} could fire hundreds of fully
      // parallel syncLeague() calls on this unauthenticated route — each
      // one now a ~17-25s ESPN day-loop post this session's own fix,
      // instead of the single cheap range call it used to be.
      const uniqueLeagueIds = [...new Set(leagueIds)].slice(0, 20);
      logger.info(`[sync] Manual sync triggered for leagues: ${uniqueLeagueIds.join(', ')}`);
      // Full-app audit, Nov 2026 — bounded via processBatched() (lib/batch.ts,
      // §43), the same primitive syncAllActiveLeagues()/backfillTeamStats.ts
      // already use, instead of a raw Promise.all that fanned out up to 20
      // fully-parallel syncLeague() calls at once on this unauthenticated
      // route. Keeps this route's aggregate ESPN load bounded consistently
      // with every other bulk-sync path in this codebase (batchSize=5,
      // gapMs=500 defaults — the process-wide espnLimiter still caps the
      // true in-flight ceiling regardless, but this keeps the burst shape
      // consistent too, not just safe).
      const leagueResults: SyncResult[] = [];
      await processBatched(uniqueLeagueIds, async (id) => {
        leagueResults.push(await syncLeague(id));
      });
      results = leagueResults;
    } else {
      logger.info('[sync] Manual sync triggered for all active leagues');
      results = await syncAllActiveLeagues();
    }

    const total = results.reduce((sum, r) => sum + r.inserted, 0);
    res.json({ success: true, results, total });
  } catch (err) {
    logger.error('[sync] Manual match sync failed:', err);
    res.status(500).json({ error: String(err) });
  }
}

async function syncScoresHandler(_req: Request, res: Response): Promise<void> {
  try {
    logger.info('[sync] Manual score update triggered');
    const result = await checkAndUpdateScores();
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[sync] Manual score update failed:', err);
    res.status(500).json({ error: String(err) });
  }
}

// ── Public routes — called from the browser (AppShell, useMatchSync, admin) ──
// No auth: a browser can't hold a real secret. Bounded by per-route rate limits.
router.post('/matches', matchesSyncLimiter, syncMatchesHandler);
router.post('/scores', scoresSyncLimiter, syncScoresHandler);

// ── Internal routes — called only by machine schedulers (GitHub Actions cron,
// Supabase pg_cron) with the X-Sync-Key header. The key is server-side only. ──
router.post('/internal/matches', syncAuth, syncMatchesHandler);
router.post('/internal/scores', syncAuth, syncScoresHandler);

export default router;
