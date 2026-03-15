import { Router } from 'express';
import healthRouter from './health';
import syncRouter from './sync';

const router = Router();

router.use('/health', healthRouter);
router.use('/sync', syncRouter);

export default router;
