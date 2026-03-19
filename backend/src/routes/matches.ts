import { Router, Request, Response } from 'express';
import { fetchMatchKeyEvents } from '../services/espn';

const router = Router();

/**
 * GET /api/matches/events?external_id=espn_12345&league_id=4328
 * Fetches key events (goals, cards, subs) from ESPN for a given match.
 * Public endpoint — no auth required.
 */
router.get('/events', async (req: Request, res: Response) => {
  const { external_id, league_id } = req.query;

  if (!external_id || !league_id) {
    res.status(400).json({ error: 'external_id and league_id are required' });
    return;
  }

  const leagueIdNum = parseInt(String(league_id), 10);
  if (isNaN(leagueIdNum)) {
    res.status(400).json({ error: 'league_id must be a number' });
    return;
  }

  const events = await fetchMatchKeyEvents(String(external_id), leagueIdNum);
  if (events === null) {
    // No events available (no ESPN coverage or no key events) — return empty array
    res.json({ events: [] });
    return;
  }

  res.json({ events });
});

export default router;
