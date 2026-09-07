-- IPI-649 · PLN-DATA-001B-M — security fixes found by Bugbot/Codex review
-- of PR #418 (commit b66d28cd). Confirmed real, not false positives:
--
-- 1. NULL-assignee authorization bypass (planner_update_task, HIGH):
--    `NOT (assignee_user_id = actor OR is_at_least(...))` is NULL — not
--    TRUE — when assignee_user_id IS NULL and is_at_least is false, and
--    `IF NULL` never enters the branch in plpgsql. Any authenticated caller
--    who knew an unassigned task's id could update it. Fixed with
--    coalesce(assignee_user_id = actor, false).
-- 2. NULL expected_updated_at bypass (planner_update_task, HIGH):
--    `updated_at <> NULL` is also NULL, silently skipping the stale-version
--    check. Fixed by rejecting a NULL p_expected_updated_at up front and
--    using IS DISTINCT FROM (null-safe) instead of <>.
-- 3. Root-only authorization (planner_shift_task, HIGH): only p_root_task_id
--    was authorized, but every task in p_changed_tasks was written — a
--    caller authorized on the root task alone could overwrite dates on
--    tasks assigned to other people. Fixed: every task in changed_tasks now
--    independently passes the same assignee-or-contributor check.
-- 4. Missing org-membership check (both RPCs, MEDIUM): only
--    planner.is_at_least (checks planner.assignments) was checked, not
--    public.is_org_member — a user removed from the org but with a stale
--    assignments row could still mutate tasks. Both RPCs now also require
--    is_org_member.
-- 5. Idempotency check-then-insert race (both RPCs, MEDIUM/HIGH): the
--    idempotency SELECT ran before the instance-level lock, so two
--    concurrent identical requests could both pass the check and race on
--    the events INSERT, raising an uncaught unique_violation. Fixed by
--    moving the idempotency check to after the instance lock (so
--    concurrent identical calls now serialize and the second correctly
--    sees the first's committed result) plus an exception handler as
--    defense in depth.
-- 6. Dependency-edge sort mismatch (planner_shift_task, MEDIUM): the live
--    edges were sorted by native UUID columns (binary order); the client's
--    expected edges were sorted by JSON text extraction (lexicographic
--    order) — the same edge set could compare unequal, spuriously
--    rejecting a valid shift as DEPENDENCY_CHANGED. Fixed: both sides now
--    sort by ::text consistently.
-- 7. Unconditional updated_at bump (planner_shift_task, MEDIUM): the apply
--    loop wrote every task in p_changed_tasks even when start/end hadn't
--    actually changed, contradicting the "minimal writes" requirement and
--    risking spurious STALE_VERSION for other viewers. This RPC is granted
--    directly to `authenticated`, not reachable only through the trusted
--    TypeScript adapter that already filters to changed tasks — a crafted
--    direct call could force no-op writes. Fixed: only updates when the new
--    dates actually differ from current.
-- 8. Missing NOT FOUND guard after UPDATE...RETURNING (planner_shift_task,
--    MEDIUM): a zero-row update leaves prior loop-iteration values in
--    plpgsql, which could misreport a task as changed. Fixed with an
--    explicit `get diagnostics ... row_count` check.
-- 9. Update idempotency hash omitted task/instance id (planner_update_task,
--    MEDIUM): hashed p_patch only — the same key + same patch shape on a
--    different task incorrectly replayed the first task's result. Fixed:
--    hash now includes p_task_id + p_instance_id.
-- 10. Completed instances not read-only (both RPCs, P2): the terminal guard
--     only covered archived/cancelled. Universal-design-prompt-4/planner/
--     planner.md:410-414 defines Completed and Archived as read-only.
--     Fixed: 'completed' added to the guard (INSTANCE_TERMINAL still the
--     returned code — the frozen contract's error-code set is unchanged).
-- 11. Unvalidated JSON container types (both RPCs, P2): a non-array
--     p_changed_tasks/p_expected_dependency_edges, or a non-object p_patch,
--     raised a raw Postgres error from jsonb_array_length/jsonb_object_keys
--     instead of the promised typed INVALID_INPUT. Fixed with jsonb_typeof
--     checks before any array/object expansion.
-- 12. Reassignment restricted to contributors (planner_update_task, P1):
--     an assignee-only caller (not contributor+) could reassign a task away
--     from themselves via the assignee_user_id patch field — this SECURITY
--     DEFINER function bypasses tasks_update_assigned_or_contributor's
--     WITH CHECK, which would otherwise reject that resulting row under
--     real RLS. Fixed: assignee_user_id patches now require contributor+.
--
-- Known, deliberately NOT fixed in this migration (documented limitation):
-- dependency-table writes (insert/update/delete on planner.dependencies)
-- don't acquire the instance-level lock these two RPCs take, so a
-- concurrent dependency edit that lands between this RPC's live-edge
-- re-fetch and its commit isn't fully serialized against it. Closing this
-- requires a lock-acquiring trigger on planner.dependencies itself — a
-- schema-wide change affecting every future dependency-mutating RPC
-- (including IPI-483's), not something owned by this ticket. Flagged for a
-- follow-up rather than silently left unfixed.

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

  if p_changed_tasks is null or jsonb_typeof(p_changed_tasks) <> 'array' or jsonb_array_length(p_changed_tasks) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if p_expected_dependency_edges is not null and jsonb_typeof(p_expected_dependency_edges) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  -- Instance-level lock FIRST, before the idempotency check — serializes
  -- concurrent identical retries here, so the second caller sees the
  -- first's committed event on its idempotency SELECT below instead of
  -- racing it (fix #5).
  select org_id, status into v_org_id, v_status
  from planner.instances
  where id = p_instance_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_status in ('completed', 'archived', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'INSTANCE_TERMINAL');
  end if;

  v_request_hash := encode(
    extensions.digest(p_changed_tasks::text || coalesce(p_expected_dependency_edges::text, '[]') || p_delta_days::text, 'sha256'),
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

  if not public.is_org_member(v_org_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- Authorize the root task. NULL-safe by construction: this is a WHERE
  -- clause inside EXISTS, and SQL's 3-valued logic never selects a row
  -- whose condition evaluates to NULL (an unassigned task with
  -- is_at_least=false correctly yields "no matching row", not a silent pass).
  if not exists (
    select 1 from planner.tasks
    where id = p_root_task_id
      and instance_id = p_instance_id
      and (assignee_user_id = v_actor or planner.is_at_least(p_instance_id, 'contributor'))
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- Lock every affected task, id-ordered.
  perform 1 from planner.tasks
  where instance_id = p_instance_id
    and id in (select (t ->> 'taskId')::uuid from jsonb_array_elements(p_changed_tasks) t)
  order by id
  for update;

  -- Per-task authorization + stale-version check in one pass. A task that
  -- doesn't exist, has moved since the client's read, OR the caller isn't
  -- individually authorized for goes into v_stale_ids — every task being
  -- written must independently pass, not just the root (fix #3).
  -- Collapsing "not found / stale / not authorized for this task" into one
  -- signal is deliberate enumeration-safety, matching this file's existing
  -- convention (assertSelectDenied-style, don't leak which condition failed).
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

  -- Dependency edges — both sides sorted by ::text consistently (fix #6:
  -- native-UUID binary sort vs JSON-text lexicographic sort could reorder
  -- an identical edge set differently).
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

  -- Apply only rows whose dates actually change (fix #7 — minimal writes,
  -- enforced server-side, not just trusted from the caller's payload).
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
        -- Fix #8: never silently report a task as changed that a 0-row
        -- update didn't actually touch (row locked earlier — should be
        -- unreachable, but don't trust that without checking).
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
      -- Defense in depth — the instance lock above already closes the main
      -- race, this only fires if some other path hits the same key.
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
end;
$$;

comment on function public.planner_shift_task(uuid, uuid, integer, text, jsonb, jsonb) is
  'IPI-649 (security-fix pass) — persists a schedule shift PlannerEngine.shiftTask() already computed in-memory. Locks the instance then every affected task (id-ordered), independently authorizes and verifies updated_at on every task (not just root), verifies the live dependency-edge set, applies only rows with an actual date change, writes one planner.events audit row in the same transaction. Idempotent by (actor, instance, event_type, idempotency_key), race-safe via instance-lock-before-check plus an exception-handled insert.';

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
  v_response jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;

  if p_expected_updated_at is null then
    -- Fix #2: a NULL here made `updated_at <> NULL` evaluate to NULL,
    -- silently skipping the stale-version check entirely.
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

  if p_patch ? 'status'
    and not (p_patch ->> 'status' = any(enum_range(null::planner.task_status)::text[]))
  then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  select org_id, status into v_org_id, v_status
  from planner.instances
  where id = p_instance_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_status in ('completed', 'archived', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'INSTANCE_TERMINAL');
  end if;

  -- Fix #9: hash now includes task_id + instance_id, not just the patch —
  -- the same key + identically-shaped patch on a different task must not
  -- collide and silently replay the wrong task's result.
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

  -- Fix #1: coalesce(..., false) — an unassigned task (assignee_user_id
  -- IS NULL) must never silently pass authorization. Without this,
  -- `NOT (NULL OR is_at_least(...))` evaluates to NULL when is_at_least is
  -- also false, and `IF NULL` is treated as false in plpgsql — the guard
  -- was a complete no-op for any unassigned task.
  if not (
    coalesce(v_row.assignee_user_id = v_actor, false)
    or planner.is_at_least(p_instance_id, 'contributor')
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- Fix #12: reassigning a task away from oneself requires contributor+ —
  -- an assignee-only caller must not use this patch to hand the task to
  -- someone else. Mirrors tasks_update_assigned_or_contributor's WITH
  -- CHECK, which this SECURITY DEFINER function otherwise bypasses.
  if p_patch ? 'assignee_user_id' and not planner.is_at_least(p_instance_id, 'contributor') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- Fix #2 (continued): IS DISTINCT FROM is null-safe; kept even though a
  -- NULL p_expected_updated_at is already rejected above, since this is
  -- the correct operator for this comparison regardless.
  if v_row.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'STALE_VERSION');
  end if;

  update planner.tasks set
    title = case when p_patch ? 'title' then p_patch ->> 'title' else title end,
    description = case when p_patch ? 'description' then nullif(p_patch ->> 'description', '') else description end,
    status = case when p_patch ? 'status' then (p_patch ->> 'status')::planner.task_status else status end,
    assignee_user_id = case when p_patch ? 'assignee_user_id' then nullif(p_patch ->> 'assignee_user_id', '')::uuid else assignee_user_id end,
    updated_at = now()
  where id = p_task_id
  returning * into v_row;

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
end;
$$;

comment on function public.planner_update_task(uuid, uuid, timestamptz, text, jsonb) is
  'IPI-649 (security-fix pass) — single-row task field edit (title/description/status/assignee_user_id allowlist only). NULL-safe authorization and concurrency checks, org-membership required, reassignment requires contributor+, idempotency hash scoped to task+instance+patch, race-safe via instance-lock-before-check plus an exception-handled insert.';
