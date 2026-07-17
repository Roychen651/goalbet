-- ─── Migration 055: The Social Syndicate — Cooperative Pool Engine (V5 Sprint 36 Commit 1) ──
-- Two new tables (syndicate_pools, pool_contributions) + two RPCs
-- (create_syndicate_pool, contribute_to_pool). No client INSERT/UPDATE/DELETE
-- policy on either table — every write funnels through the RPCs, same
-- posture as migration 042 (Momentum Bets). Idempotent.

-- ============================================================
-- 1. Schema
-- ============================================================
CREATE TABLE IF NOT EXISTS public.syndicate_pools (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  group_id          UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by        UUID NOT NULL REFERENCES public.profiles(id),
  -- Mirrors backend/src/services/pointsEngine.ts's PredictionInput shape
  -- field-for-field — the only way pool resolution (Commit 2) can reuse
  -- calculatePoints() with zero new scoring code.
  target_prediction JSONB NOT NULL,
  total_staked      INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'locked', 'resolved', 'refunded')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, group_id)  -- one active pool per match per group
);

CREATE INDEX IF NOT EXISTS idx_syndicate_pools_group_status
  ON public.syndicate_pools (group_id, status);

CREATE TABLE IF NOT EXISTS public.pool_contributions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id     UUID NOT NULL REFERENCES public.syndicate_pools(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  -- Settlement completion guard, identical in spirit to
  -- micro_prediction_bets.settled_at (migration 043) — Commit 2's payout
  -- loop claims each contribution individually via settled_at IS NULL, so a
  -- crash mid-distribution leaves unprocessed contributors safely retryable.
  settled_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pool_id, user_id)  -- the double-spend backstop
);

CREATE INDEX IF NOT EXISTS idx_pool_contributions_pool ON public.pool_contributions (pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_contributions_unsettled
  ON public.pool_contributions (pool_id) WHERE settled_at IS NULL;

-- ============================================================
-- 2. RLS
-- ============================================================
ALTER TABLE public.syndicate_pools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syndicate_pools_select_group_members" ON public.syndicate_pools;
CREATE POLICY "syndicate_pools_select_group_members" ON public.syndicate_pools
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = syndicate_pools.group_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );
-- No client INSERT/UPDATE/DELETE policy — every write goes through
-- create_syndicate_pool() / contribute_to_pool() (both SECURITY DEFINER) or
-- the backend service role (lock/resolve/refund transitions, Commit 2).

ALTER TABLE public.pool_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pool_contributions_select_group_members" ON public.pool_contributions;
CREATE POLICY "pool_contributions_select_group_members" ON public.pool_contributions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.syndicate_pools sp
      JOIN public.group_members gm ON gm.group_id = sp.group_id
      WHERE sp.id = pool_contributions.pool_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );
-- Deliberately different privacy shape from individual predictions (rule
-- 4.5 / migration 037): a pool's contributions are visible to the WHOLE
-- group immediately, not hidden until kickoff. This is a cooperative,
-- public rallying activity members actively co-decide together — not a
-- private pick being protected from rivals. No client write policy here
-- either.

