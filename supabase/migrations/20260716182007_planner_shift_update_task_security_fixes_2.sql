-- IPI-649 · PLN-DATA-001B-M — second security-fix pass, from Bugbot/Sentry
-- re-review of commit 0011fd57 (the first security-fix pass). Confirmed
-- real, fixed below, except one rejected false positive:
--
-- REJECTED — Sentry HIGH "idempotency hash is non-deterministic because
-- jsonb::text doesn't preserve key order": verified live before touching
-- anything —
--   select ('{"b":2,"a":1,"c":3}'::jsonb::text) = ('{"a":1,"b":2,"c":3}'::jsonb::text);
--   -- returns true
-- `jsonb` (unlike `json`) canonicalizes on storage — key order, whitespace,
-- and duplicate keys are all normalized, so `::text` is deterministic for a
-- given logical object regardless of input order. No fix applied; this
-- finding does not hold.
--
-- Fixed:
-- 1. NULL idempotency key bypass (both RPCs, MEDIUM): `idempotency_key =
--    NULL` never matches in SQL, and the unique constraint permits multiple
--    NULLs — a NULL key completely bypassed idempotency. Fixed: reject
--    NULL/empty p_idempotency_key up front with INVALID_INPUT.
-- 2. Invalid taskId/date/uuid crashes the RPC (both RPCs, MEDIUM): direct
--    `::uuid`/`::date`/`::timestamptz` casts on malformed jsonb-embedded
--    strings raised a raw Postgres error instead of the documented
--    INVALID_INPUT. Fixed: the whole function body is now wrapped in an
--    outer exception handler for SQLSTATE class 22 (data_exception —
--    invalid_text_representation, invalid_datetime_format, etc.), mapped
--    to INVALID_INPUT. The existing inner unique_violation handler around
--    the events INSERT is untouched (class 23, a different SQLSTATE class,
--    still handled first and more specifically).
-- 3. NULL p_delta_days breaks the shift idempotency hash (MEDIUM): an
--    unvalidated NULL delta made the `||` concatenation (and therefore the
--    stored hash) NULL, so a legitimate retry's hash comparison could never
--    match. Fixed: reject a NULL p_delta_days up front.
-- 4. Duplicate taskId duplicates results (planner_shift_task, LOW): the
--    apply loop didn't guard against the same taskId appearing twice in
--    p_changed_tasks, which could update + report that row twice in one
--    response. Fixed: reject a payload containing a duplicate taskId with
--    INVALID_INPUT (matches this file's existing "reject malformed input,
--    don't silently coerce it" convention) rather than silently de-duping.
-- 5. Terminal guard blocks a legitimate replay (both RPCs, MEDIUM): the
--    completed/archived/cancelled check ran before the idempotency lookup,
--    so a retry of an already-successful mutation issued after the instance
--    later became terminal got INSTANCE_TERMINAL instead of the promised
--    cached {replayed:true} response. Fixed: idempotency check now runs
--    right after the instance lock, before the terminal-status check — a
--    replay returns the original result regardless of the instance's
--    current status, since it performs no new write.
-- 6. planner_update_task always bumps updated_at (MEDIUM): every allowed
--    patch forced a version bump + audit event even when the patched
--    fields were unchanged, unlike planner_shift_task's minimal-writes fix
--    from the first pass. Fixed: only updates when at least one patched
--    field's new value actually differs from the current row.
-- 7. NULL title violates a NOT NULL constraint (planner_update_task,
--    MEDIUM): `p_patch = {"title": null}` has the key present but a JSON
--    null value; `p_patch->>'title'` returns SQL NULL, which would hit
--    `title`'s NOT NULL constraint as a raw Postgres error. Same latent
--    class of bug applies to `status` (also NOT NULL) — `p_patch->>'status'
--    IS NULL` would make the enum-membership check itself evaluate to NULL,
--    silently skipping validation (the same 3-valued-logic trap as pass 1's
--    NULL-assignee bug). Fixed: explicit NULL rejection for both `title`
--    and `status` when their key is present. `description`/
--    `assignee_user_id` are nullable columns — a JSON null there is a
--    legitimate "clear the field" value, already handled correctly by the
--    existing nullif(...) pattern.

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

  -- Reject a duplicate taskId rather than silently double-processing it.
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
    extensions.digest(p_changed_tasks::text || coalesce(p_expected_dependency_edges::text, '[]') || p_delta_days::text, 'sha256'),
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

  return v_response;

  exception
    when data_exception then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end;
end;
$$;

comment on function public.planner_shift_task(uuid, uuid, integer, text, jsonb, jsonb) is
  'IPI-649 (security-fix pass 2) — persists a schedule shift PlannerEngine.shiftTask() already computed in-memory. NULL-safe idempotency key/delta, malformed-cast-safe (data_exception -> INVALID_INPUT), duplicate-taskId-safe, replay exempted from the terminal-instance guard. See pass 1''s comment for the full locking/authorization/dependency-comparison model.';

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

  -- title/status are NOT NULL columns — a JSON null value for either
  -- (key present, value null) must be rejected explicitly, not silently
  -- forwarded to a raw constraint violation or a 3-valued-logic-skipped
  -- enum check.
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

  -- Outer guard: a malformed assignee_user_id UUID (or any other cast
  -- below) returns typed INVALID_INPUT instead of a raw Postgres error.
  begin

  select org_id, status into v_org_id, v_status
  from planner.instances
  where id = p_instance_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_request_hash := encode(
    extensions.digest(p_task_id::text || p_instance_id::text || p_patch::text, 'sha256'),
    'hex'
  );

  -- Idempotency check before the terminal-status check — same replay
  -- exemption as planner_shift_task above.
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

  if v_row.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'STALE_VERSION');
  end if;

  -- Resolve each patched field's new value once, so the minimal-write
  -- comparison below and the actual UPDATE use identical values.
  v_new_title := case when p_patch ? 'title' then p_patch ->> 'title' else v_row.title end;
  v_new_description := case when p_patch ? 'description' then nullif(p_patch ->> 'description', '') else v_row.description end;
  v_new_status := case when p_patch ? 'status' then (p_patch ->> 'status')::planner.task_status else v_row.status end;
  v_new_assignee := case when p_patch ? 'assignee_user_id' then nullif(p_patch ->> 'assignee_user_id', '')::uuid else v_row.assignee_user_id end;

  -- Minimal writes: only touch the row (and bump updated_at / write an
  -- audit event) if at least one field's resolved value actually differs
  -- from the current row — matches planner_shift_task's pass-1 fix.
  if v_new_title is distinct from v_row.title
    or v_new_description is distinct from v_row.description
    or v_new_status is distinct from v_row.status
    or v_new_assignee is distinct from v_row.assignee_user_id
  then
    update planner.tasks set
      title = v_new_title,
      description = v_new_description,
      status = v_new_status,
      assignee_user_id = v_new_assignee,
      updated_at = now()
    where id = p_task_id
    returning * into v_row;
  end if;

  v_response := jsonb_build_object('ok', true, 'replayed', false, 'taskId', v_row.id, 'updatedAt', v_row.updated_at);

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

  return v_response;

  exception
    when data_exception then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end;
end;
$$;

comment on function public.planner_update_task(uuid, uuid, timestamptz, text, jsonb) is
  'IPI-649 (security-fix pass 2) — single-row task field edit. NULL-safe idempotency key, NULL-safe title/status rejection, malformed-cast-safe (data_exception -> INVALID_INPUT), minimal writes (no-op patch does not bump updated_at or write an event), replay exempted from the terminal-instance guard. See pass 1''s comment for the full authorization/concurrency model.';
