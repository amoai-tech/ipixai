-- IPI-653 · PLN-DATA-003 — v1 phase-anchor materialization policy correction.
--
-- Round-2 fix to 20260716210000: that migration chained the generated
-- phase-anchor tasks with planner.dependencies rows (finish_to_start, in
-- phase order) purely from sequential dates. Per the confirmed v1 policy,
-- that's wrong — planner.phases carries no authoritative dependency
-- definition (no template-dependency table exists), so sequential
-- planned dates are not proof of a real dependency relationship. Creating
-- dependency rows anyway would fabricate schedule-shift semantics
-- (planner_shift_task propagates deltas across planner.dependencies edges)
-- that nothing actually asked for.
--
-- v1 policy (confirmed): each planner.phases row generates exactly one
-- system-created phase-anchor task — phase_id = phase.id, title =
-- phase.name, status = 'todo', assignee_user_id = null, dates computed
-- sequentially from planned_start + default_duration_days. No dependency
-- rows, no additional child tasks, priorities, or assignees. This is an
-- MVP bootstrap, not the final rich task-template model — a future ticket
-- may add planner.phase_task_templates with its own authoritative
-- dependency graph; this RPC must not invent one.
--
-- Rollback (manual — forward-only migrations):
--   Re-apply 20260716210000's function body (with the dependency insert)
--   via a new forward migration if this needs reverting.

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
  v_response jsonb;
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

  v_request_hash := encode(
    extensions.digest(
      p_org_id::text || p_entity_type || p_entity_id::text || p_workflow_id::text
        || p_name || coalesce(p_planned_start::text, ''),
      'sha256'
    ),
    'hex'
  );

  -- Idempotent replay — no instance_id predicate; see 20260716210000's header note.
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

  -- Creation permission: org owner or editor only (confirmed decision —
  -- the ticket's proposed 'admin' role does not exist in org_members).
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

  -- Source-entity validation, per type. Only shoot.shoots has an
  -- archived-like status; campaigns/crm_deals have no such column today.
  if p_entity_type = 'shoot' and not exists (
    select 1 from shoot.shoots
    where id = p_entity_id and org_id = p_org_id and status <> 'archived'
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

  -- Duplicate-tuple check — separate from idempotency-key replay above.
  select id into v_existing_instance_id
  from planner.instances
  where org_id = p_org_id
    and entity_type = p_entity_type
    and entity_id = p_entity_id
    and workflow_id = p_workflow_id;

  if found then
    return jsonb_build_object('ok', false, 'code', 'INSTANCE_ALREADY_EXISTS', 'instanceId', v_existing_instance_id);
  end if;

  insert into planner.instances (org_id, workflow_id, entity_type, entity_id, name, status, planned_start)
  values (p_org_id, p_workflow_id, p_entity_type, p_entity_id, p_name, 'draft', coalesce(p_planned_start, current_date))
  returning id into v_instance_id;
  -- planner.bootstrap_owner_assignment (existing trigger) assigns v_actor as owner here.

  -- v1 policy: one phase-anchor task per phase, no dependency rows —
  -- sequential dates are a schedule default, not an asserted dependency.
  v_cursor := coalesce(p_planned_start, current_date);

  for v_phase in
    select id, name, default_duration_days
    from planner.phases
    where workflow_id = p_workflow_id
    order by order_index
  loop
    insert into planner.tasks (instance_id, phase_id, title, start_date, end_date, duration_days, status, assignee_user_id)
    values (
      v_instance_id, v_phase.id, v_phase.name,
      v_cursor, v_cursor + (v_phase.default_duration_days - 1), v_phase.default_duration_days,
      'todo', null
    );

    v_cursor := v_cursor + v_phase.default_duration_days;
  end loop;

  v_response := jsonb_build_object('ok', true, 'replayed', false, 'instanceId', v_instance_id);

  insert into planner.events (
    instance_id, actor_user_id, event_type, payload,
    idempotency_key, request_hash, result_payload
  )
  values (
    v_instance_id, v_actor, 'instance_created',
    jsonb_build_object('orgId', p_org_id, 'entityType', p_entity_type, 'entityId', p_entity_id, 'workflowId', p_workflow_id),
    p_idempotency_key, v_request_hash, v_response
  );

  return v_response;
end;
$$;

comment on function public.planner_create_instance(uuid, text, uuid, uuid, text, date, text) is
  'IPI-653 — atomic instance-creation RPC. Validates org role (owner/editor), workflow, and source entity (shoot/campaign/crm_deal), then inserts planner.instances and one system-created phase-anchor planner.tasks row per planner.phases row (v1 policy: no dependency rows — sequential dates are a schedule default, not an asserted dependency), plus one planner.events audit row, all in one transaction. Duplicate (org_id, entity_type, entity_id, workflow_id) returns INSTANCE_ALREADY_EXISTS with the existing id; a matching idempotency_key replay returns the original result with replayed:true.';
