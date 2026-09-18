import {
  type ShootPlanApprovalSnapshot,
  parseShootPlanApprovalSnapshot,
  planApprovalMessage,
  toShootPlanApprovalIdentity,
} from "@/lib/shoot/plan-approval";

/**
 * IPI-1084 · APPROVAL-001 — the one server-side staging path, plus the one
 * server-side read of a staged revision.
 *
 * `stageShootPlanRevision` never computes the revision number, the approval id
 * or the plan hash — `stage_shoot_plan_revision` owns all three, so a caller
 * (workflow step or authorized route) cannot influence approval authority. It
 * is called with service-side authority only, and only from a path that has
 * already authorized the operator.
 *
 * `loadShootPlanApproval` goes through the org-scoped `get_shoot_plan_approval`
 * RPC, so it returns a recomputed `hashMatches` proof and an `isCurrent` flag
 * rather than trusting anything a caller passed in.
 */

export type ShootPlanApprovalRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

export type StageShootPlanRevisionInput = {
  brandId: string;
  workflowRunId: string;
  plan: unknown;
  stagedBy?: string | null;
  agentThreadId?: string | null;
  expiresAt?: string | null;
};

export type StageShootPlanRevisionOutcome =
  | { ok: true; approvalId: string; revision: number; planHash: string }
  | { ok: false; code: string; message: string };

export async function stageShootPlanRevision(
  input: StageShootPlanRevisionInput,
  deps: { supabase: { rpc: ShootPlanApprovalRpc } },
): Promise<StageShootPlanRevisionOutcome> {
  const failure = (code: string): StageShootPlanRevisionOutcome => ({
    ok: false,
    code,
    message: planApprovalMessage(code),
  });

  if (!input.brandId || !input.workflowRunId) return failure("INVALID_INPUT");
  if (typeof input.plan !== "object" || input.plan === null || Array.isArray(input.plan)) {
    return failure("INVALID_INPUT");
  }

  let raw: unknown;
  try {
    const { data, error } = await deps.supabase.rpc("stage_shoot_plan_revision", {
      p_brand_id: input.brandId,
      p_workflow_run_id: input.workflowRunId,
      p_plan: input.plan,
      p_staged_by: input.stagedBy ?? null,
      p_agent_thread_id: input.agentThreadId ?? null,
      p_expires_at: input.expiresAt ?? null,
    });
    if (error) return failure("STAGE_FAILED");
    raw = data;
  } catch {
    return failure("STAGE_FAILED");
  }

  const identity = toShootPlanApprovalIdentity(raw);
  if (!identity) return failure("STAGE_FAILED");
  return {
    ok: true,
    approvalId: identity.approvalId,
    revision: identity.revision,
    planHash: identity.planHash,
  };
}

export type LoadShootPlanApprovalOutcome =
  | { ok: true; snapshot: ShootPlanApprovalSnapshot }
  | { ok: false; code: string; message: string };

export async function loadShootPlanApproval(
  approvalId: string,
  deps: { supabase: { rpc: ShootPlanApprovalRpc } },
): Promise<LoadShootPlanApprovalOutcome> {
  if (!approvalId) {
    return { ok: false, code: "INVALID_INPUT", message: planApprovalMessage("INVALID_INPUT") };
  }
  let raw: unknown;
  try {
    const { data, error } = await deps.supabase.rpc("get_shoot_plan_approval", {
      p_approval_id: approvalId,
    });
    if (error) {
      return { ok: false, code: "LOOKUP_FAILED", message: planApprovalMessage("LOOKUP_FAILED") };
    }
    raw = data;
  } catch {
    return { ok: false, code: "LOOKUP_FAILED", message: planApprovalMessage("LOOKUP_FAILED") };
  }
  const snapshot = parseShootPlanApprovalSnapshot(raw);
  if (!snapshot) {
    return { ok: false, code: "NOT_FOUND", message: planApprovalMessage("NOT_FOUND") };
  }
  return { ok: true, snapshot };
}
