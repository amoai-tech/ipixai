-- IPI-1074 · PLANS-001 — CI seed for the read-contract proof.
-- Creates a minimal production-shaped planner schema + roles + auth.uid +
-- is_org_member + is_at_least so the migration's SECURITY DEFINER RPCs can
-- apply and be exercised exactly as CI does (postgres:17, psql ON_ERROR_STOP).
-- Runner: .github/workflows/ci.yml job plans-001-read-contract-acl.

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
  if not exists (select 1 from pg_roles where rolname = 'ci_acl_probe') then
    create role ci_acl_probe nologin nosuperuser;
  end if;
end
$roles$;

create schema if not exists auth;
create schema if not exists planner;

-- JWT claim bridge used by production is_org_member / is_at_least / RPCs.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid()
);

create table if not exists public.org_members (
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null,
  primary key (org_id, user_id)
);

grant select on table public.orgs to authenticated;
grant select on table public.org_members to authenticated;

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

grant execute on function public.is_org_member(uuid) to authenticated;

-- Minimal planner schema mirroring the columns the read RPCs touch.
create table if not exists planner.workflows (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  name        text not null,
  category    text not null,
  version     integer not null default 1,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists planner.phases (
  id                   uuid primary key default gen_random_uuid(),
  workflow_id          uuid not null references planner.workflows (id) on delete cascade,
  slug                 text not null,
  name                 text not null,
  order_index          integer not null,
  default_duration_days integer not null default 5,
  gate_type            text,
  required_role        text,
  created_at           timestamptz not null default now(),
  unique (workflow_id, slug)
);

create table if not exists planner.instances (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  workflow_id   uuid not null references planner.workflows (id) on delete restrict,
  entity_type   text not null check (entity_type in ('shoot', 'campaign', 'crm_deal')),
  entity_id     uuid not null,
  name          text not null,
  status        text not null default 'draft',
  planned_start date,
  planned_end   date,
  owner_user_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, entity_type, entity_id, workflow_id)
);

create table if not exists planner.tasks (
  id             uuid primary key default gen_random_uuid(),
  instance_id    uuid not null references planner.instances (id) on delete cascade,
  phase_id       uuid references planner.phases (id) on delete set null,
  parent_task_id uuid references planner.tasks (id) on delete set null,
  title          text not null,
  description    text,
  start_date     date,
  end_date       date,
  duration_days  integer,
  status         text not null default 'todo',
  priority       text not null default 'medium',
  assignee_user_id uuid,
  assignee_role  text,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists planner.dependencies (
  id           uuid primary key default gen_random_uuid(),
  instance_id  uuid not null references planner.instances (id) on delete cascade,
  from_task_id uuid not null references planner.tasks (id) on delete cascade,
  to_task_id   uuid not null references planner.tasks (id) on delete cascade,
  dep_type     text not null default 'finish_to_start',
  lag_days     integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (from_task_id, to_task_id),
  constraint dependencies_no_self_loop check (from_task_id <> to_task_id)
);

create table if not exists planner.assignments (
  id             uuid primary key default gen_random_uuid(),
  instance_id    uuid not null references planner.instances (id) on delete cascade,
  user_id        uuid not null,
  role           text not null check (role in ('owner', 'manager', 'contributor', 'viewer')),
  permissions    jsonb,
  created_at     timestamptz not null default now(),
  unique (instance_id, user_id)
);

create table if not exists planner.gate_approvals (
  id              uuid primary key default gen_random_uuid(),
  instance_id     uuid not null references planner.instances (id) on delete cascade,
  phase_id        uuid not null references planner.phases (id) on delete cascade,
  status          text not null check (status in ('reachable', 'approved', 'discarded')),
  approved_by     uuid,
  approved_at     timestamptz,
  updated_at      timestamptz not null default now(),
  unique (instance_id, phase_id)
);

create table if not exists planner.view_configs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  instance_id   uuid not null references planner.instances (id) on delete cascade,
  default_view  text not null default 'timeline',
  filters       jsonb not null default '{}'::jsonb,
  sort_config   jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, instance_id)
);

-- Production-shaped role hierarchy helper (SECURITY DEFINER + auth.uid).
create or replace function planner.is_at_least(
  p_instance_id uuid,
  p_min_role text
)
returns boolean
language sql
security definer
set search_path = planner, public
volatile
as $$
  select exists (
    select 1 from planner.assignments
    where instance_id = p_instance_id
      and user_id = (select auth.uid())
      and case p_min_role
        when 'viewer'      then true
        when 'contributor' then role in ('contributor', 'manager', 'owner')
        when 'manager'     then role in ('manager', 'owner')
        when 'owner'       then role = 'owner'
        else false
      end
  );
$$;

revoke all on function planner.is_at_least(uuid, text) from public, anon;
grant execute on function planner.is_at_least(uuid, text) to authenticated, service_role;