import { Router, Request, Response } from 'express';
import { getLeagueStats } from '../services/stats';

const router = Router();

router.get('/:leagueId', async (req: Request, res: Response) => {
  const leagueId = parseInt(req.params.leagueId, 10);
  if (!Number.isFinite(leagueId)) {
    return res.status(400).json({ error: 'Invalid leagueId' });
  }
  try {
    const data = await getLeagueStats(leagueId);
    if (!data) return res.status(404).json({ error: 'No stats for this league' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
