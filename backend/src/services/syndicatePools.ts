// V5 Sprint 36 — "The Social Syndicate" — Cooperative Pool resolution.
//
// A separate file, not inlined into scoreUpdater.ts, matching the existing
// momentumBets.ts precedent: pool resolution is its own DB-state sweep
// called FROM scoreUpdater.ts's existing per-match resolution flow, not a
// second polling loop with its own cadence.
//
// Called once per match, right after resolveMatchPredictions()'s per-
// prediction loop completes for that match — never per-prediction-iteration,
// since a pool is one-per-(match_id, group_id), not one-per-prediction.

import { supabaseAdmin } from '../lib/supabaseAdmin';
import { calculatePoints, type PredictionInput, type MatchResult } from './pointsEngine';
import { logger } from '../lib/logger';

interface PoolContribution {
  id: string;
  user_id: string;
  amount: number;
  created_at: string;
}

interface PoolRow {
  id: string;
  group_id: string;
  target_prediction: PredictionInput;
  total_staked: number;
}

/**
 * Largest-remainder proportional payout split. Naively rounding each
 * contributor's share independently (ROUND(total * amount / totalStaked))
 * does not sum back to `totalPayout` — Postgres/JS rounding drift would
 * silently break the standing invariant group_members.coins ==
 * SUM(coin_transactions.amount) (CLAUDE.md §21). This guarantees the
 * returned shares sum to EXACTLY totalPayout: floor every share, then hand
 * out the leftover coins one at a time (largest fractional remainder
 * first, ties broken by earliest contribution) until the totals reconcile.
 */
export function splitPayoutByLargestRemainder(
  totalPayout: number,
  contributions: PoolContribution[],
  totalStaked: number,
): Map<string, number> {
  const shares = new Map<string, number>();
  if (totalPayout <= 0 || totalStaked <= 0 || contributions.length === 0) {
    for (const c of contributions) shares.set(c.id, 0);
    return shares;
  }

  const withRemainders = contributions.map((c) => {
    const exact = (totalPayout * c.amount) / totalStaked;
    const floor = Math.floor(exact);
    return { id: c.id, floor, remainder: exact - floor, created_at: c.created_at };
  });

  const floorSum = withRemainders.reduce((sum, w) => sum + w.floor, 0);
  let remainingToDistribute = totalPayout - floorSum;

  withRemainders.sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.created_at.localeCompare(b.created_at); // earliest contributor wins ties
  });

  for (const w of withRemainders) {
    const bonus = remainingToDistribute > 0 ? 1 : 0;
    shares.set(w.id, w.floor + bonus);
    if (bonus) remainingToDistribute--;
  }

  return shares;
}

/**
 * Resolves every open/locked syndicate pool for a single match. Called
 * from scoreUpdater.ts's FT and ET resolution branches (and its catch-up
 * pass) with the same scoringResult (90-minute regulation score) already
 * computed there — never re-derives it.
 *
 * A match can have multiple pools (one per group with an active pool for
 * it), so this loops per pool. Each pool's resolution is its own atomic
 * claim, own error boundary — one pool failing never blocks another.
 */
