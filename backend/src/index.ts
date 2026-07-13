import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/index';
import { startScheduler } from './cron/scheduler';
import { logger } from './lib/logger';
import { globalLimiter } from './middleware/rateLimiter';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.FRONTEND_URL,
      'https://goalbet.vercel.app',
      'https://goalbet-io.vercel.app',
    ].filter(Boolean) as string[]
  : ['http://localhost:5173', 'http://localhost:3000'];

// Scoped to this project's actual Vercel preview URL shape — verified against
// real deployments, e.g. https://goalbet-pcjmhlfsu-roychen651s-projects.vercel.app
// (the dashboard project name "goalbet-io" is NOT the URL slug — it's "goalbet").
const VERCEL_PREVIEW_ORIGIN = /^https:\/\/goalbet-[a-z0-9]+-roychen651s-projects\.vercel\.app$/;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (GitHub Actions, pg_net, curl, server-to-server —
    // CORS is a browser-only mechanism and is structurally irrelevant to these)
    if (!origin) return callback(null, true);
    if (VERCEL_PREVIEW_ORIGIN.test(origin)) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(globalLimiter);

// Routes
app.use('/api', apiRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`GoalBet backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Start cron scheduler (skip in test mode)
if (process.env.NODE_ENV !== 'test') {
  startScheduler();
}

export default app;
