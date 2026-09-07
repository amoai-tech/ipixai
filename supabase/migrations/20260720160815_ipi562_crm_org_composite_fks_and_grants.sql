-- IPI-562 · CRM-UX-005 Phase 0 — org-consistent CRM FKs + least-privilege grants
-- Precedent: campaigns UNIQUE (org_id, id) + composite FK (20260707100000_ipi268_campaigns_schema.sql)
-- Live check 2026-07-20: zero cross-org orphan rows on contacts/deals/activities.

-- ── 1. Parent uniqueness for composite FK targets ───────────────────────────
alter table public.crm_companies
  add constraint uq_crm_companies_org_id_id unique (org_id, id);

alter table public.crm_contacts
  add constraint uq_crm_contacts_org_id_id unique (org_id, id);

alter table public.crm_deals
  add constraint uq_crm_deals_org_id_id unique (org_id, id);

-- ── 2. Replace UUID-only FKs with (org_id, …) composites ────────────────────
alter table public.crm_contacts
  drop constraint if exists crm_contacts_company_id_fkey;

alter table public.crm_contacts
  add constraint crm_contacts_org_company_fkey
  foreign key (org_id, company_id)
  references public.crm_companies (org_id, id)
  on delete cascade;

alter table public.crm_deals
  drop constraint if exists crm_deals_company_id_fkey;

alter table public.crm_deals
  add constraint crm_deals_org_company_fkey
  foreign key (org_id, company_id)
  references public.crm_companies (org_id, id)
  on delete cascade;

alter table public.crm_activities
  drop constraint if exists crm_activities_company_id_fkey;

alter table public.crm_activities
  drop constraint if exists crm_activities_contact_id_fkey;

alter table public.crm_activities
  drop constraint if exists crm_activities_deal_id_fkey;

-- MATCH SIMPLE (default): NULL anchor columns skip that composite FK check.
alter table public.crm_activities
  add constraint crm_activities_org_company_fkey
  foreign key (org_id, company_id)
  references public.crm_companies (org_id, id)
  on delete cascade;

alter table public.crm_activities
  add constraint crm_activities_org_contact_fkey
  foreign key (org_id, contact_id)
  references public.crm_contacts (org_id, id)
  on delete cascade;

alter table public.crm_activities
  add constraint crm_activities_org_deal_fkey
  foreign key (org_id, deal_id)
  references public.crm_deals (org_id, id)
  on delete cascade;

-- ── 3. Least-privilege grants ─────────────────────────────────────────────
revoke all on table public.crm_companies from anon;
revoke all on table public.crm_contacts from anon;
revoke all on table public.crm_deals from anon;
revoke all on table public.crm_activities from anon;

revoke all on table public.crm_companies from authenticated;
revoke all on table public.crm_contacts from authenticated;
revoke all on table public.crm_deals from authenticated;
revoke all on table public.crm_activities from authenticated;

grant select, insert, update, delete on table public.crm_companies to authenticated;
grant select, insert, update, delete on table public.crm_contacts to authenticated;
grant select, insert, update, delete on table public.crm_deals to authenticated;
grant select, insert, update, delete on table public.crm_activities to authenticated;

-- ── 4. Policies: explicit TO authenticated (replace {public}) ─────────────
drop policy if exists crm_companies_select_org on public.crm_companies;
drop policy if exists crm_companies_insert_org on public.crm_companies;
drop policy if exists crm_companies_update_org on public.crm_companies;
drop policy if exists crm_companies_delete_owner on public.crm_companies;

create policy crm_companies_select_org on public.crm_companies
  for select to authenticated
  using (is_org_member(org_id));
create policy crm_companies_insert_org on public.crm_companies
  for insert to authenticated
  with check (is_org_member(org_id));
create policy crm_companies_update_org on public.crm_companies
  for update to authenticated
  using (is_org_member(org_id))
  with check (is_org_member(org_id));
create policy crm_companies_delete_owner on public.crm_companies
  for delete to authenticated
  using (is_org_owner(org_id));

drop policy if exists crm_contacts_select_org on public.crm_contacts;
drop policy if exists crm_contacts_insert_org on public.crm_contacts;
drop policy if exists crm_contacts_update_org on public.crm_contacts;
drop policy if exists crm_contacts_delete_owner on public.crm_contacts;

create policy crm_contacts_select_org on public.crm_contacts
  for select to authenticated
  using (is_org_member(org_id));
create policy crm_contacts_insert_org on public.crm_contacts
  for insert to authenticated
  with check (is_org_member(org_id));
create policy crm_contacts_update_org on public.crm_contacts
  for update to authenticated
  using (is_org_member(org_id))
  with check (is_org_member(org_id));
create policy crm_contacts_delete_owner on public.crm_contacts
  for delete to authenticated
  using (is_org_owner(org_id));

drop policy if exists crm_deals_select_org on public.crm_deals;
drop policy if exists crm_deals_insert_org on public.crm_deals;
drop policy if exists crm_deals_update_org on public.crm_deals;
drop policy if exists crm_deals_delete_owner on public.crm_deals;

create policy crm_deals_select_org on public.crm_deals
  for select to authenticated
  using (is_org_member(org_id));
create policy crm_deals_insert_org on public.crm_deals
  for insert to authenticated
  with check (is_org_member(org_id));
create policy crm_deals_update_org on public.crm_deals
  for update to authenticated
  using (is_org_member(org_id))
  with check (is_org_member(org_id));
create policy crm_deals_delete_owner on public.crm_deals
  for delete to authenticated
  using (is_org_owner(org_id));

drop policy if exists crm_activities_select_org on public.crm_activities;
drop policy if exists crm_activities_insert_org on public.crm_activities;
drop policy if exists crm_activities_update_org on public.crm_activities;
drop policy if exists crm_activities_delete_owner on public.crm_activities;

create policy crm_activities_select_org on public.crm_activities
  for select to authenticated
  using (is_org_member(org_id));
create policy crm_activities_insert_org on public.crm_activities
  for insert to authenticated
  with check (is_org_member(org_id));
create policy crm_activities_update_org on public.crm_activities
  for update to authenticated
  using (is_org_member(org_id))
  with check (is_org_member(org_id));
create policy crm_activities_delete_owner on public.crm_activities
  for delete to authenticated
  using (is_org_owner(org_id));
