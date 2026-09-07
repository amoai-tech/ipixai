-- IPI-483 · PLN-ENG-002 — Workflow Dependencies and Gate Approvals (PR1: migration)
--
-- Adds planner.gate_approvals + atomic approve/discard RPCs. Reuses the
-- IPI-649 concurrency/idempotency conventions exactly:
--   security definer, empty search_path, schema-qualified relations,
--   revoke public/anon, grant authenticated only,
--   (actor_user_id, instance_id, event_type, idempotency_key) replay via
--   planner.events with request_hash / result_payload,
--   STALE_VERSION / IDEMPOTENCY_CONFLICT / FORBIDDEN / UNAUTHENTICATED codes.
--
-- This file is a faithful reconstruction of the migration as applied to the
-- remote project (supabase migration list --linked: 20260802100030). The
-- deployed objects are the source of truth; if any object below drifts from
-- the live database, reconcile the file from the database rather than
-- hand-editing — the migration is already in the remote ledger and will never
-- replay via `supabase db push`.
--
-- Approve commits approval + optional task date shifts + audit event in ONE
-- transaction. Reachability = gate_type not null + at least one non-cancelled
-- phase task + every non-cancelled phase task done (cancelled tasks are
-- ignored, matching resolveGateVisualState) + is_at_least(coalesce
-- (required_role,'manager')) with viewer always denied. Phase tasks are
-- locked (for update) before the reachability check and every changed task is
-- version-CAS'd (expectedUpdatedAt). Dependency edges are locked and CAS'd
-- against a canonical three-key snapshot {fromTaskId, toTaskId, lagDays};
-- existing dep_type values are preserved on replace (only finish_to_start is
-- accepted from the client in Phase 1). Cycle detection (linear topological
-- peel, no path-length bound) runs only when p_proposed_dependency_edges is
-- not null; date-only approvals skip it but still CAS p_expected_dependency_edges
-- against the live graph.
--
-- Idempotency: the audit event insert (planner.events) doubles as the replay
-- claim; a unique_violation on a racing duplicate returns replay (result_payload
-- with replayed:true) or IDEMPOTENCY_CONFLICT. The loser's mutations are
-- value-identical to the winner's (same key + hash), and the STALE_VERSION /
-- DEPENDENCY_CHANGED CAS gates run before any write, so a duplicate can never
-- commit divergent state.
--
-- Edit is client-side proposal regeneration (no RPC). Discard persists
-- status='discarded' without shifting dates; replay is checked before the
-- GATE_ALREADY_APPROVED guard so a retry of a committed discard replays.
--
-- Rollback (manual forward migration if needed):
--   drop function if exists public.planner_approve_gate(uuid, uuid, text, jsonb, jsonb, jsonb);
--   drop function if exists public.planner_discard_gate(uuid, uuid, text, text);
--   drop function if exists planner.dependency_edges_have_cycle(jsonb);
--   drop function if exists planner.gate_phase_tasks_done(uuid, uuid);
--   drop table if exists planner.gate_approvals;

-- ── 1. Table ───────────────────────────────────────────────────────────────

create table planner.gate_approvals (
  id              uuid primary key default gen_random_uuid(),
  instance_id     uuid not null references planner.instances(id) on delete cascade,
  phase_id        uuid not null references planner.phases(id) on delete cascade,
  status          text not null check (status in ('reachable', 'approved', 'discarded')),
  approved_by     uuid references auth.users(id) on delete set null,
  approved_at     timestamptz,
  idempotency_key text,
  request_hash    text,
  result_payload  jsonb,
  updated_at      timestamptz not null default now(),
  unique (instance_id, phase_id)
);

comment on table planner.gate_approvals is
  'IPI-483 — persisted human gate decision per planner instance phase. Completing tasks alone never writes approved; Approved requires this row with status=approved.';
comment on column planner.gate_approvals.status is
  'reachable = proposal open; approved = committed human decision; discarded = proposal abandoned without approving.';
comment on column planner.gate_approvals.idempotency_key is
  'IPI-483 — mirrors planner.events.idempotency_key for the approving/discarding actor. Null until first mutation.';
