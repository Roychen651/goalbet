-- ─── Migration 042: In-Play Micro-Predictions "Momentum Bets" (V4 Sprint 14) ──
-- Short-fuse, low-stake (2 coin) in-play propositions during live matches.
-- Every write funnels through submit_micro_prediction() — no direct client
-- INSERT/UPDATE policy on micro_prediction_bets, applying the Sprint 11
-- lesson (never trust a client-computed cost or a client-written bet row)
-- from day one instead of retrofitting it after a vulnerability is found.
--
-- Arbitrage note: the outcome window for a resolved question is always
-- [locked_at, locked_at + 10 minutes), never [opens_at, opens_at + 10 min).
-- Betting only happens during [opens_at, locked_at) — a period that, by
-- construction, ends before the outcome window begins. No client, however
-- fast, can know the outcome of a window that hasn't started yet. This is
-- enforced by resolution logic reading locked_at + baseline scores, not by
-- timing precision alone.
--
-- Idempotent.

-- ============================================================
-- 1. Schema
-- ============================================================
CREATE TABLE IF NOT EXISTS public.micro_prediction_questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  group_id            UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  milestone           TEXT NOT NULL CHECK (milestone IN ('kickoff', 'halftime', 'minute_75')),
  question_type       TEXT NOT NULL CHECK (question_type IN ('goal_next_10')),
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'locked', 'resolved', 'canceled')),
  opens_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL,
  locked_at           TIMESTAMPTZ,
  baseline_home_score INTEGER,
  baseline_away_score INTEGER,
  resolves_at         TIMESTAMPTZ,
  correct_choice      TEXT CHECK (correct_choice IN ('yes', 'no')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Idempotent generation backstop — one question per milestone per match per group.
  UNIQUE (match_id, group_id, milestone)
);

CREATE INDEX IF NOT EXISTS idx_micro_questions_open_expiring
  ON public.micro_prediction_questions (status, expires_at)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_micro_questions_locked_resolving
  ON public.micro_prediction_questions (status, resolves_at)
  WHERE status = 'locked';

CREATE INDEX IF NOT EXISTS idx_micro_questions_group
  ON public.micro_prediction_questions (group_id, match_id);

CREATE TABLE IF NOT EXISTS public.micro_prediction_bets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES public.micro_prediction_questions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id      UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  choice        TEXT NOT NULL CHECK (choice IN ('yes', 'no')),
  coins_staked  INTEGER NOT NULL DEFAULT 2,
  is_winner     BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The concurrent-double-bet backstop the atomic claim also protects.
  UNIQUE (question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_micro_bets_question ON public.micro_prediction_bets (question_id);
CREATE INDEX IF NOT EXISTS idx_micro_bets_user_group ON public.micro_prediction_bets (user_id, group_id);

-- ============================================================
-- 2. RLS — questions
-- ============================================================
ALTER TABLE public.micro_prediction_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "micro_questions_select_group_members" ON public.micro_prediction_questions;
CREATE POLICY "micro_questions_select_group_members" ON public.micro_prediction_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = micro_prediction_questions.group_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );
-- No client INSERT/UPDATE/DELETE policy — questions are written exclusively
-- by the backend (service role), never by an authenticated client.

-- ============================================================
-- 3. RLS — bets. Mirrors migration 037's predictions privacy shape: own row
--    always visible; another member's bet is hidden until the question locks.
-- ============================================================
ALTER TABLE public.micro_prediction_bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "micro_bets_select_own_or_locked" ON public.micro_prediction_bets;
CREATE POLICY "micro_bets_select_own_or_locked" ON public.micro_prediction_bets
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.micro_prediction_questions q
      WHERE q.id = micro_prediction_bets.question_id
        AND q.status IN ('locked', 'resolved', 'canceled')
    )
  );
-- No client INSERT/UPDATE/DELETE policy — every write goes through
-- submit_micro_prediction() (SECURITY DEFINER, bypasses RLS deliberately).

