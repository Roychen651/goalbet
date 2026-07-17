-- ─── Migration 056: The Social Syndicate — Group Battles (V5 Sprint 36 Commit 3) ──
-- group_battles table + the first cross-group (OR-across-two-memberships)
-- RLS policy in this schema + challenge_group()/respond_to_battle()/
-- compute_battle_scores() RPCs + BATTLE_PROGRESS added to group_events.
-- Idempotent.

-- ============================================================
-- 1. Schema
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_battles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  defender_group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  start_time          TIMESTAMPTZ NOT NULL,
  end_time            TIMESTAMPTZ NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'active', 'declined', 'completed')),
  challenger_score    NUMERIC,
  defender_score      NUMERIC,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (challenger_group_id <> defender_group_id),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_group_battles_challenger ON public.group_battles (challenger_group_id, status);
CREATE INDEX IF NOT EXISTS idx_group_battles_defender ON public.group_battles (defender_group_id, status);
CREATE INDEX IF NOT EXISTS idx_group_battles_active ON public.group_battles (status) WHERE status = 'active';

-- ============================================================
-- 2. RLS — the first "OR across two different group memberships" policy in
--    this schema. Every other group-scoped table only ever needs a
--    single-group membership check.
-- ============================================================
ALTER TABLE public.group_battles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_battles_select_either_side" ON public.group_battles;
CREATE POLICY "group_battles_select_either_side" ON public.group_battles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.user_id = (SELECT auth.uid())
        AND gm.group_id IN (group_battles.challenger_group_id, group_battles.defender_group_id)
    )
  );
-- No client INSERT/UPDATE/DELETE — every write goes through
-- challenge_group() / respond_to_battle() (both SECURITY DEFINER) or the
-- backend service role (score refresh / completion).