comment on column planner.gate_approvals.request_hash is
  'IPI-483 — sha256 of the mutation payload; same key + different hash → IDEMPOTENCY_CONFLICT.';
comment on column planner.gate_approvals.result_payload is
  'IPI-483 — exact RPC response replayed (with replayed:true) on a matching retry.';

create index gate_approvals_phase_id_idx on planner.gate_approvals (phase_id);
create index gate_approvals_instance_status_idx on planner.gate_approvals (instance_id, status);

create trigger gate_approvals_updated_at
  before update on planner.gate_approvals
  for each row execute function public.handle_updated_at();

-- ── 2. RLS ─────────────────────────────────────────────────────────────────
-- Reads: assigned org members (viewer+), same assignment+org pattern as tasks.
-- Writes: SECURITY DEFINER RPCs only — no authenticated INSERT/UPDATE/DELETE.

alter table planner.gate_approvals enable row level security;

create policy "gate_approvals_select_org"
  on planner.gate_approvals
  for select
  to authenticated
  using (
    exists (
      select 1
      from planner.instances i
      where i.id = gate_approvals.instance_id
        and public.is_org_member(i.org_id)
    )
    and planner.is_at_least(instance_id, 'viewer')
  );

grant select on table planner.gate_approvals to authenticated;
revoke insert, update, delete on table planner.gate_approvals from authenticated;
revoke all on table planner.gate_approvals from anon;

-- ── 3. Internal helpers ────────────────────────────────────────────────────

-- Phase 1 reachability (matches resolveGateVisualState): at least one
-- non-cancelled task for (instance, phase) and every non-cancelled task done.
create or replace function planner.gate_phase_tasks_done(
  p_instance_id uuid,
  p_phase_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from planner.tasks
      where instance_id = p_instance_id and phase_id = p_phase_id
        and status is distinct from 'cancelled'::planner.task_status
    )
    and not exists (
      select 1 from planner.tasks
      where instance_id = p_instance_id
        and phase_id = p_phase_id
        and status is distinct from 'done'::planner.task_status
        and status is distinct from 'cancelled'::planner.task_status
    );
$$;

comment on function planner.gate_phase_tasks_done(uuid, uuid) is
  'IPI-483 — true when the phase has at least one non-cancelled task and every non-cancelled task is done for the instance. Cancelled tasks are excluded, matching planner-view-model.ts. Does not check actor role.';

revoke all on function planner.gate_phase_tasks_done(uuid, uuid) from public;
revoke all on function planner.gate_phase_tasks_done(uuid, uuid) from anon;
revoke all on function planner.gate_phase_tasks_done(uuid, uuid) from authenticated;

-- Linear topological-peel cycle check: repeatedly remove nodes without an
-- incoming edge; leftover edges sit on a cycle. No path-length bound, no
-- exponential blowup on diamond graphs.
create or replace function planner.dependency_edges_have_cycle(p_edges jsonb)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_from uuid[];
  v_to uuid[];
  v_removable uuid[];
  v_keep_from uuid[];
  v_keep_to uuid[];
begin
  select coalesce(array_agg((e ->> 'fromTaskId')::uuid), array[]::uuid[]),
         coalesce(array_agg((e ->> 'toTaskId')::uuid), array[]::uuid[])
  into v_from, v_to
  from jsonb_array_elements(coalesce(p_edges, '[]'::jsonb)) e
  where nullif(e ->> 'fromTaskId', '') is not null
    and nullif(e ->> 'toTaskId', '') is not null;

  loop
    exit when coalesce(array_length(v_from, 1), 0) = 0;

    select coalesce(array_agg(distinct f), array[]::uuid[])
    into v_removable
    from unnest(v_from) as f
    where f <> all (v_to);

    -- No source without an incoming edge remains: every leftover edge sits on
    -- a cycle.
    exit when coalesce(array_length(v_removable, 1), 0) = 0;

    select coalesce(array_agg(f), array[]::uuid[]),
           coalesce(array_agg(t), array[]::uuid[])
    into v_keep_from, v_keep_to
    from unnest(v_from, v_to) as e(f, t)
    where f <> all (v_removable);

    v_from := v_keep_from;
    v_to := v_keep_to;
  end loop;

  return coalesce(array_length(v_from, 1), 0) > 0;
