-- IPI-649 · PLN-DATA-001B-M — seventh security-fix pass, from continued
-- Bugbot/Sentry re-review of commit 4c07fcd3 (round 6) on PR #418.
--
-- Fixed:
-- 1. Empty shift dates clear schedule (planner_shift_task, HIGH — Sentry +
--    Cursor, same finding): round 6 rejected an absent key or a JSON `null`
--    value for newStartDate/newEndDate, but not an empty string `""`. An
--    empty string has jsonb_typeof 'string' (not 'null'), so it passed
--    validation, then `nullif(v_task ->> 'newStartDate', '')::date`
--    downstream converts it to SQL NULL anyway, reopening the same
--    "clears the schedule" bug via a third input shape. Fixed: the
--    pre-pass check is unified into a single `nullif(v_task ->> 'key', '')
--    is null` test per date field — this one idiom covers all three ways a
--    date can be missing (absent key, JSON null, empty string) instead of
--    enumerating each shape separately, closing this category of finding
--    for good rather than one input shape at a time.
--
-- Explicitly deferred, not fixed in this round or session (see PR #418/#420
-- reply threads and the Step 7 final report for full rationale — each is a
-- genuine design-level gap, not a same-day mechanical fix):
-- - "No-op success breaks idempotency replay" (round 3's audit-log-cleanliness
--   fix means a no-op mutation has nothing to replay from on retry).
-- - "Shift apply loop partial commits" (a mid-loop INVALID_INPUT/NOT_FOUND
--   return does not roll back earlier writes in the same call — PL/pgSQL
--   function bodies are not automatically transactional across a `return`
--   inside nested exception blocks the way a single top-level statement is;
--   needs a deliberate SAVEPOINT/rollback design, not a one-line fix).
-- - "Invalid assignee crashes update RPC" (a syntactically valid but
--   nonexistent assignee_user_id hits the tasks.assignee_user_id foreign
--   key as an uncaught integrity_constraint_violation, SQLSTATE class 23,
--   which the existing data_exception handler — class 22 — does not catch;
--   needs its own foreign_key_violation handler, tracked as a follow-up).

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

  -- Reject a missing/null taskId, a duplicate taskId, or a date field that
  -- is absent, JSON null, OR an empty string — nullif(x, '') is null covers
  -- all three shapes in one check, rather than NULL-clearing a schedule.
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

  -- Outer guard: any malformed taskId/date/timestamp cast inside the rest
  -- of this function (jsonb-embedded strings, not the typed top-level uuid
  -- parameters) returns typed INVALID_INPUT instead of a raw Postgres
  -- error. The inner unique_violation handler around the events INSERT
  -- below is a different SQLSTATE class (23, not 22) and is unaffected.
  begin

  -- Instance-level lock FIRST — serializes concurrent identical retries.
  select org_id, status into v_org_id, v_status
  from planner.instances
  where id = p_instance_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_request_hash := encode(
    extensions.digest(
      p_root_task_id::text || p_changed_tasks::text || coalesce(p_expected_dependency_edges::text, '[]') || p_delta_days::text,
      'sha256'
    ),
    'hex'
  );

  -- Idempotency check runs before the terminal-status check — a replay of
  -- an already-successful mutation must return the cached result even if
  -- the instance has since become terminal, since replaying performs no
  -- new write.
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

  perform 1 from planner.tasks
  where instance_id = p_instance_id
    and id in (select (t ->> 'taskId')::uuid from jsonb_array_elements(p_changed_tasks) t)
  order by id
  for update;

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
        and updated_at = v_expected_updated_at
        and (assignee_user_id = v_actor or planner.is_at_least(p_instance_id, 'contributor'))
    ) then
      v_stale_ids := array_append(v_stale_ids, v_task_id);
    end if;
  end loop;

  if array_length(v_stale_ids, 1) > 0 then
    return jsonb_build_object('ok', false, 'code', 'STALE_VERSION', 'conflicts', to_jsonb(v_stale_ids));
  end if;

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

  -- Only record an audit event (and consume the idempotency key against a
  -- real mutation) when something actually changed — a fully no-op shift
  -- (every task's requested dates already match its current dates) must not
  -- pollute the audit log with a phantom 'task_shifted' event.
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
  'IPI-649 (security-fix pass 7) — persists a schedule shift PlannerEngine.shiftTask() already computed in-memory. NULL-safe idempotency key/delta, malformed-cast-safe (data_exception -> INVALID_INPUT), duplicate-taskId-safe and null-taskId-safe, both shift dates required non-empty/non-null on every changed-task entry, request hash includes root task id, replay exempted from the terminal-instance guard, no audit event for a fully no-op shift. Known unresolved gaps (see migration header): no rollback of earlier writes on a mid-loop error, and a nonexistent assignee_user_id on planner_update_task raises an uncaught FK violation rather than typed INVALID_INPUT. See pass 1''s comment for the full locking/authorization/dependency-comparison model.';
