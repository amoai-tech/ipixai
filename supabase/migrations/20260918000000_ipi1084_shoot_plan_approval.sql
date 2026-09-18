-- IPI-1084 · APPROVAL-001 — Exact-revision ShootPlan approval record.
--
-- Requires ONE explicit human decision on ONE immutable ShootPlan revision
-- before any Shoot can be saved, and keeps that decision durable enough for a
-- later save task (IPI-1083 · SHOOT-SAVE-001) to independently reload and
-- revalidate the exact approved artifact after reconnect or retry.
--
-- This is an APPROVAL record, not Shoot application data. Nothing here writes
-- shoot.shoots, shoot.shoot_deliverables or shoot.shoot_list.
--
-- It mirrors the proven planner.gate_approvals + planner.events conventions
-- (IPI-483 / IPI-649): SECURITY DEFINER RPCs, empty search_path, schema-qualified
-- relations, sha256 request_hash idempotency, typed failure codes. It
-- deliberately does NOT reuse planner.gate_approvals or any Brand table.
--
-- Revision identity is SERVER-OWNED: plan_hash is always computed by the
-- database from the stored jsonb (jsonb::text is Postgres-canonical), so a
-- browser can never mint an approval identity. Editing a plan stages a NEW
-- revision row, which structurally invalidates the earlier approval.

create table if not exists shoot.shoot_plan_approvals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  workflow_run_id text not null,
  agent_thread_id text,
  revision integer not null check (revision > 0),
  plan jsonb not null,
  plan_hash text not null check (plan_hash <> ''),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'changes_requested', 'cancelled')),
  staged_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  idempotency_key text,
  request_hash text,
  result_payload jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_run_id, revision)
);

comment on table shoot.shoot_plan_approvals is
  'IPI-1084 · APPROVAL-001 — immutable ShootPlan revision + its exact-revision human decision. Approval truth is status = approved on the CURRENT revision; no other table is required to save later.';
comment on column shoot.shoot_plan_approvals.workflow_run_id is
  'Mastra planner run this revision belongs to; one row per (run, revision).';
comment on column shoot.shoot_plan_approvals.revision is
  'Immutable revision number. Editing stages revision + 1, which leaves any earlier approval attached to a superseded revision.';
comment on column shoot.shoot_plan_approvals.plan is
  'The exact ShootPlan revision as staged. Canonical serialization source of truth for plan_hash.';
comment on column shoot.shoot_plan_approvals.plan_hash is
  'sha256 of plan::text, always computed by the database at stage time. A decision must quote this exact hash.';
comment on column shoot.shoot_plan_approvals.status is
  'pending | approved | rejected | changes_requested | cancelled. Only approved on the current revision unlocks a later save.';
comment on column shoot.shoot_plan_approvals.idempotency_key is
  'Caller-supplied key for the deciding mutation; a repeat with the same key and same request_hash replays the stored result.';
comment on column shoot.shoot_plan_approvals.request_hash is
  'sha256 of the deciding mutation payload; same key + different hash returns IDEMPOTENCY_CONFLICT.';
comment on column shoot.shoot_plan_approvals.result_payload is
  'Exact RPC response, replayed with replayed:true on a matching retry.';
comment on column shoot.shoot_plan_approvals.expires_at is
  'Optional staging expiry. An expired pending revision fails closed with EXPIRED instead of parking a run forever.';

create index if not exists idx_shoot_plan_approvals_brand_id
  on shoot.shoot_plan_approvals(brand_id);
create index if not exists idx_shoot_plan_approvals_run_status
  on shoot.shoot_plan_approvals(workflow_run_id, status);
create index if not exists idx_shoot_plan_approvals_brand_status
  on shoot.shoot_plan_approvals(brand_id, status);

drop trigger if exists trg_shoot_plan_approvals_updated_at on shoot.shoot_plan_approvals;
create trigger trg_shoot_plan_approvals_updated_at
  before update on shoot.shoot_plan_approvals
  for each row execute function public.handle_updated_at();

alter table shoot.shoot_plan_approvals enable row level security;

drop policy if exists shoot_plan_approvals_select_org on shoot.shoot_plan_approvals;
create policy shoot_plan_approvals_select_org on shoot.shoot_plan_approvals
  for select to authenticated
  using (
    brand_id in (
      select id from public.brands where public.is_org_member(org_id)
    )
  );