end;
$$;

comment on function planner.dependency_edges_have_cycle(jsonb) is
  'IPI-483 — linear topological-peel cycle check over finish-to-start edges (no path-length bound, no exponential blowup on diamond graphs). Used only when an approve proposal changes dependency edges.';

revoke all on function planner.dependency_edges_have_cycle(jsonb) from public;
revoke all on function planner.dependency_edges_have_cycle(jsonb) from anon;
revoke all on function planner.dependency_edges_have_cycle(jsonb) from authenticated;

-- ── 4. RPCs ────────────────────────────────────────────────────────────────
-- Both RPCs: security definer, empty search_path, schema-qualified relations,
-- authenticated-only EXECUTE. Response envelope: {ok, code?, ...} with
-- UNAUTHENTICATED / FORBIDDEN / NOT_FOUND / INVALID_INPUT / GATE_LOCKED /
-- GATE_ALREADY_APPROVED / INSTANCE_TERMINAL / STALE_VERSION /
-- DEPENDENCY_CHANGED / DEPENDENCY_CYCLE / IDEMPOTENCY_CONFLICT / replay.

create or replace function public.planner_approve_gate(
  p_instance_id uuid,
  p_phase_id uuid,
  p_idempotency_key text,
  p_changed_tasks jsonb,
  p_expected_dependency_edges jsonb,
  p_proposed_dependency_edges jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_org_id uuid;
  v_status planner.instance_status;
  v_workflow_id uuid;
  v_gate_type text;
  v_required_role text;
  v_request_hash text;
  v_existing planner.events;
  v_approval planner.gate_approvals;
  v_task jsonb;
  v_task_id uuid;
  v_seen_ids uuid[] := array[]::uuid[];
  v_expected_updated_at timestamptz;
  v_new_updated_at timestamptz;
  v_current_start date;
  v_current_end date;
  v_new_start date;
  v_new_end date;
  v_row_count integer;
  v_stale_ids uuid[] := array[]::uuid[];
  v_current_edges jsonb;
  v_expected_edges jsonb;
  v_proposed_edges jsonb;
  v_existing_dep_types jsonb;
  v_seen_pairs text[];
  v_pair_key text;
  v_changed_result jsonb := '[]'::jsonb;
  v_task_dates jsonb := '[]'::jsonb;
  v_response jsonb;
  v_edge record;
  v_approval_id uuid;
  v_approved_at timestamptz;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if p_changed_tasks is null or jsonb_typeof(p_changed_tasks) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if p_expected_dependency_edges is not null and jsonb_typeof(p_expected_dependency_edges) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  if p_proposed_dependency_edges is not null and jsonb_typeof(p_proposed_dependency_edges) <> 'array' then
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

    begin
      if (v_task ->> 'newStartDate')::date > (v_task ->> 'newEndDate')::date then
        return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
      end if;
    exception
      when data_exception then
        return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end;
  end loop;

  begin

  select org_id, status, workflow_id into v_org_id, v_status, v_workflow_id
  from planner.instances
  where id = p_instance_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if not public.is_org_member(v_org_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select gate_type, required_role into v_gate_type, v_required_role
  from planner.phases
  where id = p_phase_id
    and workflow_id = v_workflow_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_gate_type is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  -- Viewers are always read-only for gate mutations (Linear AC).
  if not planner.is_at_least(p_instance_id, 'contributor') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_required_role := coalesce(nullif(trim(v_required_role), ''), 'manager');
  if v_required_role not in ('contributor', 'manager', 'owner') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;
  if not planner.is_at_least(p_instance_id, v_required_role) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- Lock existing approval row (if any) before idempotency lookup.
  select * into v_approval
  from planner.gate_approvals
  where instance_id = p_instance_id and phase_id = p_phase_id
  for update;

  if found and v_approval.status = 'approved' then
    -- Already approved: replay if same key+hash; same key different hash →
    -- IDEMPOTENCY_CONFLICT; otherwise typed conflict.
    v_request_hash := encode(
      extensions.digest(
        p_instance_id::text || p_phase_id::text || coalesce(p_changed_tasks::text, '[]')
          || coalesce(p_expected_dependency_edges::text, '[]')
          || coalesce(p_proposed_dependency_edges::text, 'null'),
        'sha256'
      ),
      'hex'
    );

    select * into v_existing
    from planner.events
    where actor_user_id = v_actor
      and instance_id = p_instance_id
      and event_type = 'gate_approved'
      and idempotency_key = p_idempotency_key;

    if found then
      if v_existing.request_hash = v_request_hash then
        return jsonb_set(v_existing.result_payload, '{replayed}', 'true'::jsonb);
      end if;
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;

    return jsonb_build_object(
      'ok', false,
      'code', 'GATE_ALREADY_APPROVED',
      'approval', jsonb_build_object(
        'id', v_approval.id,
        'status', v_approval.status,
        'approvedAt', v_approval.approved_at,
        'approvedBy', v_approval.approved_by
      )
    );
  end if;

  v_request_hash := encode(
    extensions.digest(
      p_instance_id::text || p_phase_id::text || coalesce(p_changed_tasks::text, '[]')
        || coalesce(p_expected_dependency_edges::text, '[]')
        || coalesce(p_proposed_dependency_edges::text, 'null'),
      'sha256'
    ),
    'hex'
  );

  select * into v_existing
  from planner.events
  where actor_user_id = v_actor
    and instance_id = p_instance_id
    and event_type = 'gate_approved'
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

  -- Lock every task in this phase before evaluating reachability so a
  -- concurrent contributor update (e.g. done -> in_progress under
  -- tasks_update_assigned_or_contributor) cannot race between this check and
  -- commit and leave an approved gate whose phase is no longer complete.
  perform 1 from planner.tasks
  where instance_id = p_instance_id and phase_id = p_phase_id
  for update;

  -- Re-check reachability inside the transaction (all phase tasks done).
  if not planner.gate_phase_tasks_done(p_instance_id, p_phase_id) then
    return jsonb_build_object('ok', false, 'code', 'GATE_LOCKED');
  end if;

  -- Lock + stale-version check for every changed task (IPI-649 pattern).
  if jsonb_array_length(p_changed_tasks) > 0 then
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
      ) then
        v_stale_ids := array_append(v_stale_ids, v_task_id);
      end if;
    end loop;

    if array_length(v_stale_ids, 1) > 0 then
      return jsonb_build_object('ok', false, 'code', 'STALE_VERSION', 'conflicts', to_jsonb(v_stale_ids));
    end if;
  end if;

  -- Dependency edge CAS (always) + optional cycle detection when edges change.
  perform 1 from planner.dependencies
  where instance_id = p_instance_id
  order by from_task_id, to_task_id
  for update;

  select coalesce(jsonb_agg(
    jsonb_build_object('fromTaskId', from_task_id, 'toTaskId', to_task_id, 'lagDays', lag_days)
    order by from_task_id::text, to_task_id::text
  ), '[]'::jsonb)
  into v_current_edges
  from planner.dependencies
  where instance_id = p_instance_id;

  -- Rebuild from typed fields (not the raw client element) so an extra key,
  -- an omitted lagDays, or lagDays sent as a string can't desync this from
  -- v_current_edges's fixed three-key shape and falsely report DEPENDENCY_CHANGED.
  begin
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'fromTaskId', (e ->> 'fromTaskId')::uuid,
        'toTaskId', (e ->> 'toTaskId')::uuid,
        'lagDays', coalesce((e ->> 'lagDays')::integer, 0)
      )
      order by e ->> 'fromTaskId', e ->> 'toTaskId'
    ), '[]'::jsonb)
    into v_expected_edges
    from jsonb_array_elements(coalesce(p_expected_dependency_edges, '[]'::jsonb)) e;
  exception
    when data_exception then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end;

  if v_current_edges <> v_expected_edges then
    return jsonb_build_object('ok', false, 'code', 'DEPENDENCY_CHANGED');
  end if;

  if p_proposed_dependency_edges is not null then
    select coalesce(jsonb_agg(e order by e ->> 'fromTaskId', e ->> 'toTaskId'), '[]'::jsonb)
    into v_proposed_edges
    from jsonb_array_elements(p_proposed_dependency_edges) e;

    if planner.dependency_edges_have_cycle(v_proposed_edges) then
      return jsonb_build_object('ok', false, 'code', 'DEPENDENCY_CYCLE');
    end if;

    -- Only finish_to_start is accepted from the client in Phase 1; a pair
    -- that already carries a different dep_type is preserved below rather
    -- than silently coerced.
    v_seen_pairs := array[]::text[];
    for v_edge in
      select
        (e ->> 'fromTaskId')::uuid as from_task_id,
        (e ->> 'toTaskId')::uuid as to_task_id,
        coalesce((e ->> 'lagDays')::integer, 0) as lag_days
      from jsonb_array_elements(v_proposed_edges) e
    loop
      if v_edge.from_task_id is null or v_edge.to_task_id is null then
        return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
      end if;
      if v_edge.from_task_id = v_edge.to_task_id then
        return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
      end if;
      if not exists (
        select 1 from planner.tasks
        where id = v_edge.from_task_id and instance_id = p_instance_id
      ) or not exists (
        select 1 from planner.tasks
        where id = v_edge.to_task_id and instance_id = p_instance_id
      ) then
        return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
      end if;

      -- Reject a duplicated (fromTaskId, toTaskId) pair now, before it hits
      -- dependencies' unique constraint as a raw data-layer error.
      v_pair_key := v_edge.from_task_id::text || ':' || v_edge.to_task_id::text;
      if v_pair_key = any(v_seen_pairs) then
        return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
      end if;
      v_seen_pairs := array_append(v_seen_pairs, v_pair_key);
    end loop;

    -- Snapshot existing dep_type per (from, to) before replacing the graph so
    -- an edit that only touches lag/one edge doesn't coerce every other edge
    -- to finish_to_start.
    select coalesce(
      jsonb_object_agg(from_task_id::text || ':' || to_task_id::text, dep_type::text),
      '{}'::jsonb
    )
    into v_existing_dep_types
    from planner.dependencies
    where instance_id = p_instance_id;

    delete from planner.dependencies where instance_id = p_instance_id;

    insert into planner.dependencies (instance_id, from_task_id, to_task_id, dep_type, lag_days)
    select
      p_instance_id,
      (e ->> 'fromTaskId')::uuid,
      (e ->> 'toTaskId')::uuid,
      coalesce(
        v_existing_dep_types ->> (((e ->> 'fromTaskId')::uuid)::text || ':' || ((e ->> 'toTaskId')::uuid)::text),
        'finish_to_start'
      )::planner.dependency_type,
      coalesce((e ->> 'lagDays')::integer, 0)
    from jsonb_array_elements(v_proposed_edges) e;
  end if;

  -- Apply date shifts.
  for v_task in select * from jsonb_array_elements(p_changed_tasks)
  loop
    v_task_id := (v_task ->> 'taskId')::uuid;
    v_new_start := nullif(v_task ->> 'newStartDate', '')::date;
    v_new_end := nullif(v_task ->> 'newEndDate', '')::date;

    -- security definer bypasses RLS — scope to the caller's instance so this
    -- read can never see start/end dates from another organization's task.
    select start_date, end_date into v_current_start, v_current_end
    from planner.tasks where id = v_task_id and instance_id = p_instance_id;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
    end if;

    if v_current_start is distinct from v_new_start or v_current_end is distinct from v_new_end then
      update planner.tasks
        set start_date = v_new_start, end_date = v_new_end, updated_at = now()
        where id = v_task_id and instance_id = p_instance_id
        returning updated_at into v_new_updated_at;

      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
      end if;

      v_changed_result := v_changed_result || jsonb_build_object(
        'taskId', v_task_id,
        'updatedAt', v_new_updated_at
      );

      -- Keep the before/after dates in the audit event (below) so a later
      -- schedule edit can't erase what this approval actually changed.
      v_task_dates := v_task_dates || jsonb_build_object(
        'taskId', v_task_id,
        'previousStartDate', v_current_start,
        'previousEndDate', v_current_end,
        'newStartDate', v_new_start,
        'newEndDate', v_new_end
      );
    end if;
  end loop;

  v_response := jsonb_build_object(
    'ok', true,
    'replayed', false,
    'status', 'approved',
    'phaseId', p_phase_id,
    'changedTasks', v_changed_result,
    'conflicts', '[]'::jsonb
  );

  insert into planner.gate_approvals (
    instance_id, phase_id, status, approved_by, approved_at,
    idempotency_key, request_hash, result_payload, updated_at
  )
  values (
    p_instance_id, p_phase_id, 'approved', v_actor, now(),
    p_idempotency_key, v_request_hash, v_response, now()
  )
  on conflict (instance_id, phase_id) do update
    set status = 'approved',
        approved_by = excluded.approved_by,
        approved_at = excluded.approved_at,
        idempotency_key = excluded.idempotency_key,
        request_hash = excluded.request_hash,
        result_payload = excluded.result_payload,
        updated_at = now()
  returning id, approved_at into v_approval_id, v_approved_at;

  v_response := v_response || jsonb_build_object(
    'approvalId', v_approval_id,
    'approvedAt', v_approved_at,
    'approvedBy', v_actor
  );

  begin
    insert into planner.events (
      instance_id, task_id, actor_user_id, event_type, payload,
      idempotency_key, request_hash, result_payload
    )
    values (
      p_instance_id, null, v_actor, 'gate_approved',
      jsonb_build_object(
        'phaseId', p_phase_id,
        'approvalId', v_approval_id,
        'changedTasks', v_changed_result,
        'taskDates', v_task_dates,
        'dependencyEdgesChanged', p_proposed_dependency_edges is not null,
        'dependencyEdges', case when p_proposed_dependency_edges is not null then v_proposed_edges else null end
      ),
      p_idempotency_key, v_request_hash, v_response
    );
  exception
    when unique_violation then
      select * into v_existing
      from planner.events
      where actor_user_id = v_actor
        and instance_id = p_instance_id
        and event_type = 'gate_approved'
        and idempotency_key = p_idempotency_key;
      if found and v_existing.request_hash = v_request_hash then
        return jsonb_set(v_existing.result_payload, '{replayed}', 'true'::jsonb);
      end if;
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
  end;

  -- Keep gate_approvals.result_payload in sync with the final response
  -- (includes approvalId after insert).
  update planner.gate_approvals
    set result_payload = v_response, updated_at = now()
    where id = v_approval_id;

  return v_response;

  exception
    when data_exception then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end;
