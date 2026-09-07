-- IPI-745 review fix (PR #548): the original take_over_stale_analysis_lock
-- required a non-null analysis_lock_token/analysis_locked_at to even attempt
-- takeover. That makes any brand stuck as analysis_running with a NULL lock
-- (a pre-IPI-744 legacy row, or any future bug that clears the columns
-- without also clearing intake_status) PERMANENTLY unrecoverable — exactly
-- the class of bug this ticket exists to fix. Fix: treat a NULL
-- analysis_locked_at as maximally stale (always eligible for takeover), and
-- match analysis_lock_token via IS NOT DISTINCT FROM so a NULL-token legacy
-- row can be taken over too. Still fully atomic and still exactly-one-winner
-- under concurrency — the UPDATE's WHERE clause is re-evaluated per row at
-- write time either way.
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
      and analysis_lock_token is not distinct from p_expected_token
      and (
        analysis_locked_at is null
        or analysis_locked_at < now() - make_interval(secs => p_stale_after_seconds)
      )
    returning id
  )
  select exists (select 1 from updated);
$$;

comment on function public.take_over_stale_analysis_lock(uuid, uuid, uuid, integer) is
  'IPI-745: atomic CAS takeover of a stale (or NULL-timestamp legacy/corrupted) analysis_running lock on brands. SECURITY INVOKER — subject to brands_update_org RLS.';

-- Review nitpick fix: stamp analysis_locked_at from Postgres now() whenever
-- analysis_lock_token is set to a non-null value, regardless of write path.
-- Removes reliance on app-server clock for the fresh-acquire path so it uses
-- the same time source as the stale-takeover RPC's own staleness check.
create or replace function public.stamp_analysis_locked_at()
returns trigger
language plpgsql
as $$
begin
  new.analysis_locked_at := now();
  return new;
end;
$$;

drop trigger if exists brands_stamp_analysis_locked_at on public.brands;
create trigger brands_stamp_analysis_locked_at
  before update on public.brands
  for each row
  when (
    new.analysis_lock_token is distinct from old.analysis_lock_token
    and new.analysis_lock_token is not null
  )
  execute function public.stamp_analysis_locked_at();

comment on trigger brands_stamp_analysis_locked_at on public.brands is
  'IPI-745: analysis_locked_at is always DB time, never app-server clock, whenever analysis_lock_token is set.';
