-- IPI-1147 · SPEC — Remove Unexpected Supabase Privileged Function Access and Prove Tenant-Safe RPCs
-- CI-only seed for the IPI-1147 proofs.
-- Creates insecure pre-state matching production gaps, then the migration
-- hardens it. Includes production-shaped auth.uid / is_org_member / brands /
-- campaigns / campaign_deliverables / talent trigger so migration RLS applies.
--
-- IPI-1311 · AUTH-ORG-SINGLE-001 — this seed's public.org_members is a
-- minimal fixture-only table (org_id, user_id), never the real migrated
-- schema: the sb-sec-010-acl CI job runs against a bare Postgres service
-- container with no `supabase db reset --local` / migration replay, so the
-- one-membership-per-user unique(user_id) constraint added by IPI-1311 is
-- never present here. The user_dual fixture below (both org A and org B)
-- proves the schema-level cross-org reparent trigger, not tenancy
-- cardinality, and is unaffected by that invariant.

create extension if not exists pgcrypto;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$roles$;

create schema if not exists auth;
create schema if not exists talent;

grant usage on schema public to anon, authenticated;
grant usage on schema talent to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant usage on schema auth to anon, authenticated;

-- JWT claim bridge used by production is_org_member / policies.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated;

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid()
);

create table if not exists public.org_members (
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null,
  primary key (org_id, user_id)
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs (id),
  user_id uuid
);

grant select on table public.orgs to authenticated;
grant select on table public.org_members to authenticated;
grant select on table public.brands to authenticated;

-- Production-shaped helper (SECURITY DEFINER + auth.uid).
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id
      and user_id = (select auth.uid())
  );
$$;

-- Campaign tables (production shape).
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  brand_id uuid not null,
  name text not null,
  status text not null default 'planning',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_deliverables (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  phase smallint not null default 1,
  label text not null,
  status text not null default 'draft',
  assigned_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;
alter table public.campaign_deliverables enable row level security;

grant select, insert, update, delete on table public.campaigns to authenticated;
grant select, insert, update, delete on table public.campaign_deliverables to authenticated;
-- Production grants anon SELECT via the implicit PUBLIC role grant; RLS is the
-- only filter. Mirror that so the anon RLS check exercises the policy.
grant select on table public.campaigns to anon, public;
grant select on table public.campaign_deliverables to anon, public;

-- Insecure pre-state: policies target implicit public (empty polroles).
drop policy if exists campaigns_select_org_member on public.campaigns;
drop policy if exists campaigns_insert_org_member on public.campaigns;
drop policy if exists campaigns_update_org_member on public.campaigns;
drop policy if exists campaigns_delete_org_member on public.campaigns;

create policy campaigns_select_org_member on public.campaigns
  for select using (is_org_member(org_id));
create policy campaigns_insert_org_member on public.campaigns
  for insert with check (is_org_member(org_id));
create policy campaigns_update_org_member on public.campaigns
  for update
  using (is_org_member(org_id) and (select auth.uid()) = (select user_id from public.brands where brands.id = campaigns.brand_id))
  with check (is_org_member(org_id) and (select auth.uid()) = (select user_id from public.brands where brands.id = campaigns.brand_id));
create policy campaigns_delete_org_member on public.campaigns
  for delete using (is_org_member(org_id));

drop policy if exists campaign_deliverables_select_org_member on public.campaign_deliverables;
drop policy if exists campaign_deliverables_insert_org_member on public.campaign_deliverables;
drop policy if exists campaign_deliverables_update_assigned_or_owner on public.campaign_deliverables;
drop policy if exists campaign_deliverables_delete_org_member on public.campaign_deliverables;

create policy campaign_deliverables_select_org_member on public.campaign_deliverables
  for select using (is_org_member((select org_id from public.campaigns where campaigns.id = campaign_deliverables.campaign_id)));
create policy campaign_deliverables_insert_org_member on public.campaign_deliverables
  for insert with check (is_org_member((select org_id from public.campaigns where campaigns.id = campaign_deliverables.campaign_id)));
create policy campaign_deliverables_update_assigned_or_owner on public.campaign_deliverables
  for update
  using (is_org_member((select org_id from public.campaigns where campaigns.id = campaign_deliverables.campaign_id)))
  with check ((select auth.uid()) = assigned_to or (select auth.uid()) = (select user_id from public.brands where brands.id = (select brand_id from public.campaigns where campaigns.id = campaign_deliverables.campaign_id)));
create policy campaign_deliverables_delete_org_member on public.campaign_deliverables
  for delete using (is_org_member((select org_id from public.campaigns where campaigns.id = campaign_deliverables.campaign_id)));

-- Talent trigger function (production shape): SECURITY DEFINER, default PUBLIC EXECUTE.
create table if not exists talent.bookings (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function talent.log_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'talent', 'public'
as $$
begin
  return new;
end;
$$;

drop trigger if exists trg_bookings_log_status_change on talent.bookings;
create trigger trg_bookings_log_status_change
  after insert or update on talent.bookings
  for each row execute function talent.log_booking_status_change();