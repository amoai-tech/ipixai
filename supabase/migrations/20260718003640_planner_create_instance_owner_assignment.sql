-- IPI-653 · PLN-DATA-003 — round-6 (PR 2 contract, continued): the PR 2
-- kickoff decision listed "owner assignment" as part of what this RPC must
-- atomically persist, alongside the task list. planner.instances.owner_user_id
-- is a plain nullable column (not a separate planner.assignments row) — none
-- of rounds 1-5 ever set it. Adds an optional p_owner_user_id, defaulting to
-- the creating actor when omitted (every instance should have an owner; the
-- creator is the only sensible default absent an explicit choice).
--
-- Not yet pushed/PR'd, so this amends round-5's contract directly rather than
-- adding a second signature change on top of it (see the just-written
-- planner-backend-efficiency-plan-2026-07-17.md: consolidate corrective SQL
-- before opening the PR when migrations haven't been pushed yet).

drop function if exists public.planner_create_instance(uuid, text, uuid, uuid, text, date, text, jsonb);

create function public.planner_create_instance(
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
set search_path = ''
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

  v_request_hash := encode(
    extensions.digest(
      p_org_id::text || p_entity_type || p_entity_id::text || p_workflow_id::text
        || p_name || coalesce(p_planned_start::text, '') || p_tasks::text
        || v_owner_user_id::text,
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
    select 1 from public.org_members
    where org_id = p_org_id
      and user_id = v_actor
      and role in ('owner', 'editor')
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- p_owner_user_id, when explicitly supplied, must itself be a member of
  -- the target org — otherwise a caller could hand ownership of a new
  -- instance to an arbitrary user id with no relationship to the org.
  if p_owner_user_id is not null and not exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = p_owner_user_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
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

  -- Validate every caller-supplied task before writing anything: each
  -- phaseId must belong to this workflow, and required fields must be
  -- present. This is its own pass so an invalid task never leaves a
  -- partially-created instance behind — a plain `return` here (unlike a
  -- raised exception) would not undo an insert already made earlier in
  -- the same call.
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

    if not exists (
      select 1 from planner.phases
      where id = (v_task->>'phaseId')::uuid
        and workflow_id = p_workflow_id
    ) then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end if;
  end loop;

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

comment on function public.planner_create_instance(uuid, text, uuid, uuid, text, date, text, jsonb, uuid) is
  'IPI-653 (pass 6 / PR 2 contract) — atomic instance-creation RPC. Accepts a caller-precomputed task list (p_tasks: array of {phaseId, title, startDate, endDate, durationDays, sortOrder, priority?, assigneeUserId?}) instead of computing dates itself — the app layer calls PlannerEngine.buildSchedule() before invoking this RPC. p_owner_user_id defaults to the calling actor when omitted; if explicitly supplied it must be an org member. Validates every task''s phaseId against p_workflow_id, org role (owner/editor), workflow, and source entity (shoot tenancy via its brand; campaign/crm_deal via direct org_id) before writing anything, then inserts planner.instances (concurrent-duplicate-safe, with owner_user_id set) and the supplied planner.tasks rows, plus one planner.events audit row, all in one transaction. v1 policy: no planner.dependencies rows are written, even though buildSchedule() also produces a dependency chain — sequential dates are not proof of a real dependency.';

revoke all on function public.planner_create_instance(uuid, text, uuid, uuid, text, date, text, jsonb, uuid) from public;
revoke all on function public.planner_create_instance(uuid, text, uuid, uuid, text, date, text, jsonb, uuid) from anon;
grant execute on function public.planner_create_instance(uuid, text, uuid, uuid, text, date, text, jsonb, uuid) to authenticated;
