-- IPI-575 · PLN-DATA-001C — Planner member mutations: invite / role update / removal
--
-- Three SECURITY DEFINER RPCs, all public schema, mirroring crm_convert_deal's
-- pattern (search_path='', explicit checks, no reliance on RLS alone) plus
-- planner_get_my_assignment's hard-scoping precedent.
--
-- Caller authorization mirrors the live RLS convention on planner.assignments,
-- refined to a "manager acts below manager, owner acts on anyone" hierarchy:
--   - INSERT (invite): caller >= manager (matches assignments_insert_manager RLS)
--   - UPDATE/DELETE (role change / removal) of an existing row: caller >= manager
--     if the target is contributor/viewer, caller must be owner if the target is
--     manager/owner — a manager can never touch another manager's or an owner's
--     assignment, only the base RLS "assignments_update_owner"/"assignments_
--     delete_owner" policies (owner-only for any row) as a blunter backstop.
--
-- Live-audit findings this migration resolves (2026-07-14, see IPI-575):
--   1. Invitee org-membership: SECURITY DEFINER bypasses assignments_insert_manager's
--      own "JOIN org_members" check, so it must be re-asserted explicitly here.
--   2. Owner role is never settable via invite or role-update — matches the live
--      RLS policy's own role list (ARRAY['manager','contributor','viewer']).
--   3. Last-owner protection needs row locking to be race-free under concurrency.

-- ── 1. planner_invite_member ────────────────────────────────────────────────

