-- IPI-335 · MODEL-FIX — tighten notifications RLS update policy.
--
-- Fix-forward from IPI-307's post-push security advisor scan: the original
-- `notifications_update_read_state` policy (20260701125400_notifications_table.sql)
-- had `with check (true)` — the `using` clause correctly restricted which rows
-- an owner could touch, but the unconditional `with check` let a mark-as-read
-- update also rewrite any other column, including reassigning ownership
-- (brand_org_id/talent_profile_id/agency_org_id) or the kind/payload.
--
-- Does not edit the already-pushed 20260701125400 migration (never rewrite
-- applied remote history — this repo's own convention). New migration instead.
--
-- Rollback:
--   drop trigger if exists trg_notifications_lock_immutable_columns on public.notifications;
--   drop function if exists public.notifications_lock_immutable_columns();
--   drop policy if exists notifications_update_read_state on public.notifications;
--   -- (re-add the original with check (true) version only if truly reverting)

drop policy if exists notifications_update_read_state on public.notifications;

create policy notifications_update_read_state on public.notifications
  for update to authenticated
  using (
    (brand_org_id is not null and public.is_org_member(brand_org_id))
    or (agency_org_id is not null and public.is_org_member(agency_org_id))
    or (talent_profile_id is not null and talent_profile_id in (
      select id from talent.talent_profiles where profile_id = (select auth.uid())
    ))
  )
  with check (
    (brand_org_id is not null and public.is_org_member(brand_org_id))
    or (agency_org_id is not null and public.is_org_member(agency_org_id))
    or (talent_profile_id is not null and talent_profile_id in (
      select id from talent.talent_profiles where profile_id = (select auth.uid())
    ))
  );

-- Column lock: only `read` may ever change via UPDATE. RLS `with check` has no
-- clean way to compare against the pre-update row (no `old.` reference in a
-- policy expression) — a BEFORE UPDATE trigger is the standard, reliable way
-- to enforce column-level immutability. Applies to every role, not just
-- authenticated — there is no legitimate path that ever needs to change these
-- columns after insert.
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
  then
    raise exception 'notifications: only the read column may be updated';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notifications_lock_immutable_columns on public.notifications;
create trigger trg_notifications_lock_immutable_columns
  before update on public.notifications
  for each row execute function public.notifications_lock_immutable_columns();
