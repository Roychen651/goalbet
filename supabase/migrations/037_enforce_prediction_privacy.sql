-- 037_enforce_prediction_privacy.sql
-- V3 Sprint 2: Fort-Knox Privacy.
--
-- (1) READ PRIVACY — close the pre-kickoff prediction leak. Before this, the
--     predictions_read_group policy (migration 004) let ANY group member SELECT
--     every other member's predictions, including pre-kickoff (status='NS').
--     Client-side 🔒 was the only thing hiding them — trivially bypassed by
--     querying Supabase directly. Now enforced server-side by RLS.
--
-- (2) WRITE-LOCK HARDENING — the kickoff trigger (migration 007) was already
--     solid; this pins its search_path and fails closed on a missing match.
--     The 15-minutes-before-kickoff rule and the backend is_resolved bypass are
--     preserved unchanged.
--
-- Idempotent / fully re-runnable (DROP … IF EXISTS before CREATE).

-- ============================================================
-- 1. READ PRIVACY
-- ============================================================
-- A prediction row is readable only if the caller is a member of its group AND
-- (it is the caller's own row  OR  the match has left 'NS').
--
-- Performance (no JOIN):
--   • `user_id = (select auth.uid())` is checked first and short-circuits the
--     hot path (a user reading their own predictions) so it never touches matches.
--   • The match check is a correlated scalar subquery on the matches PRIMARY KEY
--     — a single index probe per row, not a join.
--   • auth.uid() is wrapped in a subselect so Postgres evaluates it once
--     (initPlan), not per row.
--   • Backed by existing indexes: idx_predictions_group (group_id),
--     idx_predictions_user_match (user_id, match_id), matches_pkey (matches.id).
drop policy if exists "predictions_read_group" on predictions;
create policy "predictions_read_group"
  on predictions for select
  using (
    group_id in (select get_my_group_ids())
    and (
      user_id = (select auth.uid())
      or (select status from matches where id = predictions.match_id) <> 'NS'
    )
  );

-- ============================================================
-- 2. KICKOFF WRITE-LOCK (hardened; rule unchanged)
-- ============================================================
create or replace function prevent_late_prediction()
returns trigger
language plpgsql
security invoker
set search_path = public          -- pin search_path (previously unset) — defense in depth
as $$
declare
  match_kickoff timestamptz;
  match_status  text;
begin
  -- Backend resolution bypass: only the service role can set is_resolved=true
  -- (client RLS WITH CHECK forbids it), so letting this through is safe.
  if TG_OP = 'UPDATE' and new.is_resolved = true then
    return new;
  end if;

  select kickoff_time, status
    into match_kickoff, match_status
    from matches
   where id = new.match_id;

  -- Fail closed: a missing match must never slip past the lock. The match_id FK
  -- already prevents this, but do not rely on NULL-boolean logic below.
  if match_kickoff is null then
    raise exception 'Prediction rejected: match % not found', new.match_id;
  end if;

  -- Lock 15 minutes before kickoff (unchanged product rule).
  if match_status <> 'NS' or match_kickoff <= now() + interval '15 minutes' then
    raise exception 'Predictions are locked 15 minutes before kickoff';
  end if;

  return new;
end;
$$;

drop trigger if exists lock_predictions_at_kickoff on predictions;
create trigger lock_predictions_at_kickoff
  before insert or update on predictions
  for each row execute procedure prevent_late_prediction();

-- ============================================================
-- 3. Re-assert the self-resolve block (client cannot set is_resolved=true)
-- ============================================================
-- Restated here so the write-lock guarantee is self-contained in one migration
-- and can't silently regress if an earlier migration is ever reverted/repaired.
drop policy if exists "predictions_update_own" on predictions;
create policy "predictions_update_own"
  on predictions for update
  using (user_id = (select auth.uid()) and is_resolved = false)
  with check (user_id = (select auth.uid()) and is_resolved = false);
