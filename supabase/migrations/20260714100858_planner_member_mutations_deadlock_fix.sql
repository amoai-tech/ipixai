-- IPI-575 · PLN-DATA-001C — fix a real deadlock in planner_update_role /
-- planner_remove_assignment, found by an independent rls-policy-auditor pass
-- on migration 20260714100000 before this ticket was marked done.
--
-- The bug: the target row was locked FIRST, unconditionally and unordered
-- (`select ... where user_id = p_target_user_id for update`), and only THEN,
-- conditionally, were all owner rows locked in id order. Two concurrent
-- callers demoting two DIFFERENT owners (O1, O2) on the same instance could
-- each lock their own target first, then each block waiting for the other's
-- row inside the "lock all owners" step — a classic circular wait. Postgres's
-- deadlock detector would catch this (no data corruption), but it aborts one
-- legitimate concurrent request with a generic `deadlock_detected` error
-- instead of the intended clean `last_owner_protected` outcome.
--
-- The fix: the owner-set lock (id-ordered, `for update`) now runs FIRST and
-- UNCONDITIONALLY in both functions, before the target row is ever locked.
-- Every call now acquires its first lock over the exact same row set in the
-- exact same order — two concurrent calls can only block each other at that
-- first step, never form a cycle.
--
-- Also fixes two lower-severity findings from the same audit:
--   - `insufficient_role` was raised from two different causes in the same
--     function (caller isn't manager+ at all, vs. caller is manager but the
--     target is owner/manager) with an identical message — the TypeScript
--     layer couldn't distinguish them. Now two distinct messages.
--   - The `auth.users` email lookup had no `order by`, so a residual/duplicate
--     auth identity with the same lowercased email would resolve to an
--     arbitrary row. Now deterministic (oldest account wins).

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
  select id into v_user_id
  from auth.users
  where lower(email) = v_email
  order by created_at asc
  limit 1;

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

  perform 1 from planner.assignments
    where instance_id = p_instance_id and role = 'owner'
    order by id
    for update;

  select role into v_target_role
  from planner.assignments
  where instance_id = p_instance_id and user_id = p_target_user_id
  for update;

  if not found then
    raise exception 'planner_update_role: member_not_found';
  end if;

  if v_target_role in ('owner', 'manager') and not planner.is_at_least(p_instance_id, 'owner') then
    raise exception 'planner_update_role: insufficient_role_for_target';
  end if;

  if v_target_role = 'owner' then
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

  perform 1 from planner.assignments
    where instance_id = p_instance_id and role = 'owner'
    order by id
    for update;

  select role into v_target_role
  from planner.assignments
  where instance_id = p_instance_id and user_id = p_target_user_id
  for update;

  if not found then
    raise exception 'planner_remove_assignment: member_not_found';
  end if;

  if v_target_role in ('owner', 'manager') and not planner.is_at_least(p_instance_id, 'owner') then
    raise exception 'planner_remove_assignment: insufficient_role_for_target';
  end if;

  if v_target_role = 'owner' then
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

-- create or replace preserves the existing grants (revoke public/anon, grant
-- authenticated) from migration 20260714100000 — no need to repeat them.
;
