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

  select i.org_id into v_org_id from planner.instances i where i.id = p_instance_id;
  if v_org_id is null then
    raise exception 'planner_invite_member: instance_not_found';
  end if;

  if not planner.is_at_least(p_instance_id, 'manager') then
    raise exception 'planner_invite_member: insufficient_role';
  end if;

  v_email := lower(trim(p_email));
  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = v_email
  order by u.created_at asc
  limit 1;

  if v_user_id is null then
    raise exception 'planner_invite_member: no_account_found';
  end if;

  if not exists (
    select 1 from public.org_members om where om.org_id = v_org_id and om.user_id = v_user_id
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

  perform 1 from planner.assignments a
    where a.instance_id = p_instance_id and a.role = 'owner'
    order by a.id
    for update;

  select a.role into v_target_role
  from planner.assignments a
  where a.instance_id = p_instance_id and a.user_id = p_target_user_id
  for update;

  if not found then
    raise exception 'planner_update_role: member_not_found';
  end if;

  if v_target_role in ('owner', 'manager') and not planner.is_at_least(p_instance_id, 'owner') then
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

  perform 1 from planner.assignments a
    where a.instance_id = p_instance_id and a.role = 'owner'
    order by a.id
    for update;

  select a.role into v_target_role
  from planner.assignments a
  where a.instance_id = p_instance_id and a.user_id = p_target_user_id
  for update;

  if not found then
    raise exception 'planner_remove_assignment: member_not_found';
  end if;

  if v_target_role in ('owner', 'manager') and not planner.is_at_least(p_instance_id, 'owner') then
    raise exception 'planner_remove_assignment: insufficient_role_for_target';
  end if;

  if v_target_role = 'owner' then
    select count(*) into v_owner_count
    from planner.assignments a
    where a.instance_id = p_instance_id and a.role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'planner_remove_assignment: last_owner_protected';
    end if;
  end if;

  delete from planner.assignments a
    where a.instance_id = p_instance_id and a.user_id = p_target_user_id
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
;
