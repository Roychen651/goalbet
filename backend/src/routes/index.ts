import { Router } from 'express';
import healthRouter from './health';
import syncRouter from './sync';
import matchesRouter from './matches';

const router = Router();

router.use('/health', healthRouter);
router.use('/sync', syncRouter);
router.use('/matches', matchesRouter);

export default router;
