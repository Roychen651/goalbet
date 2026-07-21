/**
 * Live Duels — 1v1 in-play coin escrow resolution (V6 Sprint 47 Commit 3).
 *
 * Both debits (challenger's stake at offer time, acceptor's stake at
 * accept time) already happened via real, individually-authorized RPC
 * calls (migration 065's create_duel_offer/accept_duel_wager) before this
 * file ever runs — this service only ever CREDITS. Modeled directly on
 * momentumBets.ts's resolution shape (§29): a plain score-delta
 * comparison against a baseline captured at lock time, a bounded outcome
 * window, auto-refund when match data is unavailable rather than left
 * stuck open forever.
 */
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';

/**
 * Resolves 'active' duels whose 10-minute outcome window has elapsed, and
 * separately refunds 'pending' (never-accepted) offers whose match has
 * already ended — a challenge nobody took before full time shouldn't sit
 * with the challenger's coins locked up forever.
 */
export async function resolveLiveDuels(): Promise<{ resolved: number; refunded: number }> {
  let resolved = 0;
  let refunded = 0;

  resolved += await resolveActiveDuels();
  refunded += await refundStalePendingOffers();

  if (resolved > 0 || refunded > 0) {
    logger.info(`[liveDuels] Resolved ${resolved}, refunded ${refunded} duel(s)`);
  }
  return { resolved, refunded };
}

async function resolveActiveDuels(): Promise<number> {
  const nowIso = new Date().toISOString();

  const { data: due, error } = await supabaseAdmin
    .from('live_duels')
    .select('id, group_id, match_id, challenger_id, challenger_side, acceptor_id, acceptor_side, stake, baseline_home_score, baseline_away_score')
    .eq('status', 'active')
    .lte('resolves_at', nowIso);

  if (error) {
    logger.warn(`[liveDuels] due-duel query failed: ${error.message}`);
    return 0;
  }
  if (!due || due.length === 0) return 0;

  let count = 0;

  for (const duel of due) {
    try {
      const { data: m } = await supabaseAdmin
        .from('matches')
        .select('home_score, away_score, status')
        .eq('id', duel.match_id)
        .single();

      const dataUnavailable =
        !m || m.home_score === null || m.away_score === null ||
        m.status === 'PST' || m.status === 'CANC' ||
        duel.baseline_home_score === null || duel.baseline_away_score === null;

      // Atomic per-duel claim — .eq('status','active') on the UPDATE, same
      // shape as resolveMatchPredictions' is_resolved=false claim — so an
      // overlapping sweep tick can't both "win" the same duel.
      if (dataUnavailable) {
        const { data: claimed } = await supabaseAdmin
          .from('live_duels')
          .update({ status: 'refunded', updated_at: new Date().toISOString() })
          .eq('id', duel.id)
          .eq('status', 'active')
          .select('id');
        if (!claimed || claimed.length === 0) continue;

        await creditCoins(duel.challenger_id, duel.group_id, duel.match_id, duel.stake, 'duel_refund', 'Live Duel — no data at resolution, refund');
        await creditCoins(duel.acceptor_id!, duel.group_id, duel.match_id, duel.stake, 'duel_refund', 'Live Duel — no data at resolution, refund');
        count++;
        continue;
      }

      const homeDelta = m.home_score! - duel.baseline_home_score!;
      const awayDelta = m.away_score! - duel.baseline_away_score!;
      const challengerDelta = duel.challenger_side === 'home' ? homeDelta : awayDelta;
      const acceptorDelta = duel.acceptor_side === 'home' ? homeDelta : awayDelta;

      let winnerId: string | null = null;
      if (challengerDelta > acceptorDelta) winnerId = duel.challenger_id;
      else if (acceptorDelta > challengerDelta) winnerId = duel.acceptor_id;
      // Equal deltas (including 0-0, the common case of a quiet 10
      // minutes) is a genuine tie — refund both, no winner declared.

      if (winnerId === null) {
        const { data: claimed } = await supabaseAdmin
          .from('live_duels')
          .update({ status: 'refunded', updated_at: new Date().toISOString() })
          .eq('id', duel.id)
          .eq('status', 'active')
          .select('id');
        if (!claimed || claimed.length === 0) continue;

        await creditCoins(duel.challenger_id, duel.group_id, duel.match_id, duel.stake, 'duel_refund', 'Live Duel — tied, refund');
        await creditCoins(duel.acceptor_id!, duel.group_id, duel.match_id, duel.stake, 'duel_refund', 'Live Duel — tied, refund');
        count++;
        continue;
      }

      const { data: claimed } = await supabaseAdmin
        .from('live_duels')
        .update({ status: 'resolved', winner_id: winnerId, updated_at: new Date().toISOString() })
        .eq('id', duel.id)
        .eq('status', 'active')
        .select('id');
      if (!claimed || claimed.length === 0) continue; // another tick already resolved it

      // Winner takes both stakes.
      await creditCoins(winnerId, duel.group_id, duel.match_id, duel.stake * 2, 'duel_won', 'Live Duel — won!');
      count++;
    } catch (err) {
      logger.warn(`[liveDuels] resolution error for duel ${duel.id}: ${(err as Error).message}`);
    }
  }

  return count;
}

async function refundStalePendingOffers(): Promise<number> {
  const { data: pending, error } = await supabaseAdmin
    .from('live_duels')
    .select('id, group_id, match_id, challenger_id, stake, matches!inner(status)')
    .eq('status', 'pending')
    .in('matches.status', ['FT', 'PST', 'CANC']);

  if (error) {
    logger.warn(`[liveDuels] stale-pending query failed: ${error.message}`);
    return 0;
  }
  if (!pending || pending.length === 0) return 0;

  let count = 0;
  for (const duel of pending) {
    try {
      const { data: claimed } = await supabaseAdmin
        .from('live_duels')
        .update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('id', duel.id)
        .eq('status', 'pending')
        .select('id');
      if (!claimed || claimed.length === 0) continue;

      await creditCoins(duel.challenger_id, duel.group_id, duel.match_id, duel.stake, 'duel_refund', 'Live Duel — match ended before anyone accepted, refund');
      count++;
    } catch (err) {
      logger.warn(`[liveDuels] stale-offer refund error for duel ${duel.id}: ${(err as Error).message}`);
    }
  }

  return count;
}

async function creditCoins(userId: string, groupId: string, matchId: string, amount: number, type: 'duel_won' | 'duel_refund', description: string): Promise<void> {
  const { data: balance, error } = await supabaseAdmin.rpc('credit_group_coins', {
    p_user_id: userId,
    p_group_id: groupId,
    p_amount: amount,
  });
  if (error) {
    logger.warn(`[liveDuels] credit_group_coins failed for user ${userId}: ${error.message}`);
    return;
  }
  const { error: txErr } = await supabaseAdmin.from('coin_transactions').insert({
    user_id: userId,
    group_id: groupId,
    match_id: matchId,
    type,
    amount,
    balance_after: balance,
    description,
  });
  if (txErr) logger.warn(`[liveDuels] coin_transactions insert failed for user ${userId}: ${txErr.message}`);
}
