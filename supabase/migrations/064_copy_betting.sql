-- ─── Migration 064: Tactical Copy-Betting & Creator Royalties (V6 Sprint 47) ─
-- Lets a group member "tail" (copy) another member's already-locked
-- prediction via submit_copied_prediction(). No new group_events type and
-- no new RLS policy — both corrected against the brief before this was
-- written, see CLAUDE.md §63:
--
--   1. "Publish an active/unlocked slip" as originally briefed would leak
--      pre-kickoff picks to the whole group, directly undoing migration
--      037's kickoff-time RLS wall (the same privacy boundary
--      aiProvocateur.ts is explicitly forbidden from crossing, §26). The
--      PREDICTION_LOCKED group_events card ALREADY exists as the "blind"
--      announcement (usernane + match + tier-count + coins staked, never
--      the actual picks) — its metadata used to also leak the six pick
--      fields until the pre-Sprint-47 hotfix (PR #145/#146) removed them.
--      Copy-betting reuses that now-genuinely-blind card; no new event
--      type or dedup index needed.
--   2. copied_from_user_id needs no new RLS policy — predictions_read_group
--      (migration 037) is row-level and column-agnostic, so this new
--      column inherits the existing kickoff-time visibility rule
--      automatically the instant it exists, the same way is_parlay/
--      parlay_linked_tiers did (migration 054).

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS copied_from_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN predictions.copied_from_user_id IS
  'Root creator whose prediction this row copies, if any. Always flattened '
  'to the ORIGINAL creator at copy time (submit_copied_prediction), never '
  'an intermediate tailer — a tail-of-a-tail must not let the intermediate '
  'user collect a royalty for virality they did not originate. NULL for a '
  'prediction placed directly, never via Tail.';

-- ============================================================
-- submit_copied_prediction — copies a source prediction's tier values
-- into a new/updated row for the calling (tailing) user.
-- ============================================================
-- Never trusts the client with tier values (rule 4.11/§11/§27's standing
-- coin-spending-RPC discipline) — every value is read server-side from the
-- source row, then delegated to submit_prediction() itself for cost
-- computation, corners/parlay validation, and the actual write, so this
-- function can never drift out of sync with that logic by duplicating it.
-- prevent_late_prediction() (migration 037's trigger) already rejects the
-- INSERT/UPDATE this performs if the source match is within 15 minutes of
-- kickoff or has already started — no separate timing check needed here.
CREATE OR REPLACE FUNCTION submit_copied_prediction(
  p_user_id               UUID,
  p_group_id              UUID,
  p_source_prediction_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_source       predictions%ROWTYPE;
  v_root_creator UUID;
  v_result       JSONB;
BEGIN
  -- 1. Identity check — caller must be the user they claim to be.
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user mismatch';
  END IF;

  -- 2. Read the source row. SECURITY DEFINER means this bypasses
  --    predictions_read_group's kickoff-time hiding on purpose — the whole
  --    point of "blind tail" is that the RPC (never the client) sees the
  --    actual picks.
  SELECT * INTO v_source FROM predictions WHERE id = p_source_prediction_id;
  IF v_source IS NULL THEN
    RAISE EXCEPTION 'Source prediction not found';
  END IF;

  -- 3. The tail must stay within the group the announcement was posted in
  --    — cross-group tailing is meaningless (the announcement never
  --    reached a different group).
  IF v_source.group_id IS DISTINCT FROM p_group_id THEN
    RAISE EXCEPTION 'Source prediction does not belong to this group';
  END IF;

  IF v_source.user_id = p_user_id THEN
    RAISE EXCEPTION 'Cannot tail your own prediction';
  END IF;

  -- 4. Chain-flatten: always credit the ROOT creator, never an
  --     intermediate tailer. If the source row is itself a tail, resolve
  --     through to whoever it was originally copied from.
  v_root_creator := COALESCE(v_source.copied_from_user_id, v_source.user_id);

  -- 5. Delegate to submit_prediction() for cost computation, corners/parlay
  --    validation, and the actual upsert — the single source of truth for
  --    all of that logic, never duplicated here.
  SELECT submit_prediction(
    p_user_id,
    v_source.group_id,
    v_source.match_id,
    v_source.predicted_outcome,
    v_source.predicted_home_score,
    v_source.predicted_away_score,
    v_source.predicted_corners,
    v_source.predicted_btts,
    v_source.predicted_over_under,
    v_source.is_parlay,
    v_source.parlay_linked_tiers
  ) INTO v_result;

  IF (v_result->>'success')::boolean IS DISTINCT FROM true THEN
    RETURN v_result; -- submit_prediction's own failure reason (insufficient_coins, member_not_found, ...)
  END IF;

  -- 6. Stamp the root-creator reference on the row submit_prediction just
  --    wrote/updated.
  UPDATE predictions
  SET copied_from_user_id = v_root_creator
  WHERE user_id = p_user_id AND match_id = v_source.match_id AND group_id = v_source.group_id;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_result->'balance',
    'coins_bet', v_result->'coins_bet',
    'prediction', v_result->'prediction',
    'copied_from_user_id', v_root_creator,
    'predicted_outcome', v_source.predicted_outcome,
    'predicted_home_score', v_source.predicted_home_score,
    'predicted_away_score', v_source.predicted_away_score,
    'predicted_corners', v_source.predicted_corners,
    'predicted_btts', v_source.predicted_btts,
    'predicted_over_under', v_source.predicted_over_under
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_copied_prediction(UUID, UUID, UUID) TO authenticated;
