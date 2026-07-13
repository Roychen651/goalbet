-- 036_setup_pg_cron_sync.sql
-- Ironclad Sync Engine (Sprint 1): move the 5-minute sync heartbeat off
-- GitHub Actions and into Supabase pg_cron. pg_cron fires a PL/pgSQL function
-- every 5 minutes that pulls SYNC_API_KEY from Vault and POSTs (via pg_net) to
-- the backend's authenticated internal sync routes.
--
-- The GitHub Actions workflow is downgraded to a 30-minute fallback heartbeat
-- (see .github/workflows/sync-cron.yml) so a pg_net outage can't let the Render
-- dyno enter a deep freeze.
--
-- SECURITY: the X-Sync-Key is NEVER hardcoded here. It is read at call time
-- from vault.decrypted_secrets. Insert it manually (see migration footer / PR
-- notes) — this file is safe to commit.
--
-- IDEMPOTENT: fully re-runnable. Extensions use IF NOT EXISTS, the function is
-- CREATE OR REPLACE, and the cron job is unscheduled (if present) before being
-- rescheduled.

-- ── Extensions ────────────────────────────────────────────────────────────────
-- On Supabase these may already be enabled via the Dashboard. If the migration
-- role lacks privilege to CREATE them, enable via Database → Extensions first,
-- then re-run (these statements become no-ops once enabled).
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- ── Heartbeat function ────────────────────────────────────────────────────────
-- Fires the score resolver first (coins), then the fixture sync. net.http_post
-- is async/fire-and-forget, so the two are independent requests — a slow or
-- failing fixture sync can never block or delay score resolution (mirrors the
-- "scores before fixtures, never blocked" invariant of the old GitHub cron).
--
-- SECURITY DEFINER so it can read vault.decrypted_secrets. Fails soft: if the
-- secret is missing it logs a warning and returns rather than erroring the job.
create or replace function public.trigger_sync_heartbeat()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_key     text;
  v_base    text := 'https://goalbet.onrender.com';
  v_headers jsonb;
begin
  select decrypted_secret
    into v_key
    from vault.decrypted_secrets
   where name = 'SYNC_API_KEY'
   limit 1;

  if v_key is null then
    raise warning '[trigger_sync_heartbeat] SYNC_API_KEY not found in Vault — skipping sync';
    return;
  end if;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Sync-Key',   v_key
  );

  -- 1. Scores first — awards coins, resolves predictions.
  perform net.http_post(
    url                 := v_base || '/api/sync/internal/scores',
    body                := '{}'::jsonb,
    headers             := v_headers,
    timeout_milliseconds := 30000
  );

  -- 2. Fixtures — non-critical; independent async request.
  perform net.http_post(
    url                 := v_base || '/api/sync/internal/matches',
    body                := '{}'::jsonb,
    headers             := v_headers,
    timeout_milliseconds := 30000
  );
end;
$$;

-- ── Schedule (idempotent) ─────────────────────────────────────────────────────
-- Unschedule any existing job of this name first. Selecting over cron.job means
-- this is a no-op empty set when the job doesn't exist yet (no error on first run).
select cron.unschedule(jobid)
  from cron.job
 where jobname = 'goalbet-sync-heartbeat';

select cron.schedule(
  'goalbet-sync-heartbeat',
  '*/5 * * * *',
  'select public.trigger_sync_heartbeat();'
);

-- ── Manual step required after deploy (NOT done here — no secret in git) ───────
-- Insert the key into Vault so the function above can read it. Run once in the
-- Supabase SQL editor with the REAL key (must equal Render's SYNC_API_KEY):
--
--   select vault.create_secret('<the-real-sync-api-key>', 'SYNC_API_KEY');
--
-- Verify:  select jobname, schedule, active from cron.job;
--          select * from cron.job_run_details order by start_time desc limit 5;
