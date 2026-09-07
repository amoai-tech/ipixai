-- IPI-745: recover brands stuck in analysis_running forever via a pg_cron
-- sweep, matching the existing expire_stale_bookings pattern (IPI-307,
-- 20260701125600_expire_stale_bookings_cron.sql) — expiry is a deterministic
-- time-based transition, not a judgment call, so it belongs in a scheduled
-- job rather than a synchronous takeover RPC triggered by a user click.
--
-- Supersedes take_over_stale_analysis_lock (added live via
-- 20260720133826/20260720143048/20260720163043-uncommitted, never merged to
-- main). That RPC's null-tolerant predicate let ANY brand mid-analysis be
-- "taken over" as if abandoned, because two live writers —
-- supabase/functions/brand-intelligence/handler.ts's markIntakeStatus and
-- app/src/mastra/workflows/brand-intelligence-workflow.ts's extractProfile
-- step — mark intake_status = 'analysis_running' without ever setting
-- analysis_lock_token/analysis_locked_at. A real duplicate-analysis
-- regression, caught in review before PR #548 merged.
--
-- A cron sweep needs no token from those writers at all: it resets
-- truly-abandoned rows by elapsed time using the already-existing
-- analysis_locked_at column (20260720114712_brands_analysis_lock_token,
-- IPI-744). Rows with a NULL analysis_locked_at (the untokened writers
-- above) are treated as eligible too, once older than the same threshold —
-- otherwise those write paths would stay stuck forever exactly like the
-- original bug. 10 minutes is 5x the longest explicit timeout anywhere in
-- this pipeline (brand-intelligence-workflow's AbortSignal.timeout(120_000)
-- on its edge-function call), so it should never sweep a legitimately
-- in-flight analysis.
--
-- Once intake_status is no longer 'analysis_running', the EXISTING
-- fresh-acquire guard in reanalyzeBrand (app/src/app/(operator)/app/brand/
-- [id]/actions.ts, already on main via IPI-744/PR #536) handles recovery
-- correctly on its own — no app code changes needed for this fix.
--
-- Rollback:
--   select cron.unschedule('expire-stale-brand-analysis');
--   drop function if exists public.expire_stale_brand_analysis();

drop function if exists public.take_over_stale_analysis_lock(uuid, uuid, uuid, integer);

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
    set intake_status = 'failed'
    where intake_status = 'analysis_running'
      and (
        analysis_locked_at is null
        or analysis_locked_at < now() - interval '10 minutes'
      )
    returning id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;

revoke all on function public.expire_stale_brand_analysis() from public, anon, authenticated;
grant execute on function public.expire_stale_brand_analysis() to service_role;

select cron.schedule(
  'expire-stale-brand-analysis',
  '*/2 * * * *', -- every 2 minutes
  $$select public.expire_stale_brand_analysis();$$
);
