import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { getRemainingCallsToday } from '../services/sportsdb';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  let dbConnected = false;

  try {
    const { error } = await supabaseAdmin.from('matches').select('count').limit(1);
    dbConnected = !error;
  } catch {
    dbConnected = false;
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dbConnected,
    sportsDbCallsRemaining: getRemainingCallsToday(),
  });
});

export default router;
