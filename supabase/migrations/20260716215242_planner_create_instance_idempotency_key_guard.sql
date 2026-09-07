-- IPI-653 · PLN-DATA-003 — round-4 fix, from Sentry re-review of round 3's
-- own diff.
--
-- Fixed:
-- Missing null/empty idempotency-key guard (Medium). Unlike
-- planner_shift_task/planner_update_task (both explicitly reject a null
-- or empty p_idempotency_key with INVALID_INPUT before ever reaching
-- their idempotency lookup), planner_create_instance never had that
-- guard. A null p_idempotency_key would reach
-- `idempotency_key = p_idempotency_key`, which is NULL (never true) under
-- three-valued logic — so a null-keyed call always misses the replay
-- lookup, regardless of how many null-keyed rows already exist for this
-- actor. In practice this was never a path to an actual duplicate
-- instance (the separate INSTANCE_ALREADY_EXISTS unique-constraint check
-- still blocks that), but it's a real, cheap-to-close consistency gap
-- against the sibling RPCs. Fixed: same guard, added in the same
-- position as the other two RPCs.

create or replace function public.planner_create_instance(
  p_org_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_workflow_id uuid,
  p_name text,
  p_planned_start date,
  p_idempotency_key text
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
  v_phase record;
  v_cursor date;
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

  -- Pass-4 fix: same null/empty idempotency-key guard as
  -- planner_shift_task/planner_update_task.
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  v_request_hash := encode(
    extensions.digest(
      p_org_id::text || p_entity_type || p_entity_id::text || p_workflow_id::text
        || p_name || coalesce(p_planned_start::text, ''),
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
    insert into planner.instances (org_id, workflow_id, entity_type, entity_id, name, status, planned_start)
    values (p_org_id, p_workflow_id, p_entity_type, p_entity_id, p_name, 'draft', coalesce(p_planned_start, current_date))
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

  v_cursor := coalesce(p_planned_start, current_date);

  for v_phase in
    select id, name, default_duration_days, order_index
    from planner.phases
    where workflow_id = p_workflow_id
    order by order_index
  loop
    insert into planner.tasks (instance_id, phase_id, title, start_date, end_date, duration_days, status, assignee_user_id, sort_order)
    values (
      v_instance_id, v_phase.id, v_phase.name,
      v_cursor, v_cursor + (v_phase.default_duration_days - 1), v_phase.default_duration_days,
      'todo', null, v_phase.order_index
    );

    v_cursor := v_cursor + v_phase.default_duration_days;
  end loop;

  insert into planner.events (
    instance_id, actor_user_id, event_type, payload,
    idempotency_key, request_hash, result_payload
  )
  values (
    v_instance_id, v_actor, 'instance_created',
    jsonb_build_object('orgId', p_org_id, 'entityType', p_entity_type, 'entityId', p_entity_id, 'workflowId', p_workflow_id),
    p_idempotency_key, v_request_hash,
    jsonb_build_object('ok', true, 'replayed', false, 'instanceId', v_instance_id)
  );

  return jsonb_build_object('ok', true, 'replayed', false, 'instanceId', v_instance_id);
end;
$$;

comment on function public.planner_create_instance(uuid, text, uuid, uuid, text, date, text) is
  'IPI-653 (pass 4) — atomic instance-creation RPC. Rejects a null/empty idempotency key (INVALID_INPUT), matching planner_shift_task/planner_update_task. Validates org role (owner/editor), workflow, and source entity (shoot tenancy via its brand; campaign/crm_deal via direct org_id), then inserts planner.instances (concurrent-duplicate-safe) and one phase-anchor planner.tasks row per phase (sort_order = phase order_index; v1 policy: no dependency rows), plus one planner.events audit row, all in one transaction. Known follow-up: dates use calendar-day arithmetic, not PlannerEngine.buildSchedule()''s business-day semantics — a linked design decision for PR 2.';