-- ============================================================
-- 3. group_events — allow POOL_CONTRIBUTION (BATTLE_PROGRESS lands in
--    Commit 3's migration alongside group_battles).
-- ============================================================
ALTER TABLE public.group_events DROP CONSTRAINT IF EXISTS group_events_event_type_check;
ALTER TABLE public.group_events ADD CONSTRAINT group_events_event_type_check
  CHECK (event_type IN (
    'PREDICTION_LOCKED', 'WON_COINS', 'LEADERBOARD_CLIMB', 'AI_BANTER', 'MICRO_BANTER',
    'POOL_CONTRIBUTION'
  ));
-- No new dedup index needed for POOL_CONTRIBUTION, unlike AI_BANTER/
-- MICRO_BANTER: those exist because multiple INDEPENDENT workers race to
-- post the same content. Here, exactly one RPC call inserts exactly one
-- row, already serialized by contribute_to_pool()'s FOR UPDATE lock on the
-- pool row — no duplicate-writer risk exists to guard against.

-- ============================================================
-- 4. create_syndicate_pool — the sole write path for starting a pool.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_syndicate_pool(
  p_group_id          UUID,
  p_match_id          UUID,
  p_target_prediction JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pool_id UUID;
  v_kickoff TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this group';
  END IF;

  SELECT kickoff_time INTO v_kickoff FROM matches WHERE id = p_match_id;
  IF v_kickoff IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  -- Same 15-minute lock boundary as prevent_late_prediction() (migration
  -- 037 / rule 4.5) — a pool can't even be opened once individual
  -- predictions would already be locked for this match.
  IF v_kickoff <= NOW() + INTERVAL '15 minutes' THEN
    RETURN jsonb_build_object('success', false, 'error', 'locked');
  END IF;

  -- target_prediction must carry at least one real tier — mirrors
  -- pointsEngine.ts's PredictionInput shape; validated here so a pool can
  -- never be created with a payload calculatePoints() (Commit 2) can't
  -- score.
  IF NOT (
    p_target_prediction ? 'predicted_outcome'
    OR (p_target_prediction ? 'predicted_home_score' AND p_target_prediction ? 'predicted_away_score')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_prediction');
  END IF;

  INSERT INTO syndicate_pools (match_id, group_id, created_by, target_prediction)
  VALUES (p_match_id, p_group_id, v_user_id, p_target_prediction)
  RETURNING id INTO v_pool_id;

  RETURN jsonb_build_object('success', true, 'pool_id', v_pool_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'pool_already_exists');
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_syndicate_pool(UUID, UUID, JSONB) TO authenticated;

-- ============================================================
-- 5. contribute_to_pool — the sole write path for staking into a pool.
--    Edit-delta shape (mirrors submit_prediction, migration 040) — a
--    contribution can be raised or lowered; only the delta ever moves
--    coins. Lock ordering mirrors submit_micro_prediction (migration 042):
--    the pool row is locked FIRST, closing the race between a concurrent
--    lock/resolve transition and a last-second contribution; only then is
--    the balance row locked.
-- ============================================================
CREATE OR REPLACE FUNCTION public.contribute_to_pool(
  p_pool_id UUID,
  p_amount  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_group_id   UUID;
  v_status     TEXT;
  v_kickoff    TIMESTAMPTZ;
  v_old_amount INTEGER;
  v_diff       INTEGER;
  v_coins      INTEGER;
  v_balance    INTEGER;
  v_total      INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not authenticated';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  -- 1. Lock the pool row first.
  SELECT sp.group_id, sp.status, m.kickoff_time
    INTO v_group_id, v_status, v_kickoff
    FROM syndicate_pools sp
    JOIN matches m ON m.id = sp.match_id
   WHERE sp.id = p_pool_id
   FOR UPDATE OF sp;

  IF v_group_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'pool_not_found');
  END IF;

  -- Server-side kickoff gate — never trust status='open' alone (rule 4.5's
  -- "never rely only on the client-side kickoff check", applied to the
  -- pool's own status column too, which a slow backend housekeeping tick
  -- might not have flipped to 'locked' yet).
  IF v_status <> 'open' OR v_kickoff <= NOW() + INTERVAL '15 minutes' THEN
    RETURN jsonb_build_object('success', false, 'error', 'pool_closed');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members WHERE group_id = v_group_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this group';
  END IF;

  -- 2. Edit-delta: only the difference from any prior contribution moves coins.
  SELECT amount INTO v_old_amount FROM pool_contributions
   WHERE pool_id = p_pool_id AND user_id = v_user_id;
  v_old_amount := COALESCE(v_old_amount, 0);
  v_diff := p_amount - v_old_amount;

  IF v_diff = 0 THEN
    SELECT coins INTO v_balance FROM group_members
     WHERE user_id = v_user_id AND group_id = v_group_id;
    SELECT total_staked INTO v_total FROM syndicate_pools WHERE id = p_pool_id;
    RETURN jsonb_build_object('success', true, 'balance', v_balance, 'total_staked', v_total);
  END IF;

  -- 3. Lock the balance row and debit/credit the delta.
  SELECT coins INTO v_coins FROM group_members
   WHERE user_id = v_user_id AND group_id = v_group_id FOR UPDATE;

  IF v_coins IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'member_not_found');
  END IF;

  IF v_diff > 0 AND v_coins < v_diff THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_coins', 'balance', v_coins);
  END IF;

  UPDATE group_members SET coins = coins - v_diff
   WHERE user_id = v_user_id AND group_id = v_group_id
   RETURNING coins INTO v_balance;

  INSERT INTO coin_transactions (user_id, group_id, match_id, type, amount, balance_after, description)
  SELECT v_user_id, v_group_id, sp.match_id, 'pool_contribution', -v_diff, v_balance,
         CASE WHEN v_old_amount = 0 THEN 'Joined syndicate pool'
              WHEN v_diff > 0 THEN 'Increased pool contribution'
              ELSE 'Reduced pool contribution' END
    FROM syndicate_pools sp WHERE sp.id = p_pool_id;

  -- 4. Upsert the contribution row itself.
  INSERT INTO pool_contributions (pool_id, user_id, amount)
  VALUES (p_pool_id, v_user_id, p_amount)
  ON CONFLICT (pool_id, user_id) DO UPDATE SET amount = EXCLUDED.amount;

  -- 5. Bump the pool's running total by the delta.
  UPDATE syndicate_pools SET total_staked = total_staked + v_diff
   WHERE id = p_pool_id
   RETURNING total_staked INTO v_total;

  -- 6. Locker Room activity — a group actively watching a pool fill up is
  --    the point; edits included, this is a cooperative signal, not spam.
  INSERT INTO group_events (group_id, user_id, event_type, match_id, metadata)
  SELECT v_group_id, v_user_id, 'POOL_CONTRIBUTION', sp.match_id,
         jsonb_build_object('pool_id', p_pool_id, 'amount', p_amount, 'total_staked', v_total)
    FROM syndicate_pools sp WHERE sp.id = p_pool_id;

  RETURN jsonb_build_object('success', true, 'balance', v_balance, 'total_staked', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_pool(UUID, INTEGER) TO authenticated;
