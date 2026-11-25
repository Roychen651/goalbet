import { Router } from 'express';
import healthRouter from './health';
import syncRouter from './sync';
import matchesRouter from './matches';
import adminRouter from './admin';
import statsRouter from './stats';
import authRouter from './auth';

const router = Router();

router.use('/health', healthRouter);
router.use('/sync', syncRouter);
router.use('/matches', matchesRouter);
router.use('/admin', adminRouter);
router.use('/stats', statsRouter);
router.use('/auth', authRouter);

export default router;