grant select on table shoot.shoot_plan_approvals to authenticated;
revoke insert, update, delete on table shoot.shoot_plan_approvals from authenticated;
revoke all on table shoot.shoot_plan_approvals from anon;

-- ---------------------------------------------------------------------------
-- stage_shoot_plan_revision: server-owned staging of one immutable revision.
-- service_role only: the Mastra planner stages; the browser never does.
-- ---------------------------------------------------------------------------
create or replace function public.stage_shoot_plan_revision(
  p_brand_id uuid,
  p_workflow_run_id text,
  p_plan jsonb,
  p_staged_by uuid,
  p_agent_thread_id text default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_plan_hash text;
  v_revision integer;
  v_id uuid;
begin
  if p_brand_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'detail', 'brand is required');
  end if;
  if p_workflow_run_id is null or btrim(p_workflow_run_id) = '' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'detail', 'workflow run is required');
  end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'detail', 'plan must be a jsonb object');
  end if;
  if not exists (select 1 from public.brands b where b.id = p_brand_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'detail', 'brand not found');
  end if;

  v_plan_hash := encode(extensions.digest(p_plan::text, 'sha256'), 'hex');

  select coalesce(max(a.revision), 0) + 1
    into v_revision
    from shoot.shoot_plan_approvals a
   where a.workflow_run_id = p_workflow_run_id;

  insert into shoot.shoot_plan_approvals (
    brand_id, workflow_run_id, agent_thread_id, revision, plan, plan_hash, status, staged_by, expires_at
  )
  values (
    p_brand_id, p_workflow_run_id, p_agent_thread_id, v_revision, p_plan, v_plan_hash, 'pending', p_staged_by, p_expires_at
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'approvalId', v_id,
    'revision', v_revision,
    'planHash', v_plan_hash,
    'status', 'pending'
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'REVISION_CONFLICT', 'detail', 'a revision was staged concurrently; retry');
  when data_exception then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
end;
$$;

comment on function public.stage_shoot_plan_revision(uuid, text, jsonb, uuid, text, timestamptz) is
  'IPI-1084 — stages one immutable ShootPlan revision and returns its database-computed plan_hash. Never approves, never writes Shoot data. service_role only.';

-- ---------------------------------------------------------------------------
-- decide_shoot_plan_revision: the authorised, hash-bound human decision.
-- authenticated only; org membership is revalidated server-side; the exact
-- revision + hash rendered to the operator must match, otherwise STALE_REVISION.
-- ---------------------------------------------------------------------------
create or replace function public.decide_shoot_plan_revision(
  p_approval_id uuid,
  p_revision integer,
  p_plan_hash text,
  p_decision text,
  p_idempotency_key text,
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_request_hash text;
  v_row shoot.shoot_plan_approvals%rowtype;
  v_response jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;
  if p_approval_id is null or p_revision is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'detail', 'approval and revision are required');
  end if;
  if p_plan_hash is null or btrim(p_plan_hash) = '' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'detail', 'the exact reviewed plan hash is required');
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'detail', 'idempotency key is required');
  end if;
  if p_decision is null
     or p_decision not in ('approved', 'rejected', 'changes_requested', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'detail', 'decision must be approved, rejected, changes_requested or cancelled');
  end if;

  select * into v_row
    from shoot.shoot_plan_approvals a
   where a.id = p_approval_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if not exists (
    select 1 from public.brands b
     where b.id = v_row.brand_id and public.is_org_member(b.org_id)
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_request_hash := encode(
    extensions.digest(
      (p_approval_id::text || '|' || p_revision::text || '|' || p_plan_hash || '|'
        || p_decision || '|' || coalesce(p_note, ''))::text,
      'sha256'
    ),
    'hex'
  );

  if v_row.idempotency_key is not null and v_row.idempotency_key = p_idempotency_key then
    if v_row.request_hash = v_request_hash then
      return jsonb_set(coalesce(v_row.result_payload, '{}'::jsonb), '{replayed}', 'true'::jsonb);
    end if;
    return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
  end if;

  if v_row.revision <> p_revision or v_row.plan_hash <> p_plan_hash then
    return jsonb_build_object(
      'ok', false,
      'code', 'STALE_REVISION',
      'detail', 'the plan changed after it was rendered; reload the current revision',
      'currentRevision', v_row.revision,
      'currentPlanHash', v_row.plan_hash,
      'status', v_row.status
    );
  end if;

  if v_row.status <> 'pending' then
    return jsonb_build_object(
      'ok', false,
      'code', 'ALREADY_DECIDED',
      'detail', 'this revision already has a decision',
      'status', v_row.status,
      'decidedAt', v_row.decided_at,
      'decidedBy', v_row.decided_by
    );
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'code', 'EXPIRED', 'detail', 'this revision expired before a decision');
  end if;

  v_response := jsonb_build_object(
    'ok', true,
    'replayed', false,
    'approvalId', v_row.id,
    'revision', v_row.revision,
    'planHash', v_row.plan_hash,
    'decision', p_decision,
    'status', p_decision,
    'decidedAt', now(),
    'decidedBy', v_actor
  );

  update shoot.shoot_plan_approvals
     set status = p_decision,
         decided_by = v_actor,
         decided_at = now(),
         decision_note = p_note,
         idempotency_key = p_idempotency_key,
         request_hash = v_request_hash,
         result_payload = v_response
   where id = v_row.id;

  return v_response;
