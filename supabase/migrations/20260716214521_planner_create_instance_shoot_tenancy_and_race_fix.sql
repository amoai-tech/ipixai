-- IPI-653 · PLN-DATA-003 — round-3 fix, from independent bot re-review
-- (Cursor Bugbot, Sentry, CodeRabbit, Codex all flagged the same critical
-- bug independently; confirmed live against the actual schema before
-- fixing).
--
-- Fixed:
--
-- 1. CRITICAL: shoot-tenancy check queried a column that doesn't exist.
--    shoot.shoots has no org_id column — confirmed live
--    (information_schema.columns for shoot.shoots has no org_id row; it
--    only has brand_id). Tenancy for a shoot is resolved through its
--    brand: shoot.shoots.brand_id -> public.brands.id -> brands.org_id.
--    Every shoot-type planner_create_instance call would have raised
--    undefined_column and crashed. Fixed: joins through public.brands.
--
-- 2. Medium: concurrent duplicate-tuple race. The prior migrations only
--    SELECTed for an existing (org_id, entity_type, entity_id,
--    workflow_id) row before INSERTing — two simultaneous identical
--    requests could both pass that check, and the loser would hit the
--    real UNIQUE constraint as an uncaught unique_violation instead of
--    the documented INSTANCE_ALREADY_EXISTS. Fixed: the INSERT is now
--    wrapped to catch unique_violation and return the winning row's id.
--
-- 3. Low: materialized tasks never set sort_order, so every row got the
--    schema default of 0 even though the loop is ordered by
--    phases.order_index — getInstanceDetail explicitly sorts embedded
--    tasks by sortOrder because PostgREST doesn't guarantee row order,
--    so newly created plans could render phases in arbitrary order.
--    Fixed: sort_order is now set to the phase's order_index.
--
-- Deliberately NOT changed in this round (a linked design decision, not a
-- mechanical bug fix — flagged for a follow-up decision alongside the
-- calendar-vs-business-day question):
-- - Dates are still computed with calendar-day arithmetic, not the
--   business-day semantics PlannerEngine.buildSchedule() already
--   implements (addBusinessDays, skips weekends). That existing TS method
--   ALSO builds a finish_to_start dependency chain between consecutive
--   phase tasks — which conflicts with this RPC's confirmed "no
--   auto-dependencies" v1 policy (sequential dates aren't proof of a real
--   dependency). Since PlannerEngine.buildSchedule() already correctly
--   implements the business-day math (and is presumably already tested),
--   re-deriving that same math a second time in raw SQL here risks a
--   subtle off-by-one/weekend bug in a parallel implementation, rather
--   than reusing what's already proven. Whether PR 2 should have the app
--   layer call PlannerEngine.buildSchedule() and have this RPC just
--   persist the computed shape (mirroring planner_shift_task's own
--   persist-only design) — resolving the calendar/business-day AND
--   dependency-chain questions together — is a real architectural
--   decision for a follow-up, not something to guess at here.

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

  -- Pass-3 fix: shoot tenancy resolved through its brand
  -- (shoot.shoots.brand_id -> public.brands.org_id) — shoot.shoots has no
  -- org_id column of its own.
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

  -- Pass-3 fix: catch a concurrent duplicate INSERT losing the race
  -- against the SELECT above, instead of an uncaught unique_violation.
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
  -- planner.bootstrap_owner_assignment (existing trigger) assigns v_actor as owner here.

  -- v1 policy: one phase-anchor task per phase, no dependency rows —
  -- sequential dates are a schedule default, not an asserted dependency.
  -- Pass-3 fix: sort_order now set from the phase's order_index (was
  -- previously omitted, leaving every task at the schema default of 0).
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
  'IPI-653 (pass 3) — atomic instance-creation RPC. Validates org role (owner/editor), workflow, and source entity (shoot tenancy resolved via its brand; campaign/crm_deal via direct org_id), then inserts planner.instances (concurrent-duplicate-safe: unique_violation is caught and returns INSTANCE_ALREADY_EXISTS) and one system-created phase-anchor planner.tasks row per planner.phases row (sort_order = phase order_index; v1 policy: no dependency rows), plus one planner.events audit row, all in one transaction. Known follow-up: dates use calendar-day arithmetic, not PlannerEngine.buildSchedule()''s business-day semantics — a linked design decision alongside whether this RPC should persist an app-computed schedule instead of deriving it in SQL.';