-- ============================================================
-- 4. submit_micro_prediction — the sole write path for a bet.
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_micro_prediction(
  p_user_id     UUID,
  p_group_id    UUID,
  p_question_id UUID,
  p_choice      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status    TEXT;
  v_expires   TIMESTAMPTZ;
  v_coins     INTEGER;
  v_balance   INTEGER;
  v_existing  UUID;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user mismatch';
  END IF;

  IF p_choice NOT IN ('yes', 'no') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_choice');
  END IF;

  -- Lock the question row itself — closes the race window between a
  -- concurrent lock-sweep flipping status and a last-second bet attempt.
  SELECT status, expires_at INTO v_status, v_expires
    FROM micro_prediction_questions
   WHERE id = p_question_id AND group_id = p_group_id
   FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'question_not_found');
  END IF;

  IF v_status <> 'open' OR NOW() > v_expires THEN
    RETURN jsonb_build_object('success', false, 'error', 'question_closed');
  END IF;

  -- Pre-check for a friendlier error in the common case. The real backstop is
  -- the UNIQUE (question_id, user_id) constraint below on the bare INSERT —
  -- deliberately NOT wrapped in ON CONFLICT DO NOTHING. If a genuine race
  -- slips past this pre-check, the INSERT raises a real exception and
  -- Postgres rolls back the whole transaction, including the coin deduction
  -- below. Suppressing that error would leave a double-charge with no bet
  -- recorded on the losing side of the race.
  SELECT id INTO v_existing FROM micro_prediction_bets
   WHERE question_id = p_question_id AND user_id = p_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_bet');
  END IF;

  SELECT coins INTO v_coins FROM group_members
   WHERE user_id = p_user_id AND group_id = p_group_id FOR UPDATE;

  IF v_coins IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'member_not_found');
  END IF;

  IF v_coins < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_coins', 'balance', v_coins);
  END IF;

  UPDATE group_members SET coins = coins - 2
   WHERE user_id = p_user_id AND group_id = p_group_id
   RETURNING coins INTO v_balance;

  INSERT INTO coin_transactions (user_id, group_id, type, amount, balance_after, description)
  VALUES (p_user_id, p_group_id, 'micro_prediction', -2, v_balance, 'Momentum bet');

  INSERT INTO micro_prediction_bets (question_id, user_id, group_id, choice, coins_staked)
  VALUES (p_question_id, p_user_id, p_group_id, p_choice, 2);

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_micro_prediction(UUID, UUID, UUID, TEXT) TO authenticated;

-- ============================================================
-- 5. group_events — MICRO_BANTER event type + its OWN dedup index.
--    Deliberately NOT reusing group_events_ai_banter_unique (group_id,
--    match_id) — a match can generate up to 3 milestone questions, and that
--    index allows only one AI_BANTER row per match per group total. Reusing
--    it would silently drop the 2nd and 3rd roast (aiProvocateur.ts's
--    existing catch block treats a unique-violation as "another worker
--    already posted" and swallows it without logging). MICRO_BANTER gets its
--    own key: (group_id, question_id) — additive, zero risk to the existing
--    Sprint 10 mechanism.
-- ============================================================
ALTER TABLE public.group_events DROP CONSTRAINT IF EXISTS group_events_event_type_check;
ALTER TABLE public.group_events ADD CONSTRAINT group_events_event_type_check
  CHECK (event_type IN ('PREDICTION_LOCKED', 'WON_COINS', 'LEADERBOARD_CLIMB', 'AI_BANTER', 'MICRO_BANTER'));

ALTER TABLE public.group_events ADD COLUMN IF NOT EXISTS question_id UUID
  REFERENCES public.micro_prediction_questions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS group_events_micro_banter_unique
  ON public.group_events (group_id, question_id)
  WHERE event_type = 'MICRO_BANTER';