exception
  when data_exception then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
end;
$$;

comment on function public.decide_shoot_plan_revision(uuid, integer, text, text, text, text) is
  'IPI-1084 — records one authorised decision bound to the exact reviewed revision and plan_hash. Fails closed with STALE_REVISION / ALREADY_DECIDED / EXPIRED / FORBIDDEN / IDEMPOTENCY_CONFLICT and performs ZERO Shoot writes. authenticated only.';

-- ---------------------------------------------------------------------------
-- get_shoot_plan_approval: org-scoped read of one revision (UI + downstream
-- revalidation). hashMatches is recomputed from stored bytes, never trusted.
-- ---------------------------------------------------------------------------
create or replace function public.get_shoot_plan_approval(
  p_approval_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row shoot.shoot_plan_approvals%rowtype;
  v_recomputed text;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  end if;
  if p_approval_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'detail', 'approval is required');
  end if;

  select * into v_row from shoot.shoot_plan_approvals a where a.id = p_approval_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if not exists (
    select 1 from public.brands b
     where b.id = v_row.brand_id and public.is_org_member(b.org_id)
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_recomputed := encode(extensions.digest(v_row.plan::text, 'sha256'), 'hex');

  return jsonb_build_object(
    'ok', true,
    'approvalId', v_row.id,
    'brandId', v_row.brand_id,
    'workflowRunId', v_row.workflow_run_id,
    'agentThreadId', v_row.agent_thread_id,
    'revision', v_row.revision,
    'planHash', v_row.plan_hash,
    'hashMatches', v_recomputed = v_row.plan_hash,
    'status', v_row.status,
    'plan', v_row.plan,
    'decisionNote', v_row.decision_note,
    'decidedAt', v_row.decided_at,
    'decidedBy', v_row.decided_by,
    'expiresAt', v_row.expires_at,
    'createdAt', v_row.created_at
  );
end;
$$;

comment on function public.get_shoot_plan_approval(uuid) is
  'IPI-1084 — org-scoped read of one ShootPlan revision with a recomputed hashMatches proof. authenticated only.';

revoke all on function public.stage_shoot_plan_revision(uuid, text, jsonb, uuid, text, timestamptz) from public;
revoke all on function public.stage_shoot_plan_revision(uuid, text, jsonb, uuid, text, timestamptz) from anon;
revoke all on function public.stage_shoot_plan_revision(uuid, text, jsonb, uuid, text, timestamptz) from authenticated;
grant execute on function public.stage_shoot_plan_revision(uuid, text, jsonb, uuid, text, timestamptz) to service_role;

revoke all on function public.decide_shoot_plan_revision(uuid, integer, text, text, text, text) from public;
revoke all on function public.decide_shoot_plan_revision(uuid, integer, text, text, text, text) from anon;
grant execute on function public.decide_shoot_plan_revision(uuid, integer, text, text, text, text) to authenticated;

revoke all on function public.get_shoot_plan_approval(uuid) from public;
revoke all on function public.get_shoot_plan_approval(uuid) from anon;
grant execute on function public.get_shoot_plan_approval(uuid) to authenticated;
