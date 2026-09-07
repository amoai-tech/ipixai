-- IPI-649 · PLN-DATA-001B-M — Planner Workspace task mutation RPCs.
--
-- Adds the two transactional RPCs IPI-574 originally scoped but never shipped
-- (its Done status covered reads only — PR #405/#411). Mirrors the established
-- public.planner_invite_member/planner_update_role pattern exactly: security
-- definer, empty search_path, schema-qualified relations, revoke public/anon,
-- grant authenticated only.
--
-- Contract correction found during implementation (2026-07-16): IPI-649's
-- frozen `PlannerShiftTaskInput.expectedTasks` type only carried
-- `{taskId, expectedUpdatedAt}` — the stale-version check input — with no
-- field for the *new* dates PlannerEngine.shiftTask() computes in step 5 of
-- the 10-step flow. Without new dates the RPC would have nothing to persist
-- in step 7. Renamed the array to `changedTasks` and added `newStartDate`/
-- `newEndDate` per entry. Linear ticket updated to match post-merge.
--
-- setViewConfig needs no RPC: planner.view_configs already has
-- user_id = auth.uid() RLS on all 4 verbs (view_configs_select_own /
-- _insert_own / _update_own / _delete_own) — a plain upsert through the
-- schema-scoped client already respects RLS. That wiring lands in the
-- application-adapter PR, not here.
--
-- Rollback (manual — this repo's migrations are forward-only, no down-script
-- is auto-run; apply as a new forward migration if this needs reverting):
--
--   drop function if exists public.planner_shift_task(uuid, uuid, integer, text, jsonb, jsonb);
--   drop function if exists public.planner_update_task(uuid, uuid, timestamptz, text, jsonb);
--
--   -- Only safe once no planner.events row depends on these columns — check first:
--   --   select count(*) from planner.events where idempotency_key is not null;
--   -- At ship time planner.events has 0 rows, so an immediate rollback is safe.
--   -- Once production rows exist with a real idempotency_key/request_hash/
--   -- result_payload, dropping the columns destroys that audit data — treat
--   -- that case as a documented manual decision (do NOT drop automatically),
--   -- not something this migration or a rollback script does for you.
--   alter table planner.events drop constraint if exists events_idempotency_unique;
--   alter table planner.events drop column if exists idempotency_key;
--   alter table planner.events drop column if exists request_hash;
--   alter table planner.events drop column if exists result_payload;

-- ── 1. Idempotency columns on planner.events ───────────────────────────────
-- Composite unique includes actor_user_id: idempotency keys aren't guaranteed
-- globally unique across users (IPI-574 pass 2 correction #8).

alter table planner.events
  add column if not exists idempotency_key text,
  add column if not exists request_hash text,
  add column if not exists result_payload jsonb;

alter table planner.events
  add constraint events_idempotency_unique
    unique (actor_user_id, instance_id, event_type, idempotency_key);

comment on column planner.events.idempotency_key is
  'IPI-649 — client-supplied key for planner_shift_task/planner_update_task replay. Null for non-mutation event types (member_invited, etc).';
comment on column planner.events.request_hash is
  'IPI-649 — sha256 of the mutation payload. Same idempotency_key + different hash → IDEMPOTENCY_CONFLICT, not a silent overwrite.';
comment on column planner.events.result_payload is
  'IPI-649 — the exact response returned to the original caller, replayed verbatim (with replayed:true) on a matching retry.';

-- ── 2. planner_shift_task ───────────────────────────────────────────────────
-- Persists a schedule shift PlannerEngine.shiftTask() already computed
-- in-memory (application code, not this RPC). This RPC only locks, validates,
-- and commits — it never runs schedule math itself.

create or replace function public.planner_shift_task(
  p_instance_id uuid,
  p_root_task_id uuid,
  p_delta_days integer,
  p_idempotency_key text,
  p_changed_tasks jsonb,             -- [{taskId, expectedUpdatedAt, newStartDate, newEndDate}]
  p_expected_dependency_edges jsonb  -- [{fromTaskId, toTaskId, lagDays}]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_status planner.instance_status;
  v_request_hash text;
  v_existing planner.events;
  v_task jsonb;
  v_task_id uuid;
  v_new_updated_at timestamptz;
  v_stale_ids uuid[] := '{}';
  v_current_edges jsonb;
  v_expected_edges jsonb;
  v_changed_result jsonb := '[]'::jsonb;
  v_response jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;

  if p_changed_tasks is null or jsonb_array_length(p_changed_tasks) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  v_request_hash := encode(
    extensions.digest(p_changed_tasks::text || coalesce(p_expected_dependency_edges::text, '[]') || p_delta_days::text, 'sha256'),
    'hex'
  );

  -- Idempotent replay: same key + same payload → return the stored result.
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

  -- Instance-level lock — serializes all schedule-affecting writes on this
  -- instance (IPI-574 pass 2 correction #9). Held for the RPC's duration.
  select status into v_status
  from planner.instances
  where id = p_instance_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_status in ('archived', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'INSTANCE_TERMINAL');
  end if;

  -- Authorize against the root task — mirrors tasks_update_assigned_or_contributor
  -- RLS exactly (assignee, or contributor+ on the instance).
  if not exists (
    select 1 from planner.tasks
    where id = p_root_task_id
      and instance_id = p_instance_id
      and (assignee_user_id = v_actor or planner.is_at_least(p_instance_id, 'contributor'))
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- Lock every affected task, id-ordered so concurrent callers acquire locks
  -- in the same order regardless of which task they touch first.
  perform 1 from planner.tasks
  where instance_id = p_instance_id
    and id in (select (t ->> 'taskId')::uuid from jsonb_array_elements(p_changed_tasks) t)
  order by id
  for update;

  -- Stale-version check on every affected task, not just the root.
  for v_task in select * from jsonb_array_elements(p_changed_tasks)
  loop
    if not exists (
      select 1 from planner.tasks
      where id = (v_task ->> 'taskId')::uuid
        and instance_id = p_instance_id
        and updated_at = (v_task ->> 'expectedUpdatedAt')::timestamptz
    ) then
      v_stale_ids := array_append(v_stale_ids, (v_task ->> 'taskId')::uuid);
    end if;
  end loop;

  if array_length(v_stale_ids, 1) > 0 then
    return jsonb_build_object('ok', false, 'code', 'STALE_VERSION', 'conflicts', to_jsonb(v_stale_ids));
  end if;

  -- Re-fetch live dependency edges touching the affected tasks and compare
  -- as a canonicalized set, not an array (insertion order isn't guaranteed
  -- to match between the client's read and this re-fetch).
  select coalesce(jsonb_agg(
    jsonb_build_object('fromTaskId', from_task_id, 'toTaskId', to_task_id, 'lagDays', lag_days)
    order by from_task_id, to_task_id
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

  -- Apply only the rows with an actual date change (IPI-574 AC-C — minimal writes).
  for v_task in select * from jsonb_array_elements(p_changed_tasks)
  loop
    update planner.tasks
      set start_date = nullif(v_task ->> 'newStartDate', '')::date,
          end_date = nullif(v_task ->> 'newEndDate', '')::date,
          updated_at = now()
      where id = (v_task ->> 'taskId')::uuid
        and instance_id = p_instance_id
      returning id, updated_at into v_task_id, v_new_updated_at;

    v_changed_result := v_changed_result || jsonb_build_object('taskId', v_task_id, 'updatedAt', v_new_updated_at);
  end loop;

  v_response := jsonb_build_object('ok', true, 'replayed', false, 'changedTasks', v_changed_result, 'conflicts', '[]'::jsonb);

  insert into planner.events (
    instance_id, task_id, actor_user_id, event_type, payload,
    idempotency_key, request_hash, result_payload
  )
  values (
    p_instance_id, p_root_task_id, v_actor, 'task_shifted',
    jsonb_build_object('rootTaskId', p_root_task_id, 'deltaDays', p_delta_days, 'changedTasks', v_changed_result),
    p_idempotency_key, v_request_hash, v_response
  );

  return v_response;
end;
$$;

comment on function public.planner_shift_task(uuid, uuid, integer, text, jsonb, jsonb) is
  'IPI-649 — persists a schedule shift PlannerEngine.shiftTask() already computed in-memory. Locks the instance then every affected task (id-ordered), verifies each task''s updated_at and the live dependency-edge set, applies only changed rows, writes one planner.events audit row in the same transaction. Idempotent by (actor, instance, event_type, idempotency_key): matching retry replays the stored result, mismatched payload under the same key returns IDEMPOTENCY_CONFLICT.';

revoke all on function public.planner_shift_task(uuid, uuid, integer, text, jsonb, jsonb) from public;
revoke all on function public.planner_shift_task(uuid, uuid, integer, text, jsonb, jsonb) from anon;
grant execute on function public.planner_shift_task(uuid, uuid, integer, text, jsonb, jsonb) to authenticated;

-- ── 3. planner_update_task ──────────────────────────────────────────────────
-- Single-row field edit — its own RPC per IPI-574 pass 2 correction #7 (a
-- separate .update() + a separate audit insert are still two implicit
-- transactions; the second can fail after the first commits).

create or replace function public.planner_update_task(
  p_task_id uuid,
  p_instance_id uuid,
  p_expected_updated_at timestamptz,
  p_idempotency_key text,
  p_patch jsonb  -- allowlisted subset of {title, description, status, assignee_user_id}
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
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

  if p_patch is null or p_patch = '{}'::jsonb then
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

  v_request_hash := encode(extensions.digest(p_patch::text, 'sha256'), 'hex');

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

  select status into v_status
  from planner.instances
  where id = p_instance_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_status in ('archived', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'INSTANCE_TERMINAL');
  end if;

  select * into v_row
  from planner.tasks
  where id = p_task_id and instance_id = p_instance_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if not (v_row.assignee_user_id = v_actor or planner.is_at_least(p_instance_id, 'contributor')) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_row.updated_at <> p_expected_updated_at then
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

  insert into planner.events (
    instance_id, task_id, actor_user_id, event_type, payload,
    idempotency_key, request_hash, result_payload
  )
  values (
    p_instance_id, p_task_id, v_actor, 'task_updated', p_patch,
    p_idempotency_key, v_request_hash, v_response
  );

  return v_response;
end;
$$;

comment on function public.planner_update_task(uuid, uuid, timestamptz, text, jsonb) is
  'IPI-649 — single-row task field edit (title/description/status/assignee_user_id allowlist only). One transaction: lock instance, lock task, verify updated_at, apply, write audit event. Same idempotency/terminal-instance guards as planner_shift_task.';

revoke all on function public.planner_update_task(uuid, uuid, timestamptz, text, jsonb) from public;
revoke all on function public.planner_update_task(uuid, uuid, timestamptz, text, jsonb) from anon;
grant execute on function public.planner_update_task(uuid, uuid, timestamptz, text, jsonb) to authenticated;
