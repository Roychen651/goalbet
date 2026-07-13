import { Router, Request, Response } from 'express';
import { syncAllActiveLeagues, syncLeague } from '../services/matchSync';
import { checkAndUpdateScores } from '../services/scoreUpdater';
import { logger } from '../lib/logger';
import { matchesSyncLimiter, scoresSyncLimiter } from '../middleware/rateLimiter';
import { syncAuth } from '../middleware/syncAuth';

const router = Router();

// ── Handlers (shared by the public browser routes and the internal cron routes) ──

async function syncMatchesHandler(req: Request, res: Response): Promise<void> {
  const { leagueIds } = req.body as { leagueIds?: number[] };

  try {
    let results;
    if (leagueIds && leagueIds.length > 0) {
      logger.info(`[sync] Manual sync triggered for leagues: ${leagueIds.join(', ')}`);
      results = await Promise.all(leagueIds.map(id => syncLeague(id)));
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