end;
$$;

comment on function public.planner_approve_gate(uuid, uuid, text, jsonb, jsonb, jsonb) is
  'IPI-483 — atomic gate approval: re-checks conditions + role, CAS task versions and dependency edges, optional cycle detection when edges change, persists gate_approvals + task date shifts + planner.events in one transaction. Reuses IPI-649 idempotency (STALE_VERSION / IDEMPOTENCY_CONFLICT / replay).';

revoke all on function public.planner_approve_gate(uuid, uuid, text, jsonb, jsonb, jsonb) from public;
revoke all on function public.planner_approve_gate(uuid, uuid, text, jsonb, jsonb, jsonb) from anon;
grant execute on function public.planner_approve_gate(uuid, uuid, text, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.planner_discard_gate(
  p_instance_id uuid,
  p_phase_id uuid,
  p_idempotency_key text,
  p_reason text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_org_id uuid;
  v_status planner.instance_status;
  v_workflow_id uuid;
  v_gate_type text;
  v_request_hash text;
  v_existing planner.events;
  v_approval planner.gate_approvals;
  v_approval_found boolean;
  v_approval_id uuid;
  v_response jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  begin

  select org_id, status, workflow_id into v_org_id, v_status, v_workflow_id
  from planner.instances
  where id = p_instance_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if not public.is_org_member(v_org_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- Discard requires contributor+ (viewer is read-only).
  if not planner.is_at_least(p_instance_id, 'contributor') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select gate_type into v_gate_type
  from planner.phases
  where id = p_phase_id
    and workflow_id = v_workflow_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_gate_type is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;

  select * into v_approval
  from planner.gate_approvals
  where instance_id = p_instance_id and phase_id = p_phase_id
  for update;

  -- Capture before the idempotency lookup below resets `found`.
  v_approval_found := found;

  v_request_hash := encode(
    extensions.digest(
      p_instance_id::text || p_phase_id::text || coalesce(p_reason, ''),
      'sha256'
    ),
    'hex'
  );

  select * into v_existing
  from planner.events
  where actor_user_id = v_actor
    and instance_id = p_instance_id
    and event_type = 'gate_discarded'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash = v_request_hash then
      return jsonb_set(v_existing.result_payload, '{replayed}', 'true'::jsonb);
    else
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
  end if;

  -- Checked after the idempotency replay above: a retry of a discard this
  -- same actor+key already committed must replay, even if another manager
  -- has since approved the gate — not be rejected as GATE_ALREADY_APPROVED.
  if v_approval_found and v_approval.status = 'approved' then
    return jsonb_build_object('ok', false, 'code', 'GATE_ALREADY_APPROVED');
  end if;

  if v_status in ('completed', 'archived', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'INSTANCE_TERMINAL');
  end if;

  v_response := jsonb_build_object(
    'ok', true,
    'replayed', false,
    'status', 'discarded',
    'phaseId', p_phase_id
  );

  insert into planner.gate_approvals (
    instance_id, phase_id, status, approved_by, approved_at,
    idempotency_key, request_hash, result_payload, updated_at
  )
  values (
    p_instance_id, p_phase_id, 'discarded', null, null,
    p_idempotency_key, v_request_hash, v_response, now()
  )
  on conflict (instance_id, phase_id) do update
    set status = 'discarded',
        approved_by = null,
        approved_at = null,
        idempotency_key = excluded.idempotency_key,
        request_hash = excluded.request_hash,
        result_payload = excluded.result_payload,
        updated_at = now()
  returning id into v_approval_id;

  v_response := v_response || jsonb_build_object('approvalId', v_approval_id);

  begin
    insert into planner.events (
      instance_id, task_id, actor_user_id, event_type, payload,
      idempotency_key, request_hash, result_payload
    )
    values (
      p_instance_id, null, v_actor, 'gate_discarded',
      jsonb_build_object(
        'phaseId', p_phase_id,
        'approvalId', v_approval_id,
        'reason', p_reason
      ),
      p_idempotency_key, v_request_hash, v_response
    );
  exception
    when unique_violation then
      select * into v_existing
      from planner.events
      where actor_user_id = v_actor
        and instance_id = p_instance_id
        and event_type = 'gate_discarded'
        and idempotency_key = p_idempotency_key;
      if found and v_existing.request_hash = v_request_hash then
        return jsonb_set(v_existing.result_payload, '{replayed}', 'true'::jsonb);
      end if;
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
  end;

  update planner.gate_approvals
    set result_payload = v_response, updated_at = now()
    where id = v_approval_id;

  return v_response;

  exception
    when data_exception then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end;
end;
$$;

comment on function public.planner_discard_gate(uuid, uuid, text, text) is
  'IPI-483 — discard a gate approval proposal without shifting dates. Persists status=discarded + planner.events in one transaction. Viewer denied; approved gates cannot be discarded.';

revoke all on function public.planner_discard_gate(uuid, uuid, text, text) from public;
revoke all on function public.planner_discard_gate(uuid, uuid, text, text) from anon;
grant execute on function public.planner_discard_gate(uuid, uuid, text, text) to authenticated;
