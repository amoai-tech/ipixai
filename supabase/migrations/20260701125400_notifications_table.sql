-- IPI-307 · MODEL-P1 — notifications table.
--
-- Documented in docs/architecture/05-supabase-data-architecture.md:215 but never
-- actually migrated (verified — no prior migration creates it). Genuinely new
-- work, not a reuse, despite the shape already being specced there. Kept in
-- `public` (not the `talent` schema) since it's cross-feature by design, not
-- Model-Booking-specific — this is just its first real consumer.
--
-- Rollback: `drop table if exists public.notifications;`

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  channel text not null default 'in-app' check (channel in ('in-app', 'email')),
  read boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  brand_org_id uuid references public.organizations(id) on delete cascade,
  talent_profile_id uuid references talent.talent_profiles(id) on delete cascade,
  agency_org_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint notifications_at_least_one_recipient
    check (num_nonnulls(brand_org_id, talent_profile_id, agency_org_id) >= 1)
);
create index idx_notifications_brand_org_id on public.notifications(brand_org_id, created_at desc) where brand_org_id is not null;
create index idx_notifications_talent_profile_id on public.notifications(talent_profile_id, created_at desc) where talent_profile_id is not null;
create index idx_notifications_agency_org_id on public.notifications(agency_org_id, created_at desc) where agency_org_id is not null;

alter table public.notifications enable row level security;

create policy notifications_select_recipient on public.notifications
  for select to authenticated
  using (
    (brand_org_id is not null and public.is_org_member(brand_org_id))
    or (agency_org_id is not null and public.is_org_member(agency_org_id))
    or (talent_profile_id is not null and talent_profile_id in (
      select id from talent.talent_profiles where profile_id = (select auth.uid())
    ))
  );

-- Mark-as-read only — inserts happen via the bookings trigger / service role,
-- never a direct client insert (prevents a client spoofing its own notifications).
create policy notifications_update_read_state on public.notifications
  for update to authenticated
  using (
    (brand_org_id is not null and public.is_org_member(brand_org_id))
    or (agency_org_id is not null and public.is_org_member(agency_org_id))
    or (talent_profile_id is not null and talent_profile_id in (
      select id from talent.talent_profiles where profile_id = (select auth.uid())
    ))
  )
  with check (true);

grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
