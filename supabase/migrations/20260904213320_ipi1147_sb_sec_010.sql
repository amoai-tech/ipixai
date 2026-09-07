-- IPI-1147 · SPEC — Remove Unexpected Supabase Privileged Function Access and Prove Tenant-Safe RPCs
--
-- Purpose (forward-only; do not edit applied history):
--   1) Revoke direct EXECUTE on talent.log_booking_status_change() from
--      PUBLIC / anon / authenticated. It is a SECURITY DEFINER trigger
--      function (trg_bookings_log_status_change on talent.bookings), not a
--      client RPC — the trigger path fires as the table owner regardless of
--      direct EXECUTE grants, so revoking direct EXECUTE does not stop the
--      trigger. service_role keeps EXECUTE for any server-side callers.
--   2) Retarget the 8 campaigns / campaign_deliverables RLS policies from the
--      implicit `public` role (empty polroles = all roles incl. anon) to
--      `authenticated`, preserving the existing predicates
--      (is_org_member(...) and the brand-owner / assigned_to checks) and
--      adding an is_org_member check on the resulting campaign_id to the
--      deliverable UPDATE with-check so a row cannot be reparented into
--      another organization's campaign.
--
-- Does NOT: mass-revoke the 34 authenticated SECURITY DEFINER RPCs; redesign
-- the trigger function; change policy predicates; touch performance/indexes;
-- alter Mastra vendor schema.

-- ---------------------------------------------------------------------------
-- 1) Trigger function direct EXECUTE
-- ---------------------------------------------------------------------------

revoke execute on function talent.log_booking_status_change()
  from public, anon, authenticated;

-- Every role is implicitly a member of PUBLIC, so the revoke above also
-- removed service_role's inherited EXECUTE. Restore it explicitly for
-- server-side callers (the trigger path fires as the table owner regardless).
grant execute on function talent.log_booking_status_change() to service_role;

-- ---------------------------------------------------------------------------
-- 2) Campaign RLS role targeting: public (implicit) -> authenticated
-- ---------------------------------------------------------------------------

-- campaigns
drop policy if exists campaigns_select_org_member on public.campaigns;
drop policy if exists campaigns_insert_org_member on public.campaigns;
drop policy if exists campaigns_update_org_member on public.campaigns;
drop policy if exists campaigns_delete_org_member on public.campaigns;

create policy campaigns_select_org_member
  on public.campaigns
  for select
  to authenticated
  using (is_org_member(org_id));

create policy campaigns_insert_org_member
  on public.campaigns
  for insert
  to authenticated
  with check (is_org_member(org_id));

create policy campaigns_update_org_member
  on public.campaigns
  for update
  to authenticated
  using (
    is_org_member(org_id)
    and (select auth.uid()) = (select user_id from public.brands where brands.id = campaigns.brand_id)
  )
  with check (
    is_org_member(org_id)
    and (select auth.uid()) = (select user_id from public.brands where brands.id = campaigns.brand_id)
  );

create policy campaigns_delete_org_member
  on public.campaigns
  for delete
  to authenticated
  using (is_org_member(org_id));

-- campaign_deliverables
drop policy if exists campaign_deliverables_select_org_member on public.campaign_deliverables;
drop policy if exists campaign_deliverables_insert_org_member on public.campaign_deliverables;
drop policy if exists campaign_deliverables_update_assigned_or_owner on public.campaign_deliverables;
drop policy if exists campaign_deliverables_delete_org_member on public.campaign_deliverables;

create policy campaign_deliverables_select_org_member
  on public.campaign_deliverables
  for select
  to authenticated
  using (
    is_org_member(
      (select org_id from public.campaigns where campaigns.id = campaign_deliverables.campaign_id)
    )
  );

create policy campaign_deliverables_insert_org_member
  on public.campaign_deliverables
  for insert
  to authenticated
  with check (
    is_org_member(
      (select org_id from public.campaigns where campaigns.id = campaign_deliverables.campaign_id)
    )
  );

create policy campaign_deliverables_update_assigned_or_owner
  on public.campaign_deliverables
  for update
  to authenticated
  using (
    is_org_member(
      (select org_id from public.campaigns where campaigns.id = campaign_deliverables.campaign_id)
    )
  )
  with check (
    is_org_member(
      (select org_id from public.campaigns where campaigns.id = campaign_deliverables.campaign_id)
    )
    and (
      (select auth.uid()) = assigned_to
      or (select auth.uid()) = (
        select user_id from public.brands
        where brands.id = (
          select brand_id from public.campaigns
          where campaigns.id = campaign_deliverables.campaign_id
        )
      )
    )
  );

create policy campaign_deliverables_delete_org_member
  on public.campaign_deliverables
  for delete
  to authenticated
  using (
    is_org_member(
      (select org_id from public.campaigns where campaigns.id = campaign_deliverables.campaign_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Cross-org reparent invariant (schema-level, not just RLS)
-- ---------------------------------------------------------------------------
-- RLS with-check cannot see the OLD row, so a user who is a member of BOTH
-- org A and org B could reparent a deliverable from an org B campaign into an
-- org A campaign (is_org_member passes for both). Enforce at the schema level:
-- a deliverable's campaign may only change within the same organization.
create or replace function public.campaign_deliverables_block_cross_org_reparent()
returns trigger
language plpgsql
as $$
declare
  old_org uuid;
  new_org uuid;
begin
  if new.campaign_id is distinct from old.campaign_id then
    select org_id into old_org from public.campaigns where id = old.campaign_id;
    select org_id into new_org from public.campaigns where id = new.campaign_id;
    if old_org is null or new_org is null then
      raise exception 'campaign_deliverables reparent references unknown campaign (old=%, new=%)', old_org, new_org;
    end if;
    if old_org <> new_org then
      raise exception 'campaign_deliverables cannot be reparented across organizations';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_campaign_deliverables_block_cross_org_reparent on public.campaign_deliverables;
create trigger trg_campaign_deliverables_block_cross_org_reparent
  before update on public.campaign_deliverables
  for each row execute function public.campaign_deliverables_block_cross_org_reparent();