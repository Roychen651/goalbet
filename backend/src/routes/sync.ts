import { Router, Request, Response } from 'express';
import { syncAllActiveLeagues, syncLeague } from '../services/matchSync';
import { LEAGUE_ESPN_MAP } from '../services/espn';
import { checkAndUpdateScores } from '../services/scoreUpdater';
import { logger } from '../lib/logger';

const router = Router();

// POST /api/sync/matches — manually trigger match sync
//   body: { leagueIds?: number[] }  → sync only those leagues
//   body: { all: true }             → force-sync EVERY ESPN-mapped league,
//                                      ignoring group config (seeds WC etc.)
//   body: {}                        → sync all leagues active in some group
router.post('/matches', async (req: Request, res: Response) => {
  const { leagueIds, all } = req.body as { leagueIds?: number[]; all?: boolean };

  try {
    let results;
    if (all) {
      const mapped = Object.keys(LEAGUE_ESPN_MAP).map(Number);
      logger.info(`[sync] FORCE sync triggered for ALL ${mapped.length} mapped leagues`);
      results = [];
      for (const id of mapped) {
        results.push(await syncLeague(id));
        await new Promise(r => setTimeout(r, 300));
      }
    } else if (leagueIds && leagueIds.length > 0) {
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
});

// POST /api/sync/scores — manually trigger score resolution
router.post('/scores', async (_req: Request, res: Response) => {
  try {
    logger.info('[sync] Manual score update triggered');
    const result = await checkAndUpdateScores();
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[sync] Manual score update failed:', err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
