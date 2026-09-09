-- IPI-1161 post-merge reconciliation: make fresh replay match the intended
-- live public Data API schema without changing private shoot ownership.
--
-- Deployment and recovery:
--   docs/supabase/ipi-1161-reconciliation-deployment.md
--
-- The preflight runs before any DDL and fails closed when an environment has
-- nullable image-spec identifiers or data in the retired singular schedule
-- table. The explicit transaction also restores the dropped foreign key and
-- prior nullability automatically if any later statement or restrict check
-- fails.

begin;

do $$
declare
  event_schedule_has_rows boolean;
begin
  if exists (
    select 1
    from public.image_specs
    where platform_id is null
       or image_type_id is null
  ) then
    raise exception
      'IPI-1161 blocked: public.image_specs contains null platform_id or image_type_id values';
  end if;

  -- The table is already absent in the verified live schema, so use dynamic
  -- SQL only when it exists in a replay or another target environment.
  if to_regclass('public.event_schedule') is not null then
    execute 'select exists (select 1 from public.event_schedule)'
      into event_schedule_has_rows;

    if event_schedule_has_rows then
      raise exception
        'IPI-1161 blocked: public.event_schedule contains rows; preserve and reconcile them before retrying';
    end if;
  end if;

  if exists (
    select 1
    from public.call_times
    where schedule_item_id is not null
  ) then
    raise exception
      'IPI-1161 blocked: public.call_times still contains schedule_item_id pointers; reconcile them before retrying';
  end if;
end
$$;

alter table public.brands
  add column if not exists approved_profile_at timestamptz;

alter table public.image_specs
  alter column platform_id set not null,
  alter column image_type_id set not null;

-- Live production keeps schedule_item_id as a nullable legacy pointer but no
-- longer enforces the FK to the retired singular event_schedule table.
alter table public.call_times
  drop constraint if exists call_times_schedule_item_id_fkey;

-- RESTRICT is intentional: an unexpected external dependency aborts the
-- transaction instead of being removed with the retired table.
drop table if exists public.event_schedule restrict;

-- Legacy application audit table. This is intentionally distinct from the
-- Supabase CLI migration ledger at supabase_migrations.schema_migrations.
create table if not exists public.supabase_migrations (
  version text primary key,
  name text not null,
  statements text not null,
  checksum text not null,
  executed_at timestamptz not null
);

alter table public.supabase_migrations enable row level security;

drop policy if exists "Only service role can access migrations"
  on public.supabase_migrations;
create policy "Only service role can access migrations"
  on public.supabase_migrations
  for all
  to service_role
  using (true)
  with check (true);

commit;
