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
import { triggerMicroBanter } from './microBanter';

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

      // Fire-and-forget, same pattern as ensureChronicle — bets on this
      // question are already finalized (submit_micro_prediction rejects any
      // attempt once status is no longer 'open'), so the roast can safely
      // read them right now. Never blocks the lock sweep on a Groq call.
      void triggerMicroBanter(q.id);

      locked++;
    } catch (err) {
      logger.warn(`[momentumBets] lock error for question ${q.id}: ${(err as Error).message}`);
    }
  }

  if (locked > 0) logger.info(`[momentumBets] Locked ${locked} micro-question(s)`);
  return locked;
}

/**
 * Resolves locked questions whose outcome window has elapsed. 'goal_next_10'
 * resolves via a plain score-delta comparison against the baseline captured
 * at lock time — no timestamped-event parsing needed, sidestepping the exact
 * ESPN data gap this question type was scoped to avoid depending on.
 *
 * If the match's data is unavailable or the sync itself appears to have
 * failed (PST/CANC, missing scores), the question is canceled and every bet
 * on it is refunded rather than left resolved on guessed data or stuck
 * unresolved forever.
 */
export async function resolveLockedMicroQuestions(): Promise<{ resolved: number; canceled: number }> {
  const nowIso = new Date().toISOString();

  const { data: due, error } = await supabaseAdmin
    .from('micro_prediction_questions')
    .select('id, match_id, baseline_home_score, baseline_away_score')
    .eq('status', 'locked')
    .lte('resolves_at', nowIso);

  if (error) {
    logger.warn(`[momentumBets] due-question query failed: ${error.message}`);
    return { resolved: 0, canceled: 0 };
  }

  let resolvedCount = 0;
  let canceledCount = 0;

  for (const q of due ?? []) {
    try {
      const { data: m } = await supabaseAdmin
        .from('matches')
        .select('home_score, away_score, status')
        .eq('id', q.match_id)
        .single();

      const dataUnavailable =
        !m || m.home_score === null || m.away_score === null ||
        m.status === 'PST' || m.status === 'CANC' ||
        q.baseline_home_score === null || q.baseline_away_score === null;

      if (dataUnavailable) {
        await supabaseAdmin
          .from('micro_prediction_questions')
          .update({ status: 'canceled' })
          .eq('id', q.id)
          .eq('status', 'locked');
        await settleBets(q.id, null);
        canceledCount++;
        continue;
      }

      const correctChoice: 'yes' | 'no' =
        (m.home_score! + m.away_score!) > (q.baseline_home_score! + q.baseline_away_score!) ? 'yes' : 'no';

      await supabaseAdmin
        .from('micro_prediction_questions')
        .update({ status: 'resolved', correct_choice: correctChoice })
        .eq('id', q.id)
        .eq('status', 'locked');

      await settleBets(q.id, correctChoice);
      resolvedCount++;
    } catch (err) {
      logger.warn(`[momentumBets] resolution error for question ${q.id}: ${(err as Error).message}`);
    }
  }

  if (resolvedCount > 0 || canceledCount > 0) {
    logger.info(`[momentumBets] Resolved ${resolvedCount}, canceled ${canceledCount} micro-question(s)`);
  }
  return { resolved: resolvedCount, canceled: canceledCount };
}

/**
 * Per-bet settlement — the actual crash-safety guard, independent of the
 * question's own status. `correctChoice: null` means the question was
 * canceled (refund path); otherwise it's the resolved outcome (win/loss
 * path — a genuine loss gets no further ledger row, matching how the main
 * prediction economy never logs anything beyond the original stake for a
 * losing pick).
 */
async function settleBets(questionId: string, correctChoice: 'yes' | 'no' | null): Promise<void> {
  const { data: bets } = await supabaseAdmin
    .from('micro_prediction_bets')
    .select('id, user_id, group_id, choice, coins_staked')
    .eq('question_id', questionId)
    .is('settled_at', null);

  for (const b of bets ?? []) {
    const { data: claimed } = await supabaseAdmin
      .from('micro_prediction_bets')
      .update({
        settled_at: new Date().toISOString(),
        is_winner: correctChoice !== null ? b.choice === correctChoice : null,
      })
      .eq('id', b.id)
      .is('settled_at', null) // atomic per-bet claim
      .select('id');

    if (!claimed || claimed.length === 0) continue; // another worker already settled this bet

    if (correctChoice === null) {
      await creditCoins(b.user_id, b.group_id, b.coins_staked, 'micro_prediction_refund', 'Momentum bet canceled — refund');
    } else if (b.choice === correctChoice) {
      await creditCoins(b.user_id, b.group_id, b.coins_staked * 2, 'micro_prediction_won', 'Momentum bet won');
    }
  }
}

async function creditCoins(userId: string, groupId: string, amount: number, type: string, description: string): Promise<void> {
  const { data: balance, error } = await supabaseAdmin.rpc('credit_group_coins', {
    p_user_id: userId,
    p_group_id: groupId,
    p_amount: amount,
  });
  if (error) {
    logger.warn(`[momentumBets] credit_group_coins failed for user ${userId}: ${error.message}`);
    return;
  }
  const { error: txErr } = await supabaseAdmin.from('coin_transactions').insert({
    user_id: userId,
    group_id: groupId,
    type,
    amount,
    balance_after: balance,
    description,
  });
  if (txErr) logger.warn(`[momentumBets] coin_transactions insert failed for user ${userId}: ${txErr.message}`);
}
