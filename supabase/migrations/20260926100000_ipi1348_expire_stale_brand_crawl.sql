-- IPI-1348 · BRAND-INTEL-PROD-002 — let a stale crawl become retryable.
--
-- validateBrand claims a brand by setting intake_status = 'crawl_running',
-- and its duplicate-run guard refuses every running state with no time
-- limit. If the run dies before the crawl starts (or the crawl never
-- reports back), the brand stays 'crawl_running' forever and the Brand page
-- never shows Retry. Live on 2026-09-26 one brand had been stuck since
-- 2026-09-22.
--
-- Extend the existing function (already run every 2 minutes by the
-- expire-stale-brand-analysis cron) instead of adding a new cron, table or
-- worker. brands.updated_at is stamped by brands_set_updated_at on the claim
-- and is not touched while Firecrawl works, so it marks when the crawl
-- started. 60 minutes is well above the slowest crawl seen in production
-- (21 minutes for 10 pages). 'crawl_complete' is left alone on purpose: it
-- can still be resumed by the Firecrawl webhook retry.
--
-- The analysis_running branch is unchanged from
-- 20260720170252_expire_stale_brand_analysis_null_grace_period.sql.

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
    where (
        intake_status = 'analysis_running'
        and (
          (analysis_locked_at is not null and analysis_locked_at < now() - interval '10 minutes')
          or (analysis_locked_at is null and updated_at < now() - interval '10 minutes')
        )
      )
      or (
        intake_status = 'crawl_running'
        and updated_at < now() - interval '60 minutes'
      )
    returning id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;
