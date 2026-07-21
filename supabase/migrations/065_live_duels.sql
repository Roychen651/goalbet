-- ─── Migration 065: Live Duels — 1v1 In-Play Coin Escrow (V6 Sprint 47 Commit 3) ──
-- One table (live_duels) + three RPCs (create_duel_offer, accept_duel_wager,
-- cancel_duel_offer). No client INSERT/UPDATE/DELETE policy — every write
-- funnels through the RPCs, same posture as migration 042/055.
--
-- The core safety property, worth restating from Commit 2's own design
-- note (RealtimeProvider.tsx's DuelChallengePayload comment): a duel's
-- escrow can NEVER be a single RPC call moving both parties' coins based on
-- an ephemeral broadcast message — that would let a spoofed client-authored
-- `fromUserId` field debit a real user's balance without their own
-- authenticated consent, the same class of hole rule 4.11 already closed
-- once. Instead this is a genuine two-phase commit, each phase a
-- single-party debit from that party's OWN authenticated session:
--   1. create_duel_offer() — the CHALLENGER's own call, debits only their
--      own balance, inserts a real 'pending' row (their stake already
--      escrowed for real).
--   2. accept_duel_wager() — the ACCEPTOR's own call, debits only their
--      own balance, flips the row to 'active' and captures the baseline
--      score.
-- Neither RPC ever reads a p_user_id belonging to anyone other than its own
-- caller (auth.uid() checked first, same as every coin-spending RPC in this
-- codebase, §11/§27). The winner's payout (both stakes) is credited by the
-- BACKEND resolution sweep (liveDuels.ts, service-role — Commit 3's second
-- half), which is safe precisely because by then both debits already
-- happened via real, individually-authorized calls; the sweep only ever
-- CREDITS, it debits nobody.
--
-- Resolution shape mirrors Momentum Bets' arbitrage-fix design (§29)
-- exactly: the outcome window is [locked_at, locked_at+10min), measured
-- from ACCEPTANCE (when betting closes), never from the offer's own
-- creation time — so there is no client speed at which the outcome of a
-- window that hasn't started yet can be known.

-- ============================================================
-- 1. Schema
-- ============================================================
CREATE TABLE IF NOT EXISTS public.live_duels (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  match_id              UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  challenger_id         UUID NOT NULL REFERENCES public.profiles(id),
  challenger_side       TEXT NOT NULL CHECK (challenger_side IN ('home', 'away')),
  acceptor_id           UUID REFERENCES public.profiles(id),
  acceptor_side         TEXT CHECK (acceptor_side IN ('home', 'away')),
  -- Symmetric — both sides always stake the SAME amount (a real 1v1, not a
  -- handicap market). Set once at offer time, never edited afterward
  -- (unlike syndicate_pools' contribute_to_pool, a duel isn't a running
  -- pot either side can keep topping up).
  stake                 INTEGER NOT NULL CHECK (stake > 0),
  status                TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'active', 'resolved', 'refunded')),
  baseline_home_score   INTEGER,
  baseline_away_score   INTEGER,
  locked_at             TIMESTAMPTZ,
  resolves_at           TIMESTAMPTZ,
  winner_id             UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_duels_group_status ON public.live_duels (group_id, status);
