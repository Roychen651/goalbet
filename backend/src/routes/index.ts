import { Router } from 'express';
import healthRouter from './health';
import syncRouter from './sync';
import matchesRouter from './matches';
import adminRouter from './admin';

const router = Router();

router.use('/health', healthRouter);
router.use('/sync', syncRouter);
router.use('/matches', matchesRouter);
router.use('/admin', adminRouter);

export default router;
