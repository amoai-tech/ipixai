-- IPI-1161 post-merge reconciliation: make fresh replay match the intended
-- live public Data API schema without changing private shoot ownership.

alter table public.brands
  add column if not exists approved_profile_at timestamptz;

alter table public.image_specs
  alter column platform_id set not null,
  alter column image_type_id set not null;

-- Live production keeps schedule_item_id as a nullable legacy pointer but no
-- longer enforces the FK to the retired singular event_schedule table.
alter table public.call_times
  drop constraint if exists call_times_schedule_item_id_fkey;

drop table if exists public.event_schedule;

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
