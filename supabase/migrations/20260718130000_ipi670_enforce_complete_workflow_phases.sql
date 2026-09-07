-- IPI-670 · PLN-DATA-003B — enforce complete workflow phase coverage on
-- planner_create_instance. Forward-only CREATE OR REPLACE of the live 9-arg
-- function (same signature / SECURITY DEFINER / search_path='').
--
-- Completeness runs AFTER per-task field/UUID/membership validation and
-- BEFORE any instance write:
--   expected_count  = count(*) from planner.phases where workflow_id = p_workflow_id
--   submitted_count = jsonb_array_length(p_tasks)
--   distinct_count  = count(distinct phaseId from p_tasks)
-- Reject INVALID_INPUT when expected_count = 0 OR submitted <> expected
-- OR distinct <> expected (empty list, omitted phase, duplicate replacing a
-- missing phase, or a workflow with zero phases).
--
-- Deliberately out of scope: TOCTOU between app listWorkflowPhases() and this
-- call (needs workflow revision); global unique (instance_id, phase_id);
-- types regen (signature unchanged).

create or replace function public.planner_create_instance(
  p_org_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_workflow_id uuid,
  p_name text,
  p_planned_start date,
  p_idempotency_key text,
  p_tasks jsonb,
  p_owner_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_request_hash text;
  v_existing planner.events;
  v_existing_instance_id uuid;
  v_instance_id uuid;
  v_owner_user_id uuid;
  v_task jsonb;
  v_phase_id uuid;
  v_title text;
  v_start_date date;
  v_end_date date;
  v_duration_days integer;
  v_sort_order integer;
  v_priority text;
  v_assignee_user_id uuid;
  v_expected_phase_count integer;
  v_submitted_task_count integer;
  v_distinct_phase_count integer;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;

  if p_org_id is null or p_entity_id is null or p_workflow_id is null
     or p_entity_type is null or nullif(trim(p_name), '') is null
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if not (p_entity_type = any(array['shoot', 'campaign', 'crm_deal'])) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if p_tasks is null or jsonb_typeof(p_tasks) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  v_owner_user_id := coalesce(p_owner_user_id, v_actor);

  if not exists (
    select 1 from public.org_members
    where org_id = p_org_id
      and user_id = v_actor
      and role in ('owner', 'editor')
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if p_owner_user_id is not null and not exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = p_owner_user_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  v_request_hash := encode(
    extensions.digest(
      jsonb_build_object(
        'orgId', p_org_id,
        'entityType', p_entity_type,
        'entityId', p_entity_id,
        'workflowId', p_workflow_id,
        'name', p_name,
        'plannedStart', p_planned_start,
        'tasks', p_tasks,
        'ownerUserId', v_owner_user_id
      )::text,
      'sha256'
    ),
    'hex'
  );

  select * into v_existing
  from planner.events
  where actor_user_id = v_actor
    and event_type = 'instance_created'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash = v_request_hash then
      return jsonb_set(v_existing.result_payload, '{replayed}', 'true'::jsonb);
    else
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
  end if;

  if not exists (
    select 1 from planner.workflows
    where id = p_workflow_id and org_id = p_org_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if p_entity_type = 'shoot' and not exists (
    select 1 from shoot.shoots s
    join public.brands b on b.id = s.brand_id
    where s.id = p_entity_id and b.org_id = p_org_id and s.status <> 'archived'
  ) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  elsif p_entity_type = 'campaign' and not exists (
    select 1 from public.campaigns where id = p_entity_id and org_id = p_org_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  elsif p_entity_type = 'crm_deal' and not exists (
    select 1 from public.crm_deals where id = p_entity_id and org_id = p_org_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  for v_task in select * from jsonb_array_elements(p_tasks)
  loop
    if v_task->>'phaseId' is null
       or nullif(trim(v_task->>'title'), '') is null
       or v_task->>'startDate' is null
       or v_task->>'endDate' is null
       or v_task->>'durationDays' is null
       or v_task->>'sortOrder' is null
    then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end if;

    begin
      v_phase_id := (v_task->>'phaseId')::uuid;
      v_start_date := (v_task->>'startDate')::date;
      v_end_date := (v_task->>'endDate')::date;
      v_duration_days := (v_task->>'durationDays')::integer;
      v_sort_order := (v_task->>'sortOrder')::integer;
      v_assignee_user_id := nullif(v_task->>'assigneeUserId', '')::uuid;
    exception
      when data_exception then
        return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end;

    v_priority := coalesce(v_task->>'priority', 'medium');

    if v_duration_days <= 0
       or v_sort_order < 0
       or v_end_date < v_start_date
       or v_priority not in ('low', 'medium', 'high', 'critical')
    then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end if;

    if not exists (
      select 1 from planner.phases
      where id = v_phase_id
        and workflow_id = p_workflow_id
    ) then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end if;

    if v_assignee_user_id is not null and not exists (
      select 1 from public.org_members
      where org_id = p_org_id and user_id = v_assignee_user_id
    ) then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end if;
  end loop;

  -- IPI-670: require a complete, distinct cover of the workflow's phases.
  select count(*)::integer
    into v_expected_phase_count
  from planner.phases
  where workflow_id = p_workflow_id;

  v_submitted_task_count := jsonb_array_length(p_tasks);

  select count(distinct (t.elem->>'phaseId'))::integer
    into v_distinct_phase_count
  from jsonb_array_elements(p_tasks) as t(elem);

  if v_expected_phase_count = 0
     or v_submitted_task_count <> v_expected_phase_count
     or v_distinct_phase_count <> v_expected_phase_count
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  select id into v_existing_instance_id
  from planner.instances
  where org_id = p_org_id
    and entity_type = p_entity_type
    and entity_id = p_entity_id
    and workflow_id = p_workflow_id;

  if found then
    return jsonb_build_object('ok', false, 'code', 'INSTANCE_ALREADY_EXISTS', 'instanceId', v_existing_instance_id);
  end if;

  begin
    insert into planner.instances (org_id, workflow_id, entity_type, entity_id, name, status, planned_start, owner_user_id)
    values (p_org_id, p_workflow_id, p_entity_type, p_entity_id, p_name, 'draft', coalesce(p_planned_start, current_date), v_owner_user_id)
    returning id into v_instance_id;
  exception
    when unique_violation then
      select id into v_existing_instance_id
      from planner.instances
      where org_id = p_org_id
        and entity_type = p_entity_type
        and entity_id = p_entity_id
        and workflow_id = p_workflow_id;
      return jsonb_build_object('ok', false, 'code', 'INSTANCE_ALREADY_EXISTS', 'instanceId', v_existing_instance_id);
  end;

  if p_owner_user_id is not null and p_owner_user_id <> v_actor then
    insert into planner.assignments (instance_id, user_id, role)
    values (v_instance_id, p_owner_user_id, 'owner')
    on conflict (instance_id, user_id) do nothing;
  end if;

  for v_task in select * from jsonb_array_elements(p_tasks)
  loop
    v_phase_id := (v_task->>'phaseId')::uuid;
    v_title := v_task->>'title';
    v_start_date := (v_task->>'startDate')::date;
    v_end_date := (v_task->>'endDate')::date;
    v_duration_days := (v_task->>'durationDays')::integer;
    v_sort_order := (v_task->>'sortOrder')::integer;
    v_priority := coalesce(v_task->>'priority', 'medium');
    v_assignee_user_id := nullif(v_task->>'assigneeUserId', '')::uuid;

    insert into planner.tasks (
      instance_id, phase_id, title, start_date, end_date, duration_days,
      status, priority, assignee_user_id, sort_order
    )
    values (
      v_instance_id, v_phase_id, v_title, v_start_date, v_end_date, v_duration_days,
      'todo', v_priority, v_assignee_user_id, v_sort_order
    );
  end loop;

  insert into planner.events (
    instance_id, actor_user_id, event_type, payload,
    idempotency_key, request_hash, result_payload
  )
  values (
    v_instance_id, v_actor, 'instance_created',
    jsonb_build_object('orgId', p_org_id, 'entityType', p_entity_type, 'entityId', p_entity_id, 'workflowId', p_workflow_id, 'ownerUserId', v_owner_user_id),
    p_idempotency_key, v_request_hash,
    jsonb_build_object('ok', true, 'replayed', false, 'instanceId', v_instance_id)
  );

  return jsonb_build_object('ok', true, 'replayed', false, 'instanceId', v_instance_id);
end;
$$;
