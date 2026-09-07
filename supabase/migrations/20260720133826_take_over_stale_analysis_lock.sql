-- IPI-745: atomic stale analysis_running lock takeover.
-- SECURITY INVOKER: runs as the calling role, brands_update_org RLS policy
-- still applies (same authorization boundary as reanalyzeBrand's direct
-- .update() calls) — this function does not bypass RLS.
--
-- Staleness is compared against Postgres now(), not app-server clock, inside
-- the same atomic UPDATE that performs the takeover, so a caller cannot win
-- a takeover on a lock that looked stale a moment ago but was just refreshed.
--
-- Returns true only if this call's UPDATE actually matched a row: the brand
-- must still be analysis_running, still hold p_expected_token (nobody else
-- has already taken it over), and its lock must still be older than the
-- threshold at the instant of the write. Exactly one concurrent caller can
-- ever see true for the same expected token, since Postgres serializes
-- concurrent UPDATEs against the same row.
create or replace function public.take_over_stale_analysis_lock(
  p_brand_id uuid,
  p_expected_token uuid,
  p_new_token uuid,
  p_stale_after_seconds integer default 300
)
returns boolean
language sql
security invoker
set search_path = public
as $$
  with updated as (
    update public.brands
    set intake_status = 'analysis_running',
        analysis_lock_token = p_new_token,
        analysis_locked_at = now()
    where id = p_brand_id
      and intake_status = 'analysis_running'
      and analysis_lock_token = p_expected_token
      and analysis_locked_at < now() - make_interval(secs => p_stale_after_seconds)
    returning id
  )
  select exists (select 1 from updated);
$$;

comment on function public.take_over_stale_analysis_lock(uuid, uuid, uuid, integer) is
  'IPI-745: atomic CAS takeover of a stale analysis_running lock on brands. SECURITY INVOKER — subject to brands_update_org RLS.';

revoke all on function public.take_over_stale_analysis_lock(uuid, uuid, uuid, integer) from public;
grant execute on function public.take_over_stale_analysis_lock(uuid, uuid, uuid, integer) to authenticated;