-- ============================================================
-- 3. group_events — allow BATTLE_PROGRESS, with its OWN dedup index at its
--    own granularity (battle_id, milestone) — deliberately NOT reusing
--    POOL_CONTRIBUTION's shape (which needs no dedup at all) or AI_BANTER's
--    (group_id, match_id) shape, which would collide across different
--    battles between the same two groups.
-- ============================================================
ALTER TABLE public.group_events DROP CONSTRAINT IF EXISTS group_events_event_type_check;
ALTER TABLE public.group_events ADD CONSTRAINT group_events_event_type_check
  CHECK (event_type IN (
    'PREDICTION_LOCKED', 'WON_COINS', 'LEADERBOARD_CLIMB', 'AI_BANTER', 'MICRO_BANTER',
    'POOL_CONTRIBUTION', 'BATTLE_PROGRESS'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS group_events_battle_progress_unique
  ON public.group_events (group_id, (metadata->>'battle_id'), (metadata->>'milestone'))
  WHERE event_type = 'BATTLE_PROGRESS';

-- ============================================================
-- 4. challenge_group — resolves the DEFENDER's existing invite code,
--    exactly the same lookup find_group_by_invite_code() already does for
--    joining a group (migration 004). Never a public group directory —
--    groups.invite_code is treated as private everywhere else in this
--    codebase (CLAUDE.md §27), and this preserves that with zero new
--    surface area.
-- ============================================================
CREATE OR REPLACE FUNCTION public.challenge_group(
  p_challenger_group_id  UUID,
  p_defender_invite_code TEXT,
  p_start_time           TIMESTAMPTZ,
  p_end_time             TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id            UUID := auth.uid();
  v_defender_group_id  UUID;
  v_battle_id          UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members WHERE group_id = p_challenger_group_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of the challenging group';
  END IF;

  IF p_end_time <= p_start_time THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_window');
  END IF;

  SELECT id INTO v_defender_group_id FROM find_group_by_invite_code(p_defender_invite_code);
  IF v_defender_group_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'group_not_found');
  END IF;

  IF v_defender_group_id = p_challenger_group_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_challenge_self');
  END IF;

  INSERT INTO group_battles (challenger_group_id, defender_group_id, start_time, end_time)
  VALUES (p_challenger_group_id, v_defender_group_id, p_start_time, p_end_time)
  RETURNING id INTO v_battle_id;

  RETURN jsonb_build_object('success', true, 'battle_id', v_battle_id, 'defender_group_id', v_defender_group_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.challenge_group(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================
-- 5. respond_to_battle — the defender group's accept/decline. Posts the
--    'started' BATTLE_PROGRESS milestone for BOTH sides in the same
--    transaction on acceptance — the 'final' milestone (Commit 3's backend
--    wrapper) lands separately once the battle window actually closes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.respond_to_battle(
  p_battle_id UUID,
  p_accept    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_challenger  UUID;
  v_defender    UUID;
  v_status      TEXT;
  v_new_status  TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: not authenticated';
  END IF;

  SELECT challenger_group_id, defender_group_id, status
    INTO v_challenger, v_defender, v_status
    FROM group_battles WHERE id = p_battle_id FOR UPDATE;

  IF v_defender IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'battle_not_found');
  END IF;

  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_responded');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members WHERE group_id = v_defender AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of the defending group';
  END IF;

  v_new_status := CASE WHEN p_accept THEN 'active' ELSE 'declined' END;

  UPDATE group_battles SET status = v_new_status WHERE id = p_battle_id;

  IF p_accept THEN
    INSERT INTO group_events (group_id, user_id, event_type, metadata)
    VALUES
      (v_challenger, NULL, 'BATTLE_PROGRESS', jsonb_build_object(
        'battle_id', p_battle_id, 'milestone', 'started',
        'challenger_group_id', v_challenger, 'defender_group_id', v_defender)),
      (v_defender, NULL, 'BATTLE_PROGRESS', jsonb_build_object(
        'battle_id', p_battle_id, 'milestone', 'started',
        'challenger_group_id', v_challenger, 'defender_group_id', v_defender))
    ON CONFLICT (group_id, (metadata->>'battle_id'), (metadata->>'milestone')) WHERE event_type = 'BATTLE_PROGRESS' DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', v_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_battle(UUID, BOOLEAN) TO authenticated;

-- ============================================================
-- 6. compute_battle_scores — average of each side's top-5 points_earned
--    among resolved predictions inside [start_time, end_time). Scoped by
--    predictions.group_id (the group context a prediction was actually
--    made in), not by "any prediction a member ever made" — this measures
--    the GROUP's own performance, matching the "group-vs-group" framing.
--    Called on a schedule (backend wrapper, every 30 min — see
--    backend/src/services/groupBattles.ts), never live-per-Realtime-event,
--    consistent with Sprint 35's deferral of live predictions broadcasting.
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_battle_scores(p_battle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_battle group_battles%ROWTYPE;
  v_challenger_score NUMERIC;
  v_defender_score   NUMERIC;
BEGIN
  SELECT * INTO v_battle FROM group_battles WHERE id = p_battle_id;
  IF v_battle.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'battle_not_found');
  END IF;

  SELECT COALESCE(AVG(pts), 0) INTO v_challenger_score FROM (
    SELECT p.points_earned AS pts
      FROM predictions p JOIN matches m ON m.id = p.match_id
     WHERE p.group_id = v_battle.challenger_group_id
       AND p.is_resolved = true
       AND m.kickoff_time >= v_battle.start_time
       AND m.kickoff_time < v_battle.end_time
     ORDER BY p.points_earned DESC LIMIT 5
  ) top5;

  SELECT COALESCE(AVG(pts), 0) INTO v_defender_score FROM (
    SELECT p.points_earned AS pts
      FROM predictions p JOIN matches m ON m.id = p.match_id
     WHERE p.group_id = v_battle.defender_group_id
       AND p.is_resolved = true
       AND m.kickoff_time >= v_battle.start_time
       AND m.kickoff_time < v_battle.end_time
     ORDER BY p.points_earned DESC LIMIT 5
  ) top5;

  UPDATE group_battles
     SET challenger_score = v_challenger_score,
         defender_score   = v_defender_score,
         status = CASE WHEN status = 'active' AND NOW() >= v_battle.end_time THEN 'completed' ELSE status END
   WHERE id = p_battle_id;

  RETURN jsonb_build_object(
    'success', true,
    'challenger_score', v_challenger_score,
    'defender_score', v_defender_score,
    'is_final', NOW() >= v_battle.end_time
  );
END;
$$;

-- No GRANT to authenticated — service-role-only, called exclusively from
-- the backend's periodic refresh (never client-triggered; a client could
-- otherwise force a battle to complete early by lying about NOW() context).
