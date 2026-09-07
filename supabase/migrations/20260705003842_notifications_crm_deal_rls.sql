-- IPI-362 Task 4 follow-up — notifications RLS for crm_deal_id recipient anchor.
--
-- IPI-362 added crm_deal_id + extended CHECK but left SELECT/UPDATE policies and
-- the immutability trigger on IPI-307/IPI-335 paths only. Rows with deal-only
-- recipient were invisible to authenticated clients.
--
-- Rollback:
--   drop index if exists idx_notifications_crm_deal_id;
--   -- restore policies/trigger from 20260701135900_notifications_rls_tighten.sql

drop policy if exists notifications_select_recipient on public.notifications;
drop policy if exists notifications_update_read_state on public.notifications;

create policy notifications_select_recipient on public.notifications
  for select to authenticated
  using (
    (brand_org_id is not null and public.is_org_member(brand_org_id))
    or (agency_org_id is not null and public.is_org_member(agency_org_id))
    or (talent_profile_id is not null and talent_profile_id in (
      select id from talent.talent_profiles where profile_id = (select auth.uid())
    ))
    or (
      crm_deal_id is not null
      and crm_deal_id in (
        select d.id
        from public.crm_deals d
        where public.is_org_member(d.org_id)
      )
    )
  );

create policy notifications_update_read_state on public.notifications
  for update to authenticated
  using (
    (brand_org_id is not null and public.is_org_member(brand_org_id))
    or (agency_org_id is not null and public.is_org_member(agency_org_id))
    or (talent_profile_id is not null and talent_profile_id in (
      select id from talent.talent_profiles where profile_id = (select auth.uid())
    ))
    or (
      crm_deal_id is not null
      and crm_deal_id in (
        select d.id
        from public.crm_deals d
        where public.is_org_member(d.org_id)
      )
    )
  )
  with check (
    (brand_org_id is not null and public.is_org_member(brand_org_id))
    or (agency_org_id is not null and public.is_org_member(agency_org_id))
    or (talent_profile_id is not null and talent_profile_id in (
      select id from talent.talent_profiles where profile_id = (select auth.uid())
    ))
    or (
      crm_deal_id is not null
      and crm_deal_id in (
        select d.id
        from public.crm_deals d
        where public.is_org_member(d.org_id)
      )
    )
  );

create or replace function public.notifications_lock_immutable_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind is distinct from old.kind
     or new.payload is distinct from old.payload
     or new.brand_org_id is distinct from old.brand_org_id
     or new.talent_profile_id is distinct from old.talent_profile_id
     or new.agency_org_id is distinct from old.agency_org_id
     or new.crm_deal_id is distinct from old.crm_deal_id
  then
    raise exception 'notifications: only the read column may be updated';
  end if;
  return new;
end;
$$;

create index if not exists idx_notifications_crm_deal_id
  on public.notifications (crm_deal_id, created_at desc)
  where crm_deal_id is not null;;
