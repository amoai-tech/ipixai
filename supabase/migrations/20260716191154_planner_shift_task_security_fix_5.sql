-- IPI-649 · PLN-DATA-001B-M — fifth security-fix pass, from continued
-- Bugbot re-review of commit 5e958e46 (round 3) on PR #418.
--
-- Fixed:
-- 1. Shift request hash ignores root task (planner_shift_task, MEDIUM):
--    v_request_hash was built from p_changed_tasks/p_expected_dependency_edges/
--    p_delta_days only — p_root_task_id was never included. Two requests
--    with the same idempotency key, same changed_tasks/delta but a
--    DIFFERENT p_root_task_id would collide in the hash and incorrectly
--    replay each other's result, misreporting rootTaskId in the audit log
--    and response. planner_update_task already includes its row identity
--    (p_task_id) in its own hash (round 2) — this brings shift's hash to
--    the same standard. Fixed: p_root_task_id::text is now part of the
--    hash input.
--
-- Not fixed here — deliberately, see reply on the PR thread:
-- "No-op success breaks idempotency replay" (MEDIUM): round 3's fix
-- (skip the events INSERT for a fully no-op mutation, to avoid a phantom
-- audit event per Sentry's earlier finding) means a retry of that same
-- no-op request has no stored event to replay from result_payload; it
-- re-validates from current state instead. This only differs from a true
-- replay if state changed between the two calls (instance went terminal,
-- a dependency changed, or the task was concurrently edited) — in every
-- one of those cases, giving the retry a fresh, accurate answer against
-- current reality is arguably more correct than replaying a stale
-- "nothing to do" result from before the state changed. Persisting a
-- lightweight idempotency-only record for no-ops (without treating it as
-- a real audit event) would resolve the tension but is a genuinely new
-- piece of schema/behavior, not a same-day mechanical fix — tracked as an
-- explicit unresolved risk rather than rushed.

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

  -- Reject a duplicate taskId, or an entry missing either date key, rather
  -- than silently double-processing or NULL-clearing a schedule.
  for v_task in select * from jsonb_array_elements(p_changed_tasks)
  loop
    begin
      v_task_id := (v_task ->> 'taskId')::uuid;
    exception
      when data_exception then
        return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end;
    if v_task_id = any(v_seen_ids) then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end if;
    v_seen_ids := array_append(v_seen_ids, v_task_id);

    if not (v_task ? 'newStartDate' and v_task ? 'newEndDate') then
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
  'IPI-649 (security-fix pass 5) — persists a schedule shift PlannerEngine.shiftTask() already computed in-memory. NULL-safe idempotency key/delta, malformed-cast-safe (data_exception -> INVALID_INPUT), duplicate-taskId-safe, requires both newStartDate/newEndDate on every changed-task entry, request hash includes root task id, replay exempted from the terminal-instance guard, no audit event for a fully no-op shift. See pass 1''s comment for the full locking/authorization/dependency-comparison model.';
