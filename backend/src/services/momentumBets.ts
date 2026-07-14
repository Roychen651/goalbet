/**
 * Momentum Bets — in-play micro-prediction lifecycle (V4 Sprint 14).
 *
 * Separate from scoreUpdater.ts on purpose: locking and resolution are pure
 * DB-state sweeps (no ESPN calls), unlike the main score-resolution loop, and
 * they run on a much tighter cadence than that loop's 30s. Milestone
 * *generation* stays in scoreUpdater.ts because it needs the fresh ESPN read
 * already happening there; everything after generation lives here.
 */
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';

const OUTCOME_WINDOW_MS = 10 * 60 * 1000;

/**
 * Flips expired 'open' questions to 'locked', stamping locked_at and a score
 * baseline in the same update. This is the moment that makes the arbitrage
 * fix real: resolution later reads baseline_*_score captured HERE, at lock
 * time, not at question-open time — so the 10-minute outcome window always
 * starts strictly after betting has already closed, never overlapping it.
 *
 * Per-question atomic claim (.eq('status','open') on the UPDATE, checking the
 * returned row count) — same pattern as prediction resolution — so two
 * overlapping sweep ticks can't both "win" the same question.
 */
export async function lockExpiredMicroQuestions(): Promise<number> {
  const nowIso = new Date().toISOString();

  const { data: expired, error } = await supabaseAdmin
    .from('micro_prediction_questions')
    .select('id, match_id')
    .eq('status', 'open')
    .lte('expires_at', nowIso);

  if (error) {
    logger.warn(`[momentumBets] expired-question query failed: ${error.message}`);
    return 0;
  }
  if (!expired || expired.length === 0) return 0;

  let locked = 0;
  for (const q of expired) {
    try {
      const { data: m } = await supabaseAdmin
        .from('matches')
        .select('home_score, away_score')
        .eq('id', q.match_id)
        .single();

      const now = new Date();
      const { data: claimed, error: updateErr } = await supabaseAdmin
        .from('micro_prediction_questions')
        .update({
          status: 'locked',
          locked_at: now.toISOString(),
          resolves_at: new Date(now.getTime() + OUTCOME_WINDOW_MS).toISOString(),
          baseline_home_score: m?.home_score ?? null,
          baseline_away_score: m?.away_score ?? null,
        })
        .eq('id', q.id)
        .eq('status', 'open') // atomic claim — only the first sweep to reach this row wins
        .select('id');

      if (updateErr) {
        logger.warn(`[momentumBets] lock failed for question ${q.id}: ${updateErr.message}`);
        continue;
      }
      if (!claimed || claimed.length === 0) continue; // another tick already locked it

      locked++;
    } catch (err) {
      logger.warn(`[momentumBets] lock error for question ${q.id}: ${(err as Error).message}`);
    }
  }

  if (locked > 0) logger.info(`[momentumBets] Locked ${locked} micro-question(s)`);
  return locked;
}
