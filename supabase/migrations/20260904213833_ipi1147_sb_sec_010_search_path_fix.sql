-- IPI-1147 · SPEC — Remove Unexpected Supabase Privileged Function Access and Prove Tenant-Safe RPCs
-- Follow-up: pin search_path on the cross-org reparent trigger function.
--
-- The IPI-1147 migration created public.campaign_deliverables_block_cross_org_reparent()
-- without SET search_path, which the Security Advisor flags as
-- function_search_path_mutable. The function body fully schema-qualifies all
-- references (public.campaigns), so an empty search_path is safe and matches
-- the repo's hardened-function convention.

create or replace function public.campaign_deliverables_block_cross_org_reparent()
returns trigger
language plpgsql
set search_path = ''
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