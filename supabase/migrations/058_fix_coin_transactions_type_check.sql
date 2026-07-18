-- ─────────────────────────────────────────────────────────────────────────
-- Migration 058: Fix coin_transactions.type CHECK — close every gap in one
-- shot (hotfix, post-Sprint-37, triggered by a live user report)
-- ─────────────────────────────────────────────────────────────────────────
-- A user reported large, unexplained "Admin Adjustment"-labeled deductions.
-- Investigation traced this to CoinHistoryModal.tsx's frontend fallback:
-- any coin_transactions.type it doesn't recognize renders as a generic
-- Wrench/"Admin Adjustment" row (fixed separately, frontend-only). But that
-- investigation also surfaced a real DB-level gap this migration closes.
--
-- coin_transactions_type_check was created in migration 020 with only
-- ('join_bonus','daily_bonus','bet_placed','bet_won'). Since then, THREE
-- separate features started inserting types that were never added to it:
--   - micro_prediction / micro_prediction_won / micro_prediction_refund
--     (migration 042/043, V4 Sprint 14 — Momentum Bets)
--   - pool_contribution / pool_won (migration 055 / backend
--     syndicatePools.ts, V5 Sprint 36 — Syndicate Pools)
-- Migration 057 (V5 Sprint 37) widened the constraint for 'cosmetic_purchase'
-- but, in the same oversight, still didn't add the pool or micro-prediction
-- types that had been missing since their own sprints shipped.
--
-- Momentum Bets is a long-established, documented-working feature (§29),
-- which only makes sense if the LIVE database's constraint has already
-- drifted more permissive than what these migration files describe (most
-- likely an early manual fix in the SQL Editor that was never captured as
-- its own migration). This migration doesn't need to resolve exactly how —
-- DROP + re-ADD with the full, correct, current list of every type this
-- codebase actually inserts closes the gap unconditionally, regardless of
-- whatever the live constraint's drifted state currently is.
--
-- Separately: contribute_to_pool()'s coin_transactions INSERT (migration
-- 055) is NOT wrapped in its own exception-swallowing block, so if the
-- live constraint genuinely does reject 'pool_contribution', the whole RPC
-- call — including the balance debit a few statements earlier in the same
-- transaction — rolls back atomically. It cannot partially succeed.

ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_type_check;
ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_transactions_type_check
  CHECK (type IN (
    'join_bonus', 'daily_bonus', 'bet_placed', 'bet_won',
    'micro_prediction', 'micro_prediction_won', 'micro_prediction_refund',
    'cosmetic_purchase', 'pool_contribution', 'pool_won'
  ));
