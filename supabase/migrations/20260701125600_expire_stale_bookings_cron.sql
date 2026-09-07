-- IPI-307 · MODEL-P1 — scheduled expiry job.
--
-- Expiry is a deterministic time-based transition, not a judgment call — it's
-- a pg_cron job, never a Mastra agent tool (notes-1.md reconciliation:
-- `expireBookingRequest` was explicitly rejected as an agent tool for this
-- reason — see 06-model-booking-implementation-plan.md §2a).
--
-- Rollback:
--   select cron.unschedule('expire-stale-bookings');
--   drop function if exists public.expire_stale_bookings();

create extension if not exists pg_cron;

create or replace function public.expire_stale_bookings()
returns integer
language plpgsql
security definer
set search_path = public, talent
as $$
declare
  v_count integer;
begin
  with expired as (
    update talent.bookings
    set status = 'expired'
    where status = 'requested'
      and expires_at < now()
    returning id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;

revoke all on function public.expire_stale_bookings() from public, anon, authenticated;
grant execute on function public.expire_stale_bookings() to service_role;

select cron.schedule(
  'expire-stale-bookings',
  '0 * * * *', -- hourly
  $$select public.expire_stale_bookings();$$
);
