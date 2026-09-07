-- IPI-V2-000 · SB-FIX-009 — Lock mutable search_path on timestamp trigger helpers.
--
-- public.stamp_analysis_locked_at / public.set_updated_at exist in repo migrations
-- and only stamp NEW fields — empty search_path is safe.
--
-- trigger_set_timestamps is created as mastra.trigger_set_timestamps()
-- (20260722093028_mastra_schema_pinned_1_12_0.sql). Keep its existing pin
-- (public, pg_temp); empty search_path is documented as unsafe for that body.
--
-- public.trigger_set_timestamps() exists on some remote catalogs only (not
-- created by git migrations). Guard so a Brand Hub / Mastra replay does not abort.
--
-- Rollback:
--   alter function public.stamp_analysis_locked_at() reset search_path;
--   alter function public.set_updated_at() reset search_path;
--   alter function mastra.trigger_set_timestamps() set search_path = public, pg_temp;
--   -- if present: alter function public.trigger_set_timestamps() reset search_path;

alter function public.stamp_analysis_locked_at() set search_path = '';
alter function public.set_updated_at() set search_path = '';
alter function mastra.trigger_set_timestamps() set search_path = public, pg_temp;

do $guard$
begin
  if to_regprocedure('public.trigger_set_timestamps()') is not null then
    execute 'alter function public.trigger_set_timestamps() set search_path = ''''';
  end if;
end
$guard$;
