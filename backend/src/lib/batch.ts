/**
 * Bounded batch execution — V4 Sprint 28 Commit 4.
 *
 * Replaces an unbounded sequential loop over N items (leagues, in this
 * codebase's case) with fixed-size concurrent batches. Batches themselves
 * run strictly sequentially — never two batches in flight at once — so the
 * real concurrency ceiling at any instant is exactly `batchSize`, not N.
 *
 * `Promise.allSettled` (not `Promise.all`) is the load-bearing choice: one
 * item's failure never rejects the whole batch or blocks the others in it —
 * each settles independently. Every caller in this codebase already wraps
 * its own per-item logic in try/catch (syncLeague, the per-league score
 * loop), so in practice `fn` rarely rejects at all — this is a defensive
 * backstop, not the primary error-handling path.
 */

import { logger } from './logger';

const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_GAP_MS = 500;

export async function processBatched<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  options?: { batchSize?: number; gapMs?: number }
): Promise<void> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const gapMs = options?.gapMs ?? DEFAULT_GAP_MS;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(fn));
    results.forEach((r) => {
      if (r.status === 'rejected') {
        logger.error(`[batch] item failed: ${r.reason}`);
      }
    });
    // Polite gap BETWEEN batches only, never within one — matches the
    // existing 500ms delay matchSync.ts already used between sequential
    // per-league fetches, just applied at the batch boundary instead of
    // after every single item.
    if (i + batchSize < items.length && gapMs > 0) {
      await new Promise(resolve => setTimeout(resolve, gapMs));
    }
  }
}
