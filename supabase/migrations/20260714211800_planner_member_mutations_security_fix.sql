-- IPI-575 · PLN-DATA-001C — security hardening found during post-merge
-- verification of PR #384.
--
-- Three fixes:
--
-- 1. Manager-gate on invite-as-manager (SEC-003):
--    A manager-level caller could invite any new member as 'manager', letting
--    them create peer managers without owner approval. Fixed by checking that
--    inviting with p_role='manager' requires the caller to be at least owner.
--    This matches the invariant already enforced by planner_update_role and
--    planner_remove_assignment (manager acts only on contributor/viewer
--    targets; owner acts on anyone).
--
-- 2. Email-enumeration cloaking (SEC-004):
--    The RPC returned distinct error codes for "no account exists for this
--    email" (no_account_found) and "account exists but not in this org"
--    (user_not_in_org). An authenticated manager+ caller could probe arbitrary
--    email addresses to learn which are registered on the platform. Both cases
--    now raise the same error (user_not_available) with the same human message,
--    making them indistinguishable.
--
-- 3. Role-promotion gating in planner_update_role (SEC-003b):
--    planner_update_role only checked the target's current role (v_target_role)
--    against the owner/manager boundary, not the requested role (p_new_role).
--    A manager who could not invite as 'manager' directly could instead invite
--    as 'contributor' and then update the target's role to 'manager', bypassing
--    the invite gate. Fixed by also rejecting p_new_role='manager' when the
--    caller is not an owner.
--
-- Validation-order fix in planner_invite_member:
--   The manager-role gate ran before the instance-existence and general
--   permission checks, causing semantically incorrect errors (e.g.
--   insufficient_role_for_target instead of instance_not_found when the
--   instance doesn't exist). The gate now runs after both checks.
--
-- create or replace preserves the existing grants (revoke public/anon, grant
-- authenticated) from migration 20260714100000 — no need to repeat them.

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

  -- Instance must exist before any is_at_least checks (which return false for
  -- non-existent instances, producing misleading error codes).
  select i.org_id into v_org_id from planner.instances i where i.id = p_instance_id;
  if v_org_id is null then
    raise exception 'planner_invite_member: instance_not_found';
  end if;

  if not planner.is_at_least(p_instance_id, 'manager') then
    raise exception 'planner_invite_member: insufficient_role';
  end if;

  if p_role = 'manager' and not planner.is_at_least(p_instance_id, 'owner') then
    raise exception 'planner_invite_member: insufficient_role_for_target';
  end if;

  v_email := lower(trim(p_email));
  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = v_email
  order by u.created_at asc
  limit 1;

  -- SEC-004: indistinguishable errors for unknown email vs email outside the
  -- org — prevents authenticated callers from probing email registration status.
  if v_user_id is null or not exists (
    select 1 from public.org_members om where om.org_id = v_org_id and om.user_id = v_user_id
  ) then
    raise exception 'planner_invite_member: user_not_available';
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
  'IPI-575 — adds an existing registered user (matched by email, trimmed+lowercased) to a planner instance. Caller must be manager+; inviting as manager requires owner. Invitee must be in the instance''s org — indistinguishable error (user_not_available) for unknown or out-of-org addresses.';

-- ── 2. planner_update_role SEC-003b guard ──────────────────────────────────

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

  -- Consistent lock order: lock the complete owner set first, id-ordered,
  -- so every caller acquires locks in the same order regardless of target.
  perform 1
  from planner.assignments a
  where a.instance_id = p_instance_id
    and a.role = 'owner'
  order by a.id
  for update;

  -- Then lock the requested target.
  select a.role into v_target_role
  from planner.assignments a
  where a.instance_id = p_instance_id
    and a.user_id = p_target_user_id
  for update;

  if not found then
    raise exception 'planner_update_role: member_not_found';
  end if;

  -- SEC-003b: reject manager-level callers trying to promote a contributor or
  -- viewer to manager — the same gate that prevents inviting-as-manager without
  -- owner approval must also prevent role-promotion to manager without owner
  -- approval; otherwise a manager could bypass the invite gate entirely.
  if (
    v_target_role in ('owner', 'manager')
    or p_new_role = 'manager'
  )
  and not planner.is_at_least(p_instance_id, 'owner')
  then
    raise exception 'planner_update_role: insufficient_role_for_target';
  end if;

  if v_target_role = 'owner' then
    select count(*) into v_owner_count
    from planner.assignments a
    where a.instance_id = p_instance_id and a.role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'planner_update_role: last_owner_protected';
    end if;
  end if;

  update planner.assignments a
    set role = p_new_role
    where a.instance_id = p_instance_id and a.user_id = p_target_user_id
    returning a.* into v_row;

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
  'IPI-575+SEC-003b — changes an existing member''s role on a planner instance. Owner role is never settable here (no self/other-elevation to owner). A manager caller may only act on contributor/viewer targets; touching a manager or owner target requires an owner caller. Manager-level callers may not promote to manager (matches invite-as-manager gate). Demoting the last owner is rejected (last_owner_protected), checked with row-locked, id-ordered owner-count locking to stay race-free under concurrent calls.';