-- Feeds the backend resolution sweep's two passes (active-past-resolves_at,
-- pending-on-an-ended-match) without a sequential scan.
CREATE INDEX IF NOT EXISTS idx_live_duels_active_resolves ON public.live_duels (resolves_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_live_duels_pending_match ON public.live_duels (match_id) WHERE status = 'pending';

-- ============================================================
-- 2. RLS — public to the whole group, like syndicate_pools (a duel
--    challenge is a public group activity by nature, not a private pick
--    needing migration 037's pre-kickoff hiding). No client write policy.
-- ============================================================
ALTER TABLE public.live_duels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_duels_select_group_members" ON public.live_duels;
CREATE POLICY "live_duels_select_group_members" ON public.live_duels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = live_duels.group_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 3. coin_transactions.type — widen for duel_stake/duel_won/duel_refund.
--    Same DROP+re-ADD-with-full-list shape migration 058 already
--    established as the correct fix for this exact CHECK constraint.
-- ============================================================
ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_type_check;
ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_transactions_type_check
  CHECK (type IN (
    'join_bonus', 'daily_bonus', 'bet_placed', 'bet_won',
    'micro_prediction', 'micro_prediction_won', 'micro_prediction_refund',
    'cosmetic_purchase', 'pool_contribution', 'pool_won',
    'duel_stake', 'duel_won', 'duel_refund'
  ));

-- ============================================================
-- 4. create_duel_offer — the CHALLENGER's own call. Single-party debit,
--    real row created in 'pending' status, discoverable by every group
--    member via a normal SELECT + Realtime (RealtimeProvider.tsx Commit 3
--    wiring) — not just to whoever happens to have the drawer open at
--    broadcast time.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_duel_offer(
  p_user_id  UUID,
  p_group_id UUID,
  p_match_id UUID,
  p_side     TEXT,
  p_stake    INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance INTEGER;
  v_duel_id UUID;
  v_status  TEXT;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user mismatch';
  END IF;

  IF p_side NOT IN ('home', 'away') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_side');
  END IF;

  IF p_stake IS NULL OR p_stake <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this group';
  END IF;

  -- A duel is a live, in-play proposition — only offerable while the
  -- match is genuinely live, same restriction Momentum Bets' milestone
  -- questions are implicitly scoped to.
  SELECT status INTO v_status FROM matches WHERE id = p_match_id;
  IF v_status IS NULL OR v_status NOT IN ('1H', 'HT', '2H', 'ET1', 'ET2', 'PEN') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_live');
  END IF;

  -- Single-party debit — the caller's own balance row only.
  SELECT coins INTO v_balance FROM group_members
   WHERE user_id = p_user_id AND group_id = p_group_id
   FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'member_not_found');
  END IF;

  IF v_balance < p_stake THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_coins', 'balance', v_balance);
  END IF;

  UPDATE group_members SET coins = coins - p_stake
   WHERE user_id = p_user_id AND group_id = p_group_id
   RETURNING coins INTO v_balance;

  INSERT INTO live_duels (group_id, match_id, challenger_id, challenger_side, stake, status)
  VALUES (p_group_id, p_match_id, p_user_id, p_side, p_stake, 'pending')
  RETURNING id INTO v_duel_id;

  INSERT INTO coin_transactions (user_id, group_id, match_id, type, amount, balance_after, description)
  VALUES (p_user_id, p_group_id, p_match_id, 'duel_stake', -p_stake, v_balance, 'Live Duel — challenge stake');

  RETURN jsonb_build_object('success', true, 'balance', v_balance, 'duel_id', v_duel_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_duel_offer(UUID, UUID, UUID, TEXT, INTEGER) TO authenticated;

-- ============================================================
-- 5. accept_duel_wager — the ACCEPTOR's own call. Locks the duel row
--    FIRST (rule 4.17's deterministic lock-ordering: the shared/contended
--    row before any single-party balance row) — this is what closes the
--    race between two members racing to accept the same open offer; only
--    the first to reach this lock wins, the second sees status <> 'pending'
--    and returns 'duel_closed'. Then locks and debits ONLY the acceptor's
--    own balance — the challenger's stake was already moved for real at
--    offer time, never touched again here.
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_duel_wager(
  p_user_id  UUID,
  p_group_id UUID,
  p_duel_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_duel    live_duels%ROWTYPE;
  v_balance INTEGER;
  v_status  TEXT;
  v_home    INTEGER;
  v_away    INTEGER;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user mismatch';
  END IF;

  SELECT * INTO v_duel FROM live_duels WHERE id = p_duel_id FOR UPDATE;

  IF v_duel IS NULL OR v_duel.group_id IS DISTINCT FROM p_group_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'duel_not_found');
  END IF;

  IF v_duel.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'duel_closed');
  END IF;

  IF v_duel.challenger_id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_accept_own_duel');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this group';
  END IF;

  SELECT status, home_score, away_score INTO v_status, v_home, v_away
    FROM matches WHERE id = v_duel.match_id;

  IF v_status IS NULL OR v_status NOT IN ('1H', 'HT', '2H', 'ET1', 'ET2', 'PEN') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_live');
  END IF;

  SELECT coins INTO v_balance FROM group_members
   WHERE user_id = p_user_id AND group_id = p_group_id
   FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'member_not_found');
  END IF;

  IF v_balance < v_duel.stake THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_coins', 'balance', v_balance);
  END IF;

  UPDATE group_members SET coins = coins - v_duel.stake
   WHERE user_id = p_user_id AND group_id = p_group_id
   RETURNING coins INTO v_balance;

  -- The outcome window starts HERE — at acceptance/lock time, never at the
  -- offer's own creation time. Betting is structurally closed the instant
  -- this UPDATE commits, before the window it measures has even begun.
  UPDATE live_duels SET
    acceptor_id = p_user_id,
    acceptor_side = CASE WHEN v_duel.challenger_side = 'home' THEN 'away' ELSE 'home' END,
    status = 'active',
    baseline_home_score = COALESCE(v_home, 0),
    baseline_away_score = COALESCE(v_away, 0),
    locked_at = NOW(),
    resolves_at = NOW() + INTERVAL '10 minutes',
    updated_at = NOW()
  WHERE id = p_duel_id;

  INSERT INTO coin_transactions (user_id, group_id, match_id, type, amount, balance_after, description)
  VALUES (p_user_id, p_group_id, v_duel.match_id, 'duel_stake', -v_duel.stake, v_balance, 'Live Duel — accepted wager');

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_duel_wager(UUID, UUID, UUID) TO authenticated;

-- ============================================================
-- 6. cancel_duel_offer — the CHALLENGER's own call, refunds their own
--    stake for a still-pending (never accepted) offer. Same single-party
--    shape as the other two — never touches anyone else's balance.
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_duel_offer(
  p_user_id  UUID,
  p_group_id UUID,
  p_duel_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_duel    live_duels%ROWTYPE;
  v_balance INTEGER;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user mismatch';
  END IF;

  SELECT * INTO v_duel FROM live_duels WHERE id = p_duel_id FOR UPDATE;

  IF v_duel IS NULL OR v_duel.group_id IS DISTINCT FROM p_group_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'duel_not_found');
  END IF;

  IF v_duel.challenger_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied: not your duel';
  END IF;

  IF v_duel.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'duel_closed');
  END IF;

  UPDATE live_duels SET status = 'refunded', updated_at = NOW() WHERE id = p_duel_id;

  UPDATE group_members SET coins = coins + v_duel.stake
   WHERE user_id = p_user_id AND group_id = p_group_id
   RETURNING coins INTO v_balance;

  INSERT INTO coin_transactions (user_id, group_id, match_id, type, amount, balance_after, description)
  VALUES (p_user_id, p_group_id, v_duel.match_id, 'duel_refund', v_duel.stake, v_balance, 'Live Duel — challenge canceled, refund');

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_duel_offer(UUID, UUID, UUID) TO authenticated;

-- No RPC here credits a winner — that's the backend resolution sweep
-- (liveDuels.ts, service-role, credit_group_coins) at rest-of-Commit-3.
-- It's safe for the sweep to be the sole credit path precisely because
-- every debit already happened via one of the three real, individually
-- authorized calls above.