create or replace function public.planner_invite_member(
  p_instance_id uuid,
  p_email text,
  p_role text
)
returns table (id uuid, instance_id uuid, user_id uuid, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_email text;
  v_user_id uuid;
  v_row planner.assignments;
begin
  if p_role not in ('manager', 'contributor', 'viewer') then
    raise exception 'planner_invite_member: invalid_role';
  end if;

  select org_id into v_org_id from planner.instances where id = p_instance_id;
  if v_org_id is null then
    raise exception 'planner_invite_member: instance_not_found';
  end if;

  if not planner.is_at_least(p_instance_id, 'manager') then
    raise exception 'planner_invite_member: insufficient_role';
  end if;

  v_email := lower(trim(p_email));
  select id into v_user_id from auth.users where lower(email) = v_email limit 1;
  if v_user_id is null then
    raise exception 'planner_invite_member: no_account_found';
  end if;

  if not exists (
    select 1 from public.org_members where org_id = v_org_id and user_id = v_user_id
  ) then
    raise exception 'planner_invite_member: user_not_in_org';
  end if;

  begin
    insert into planner.assignments (instance_id, user_id, role)
    values (p_instance_id, v_user_id, p_role)
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'planner_invite_member: already_member';
  end;

  insert into planner.events (instance_id, actor_user_id, event_type, payload)
  values (
    p_instance_id,
    (select auth.uid()),
    'member_invited',
    jsonb_build_object('user_id', v_user_id, 'role', p_role)
  );

  return query select v_row.id, v_row.instance_id, v_row.user_id, v_row.role;
end;
$$;

comment on function public.planner_invite_member(uuid, text, text) is
  'IPI-575 — adds an existing registered user (matched by email, trimmed+lowercased) to a planner instance. Caller must be manager+ on the instance; invitee must already belong to the instance''s org (public.org_members) — a SECURITY DEFINER-only check, since this bypasses assignments_insert_manager''s own org_members join. Owner role is never invitable. Writes assignment + event in one transaction; duplicate invites map to already_member via the unique (instance_id, user_id) constraint.';

revoke all on function public.planner_invite_member(uuid, text, text) from public;
revoke all on function public.planner_invite_member(uuid, text, text) from anon;
grant execute on function public.planner_invite_member(uuid, text, text) to authenticated;

-- ── 2. planner_update_role ──────────────────────────────────────────────────

create or replace function public.planner_update_role(
  p_instance_id uuid,
  p_target_user_id uuid,
  p_new_role text
)
returns table (id uuid, instance_id uuid, user_id uuid, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role text;
  v_owner_count integer;
  v_row planner.assignments;
begin
  if p_new_role not in ('manager', 'contributor', 'viewer') then
    raise exception 'planner_update_role: invalid_role';
  end if;

  if not planner.is_at_least(p_instance_id, 'manager') then
    raise exception 'planner_update_role: insufficient_role';
  end if;

  select role into v_target_role
  from planner.assignments
  where instance_id = p_instance_id and user_id = p_target_user_id
  for update;

  if not found then
    raise exception 'planner_update_role: member_not_found';
  end if;

  if v_target_role in ('owner', 'manager') and not planner.is_at_least(p_instance_id, 'owner') then
    raise exception 'planner_update_role: insufficient_role';
  end if;

  if v_target_role = 'owner' then
    perform 1 from planner.assignments
      where instance_id = p_instance_id and role = 'owner'
      order by id
      for update;

    select count(*) into v_owner_count
    from planner.assignments
    where instance_id = p_instance_id and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'planner_update_role: last_owner_protected';
    end if;
  end if;

  update planner.assignments
    set role = p_new_role
    where instance_id = p_instance_id and user_id = p_target_user_id
    returning * into v_row;

  insert into planner.events (instance_id, actor_user_id, event_type, payload)
  values (
    p_instance_id,
    (select auth.uid()),
    'member_role_updated',
    jsonb_build_object('user_id', p_target_user_id, 'old_role', v_target_role, 'new_role', p_new_role)
  );

  return query select v_row.id, v_row.instance_id, v_row.user_id, v_row.role;
end;
$$;

comment on function public.planner_update_role(uuid, uuid, text) is
  'IPI-575 — changes an existing member''s role on a planner instance. Owner role is never settable here (no self/other-elevation to owner). A manager caller may only act on contributor/viewer targets; touching a manager or owner target requires an owner caller. Demoting the last owner is rejected (last_owner_protected), checked with row-locked, id-ordered owner-count locking to stay race-free under concurrent calls.';

revoke all on function public.planner_update_role(uuid, uuid, text) from public;
revoke all on function public.planner_update_role(uuid, uuid, text) from anon;
grant execute on function public.planner_update_role(uuid, uuid, text) to authenticated;

-- ── 3. planner_remove_assignment ────────────────────────────────────────────

create or replace function public.planner_remove_assignment(
  p_instance_id uuid,
  p_target_user_id uuid
)
returns table (id uuid, instance_id uuid, user_id uuid, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role text;
  v_owner_count integer;
  v_row planner.assignments;
begin
  if not planner.is_at_least(p_instance_id, 'manager') then
    raise exception 'planner_remove_assignment: insufficient_role';
  end if;

  select role into v_target_role
  from planner.assignments
  where instance_id = p_instance_id and user_id = p_target_user_id
  for update;

  if not found then
    raise exception 'planner_remove_assignment: member_not_found';
  end if;

  if v_target_role in ('owner', 'manager') and not planner.is_at_least(p_instance_id, 'owner') then
    raise exception 'planner_remove_assignment: insufficient_role';
  end if;

  if v_target_role = 'owner' then
    perform 1 from planner.assignments
      where instance_id = p_instance_id and role = 'owner'
      order by id
      for update;

    select count(*) into v_owner_count
    from planner.assignments
    where instance_id = p_instance_id and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'planner_remove_assignment: last_owner_protected';
    end if;
  end if;

  delete from planner.assignments
    where instance_id = p_instance_id and user_id = p_target_user_id
    returning * into v_row;

  insert into planner.events (instance_id, actor_user_id, event_type, payload)
  values (
    p_instance_id,
    (select auth.uid()),
    'member_removed',
    jsonb_build_object('user_id', p_target_user_id, 'role', v_target_role)
  );

  return query select v_row.id, v_row.instance_id, v_row.user_id, v_row.role;
end;
$$;

comment on function public.planner_remove_assignment(uuid, uuid) is
  'IPI-575 — removes an existing member from a planner instance. A manager caller may only remove contributor/viewer targets; removing a manager or owner requires an owner caller. Removing the last owner is rejected (last_owner_protected), checked with the same row-locked, id-ordered owner-count pattern as planner_update_role.';

revoke all on function public.planner_remove_assignment(uuid, uuid) from public;
revoke all on function public.planner_remove_assignment(uuid, uuid) from anon;
grant execute on function public.planner_remove_assignment(uuid, uuid) to authenticated;
;
