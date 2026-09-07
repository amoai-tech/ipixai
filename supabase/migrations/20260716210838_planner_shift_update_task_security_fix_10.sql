-- IPI-649 · PLN-DATA-001B-M — tenth security-fix pass, from CodeRabbit's
-- first full review pass on this PR (verified against official Postgres/
-- Supabase idempotency and SECURITY DEFINER guidance before implementing —
-- see round-10 PR comment for sources).
--
-- Fixed:
--
-- 1. Reauthorize every changed task before replaying, not just the root
--    task (planner_shift_task, Major/quick-win). Round 8 moved the ROOT
--    task's authorization check before the idempotency lookup, but the
--    per-task authorization check for every OTHER task in p_changed_tasks
--    still ran after the idempotency lookup (merged with the staleness
--    check in that same later loop). An actor who remains authorized for
--    the root task (e.g. still its direct assignee) but has since lost
--    access to a SECONDARY task in the same payload (no longer assigned
--    to it, demoted below contributor) could still replay a cached
--    success that touched that secondary task. Fixed: task locking and
--    per-task AUTHORIZATION are now a separate pass that runs before the
--    idempotency lookup, alongside the root-task check. Per-task
--    STALENESS is still checked afterward (it must read the freshly
--    locked row state, and staleness alone was never an idempotency-
--    replay bypass — only authorization was).
--
-- 2. Require org membership for a patched assignee (planner_update_task,
--    Major/quick-win). The existing tasks.assignee_user_id -> auth.users
--    foreign key only proves the target id is a real user somewhere in
--    the system — not that they belong to this instance's org. An
--    authorized contributor could assign a task to any valid user id,
--    including someone with no relationship to the org at all. Fixed:
--    a non-null patched assignee must now be a public.org_members row for
--    the instance's org_id, returning INVALID_INPUT otherwise — same
--    validation shape already applied to invites via
--    planner_invite_member's user_not_in_org check, just extended to task
--    assignment.
--
-- Reviewed and NOT changed, with reasoning (CodeRabbit "Heavy Lift" item,
-- not a quick fix — a deliberate scope decision, not a silent skip):
-- - "Validate/recompute shifted dates server-side" — planner_shift_task
--   is deliberately a persist-only RPC by design (see pass 1's header):
--   PlannerEngine.shiftTask() computes the schedule in TypeScript: this
--   RPC locks, authorizes, and commits, it never re-runs schedule math.
--   An authorized contributor/assignee already has standing authority to
--   change a task's dates (planner_update_task just doesn't happen to
--   expose date fields in its patch allowlist) — this isn't a privilege
--   escalation. Whether the RPC should ALSO validate the resulting dates
--   against the dependency graph's ordering constraints (not just that
--   the edge set is unchanged) is a genuine architectural question for a
--   future ticket, not a same-session mechanical fix.

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

  -- Pass-10 fix #1: lock every changed task and check AUTHORIZATION for
  -- all of them (not just the root task) BEFORE the idempotency lookup —
  -- a replay must still be authorized for every task it touches.
  -- Staleness (which needs the freshly locked row state, checked again
  -- after the terminal-instance guard below) is intentionally NOT part of
  -- this pass.
  perform 1 from planner.tasks
  where instance_id = p_instance_id
    and id in (select (t ->> 'taskId')::uuid from jsonb_array_elements(p_changed_tasks) t)
  order by id
  for update;

  for v_task in select * from jsonb_array_elements(p_changed_tasks)
  loop
    v_task_id := (v_task ->> 'taskId')::uuid;
    if not exists (
      select 1 from planner.tasks
      where id = v_task_id
        and instance_id = p_instance_id
        and (assignee_user_id = v_actor or planner.is_at_least(p_instance_id, 'contributor'))
    ) then
      v_unauthorized_ids := array_append(v_unauthorized_ids, v_task_id);
    end if;
  end loop;

  if array_length(v_unauthorized_ids, 1) > 0 then
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

  -- Pass-10: staleness only (authorization for these tasks was already
  -- confirmed above, before the idempotency lookup).
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
    ) then
      v_stale_ids := array_append(v_stale_ids, v_task_id);
    end if;
  end loop;

  if array_length(v_stale_ids, 1) > 0 then
    return jsonb_build_object('ok', false, 'code', 'STALE_VERSION', 'conflicts', to_jsonb(v_stale_ids));
  end if;

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
  'IPI-649 (security-fix pass 10) — persists a schedule shift PlannerEngine.shiftTask() already computed in-memory. Every changed task (not just the root) is locked and authorization-checked before the idempotency lookup — a replay requires still being authorized for every task it touches. Staleness is checked separately, after the terminal-instance guard. Dependency rows are locked before the edge comparison. See pass 8 for the FORBIDDEN-vs-STALE_VERSION precedence, pass 1 for the full locking model.';

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

  -- Pass-10 fix #2: a non-null patched assignee must belong to this
  -- instance's org — the assignee_user_id -> auth.users FK only proves
  -- the id is a real user somewhere, not that they're in this org.
  -- Same validation shape as planner_invite_member's user_not_in_org.
  if p_patch ? 'assignee_user_id' and nullif(p_patch ->> 'assignee_user_id', '') is not null then
    if not exists (
      select 1 from public.org_members
      where org_id = v_org_id
        and user_id = (p_patch ->> 'assignee_user_id')::uuid
    ) then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end if;
  end if;

  v_request_hash := encode(
    extensions.digest(p_task_id::text || p_instance_id::text || p_expected_updated_at::text || p_patch::text, 'sha256'),
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
  'IPI-649 (security-fix pass 10) — single-row task field edit. A non-null patched assignee_user_id must be a member of the instance''s org (INVALID_INPUT otherwise), same shape as planner_invite_member''s user_not_in_org check. See pass 9 for the hash/CAS coverage, pass 8 for authorization-before-idempotency ordering, pass 1 for the full locking model.';
