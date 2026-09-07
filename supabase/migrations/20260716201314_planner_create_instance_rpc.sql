-- IPI-653 · PLN-DATA-003 — Planner Instance Creation Service.
--
-- Atomic instance-creation RPC: validates the source entity + workflow,
-- inserts the planner.instances row, materializes one planner.tasks row per
-- planner.phases row (one-task-per-phase — confirmed decision, see ticket),
-- chains them finish_to_start in phase order, and writes a planner.events
-- audit record. planner.bootstrap_owner_assignment (existing AFTER INSERT
-- trigger on planner.instances, migration 20260709000000) already assigns
-- the caller as owner — this RPC does not call it directly.
--
-- Creation permission (confirmed decision): public.org_members.role is
-- ('owner', 'editor', 'viewer') — there is no 'admin' role in the real
-- schema (IPI-647 separately confirmed no owner/admin bypass exists
-- anywhere in the permission model). Owner and editor may create; viewer
-- may not.
--
-- Idempotency: mirrors IPI-649's planner_shift_task/planner_update_task
-- pattern (planner.events.idempotency_key/request_hash/result_payload,
-- migration 20260716172904), but the lookup omits an instance_id predicate
-- since instance_id doesn't exist yet at lookup time for a create — it's an
-- output of this RPC, not an input. Uniqueness of a real retry is carried
-- entirely by (actor_user_id, event_type, idempotency_key) plus a matching
-- request_hash.
--
-- Duplicate-tuple handling is a SEPARATE, non-idempotency-keyed check:
-- planner.instances already has UNIQUE (org_id, entity_type, entity_id,
-- workflow_id) — a second creation request for that tuple (any idempotency
-- key, including none) returns INSTANCE_ALREADY_EXISTS with the existing id.
--
-- Rollback (manual — forward-only migrations, no down-script is auto-run):
--   drop function if exists public.planner_create_instance(uuid, text, uuid, uuid, text, date, text);
--   -- planner.events.idempotency_key/request_hash/result_payload already exist
--   -- (added by 20260716172904) — do not drop those columns here.

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
  v_task_id uuid;
  v_prev_task_id uuid;
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

  -- Idempotent replay — no instance_id predicate; see header note.
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

  -- One task per phase (confirmed decision), chained finish_to_start in
  -- phase order, dates computed sequentially from default_duration_days.
  v_cursor := coalesce(p_planned_start, current_date);
  v_prev_task_id := null;

  for v_phase in
    select id, name, default_duration_days
    from planner.phases
    where workflow_id = p_workflow_id
    order by order_index
  loop
    insert into planner.tasks (instance_id, phase_id, title, start_date, end_date, duration_days, status)
    values (
      v_instance_id, v_phase.id, v_phase.name,
      v_cursor, v_cursor + (v_phase.default_duration_days - 1), v_phase.default_duration_days,
      'todo'
    )
    returning id into v_task_id;

    if v_prev_task_id is not null then
      insert into planner.dependencies (instance_id, from_task_id, to_task_id, dep_type, lag_days)
      values (v_instance_id, v_prev_task_id, v_task_id, 'finish_to_start', 0);
    end if;

    v_cursor := v_cursor + v_phase.default_duration_days;
    v_prev_task_id := v_task_id;
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
  'IPI-653 — atomic instance-creation RPC. Validates org role (owner/editor), workflow, and source entity (shoot/campaign/crm_deal), then inserts planner.instances, one planner.tasks row per planner.phases row (chained finish_to_start, dates from default_duration_days), and one planner.events audit row, all in one transaction. Duplicate (org_id, entity_type, entity_id, workflow_id) returns INSTANCE_ALREADY_EXISTS with the existing id; a matching idempotency_key replay returns the original result with replayed:true.';

revoke all on function public.planner_create_instance(uuid, text, uuid, uuid, text, date, text) from public;
revoke all on function public.planner_create_instance(uuid, text, uuid, uuid, text, date, text) from anon;
grant execute on function public.planner_create_instance(uuid, text, uuid, uuid, text, date, text) to authenticated;
