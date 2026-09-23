-- IPI-1311 · AUTH-ORG-SINGLE-001 — Keep Each iPix User in One Organization for MVP
--
-- Enforces the MVP tenancy invariant: one authenticated user has at most one
-- public.org_members row. Organizations keep supporting many users and many
-- brands; only per-user membership cardinality is constrained.
--
-- Preconditions: the live duplicate-membership reconciliation (Step 1 of
-- IPI-1311) must already be complete before this migration is applied —
-- the preflight guard below raises and aborts if any duplicates remain, so
-- this migration can never silently mask an unreconciled duplicate.
--
-- Also fixes a real latent bug in auto_add_org_owner() (IPI-16): its
-- `on conflict do nothing` had no explicit target, so once org_members(user_id)
-- becomes unique, a user who already has a membership elsewhere would have
-- their new-org owner-membership insert silently swallowed — leaving a
-- partial organization with zero members. Scoping the conflict target to the
-- original (org_id, user_id) primary key preserves that key's harmless
-- idempotency (org_id is always freshly generated here, so it can never
-- actually conflict) while letting a genuine org_members_user_id_key
-- violation raise and abort the whole transaction atomically — no org is
-- left without an owner.
--
-- Rollback:
--   alter table public.org_members drop constraint if exists org_members_user_id_key;
--   create or replace function public.auto_add_org_owner()
--   returns trigger language plpgsql security definer set search_path = public as $$
--   begin
--     insert into public.org_members (org_id, user_id, role)
--     values (new.id, new.owner_id, 'owner')
--     on conflict do nothing;
--     return new;
--   end;
--   $$;

do $$
declare
  v_duplicate_count int;
begin
  select count(*) into v_duplicate_count
  from (
    select user_id from public.org_members group by user_id having count(*) > 1
  ) dup;

  if v_duplicate_count > 0 then
    raise exception
      'IPI-1311: % user(s) still have more than one org_members row; reconcile before applying this migration',
      v_duplicate_count;
  end if;
end $$;

alter table public.org_members
  add constraint org_members_user_id_key unique (user_id);

create or replace function public.auto_add_org_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.org_members (org_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (org_id, user_id) do nothing;
  return new;
end;
$$;
