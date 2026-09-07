-- IPI-268: Add campaigns + campaign_deliverables schema

-- 1. Enums
do $$ begin
  create type public.campaign_status as enum ('planning', 'active', 'live', 'complete');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.deliverable_status as enum ('pending', 'in_progress', 'review', 'approved', 'blocked');
exception
  when duplicate_object then null;
end $$;

-- 2. Helper functions
create or replace function public.set_updated_at()
returns trigger
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.check_campaign_org_consistency()
returns trigger
security definer
set search_path = 'public'
as $$
begin
  if new.org_id != (select org_id from public.brands where id = new.brand_id) then
    raise exception 'campaign.org_id (%) must match brand.org_id (%)', new.org_id, (select org_id from public.brands where id = new.brand_id);
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function public.block_brand_org_change()
returns trigger
security definer
set search_path = 'public'
as $$
begin
  if old.org_id is distinct from new.org_id then
    if exists (select 1 from public.campaigns where brand_id = old.id limit 1) then
      raise exception 'cannot change brand.org_id — campaign(s) reference this brand';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

-- 3. Tables
create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  brand_id    uuid not null references public.brands(id) on delete cascade,
  name        text not null,
  status      public.campaign_status not null default 'planning',
  objective   public.campaign_objective_type,
  start_date  date,
  end_date    date,
  cover_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_campaigns_org_id_id unique (org_id, id)
);

create table if not exists public.campaign_deliverables (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  phase       smallint not null check (phase between 1 and 12),
  label       text not null,
  status      public.deliverable_status not null default 'pending',
  due_date    date,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_campaign_deliverables_phase unique (campaign_id, phase)
);

-- 4. Indexes
create index if not exists idx_campaigns_org_id on public.campaigns(org_id);
create index if not exists idx_campaigns_brand_id on public.campaigns(brand_id);
create index if not exists idx_campaigns_status on public.campaigns(status) where status in ('planning', 'active');
create index if not exists idx_campaign_deliverables_assigned_to on public.campaign_deliverables(assigned_to);

-- 5. Triggers
drop trigger if exists set_campaigns_updated_at on public.campaigns;
create trigger set_campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

drop trigger if exists set_campaign_deliverables_updated_at on public.campaign_deliverables;
create trigger set_campaign_deliverables_updated_at
  before update on public.campaign_deliverables
  for each row execute function public.set_updated_at();

drop trigger if exists check_campaign_org_consistency on public.campaigns;
create trigger check_campaign_org_consistency
  before insert or update on public.campaigns
  for each row execute function public.check_campaign_org_consistency();

drop trigger if exists block_brand_org_change on public.brands;
create trigger block_brand_org_change
  before update of org_id on public.brands
  for each row execute function public.block_brand_org_change();

-- 6. RLS
alter table public.campaigns enable row level security;
alter table public.campaign_deliverables enable row level security;

-- campaigns policies
drop policy if exists "campaigns_select_org_member" on public.campaigns;
create policy "campaigns_select_org_member" on public.campaigns
  for select
  to authenticated
  using (is_org_member(org_id));

drop policy if exists "campaigns_insert_org_member" on public.campaigns;
create policy "campaigns_insert_org_member" on public.campaigns
  for insert
  to authenticated
  with check (is_org_member(org_id));

drop policy if exists "campaigns_update_org_member" on public.campaigns;
create policy "campaigns_update_org_member" on public.campaigns
  for update
  to authenticated
  using (
    is_org_member(org_id)
    and (select auth.uid()) = (select user_id from public.brands where id = campaigns.brand_id)
  )
  with check (is_org_member(org_id));

drop policy if exists "campaigns_delete_org_member" on public.campaigns;
create policy "campaigns_delete_org_member" on public.campaigns
  for delete
  to authenticated
  using (is_org_member(org_id));

-- campaign_deliverables policies
drop policy if exists "campaign_deliverables_select_org_member" on public.campaign_deliverables;
create policy "campaign_deliverables_select_org_member" on public.campaign_deliverables
  for select
  to authenticated
  using (
    is_org_member((select org_id from public.campaigns where id = campaign_id))
  );

drop policy if exists "campaign_deliverables_insert_org_member" on public.campaign_deliverables;
drop policy if exists "campaign_deliverables_insert_owner" on public.campaign_deliverables;
create policy "campaign_deliverables_insert_org_member" on public.campaign_deliverables
  for insert
  to authenticated
  with check (
    is_org_member((select org_id from public.campaigns where id = campaign_id))
  );

drop policy if exists "campaign_deliverables_update_assigned_or_owner" on public.campaign_deliverables;
create policy "campaign_deliverables_update_assigned_or_owner" on public.campaign_deliverables
  for update
  to authenticated
  using (
    is_org_member((select org_id from public.campaigns where id = campaign_id))
  )
  with check (
    assigned_to is null or (select auth.uid()) = assigned_to
    or (select auth.uid()) = (select user_id from public.brands where id = (select brand_id from public.campaigns where id = campaign_id))
  );

drop policy if exists "campaign_deliverables_delete_org_member" on public.campaign_deliverables;
drop policy if exists "campaign_deliverables_delete_owner" on public.campaign_deliverables;
create policy "campaign_deliverables_delete_org_member" on public.campaign_deliverables
  for delete
  to authenticated
  using (
    is_org_member((select org_id from public.campaigns where id = campaign_id))
  );

-- 7. FK repair: crm_deals.campaign_id with org_id cross-tenant guard
-- ON DELETE SET NULL (campaign_id) preserves not-null org_id when campaign is deleted
alter table crm_deals drop constraint if exists fk_crm_deals_campaign;
do $$ begin
  alter table crm_deals add constraint fk_crm_deals_campaign
    foreign key (org_id, campaign_id) references public.campaigns(org_id, id) on delete set null (campaign_id);
exception
  when duplicate_object then null;
end $$;
