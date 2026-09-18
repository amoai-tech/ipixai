-- IPI-1084 · APPROVAL-001 — let the review workflow re-read durable approval state.
--
-- The `awaitDecision` step runs inside the Mastra workflow with service-side
-- authority, so it has no authenticated session. The increment-1 org-scoped read
-- `public.get_shoot_plan_approval(uuid)` fails closed with UNAUTHENTICATED when
-- `auth.uid()` is null, so granting service_role EXECUTE on it does NOT let the
-- workflow re-read anything — verified on a fresh local replay.
--
-- Widening that function would mean deleting its `auth.uid()` / org-membership
-- check, which is exactly the ownership semantics the operator review path
-- depends on. Instead this adds a separate, narrowly-scoped service-side proof
-- read and leaves the operator read untouched.
--
-- Authority split (each half proven behaviourally in
-- supabase/tests/security/ipi1084-shoot-plan-approval-acl.sql):
--
--   service_role           stage revision                YES
--   service_role           re-read one approval proof    YES  <- this migration
--   service_role           record a human decision       NO   (revoked in ...000002)
--   authenticated editor   record a human decision       YES
--   editor/viewer/anon/OrgB read via the operator RPC     unchanged (org-scoped)
--
-- The proof read returns only the fields required to prove a decision
-- (approvalId, brandId, workflowRunId, revision, planHash, status, decision,
-- hashMatches, isCurrent). It never returns the plan body, a user id or a note,
-- and it grants no table DML. The underlying `shoot.shoot_plan_approvals` table
-- keeps its SELECT-only service_role grant with all direct DML revoked.

-- Undo the ineffective increment-2a grant: service_role had EXECUTE on the
-- org-scoped read (Supabase's default function ACL) and could not use it.
revoke all on function public.get_shoot_plan_approval(uuid) from service_role;

comment on function public.get_shoot_plan_approval(uuid) is
  'IPI-1084 · APPROVAL-001 — org-scoped read of one staged ShootPlan revision with a recomputed hashMatches proof and an isCurrent flag. authenticated only: it fails closed with UNAUTHENTICATED without a session, so it is the operator path and never the workflow path (see public.get_shoot_plan_approval_proof).';

-- ---------------------------------------------------------------------------
-- get_shoot_plan_approval_proof: the workflow's bounded durable re-read.
--
-- Deliberately has no auth.uid() check: service_role is the trusted server-side
-- caller and holds no end-user session. It is not a decision path — the write
-- RPC stays revoked from service_role — and it exposes no plan body.
-- ---------------------------------------------------------------------------
create or replace function public.get_shoot_plan_approval_proof(
  p_approval_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row shoot.shoot_plan_approvals%rowtype;
  v_recomputed text;
begin
  if p_approval_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'detail', 'approval is required');
  end if;

  select * into v_row from shoot.shoot_plan_approvals a where a.id = p_approval_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  -- hashMatches is recomputed from the stored bytes on every read, so the
  -- workflow proves the decision was made against the artifact it staged rather
  -- than trusting anything carried in the resume payload.
  v_recomputed := encode(extensions.digest(v_row.plan::text, 'sha256'), 'hex');

  return jsonb_build_object(
    'ok', true,
    'approvalId', v_row.id,
    'brandId', v_row.brand_id,
    'workflowRunId', v_row.workflow_run_id,
    'revision', v_row.revision,
    'planHash', v_row.plan_hash,
    'status', v_row.status,
    'decision', v_row.status,
    'hashMatches', v_recomputed = v_row.plan_hash,
    'isCurrent', v_row.revision = (
      select max(newer.revision) from shoot.shoot_plan_approvals newer
       where newer.workflow_run_id = v_row.workflow_run_id
    )
  );
end;
$$;

comment on function public.get_shoot_plan_approval_proof(uuid) is
  'IPI-1084 · APPROVAL-001 — service-side bounded proof read of one ShootPlan approval revision (identity + recomputed hashMatches + isCurrent). service_role only; never returns the plan body and cannot record a decision.';

revoke all on function public.get_shoot_plan_approval_proof(uuid) from public;
revoke all on function public.get_shoot_plan_approval_proof(uuid) from anon;
revoke all on function public.get_shoot_plan_approval_proof(uuid) from authenticated;
grant execute on function public.get_shoot_plan_approval_proof(uuid) to service_role;
