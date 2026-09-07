-- IPI-649 · PLN-DATA-001B-M — ninth security-fix pass, from continued bot
-- re-review (Sentry) of round 8's own migration file.
--
-- Fixed:
-- planner_update_task's idempotency request_hash omitted
-- p_expected_updated_at (MEDIUM). planner_shift_task's hash already covers
-- its per-task CAS token implicitly (expectedUpdatedAt is a field inside
-- each entry of p_changed_tasks, which IS part of that function's hash
-- input) — planner_update_task's hash only covered p_task_id, p_instance_id,
-- and p_patch, an inconsistency between the two RPCs. A client that reused
-- the same idempotency_key across two logically-different update attempts
-- with an identical patch but different expectedUpdatedAt values (a client
-- bug — keys should be unique per logical mutation, not shared) would have
-- them incorrectly treated as the same request, replaying the earlier
-- stored response. A genuine same-request retry is unaffected either way:
-- it never re-touches the row (replay returns the stored response
-- verbatim, it doesn't re-run the UPDATE), so this was never a path to
-- writing stale data — but including expected_updated_at closes the gap
-- and brings both RPCs' hash inputs to the same standard.

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

  -- Pass-9 fix: p_expected_updated_at is now part of the hash input,
  -- matching planner_shift_task's implicit coverage of its per-task CAS
  -- token via p_changed_tasks.
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
  'IPI-649 (security-fix pass 9) — single-row task field edit. Idempotency request_hash now includes p_expected_updated_at, matching planner_shift_task''s implicit CAS coverage. See pass 8 for authorization-before-idempotency ordering, pass 3 for the minimal-writes model, pass 1 for the full locking model.';
