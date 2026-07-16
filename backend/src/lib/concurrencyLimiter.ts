/**
 * Process-wide concurrency limiter — V4 Sprint 30 Commit 1.
 *
 * Sprint 28's processBatched() (batch.ts) already bounds concurrency, but
 * only WITHIN one call — batchSize items fire simultaneously, then the next
 * batch. That bound doesn't compose across separate call sites: the Tier-1
 * live poller (30s), Tier-2 poller (90s), the daily/noon full sync, the
 * registry refresh, and the retroactive backfill script each call
 * processBatched() independently. On a busy Saturday, several of these can
 * genuinely overlap within the same few seconds, and each one's "5 at a
 * time" stacks on top of the others' — nothing today caps the AGGREGATE
 * number of simultaneous ESPN requests this whole process can generate.
 *
 * ConcurrencyLimiter is a single, module-level, process-wide gate underneath
 * all of them, applied at the actual HTTP call site (espnHttp.ts's
 * espnGet()) rather than at any one scheduling layer. A caller that finds
 * the limit already reached queues (FIFO) instead of firing immediately;
 * queued callers are released one at a time as active work completes.
 *
 * Single-process-safe by construction — this backend runs as one Node
 * process (Render free tier), so a plain in-memory counter is correct and
 * sufficient. No Redis or external coordination needed (V4 Sprint 30
 * Mandate 4).
 */

export class ConcurrencyLimiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

// One process-wide instance, shared by every ESPN call site via
// espnHttp.ts's espnGet(). Configurable without a code change so the
// ceiling can be tuned in production (e.g. after observing real 429s)
// without a redeploy just to change a constant.
export const espnLimiter = new ConcurrencyLimiter(
  Number(process.env.ESPN_MAX_CONCURRENT_REQUESTS) || 5
);
