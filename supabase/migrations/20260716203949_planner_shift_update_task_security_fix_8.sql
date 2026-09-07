-- IPI-649 · PLN-DATA-001B-M — eighth security-fix pass, from an independent
-- adversarial audit of the full merged PR #418+#420 chain (two dedicated
-- agents, one per PR, each told to re-derive every claim from the live DB
-- and current code rather than trust prior review rounds).
--
-- Fixed in this round:
--
-- 1. Idempotency replay skipped re-authorization (planner_shift_task AND
--    planner_update_task, MEDIUM). Both functions checked the idempotency
--    cache BEFORE the org-membership and per-task authorization checks.
--    An actor who successfully mutated a task while a contributor, then
--    lost access (removed from the org/instance, or demoted), could
--    replay the exact same idempotency key + payload and get back the
--    cached ok:true result with no re-check of their now-revoked access.
--    Fixed: is_org_member + the task-level authorization check now run
--    BEFORE the idempotency lookup. The terminal-instance check stays
--    AFTER the idempotency lookup, unchanged — that ordering is a
--    separate, deliberate decision (a replay of an already-successful
--    mutation must still succeed even if the instance went terminal
--    afterward, since replaying performs no new write) and is not what
--    this finding is about.
--
-- 2. Non-root task authorization failures were misreported as
--    STALE_VERSION instead of FORBIDDEN (planner_shift_task, LOW). The
--    per-task loop merged the authorization check and the stale-version
--    check into one EXISTS — a task that failed ONLY authorization (not
--    actually stale) still landed in v_stale_ids. The mutation was
--    correctly blocked either way (no bypass), but the wrong error code
--    sent the client down a dead-end "refresh and retry" path that can
--    never satisfy an authorization failure. Fixed: authorization and
--    staleness are now checked as two separate conditions per task, with
--    FORBIDDEN taking precedence when both are collected.
--
-- 3. Dependency-edge comparison had no lock on planner.dependencies
--    (planner_shift_task, MEDIUM). A concurrent INSERT referencing one of
--    the already-locked tasks is blocked (the FK's implicit FOR KEY SHARE
--    conflicts with this function's FOR UPDATE on planner.tasks), but a
--    concurrent DELETE of an existing dependency row needs no lock on the
--    parent task row and was NOT blocked — a manager deleting an edge
--    between the comparison SELECT and this transaction's commit could
--    slip past DEPENDENCY_CHANGED detection. Fixed: the matched
--    dependency rows are now locked FOR UPDATE immediately before the
--    comparison, so a concurrent DELETE blocks until this transaction
--    commits (same as the existing INSERT case).
--
-- 4. A syntactically valid but nonexistent assignee_user_id raised an
--    uncaught foreign_key_violation instead of typed INVALID_INPUT
--    (planner_update_task, MEDIUM — explicitly flagged as deferred in
--    pass 7's header, now closed). Fixed: the UPDATE is wrapped in its
--    own exception block catching foreign_key_violation.
--
-- Explicitly still deferred, not fixed in this round (unchanged from pass
-- 7's header — both remain genuine design-level gaps, not mechanical
-- fixes, and the audit that produced this round independently confirmed
-- both are effectively unreachable under the current locking model, not
-- live risks):
-- - "Shift apply loop partial commits" (needs a deliberate SAVEPOINT design).
-- - "No-op success breaks idempotency replay" (direct tension with pass 3's
--   no-phantom-audit-event fix — re-validating a no-op retry against
--   current state is arguably more correct than replaying a stale answer).

create or replace function public.planner_shift_task(
  p_instance_id uuid,
  p_root_task_id uuid,
  p_delta_days integer,
  p_idempotency_key text,
  p_changed_tasks jsonb,
  p_expected_dependency_edges jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_org_id uuid;
  v_status planner.instance_status;
  v_request_hash text;
  v_existing planner.events;
  v_task jsonb;
  v_task_id uuid;
  v_seen_ids uuid[] := '{}';
  v_expected_updated_at timestamptz;
  v_new_updated_at timestamptz;
  v_current_start date;
  v_current_end date;
  v_new_start date;
  v_new_end date;
  v_row_count integer;
  v_unauthorized_ids uuid[] := '{}';
  v_stale_ids uuid[] := '{}';
  v_current_edges jsonb;
  v_expected_edges jsonb;
  v_changed_result jsonb := '[]'::jsonb;
  v_response jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if p_delta_days is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if p_changed_tasks is null or jsonb_typeof(p_changed_tasks) <> 'array' or jsonb_array_length(p_changed_tasks) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if p_expected_dependency_edges is not null and jsonb_typeof(p_expected_dependency_edges) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  for v_task in select * from jsonb_array_elements(p_changed_tasks)
  loop
    begin
      v_task_id := (v_task ->> 'taskId')::uuid;
    exception
      when data_exception then
        return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end;

    if v_task_id is null then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end if;

    if v_task_id = any(v_seen_ids) then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end if;
    v_seen_ids := array_append(v_seen_ids, v_task_id);

    if nullif(v_task ->> 'newStartDate', '') is null or nullif(v_task ->> 'newEndDate', '') is null then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end if;
  end loop;

  begin

  select org_id, status into v_org_id, v_status
  from planner.instances
  where id = p_instance_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  -- Authorization now runs BEFORE the idempotency lookup (pass-8 fix #1) —
  -- a replay must still come from a currently-authorized actor. The
  -- terminal-instance check stays AFTER the idempotency lookup, unchanged;
  -- that's a separate, deliberate exemption (see header).
  if not public.is_org_member(v_org_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if not exists (
    select 1 from planner.tasks
    where id = p_root_task_id
      and instance_id = p_instance_id
      and (assignee_user_id = v_actor or planner.is_at_least(p_instance_id, 'contributor'))
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_request_hash := encode(
    extensions.digest(
      p_root_task_id::text || p_changed_tasks::text || coalesce(p_expected_dependency_edges::text, '[]') || p_delta_days::text,
      'sha256'
    ),
    'hex'
  );

  select * into v_existing
  from planner.events
  where actor_user_id = v_actor
    and instance_id = p_instance_id
    and event_type = 'task_shifted'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash = v_request_hash then
      return jsonb_set(v_existing.result_payload, '{replayed}', 'true'::jsonb);
    else
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
  end if;

  if v_status in ('completed', 'archived', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'INSTANCE_TERMINAL');
  end if;

  perform 1 from planner.tasks
  where instance_id = p_instance_id
    and id in (select (t ->> 'taskId')::uuid from jsonb_array_elements(p_changed_tasks) t)
  order by id
  for update;

  -- Pass-8 fix #2: authorization and staleness are now two separate
  -- conditions per task (previously merged into one EXISTS, which
  -- misreported an authorization failure as STALE_VERSION).
  for v_task in select * from jsonb_array_elements(p_changed_tasks)
  loop
    v_task_id := (v_task ->> 'taskId')::uuid;
    v_expected_updated_at := nullif(v_task ->> 'expectedUpdatedAt', '')::timestamptz;

    if v_expected_updated_at is null then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end if;

    if not exists (
      select 1 from planner.tasks
      where id = v_task_id
        and instance_id = p_instance_id
        and (assignee_user_id = v_actor or planner.is_at_least(p_instance_id, 'contributor'))
    ) then
      v_unauthorized_ids := array_append(v_unauthorized_ids, v_task_id);
    elsif not exists (
      select 1 from planner.tasks
      where id = v_task_id
        and instance_id = p_instance_id
        and updated_at = v_expected_updated_at
    ) then
      v_stale_ids := array_append(v_stale_ids, v_task_id);
    end if;
  end loop;

  if array_length(v_unauthorized_ids, 1) > 0 then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if array_length(v_stale_ids, 1) > 0 then
    return jsonb_build_object('ok', false, 'code', 'STALE_VERSION', 'conflicts', to_jsonb(v_stale_ids));
  end if;

  -- Pass-8 fix #3: lock the matched dependency rows before comparing them,
  -- so a concurrent DELETE (not blocked by the tasks' FOR UPDATE lock the
  -- way a concurrent INSERT is via the FK's implicit FOR KEY SHARE) can no
  -- longer slip past DEPENDENCY_CHANGED detection.
  perform 1 from planner.dependencies
  where instance_id = p_instance_id
    and (
      from_task_id in (select (t ->> 'taskId')::uuid from jsonb_array_elements(p_changed_tasks) t)
      or to_task_id in (select (t ->> 'taskId')::uuid from jsonb_array_elements(p_changed_tasks) t)
    )
  for update;

  select coalesce(jsonb_agg(
    jsonb_build_object('fromTaskId', from_task_id, 'toTaskId', to_task_id, 'lagDays', lag_days)
    order by from_task_id::text, to_task_id::text
  ), '[]'::jsonb)
  into v_current_edges
  from planner.dependencies
  where instance_id = p_instance_id
    and (
      from_task_id in (select (t ->> 'taskId')::uuid from jsonb_array_elements(p_changed_tasks) t)
      or to_task_id in (select (t ->> 'taskId')::uuid from jsonb_array_elements(p_changed_tasks) t)
    );

  select coalesce(jsonb_agg(e order by e ->> 'fromTaskId', e ->> 'toTaskId'), '[]'::jsonb)
  into v_expected_edges
  from jsonb_array_elements(coalesce(p_expected_dependency_edges, '[]'::jsonb)) e;

  if v_current_edges <> v_expected_edges then
    return jsonb_build_object('ok', false, 'code', 'DEPENDENCY_CHANGED');
  end if;

  for v_task in select * from jsonb_array_elements(p_changed_tasks)
  loop
    v_task_id := (v_task ->> 'taskId')::uuid;
    v_new_start := nullif(v_task ->> 'newStartDate', '')::date;
    v_new_end := nullif(v_task ->> 'newEndDate', '')::date;

    select start_date, end_date into v_current_start, v_current_end
    from planner.tasks where id = v_task_id;

    if v_current_start is distinct from v_new_start or v_current_end is distinct from v_new_end then
      update planner.tasks
        set start_date = v_new_start, end_date = v_new_end, updated_at = now()
        where id = v_task_id and instance_id = p_instance_id
        returning updated_at into v_new_updated_at;

      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
      end if;

      v_changed_result := v_changed_result || jsonb_build_object('taskId', v_task_id, 'updatedAt', v_new_updated_at);
    end if;
  end loop;

  v_response := jsonb_build_object('ok', true, 'replayed', false, 'changedTasks', v_changed_result, 'conflicts', '[]'::jsonb);

  if jsonb_array_length(v_changed_result) > 0 then
    begin
      insert into planner.events (
        instance_id, task_id, actor_user_id, event_type, payload,
        idempotency_key, request_hash, result_payload
      )
      values (
        p_instance_id, p_root_task_id, v_actor, 'task_shifted',
        jsonb_build_object('rootTaskId', p_root_task_id, 'deltaDays', p_delta_days, 'changedTasks', v_changed_result),
        p_idempotency_key, v_request_hash, v_response
      );
    exception
      when unique_violation then
        select * into v_existing
        from planner.events
        where actor_user_id = v_actor
          and instance_id = p_instance_id
          and event_type = 'task_shifted'
          and idempotency_key = p_idempotency_key;
        if found and v_existing.request_hash = v_request_hash then
          return jsonb_set(v_existing.result_payload, '{replayed}', 'true'::jsonb);
        end if;
        return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end;
  end if;

  return v_response;

  exception
    when data_exception then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end;
end;
$$;

comment on function public.planner_shift_task(uuid, uuid, integer, text, jsonb, jsonb) is
  'IPI-649 (security-fix pass 8) — persists a schedule shift PlannerEngine.shiftTask() already computed in-memory. Authorization checked before the idempotency lookup (a replay requires still being authorized); authorization and staleness are separate per-task checks (FORBIDDEN takes precedence over STALE_VERSION); dependency rows are locked before the edge comparison (blocks a concurrent DELETE the same way a concurrent INSERT is already blocked). Known unresolved gaps: no rollback of earlier writes on a mid-loop error (needs a SAVEPOINT design), and a fully no-op shift retry re-validates against current state rather than replaying (deliberate, see pass 3). See pass 1''s comment for the full locking model.';

create or replace function public.planner_update_task(
  p_task_id uuid,
  p_instance_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key text,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_org_id uuid;
  v_status planner.instance_status;
  v_request_hash text;
  v_existing planner.events;
  v_key text;
  v_row planner.tasks;
  v_new_title text;
  v_new_description text;
  v_new_status planner.task_status;
  v_new_assignee uuid;
  v_changed boolean;
  v_response jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if p_expected_updated_at is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    if not (v_key = any(array['title', 'description', 'status', 'assignee_user_id'])) then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end if;
  end loop;

  if p_patch ? 'title' and p_patch ->> 'title' is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;
  if p_patch ? 'status' and p_patch ->> 'status' is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if p_patch ? 'status'
    and not (p_patch ->> 'status' = any(enum_range(null::planner.task_status)::text[]))
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  begin

  select org_id, status into v_org_id, v_status
  from planner.instances
  where id = p_instance_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  -- Pass-8 fix #1 (same as planner_shift_task): authorization before the
  -- idempotency lookup. The task row must be locked to check per-task
  -- authorization, so that lock (and its NOT_FOUND check) moves up too;
  -- the idempotency lookup and terminal-instance check keep their
  -- existing relative order (idempotency before terminal, unchanged).
  if not public.is_org_member(v_org_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_row
  from planner.tasks
  where id = p_task_id and instance_id = p_instance_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if not (
    coalesce(v_row.assignee_user_id = v_actor, false)
    or planner.is_at_least(p_instance_id, 'contributor')
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if p_patch ? 'assignee_user_id' and not planner.is_at_least(p_instance_id, 'contributor') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_request_hash := encode(
    extensions.digest(p_task_id::text || p_instance_id::text || p_patch::text, 'sha256'),
    'hex'
  );

  select * into v_existing
  from planner.events
  where actor_user_id = v_actor
    and instance_id = p_instance_id
    and event_type = 'task_updated'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash = v_request_hash then
      return jsonb_set(v_existing.result_payload, '{replayed}', 'true'::jsonb);
    else
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
  end if;

  if v_status in ('completed', 'archived', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'INSTANCE_TERMINAL');
  end if;

  if v_row.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'STALE_VERSION');
  end if;

  v_new_title := case when p_patch ? 'title' then p_patch ->> 'title' else v_row.title end;
  v_new_description := case when p_patch ? 'description' then nullif(p_patch ->> 'description', '') else v_row.description end;
  v_new_status := case when p_patch ? 'status' then (p_patch ->> 'status')::planner.task_status else v_row.status end;
  v_new_assignee := case when p_patch ? 'assignee_user_id' then nullif(p_patch ->> 'assignee_user_id', '')::uuid else v_row.assignee_user_id end;

  v_changed :=
    v_new_title is distinct from v_row.title
    or v_new_description is distinct from v_row.description
    or v_new_status is distinct from v_row.status
    or v_new_assignee is distinct from v_row.assignee_user_id;

  if v_changed then
    begin
      update planner.tasks set
        title = v_new_title,
        description = v_new_description,
        status = v_new_status,
        assignee_user_id = v_new_assignee,
        updated_at = now()
      where id = p_task_id
      returning * into v_row;
    exception
      -- Pass-8 fix #4: a syntactically valid but nonexistent
      -- assignee_user_id previously raised an uncaught FK violation.
      when foreign_key_violation then
        return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end;
  end if;

  v_response := jsonb_build_object('ok', true, 'replayed', false, 'taskId', v_row.id, 'updatedAt', v_row.updated_at);

  if v_changed then
    begin
      insert into planner.events (
        instance_id, task_id, actor_user_id, event_type, payload,
        idempotency_key, request_hash, result_payload
      )
      values (
        p_instance_id, p_task_id, v_actor, 'task_updated', p_patch,
        p_idempotency_key, v_request_hash, v_response
      );
    exception
      when unique_violation then
        select * into v_existing
        from planner.events
        where actor_user_id = v_actor
          and instance_id = p_instance_id
          and event_type = 'task_updated'
          and idempotency_key = p_idempotency_key;
        if found and v_existing.request_hash = v_request_hash then
          return jsonb_set(v_existing.result_payload, '{replayed}', 'true'::jsonb);
        end if;
        return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end;
  end if;

  return v_response;

  exception
    when data_exception then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end;
end;
$$;

comment on function public.planner_update_task(uuid, uuid, timestamptz, text, jsonb) is
  'IPI-649 (security-fix pass 8) — single-row task field edit. Authorization (org membership, assignee/contributor+, assignee-reassignment gate) now runs before the idempotency lookup — a replay requires still being authorized. A nonexistent assignee_user_id now returns typed INVALID_INPUT instead of an uncaught FK violation. See pass 3''s comment for the minimal-writes/no-phantom-audit-event model, pass 1 for the full locking model.';
