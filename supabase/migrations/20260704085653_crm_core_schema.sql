-- IPI-362 · CRM-DATA-001 — Schema + RLS: companies, contacts, deals, activities
-- Plan: docs/plan/tasks/2026-07-04-crm-schema-rls.md
-- Spec: tasks/crm/02-crm-architecture-brief.md §Database

-- ── Task 1: 4 core tables ───────────────────────────────────────────────

create table public.crm_companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  brand_id uuid references public.brands(id),
  name text not null,
  domain text,
  industry text,
  status text not null default 'prospect' check (status in ('prospect','active','inactive','lost')),
  source text,
  owner uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.crm_companies is 'CRM relationship-layer company record — prospect until brand_id is set via a won deal (IPI-367). Never FK into legacy fashion_brands.';

create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  company_id uuid references public.crm_companies(id),
  profile_id uuid references public.profiles(id),
  name text not null,
  email jsonb not null default '[]'::jsonb,
  phone jsonb not null default '[]'::jsonb,
  role_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.crm_contacts is 'CRM contact — email/phone are jsonb arrays of {value,type,primary}, not single columns.';
comment on column public.crm_contacts.email is 'jsonb array: [{"value":"a@b.com","type":"work","primary":true}]';
comment on column public.crm_contacts.phone is 'jsonb array, same shape as email';

create table public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  company_id uuid not null references public.crm_companies(id),
  stage text not null default 'lead' check (stage in ('lead','qualified','proposal','negotiation','won','lost')),
  value numeric,
  currency text not null default 'USD',
  shoot_id uuid references public.shoots(id),
  campaign_id uuid, -- FK inactive until IPI-268 campaigns table exists — do not add a constraint yet
  owner uuid references public.profiles(id),
  expected_close_date date,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.crm_deals is 'CRM pipeline unit. stage=won/lost may ONLY be set via api/crm/deals/[id]/convert (IPI-367) — enforced by crm_deals_guard_terminal_stage() below, not just app discipline.';

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  company_id uuid references public.crm_companies(id),
  contact_id uuid references public.crm_contacts(id),
  deal_id uuid references public.crm_deals(id),
  type text not null check (type in ('note','call','email','meeting','task','ai_summary')),
  body text,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_activities_anchor_check check (
    num_nonnulls(company_id, contact_id, deal_id) >= 1
  )
);
comment on table public.crm_activities is 'Unified CRM timeline — notes/calls/emails/meetings/tasks/AI summaries in one table by design. Task state is derived from due_at/completed_at, not a stored status column.';

-- Reuse existing handle_updated_at() trigger convention (verified live, no-arg, safe to reuse as-is)
create trigger crm_companies_updated_at before update on public.crm_companies
  for each row execute function public.handle_updated_at();
create trigger crm_contacts_updated_at before update on public.crm_contacts
  for each row execute function public.handle_updated_at();
create trigger crm_deals_updated_at before update on public.crm_deals
  for each row execute function public.handle_updated_at();
create trigger crm_activities_updated_at before update on public.crm_activities
  for each row execute function public.handle_updated_at();

-- ── Task 2: won/lost DB-level guard trigger ────────────────────────────

create or replace function public.crm_deals_guard_terminal_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stage in ('won', 'lost') and old.stage not in ('won', 'lost') then
    if coalesce(current_setting('app.crm_convert', true), '') <> '1' then
      raise exception 'crm_deals.stage may only be set to won/lost via api/crm/deals/[id]/convert (IPI-367)';
    end if;
  end if;
  return new;
end;
$$;
comment on function public.crm_deals_guard_terminal_stage() is 'Defense-in-depth for IPI-367: rejects any UPDATE setting stage=won/lost unless app.crm_convert=1 is set in the same transaction by the convert route.';

create trigger crm_deals_terminal_stage_guard
  before update on public.crm_deals
  for each row execute function public.crm_deals_guard_terminal_stage();

-- ── Task 3: RLS policies — all 4 tables, written out explicitly ────────

alter table public.crm_companies enable row level security;
create policy crm_companies_select_org on public.crm_companies
  for select using (is_org_member(org_id));
create policy crm_companies_insert_org on public.crm_companies
  for insert with check (is_org_member(org_id));
create policy crm_companies_update_org on public.crm_companies
  for update using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy crm_companies_delete_owner on public.crm_companies
  for delete using (is_org_owner(org_id));

alter table public.crm_contacts enable row level security;
create policy crm_contacts_select_org on public.crm_contacts
  for select using (is_org_member(org_id));
create policy crm_contacts_insert_org on public.crm_contacts
  for insert with check (is_org_member(org_id));
create policy crm_contacts_update_org on public.crm_contacts
  for update using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy crm_contacts_delete_owner on public.crm_contacts
  for delete using (is_org_owner(org_id));

alter table public.crm_deals enable row level security;
create policy crm_deals_select_org on public.crm_deals
  for select using (is_org_member(org_id));
create policy crm_deals_insert_org on public.crm_deals
  for insert with check (is_org_member(org_id));
create policy crm_deals_update_org on public.crm_deals
  for update using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy crm_deals_delete_owner on public.crm_deals
  for delete using (is_org_owner(org_id));

alter table public.crm_activities enable row level security;
create policy crm_activities_select_org on public.crm_activities
  for select using (is_org_member(org_id));
create policy crm_activities_insert_org on public.crm_activities
  for insert with check (is_org_member(org_id));
create policy crm_activities_update_org on public.crm_activities
  for update using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy crm_activities_delete_owner on public.crm_activities
  for delete using (is_org_owner(org_id));

-- ── Task 4: extend public.notifications — resolved decision ────────────
-- kind itself needs no migration (unconstrained text). The blocker was the
-- recipient CHECK, which had no slot for a CRM deal. Add one, additively.

alter table public.notifications
  add column crm_deal_id uuid references public.crm_deals(id);

alter table public.notifications
  drop constraint notifications_at_least_one_recipient;

alter table public.notifications
  add constraint notifications_at_least_one_recipient
  check (num_nonnulls(brand_org_id, talent_profile_id, agency_org_id, crm_deal_id) >= 1);

comment on column public.notifications.crm_deal_id is 'IPI-362 Task 4: CRM notification recipient anchor (deal_stage_changed, follow_up_due). Nullable — existing booking/talent rows unaffected.';;
