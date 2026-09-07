-- IPI-653 · PLN-DATA-003 — round-7 (PR 2 review hardening): fixes 4 real
-- findings from PR #427's review pass (Codex + Sentry bots, triaged and
-- confirmed live against pg_get_functiondef / the bootstrap trigger body).
--
-- 1. Authorization now runs BEFORE the idempotency replay lookup, matching
--    planner_shift_task/planner_update_task's round-8 fix. Previously a
--    caller whose org role was revoked after a successful create could
--    still replay the cached ok:true result via the same idempotency key.
-- 2. p_owner_user_id, when explicitly different from the caller, now gets
--    its own planner.assignments row. planner.bootstrap_owner_assignment()
--    hardcodes auth.uid() (confirmed via pg_get_functiondef) — it never
--    assigns p_owner_user_id — so an explicit owner previously had zero
--    assignment rows and could not open or manage the plan they nominally
--    owned.
-- 3. Every task's typed fields (phaseId/startDate/endDate/durationDays/
--    sortOrder/assigneeUserId) are now cast inside an exception-handling
--    block during validation, before any write. Previously a malformed
--    value (e.g. phaseId: "") reached its ::cast unguarded during the
--    persist loop, raising a raw Postgres data_exception instead of a
--    typed INVALID_INPUT result — and only after the instance row had
--    already been inserted.
-- 4. A non-null assigneeUserId is now validated against org membership,
--    matching planner_update_task's existing guard
--    (20260716210500_planner_shift_update_task_security_fix_10.sql).
--    Previously an owner/editor could persist tasks assigned to any
--    auth.users id, including one outside the org.
--
-- Known, deliberately deferred (not fixed here): a workflow's phase set
-- can change between the app layer's listWorkflowPhases() read and this
-- call (TOCTOU) — the RPC only validates that supplied phaseIds belong to
-- the workflow, not that the full current phase set is represented. Fixing
-- this properly means passing a workflow revision/version for optimistic
-- concurrency, which is real follow-up scope, not a review-comment fix —
-- tracked separately, not folded into this migration.

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

  -- Round-7: authz before idempotency replay.
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

  -- Validate every caller-supplied task before writing anything: phaseId
  -- must belong to this workflow, required fields must be present, every
  -- typed field must actually parse (round-7), and a non-null assignee
  -- must be an org member (round-7).
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

  -- Round-7: bootstrap_owner_assignment only ever assigns the calling
  -- actor — give an explicit, different owner their own assignment too.
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

comment on function public.planner_create_instance(uuid, text, uuid, uuid, text, date, text, jsonb, uuid) is
  'IPI-653 (pass 7 / PR 2 review hardening) — atomic instance-creation RPC. Accepts a caller-precomputed task list (p_tasks) instead of computing dates itself. Authorization (org role + explicit-owner membership) runs before idempotency replay. Every task field is cast inside an exception-handling block before any write (typed INVALID_INPUT, never a raw Postgres error); a non-null assigneeUserId must be an org member. An explicit p_owner_user_id different from the caller gets its own planner.assignments row (bootstrap_owner_assignment only ever assigns the caller). v1 policy unchanged: no planner.dependencies rows written. Known deferred gap: workflow phase set can change between the app layer''s read and this call (TOCTOU) — tracked separately, not fixed here.';
