-- IPI-653 · PLN-DATA-003 — final consolidated PR 2 contract for
-- planner_create_instance. Consolidates three sequential migrations that
-- were never merged/published (rounds 5, 6, 7 of this PR — repeatedly
-- replacing the same function on an already-open, unmerged PR), plus two
-- new fixes from a subsequent CodeRabbit review pass. Per this repo's own
-- "never rewrite applied migrations" rule, this is safe: none of the
-- consolidated migrations were ever on `main` — they only existed as
-- separate commits on this still-open PR branch.
--
-- Full history of what's consolidated here:
--
-- 1. (round 5) Accepts p_tasks jsonb — a caller-precomputed task list
--    (PlannerEngine.buildSchedule() in the app layer) instead of computing
--    calendar-day dates itself. Closes the business-day-vs-calendar-day gap
--    from the PR 1 migration.
-- 2. (round 6) Accepts p_owner_user_id, defaulting to the caller; must be
--    an org member if explicitly supplied.
-- 3. (round 7) Authorization runs before idempotency replay (matching
--    planner_shift_task/planner_update_task's round-8 fix — a revoked-role
--    actor could otherwise replay a cached ok:true result). An explicit
--    owner different from the caller gets their own planner.assignments
--    row (bootstrap_owner_assignment only ever assigns the caller — con-
--    firmed via its live definition). Every task field is cast inside an
--    exception-handling block before any write, returning typed
--    INVALID_INPUT instead of a raw Postgres data_exception. A non-null
--    assigneeUserId is validated against org membership.
-- 4. (this migration, new) The request hash now hashes a structured
--    jsonb document instead of delimiter-free string concatenation — a
--    name ending in a date could otherwise collide with a shorter name
--    plus that same date as the planned_start (e.g. name="Foo 2026-08-03"
--    + null start vs. name="Foo " + start="2026-08-03" hash identically).
-- 5. (this migration, new) Task fields are now semantically validated, not
--    just type-cast: durationDays > 0, sortOrder >= 0, endDate >= startDate,
--    and priority must be one of the four values planner.tasks' own CHECK
--    constraint allows. Priority previously reached that CHECK constraint
--    unvalidated — a check_violation is a different exception class than
--    data_exception, so an invalid priority would have leaked as a raw
--    Postgres error, not typed INVALID_INPUT. durationDays/sortOrder/date-
--    ordering had no DB constraint at all, so invalid values would have
--    silently persisted.
--
-- Deliberately deferred (documented, not fixed): (a) a workflow's phase set
-- can change between the app layer's listWorkflowPhases() read and this
-- call (TOCTOU) — fixing this means passing a workflow revision for
-- optimistic concurrency, real follow-up scope, not a review-comment fix.
-- (b) two concurrent calls with the *same* idempotency key can both miss
-- the replay lookup before either commits — the loser then hits
-- planner.instances' unique constraint and returns INSTANCE_ALREADY_EXISTS
-- (with the real instance id) instead of replayed:true. No corruption, no
-- crash, just a different-but-still-usable result on the losing side of a
-- rare race. A true fix needs a reservation/advisory lock on
-- (actor, idempotency_key), which is real engineering scope, not a
-- same-PR fix.

drop function if exists public.planner_create_instance(uuid, text, uuid, uuid, text, date, text, jsonb, uuid);

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

  -- Authorization before idempotency replay.
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

  -- Structured hash: a jsonb document with named fields, not delimiter-free
  -- concatenation, so two distinct requests can never collide to the same
  -- preimage.
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

  -- Validate every caller-supplied task before writing anything: required
  -- fields present, every typed field actually parses (exception-handled,
  -- not a raw Postgres error), semantically valid (positive duration,
  -- non-negative sort order, end >= start, priority within the domain
  -- planner.tasks' own CHECK constraint allows — validated here so an
  -- invalid priority never reaches that constraint as a raw
  -- check_violation), phaseId belongs to this workflow, and a non-null
  -- assignee is an org member.
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

  -- bootstrap_owner_assignment only ever assigns the calling actor — give
  -- an explicit, different owner their own assignment too.
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
  'IPI-653 (final, PR 2 contract) — atomic instance-creation RPC. Accepts a caller-precomputed task list (p_tasks) with business-day-accurate dates (PlannerEngine.buildSchedule() in the app layer). Authorization runs before idempotency replay. Every task field is cast and semantically validated (positive duration, non-negative sort order, end >= start, priority within the tasks table''s own CHECK domain) before any write — never a raw Postgres error. A non-null assigneeUserId must be an org member. An explicit p_owner_user_id different from the caller gets its own planner.assignments row. Request hash is a structured jsonb document, not delimiter-free concatenation. v1 policy: no planner.dependencies rows written. Known deferred gaps (documented in the migration header): workflow phase-set TOCTOU between the app layer''s read and this call; same-idempotency-key concurrent calls can race to INSTANCE_ALREADY_EXISTS instead of a clean replay (no corruption, just a different result on the losing side).';

revoke all on function public.planner_create_instance(uuid, text, uuid, uuid, text, date, text, jsonb, uuid) from public;
revoke all on function public.planner_create_instance(uuid, text, uuid, uuid, text, date, text, jsonb, uuid) from anon;
grant execute on function public.planner_create_instance(uuid, text, uuid, uuid, text, date, text, jsonb, uuid) to authenticated;
