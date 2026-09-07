-- IPI-745 review fix (PR #557): expire_stale_brand_analysis
-- (20260720163626) marked any NULL-analysis_locked_at row 'failed' on the
-- very next cron tick (up to 2 minutes), with no elapsed-time check at all
-- for that branch — a real race against the two live writers that never
-- set analysis_locked_at (supabase/functions/brand-intelligence/handler.ts's
-- markIntakeStatus, app/src/mastra/workflows/brand-intelligence-workflow.ts's
-- extractProfile step). A legitimate analysis from either path could be
-- expired seconds after it started, and re-launched concurrently. Caught
-- independently by two review bots (Sentry-style Bug Prediction + Codex),
-- both citing the same root cause.
--
-- Fix: gate the NULL case by updated_at instead of analysis_locked_at — the
-- brands_set_updated_at trigger (20260614000000_ipix_platform_mvp.sql)
-- already stamps updated_at from Postgres now() on every write to this row,
-- including both untokened writers' own analysis_running writes, so it's a
-- reliable elapsed-time signal even without a lock timestamp.
--
-- Also clears analysis_lock_token/analysis_locked_at on expiry (2nd review
-- finding, Codex P2): without this, a token-tracked run's stale timestamp
-- survives being marked 'failed', and if the brand is restarted via a path
-- that doesn't set a fresh lock timestamp, the very next sweep would
-- immediately re-expire that new, legitimate run using the old timestamp.
--
-- Live-verified against 4 disposable rows: NULL+fresh-updated_at (left
-- running), NULL+old-updated_at (expired), old-token (expired, lock
-- cleared), fresh-token (left running, lock intact).

create or replace function public.expire_stale_brand_analysis()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.brands
    set intake_status = 'failed',
        analysis_lock_token = null,
        analysis_locked_at = null
    where intake_status = 'analysis_running'
      and (
        (analysis_locked_at is not null and analysis_locked_at < now() - interval '10 minutes')
        or (analysis_locked_at is null and updated_at < now() - interval '10 minutes')
      )
    returning id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;