export async function resolvePoolsForMatch(
  matchId: string,
  scoringResult: MatchResult,
  matchEndAt: string,
): Promise<{ resolved: number; errors: { scope: string; message: string }[] }> {
  const errors: { scope: string; message: string }[] = [];
  let resolvedCount = 0;

  const { data: pools, error: poolsError } = await supabaseAdmin
    .from('syndicate_pools')
    .select('id, group_id, target_prediction, total_staked')
    .eq('match_id', matchId)
    .in('status', ['open', 'locked']);

  if (poolsError) {
    errors.push({ scope: 'syndicate_pools_fetch', message: poolsError.message });
    return { resolved: 0, errors };
  }
  if (!pools || pools.length === 0) return { resolved: 0, errors };

  for (const pool of pools as PoolRow[]) {
    try {
      // ── ATOMIC CLAIM — same shape as resolveMatchPredictions'
      // is_resolved=false guard (rule 4.14). Only the first worker to win
      // this UPDATE proceeds to payout; a concurrent caller sees an empty
      // .select() and skips.
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from('syndicate_pools')
        .update({ status: 'resolved' })
        .eq('id', pool.id)
        .in('status', ['open', 'locked'])
        .select('id');

      if (claimError) {
        errors.push({ scope: `pool_claim_${pool.id}`, message: claimError.message });
        continue;
      }
      if (!claimed || claimed.length === 0) {
        logger.debug(`[syndicatePools] Pool ${pool.id} already claimed by another worker — skipping`);
        continue;
      }

      const breakdown = calculatePoints(pool.target_prediction, scoringResult);
      const finalPoints = breakdown.total;

      const { data: contributions, error: contribError } = await supabaseAdmin
        .from('pool_contributions')
        .select('id, user_id, amount, created_at')
        .eq('pool_id', pool.id)
        .is('settled_at', null);

      if (contribError) {
        errors.push({ scope: `pool_contributions_fetch_${pool.id}`, message: contribError.message });
        continue;
      }
      if (!contributions || contributions.length === 0) {
        resolvedCount++;
        continue;
      }

      if (finalPoints <= 0) {
        // Silent on a loss — no group_events row, no coins, matching the
        // same restraint already established for Momentum Bets losses
        // (CLAUDE.md §29: "a loss toast... would be noise, not feedback").
        // Contributions still need settled_at stamped so a retry doesn't
        // re-process them.
        const ids = (contributions as PoolContribution[]).map((c) => c.id);
        const { error: settleError } = await supabaseAdmin
          .from('pool_contributions')
          .update({ settled_at: matchEndAt })
          .in('id', ids);
        if (settleError) {
          errors.push({ scope: `pool_settle_loss_${pool.id}`, message: settleError.message });
        }
        resolvedCount++;
        continue;
      }

      // Same 2× points-to-coins convention as individual prediction payouts.
      const totalPayout = finalPoints * 2;
      const shares = splitPayoutByLargestRemainder(
        totalPayout,
        contributions as PoolContribution[],
        pool.total_staked,
      );

      // ── Per-contributor settlement — claim each row individually
      // (settled_at IS NULL), never gate the whole pool behind one status
      // flip (rule established for Momentum Bets, CLAUDE.md §29: "a crash
      // mid-batch must leave unprocessed records safely retryable").
      for (const contribution of contributions as PoolContribution[]) {
        const share = shares.get(contribution.id) ?? 0;
        if (share <= 0) continue;

        const { data: settledRow, error: settleClaimError } = await supabaseAdmin
          .from('pool_contributions')
          .update({ settled_at: matchEndAt })
          .eq('id', contribution.id)
          .is('settled_at', null)
          .select('id');

        if (settleClaimError) {
          errors.push({ scope: `pool_settle_${contribution.id}`, message: settleClaimError.message });
          continue;
        }
        if (!settledRow || settledRow.length === 0) {
          // Another worker already settled this exact contribution.
          continue;
        }

        const { error: creditError } = await supabaseAdmin.rpc('credit_group_coins', {
          p_user_id: contribution.user_id,
          p_group_id: pool.group_id,
          p_amount: share,
        });
        if (creditError) {
          logger.error(
            `[syndicatePools] credit_group_coins FAILED for pool ${pool.id} user ${contribution.user_id} amount ${share} — ${creditError.message}`,
          );
          errors.push({ scope: `pool_credit_${contribution.id}`, message: creditError.message });
          continue;
        }

        // Distinct type from increment_coins' hardcoded 'bet_won' — same
        // reasoning as Momentum Bets' micro_prediction_won (CLAUDE.md §29):
        // a pool payout should render distinctly in CoinHistoryModal, not
        // be indistinguishable from an individual prediction win.
        const { error: txnError } = await supabaseAdmin.from('coin_transactions').insert({
          user_id: contribution.user_id,
          group_id: pool.group_id,
          match_id: matchId,
          type: 'pool_won',
          amount: share,
          description: `Syndicate pool won: ${finalPoints} pts → ${totalPayout} coins split`,
          created_at: matchEndAt, // "the times are sacred" — rule §11
        });
        if (txnError) {
          logger.warn(`[syndicatePools] coin_transactions insert failed for pool ${pool.id}: ${txnError.message}`);
        }

        // Reuses the existing WON_COINS event type (already rendered by
        // ActivityFeed with zero new frontend work needed for Commit 2) —
        // a pool win is genuinely "N individual coin awards that share a
        // decision," not a structurally new kind of event. metadata flags
        // it as pool-derived so Commit 4's UI can badge it distinctly.
        const { error: evtError } = await supabaseAdmin.from('group_events').insert({
          group_id: pool.group_id,
          user_id: contribution.user_id,
          event_type: 'WON_COINS',
          match_id: matchId,
          created_at: matchEndAt,
          metadata: {
            coins: share,
            points: finalPoints,
            pool_id: pool.id,
            is_pool_payout: true,
          },
        });
        if (evtError) logger.warn(`[syndicatePools] group_events insert failed: ${evtError.message}`);
      }

      resolvedCount++;
      logger.info(`[syndicatePools] Resolved pool ${pool.id}: ${finalPoints} pts, ${totalPayout} coins split across ${contributions.length} contributors`);
    } catch (err) {
      logger.error(`[syndicatePools] Unexpected error resolving pool ${pool.id}:`, err);
      errors.push({ scope: `pool_resolve_${pool.id}`, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { resolved: resolvedCount, errors };
}
