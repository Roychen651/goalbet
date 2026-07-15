import { Router, Request, Response } from 'express';
import { getLeagueStats, getTeamForm } from '../services/stats';
import { getLeagueNews } from '../services/leagueNews';

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

// V4 Sprint 27 — Interactive Team Sheets. Lazy: only ever called when a
// standings row is actually expanded on the frontend, never prefetched/batched.
router.get('/:leagueId/team/:teamId/form', async (req: Request, res: Response) => {
  const leagueId = parseInt(req.params.leagueId, 10);
  const teamId = req.params.teamId;
  if (!Number.isFinite(leagueId) || !teamId) {
    return res.status(400).json({ error: 'Invalid leagueId or teamId' });
  }
  try {
    const data = await getTeamForm(leagueId, teamId);
    if (!data) return res.status(404).json({ error: 'No form data for this team' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// V4 Sprint 27 — The Pulse Feed. Lazy: only called when the news card list is
// actually mounted/scrolled into view on the frontend.
router.get('/:leagueId/news', async (req: Request, res: Response) => {
  const leagueId = parseInt(req.params.leagueId, 10);
  if (!Number.isFinite(leagueId)) {
    return res.status(400).json({ error: 'Invalid leagueId' });
  }
  try {
    const data = await getLeagueNews(leagueId);
    if (!data) return res.status(404).json({ error: 'No news for this league' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
