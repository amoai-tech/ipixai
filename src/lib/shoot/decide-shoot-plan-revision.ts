import {
  PLAN_APPROVAL_PENDING,
  type DecideShootPlanRevisionInput,
  type DecideShootPlanRevisionOutcome,
  type ShootPlanApprovalIdentity,
  type ShootPlanApprovalStatus,
  type ShootPlanResumeState,
  isPlanApprovalDecision,
  parseShootPlanApprovalSnapshot,
  parseShootPlanDecisionResponse,
  planApprovalMessage,
} from "@/lib/shoot/plan-approval";

/**
 * IPI-1084 · APPROVAL-001 — the one server-side decision path.
 *
 * Both transports call exactly this function:
 *   - the Mastra tool (`decideShootPlanRevision`) with a Supabase client scoped
 *     to the request's verified session JWT, and
 *   - the authorized route handler the review UI posts to, with the same
 *     session-scoped client built from the request cookies.
 *
 * It never trusts the browser for the hash, the revision, the tenant or the
 * actor: the database recomputes the plan hash and enforces org + role + status
 * inside `decide_shoot_plan_revision`, and the run id comes from the row, not
 * from the request. Zero Shoot application writes happen here.
 */

export const SHOOT_PLAN_REVIEW_WORKFLOW_ID = "shoot-plan-review";
export const SHOOT_PLAN_REVIEW_RESUME_STEP = "awaitDecision";

export type ShootPlanApprovalRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

export type ShootPlanReviewWorkflowRunner = {
  getWorkflowRunById(
    runId: string,
  ): Promise<{ status?: string | null } | null | undefined>;
  createRun(options: { runId: string }): Promise<{
    resume(args: { resumeData: unknown; step: string }): Promise<{ status: string }>;
  }>;
};

export type DecideShootPlanRevisionDeps = {
  supabase: { rpc: ShootPlanApprovalRpc };
  workflow: ShootPlanReviewWorkflowRunner;
  resumeStep?: string;
};

type DecisionFailure = Extract<DecideShootPlanRevisionOutcome, { ok: false }>;

export async function decideShootPlanRevision(
  input: DecideShootPlanRevisionInput,
  deps: DecideShootPlanRevisionDeps,
): Promise<DecideShootPlanRevisionOutcome> {
  const failure = (code: string, currentRevision: number | null = null): DecisionFailure => ({
    ok: false,
    code,
    message: planApprovalMessage(code),
    currentRevision,
  });

  if (!isPlanApprovalDecision(input.decision)) return failure("INVALID_INPUT");
  if (!Number.isInteger(input.revision) || input.revision <= 0) return failure("INVALID_INPUT");
  if (!input.planHash || input.planHash.trim().length === 0) return failure("INVALID_INPUT");
  if (!input.approvalId || input.approvalId.trim().length === 0) return failure("INVALID_INPUT");

  // 1. Read the authoritative state first. The read is org-scoped and recomputes
  //    hashMatches/isCurrent, so a retry after a reconnect sees exactly what the
  //    database holds — never what the browser remembers.
  let snapshotRaw: unknown;
  try {
    const { data, error } = await deps.supabase.rpc("get_shoot_plan_approval", {
      p_approval_id: input.approvalId,
    });
    if (error) return failure("LOOKUP_FAILED");
    snapshotRaw = data;
  } catch {
    return failure("LOOKUP_FAILED");
  }
  const snapshot = parseShootPlanApprovalSnapshot(snapshotRaw);
  if (!snapshot) return failure("NOT_FOUND");

  let replayed = false;

  if (snapshot.status === PLAN_APPROVAL_PENDING) {
    // Defense in depth only — the RPC re-validates all of this under its own row
    // lock. These pre-checks make sure an obviously stale click never spends a
    // decision round-trip.
    if (!snapshot.isCurrent) return failure("SUPERSEDED_REVISION", snapshot.revision);
    if (!snapshot.hashMatches) return failure("STALE_REVISION", snapshot.revision);
    if (snapshot.revision !== input.revision || snapshot.planHash !== input.planHash) {
      return failure("STALE_REVISION", snapshot.revision);
    }

    const idempotencyKey =
      input.idempotencyKey && input.idempotencyKey.trim().length > 0
        ? input.idempotencyKey.trim()
        : // Deterministic: a retry of the same reviewed payload replays the exact
          // original response instead of conflicting, while a different decision
          // (or a different note) for the same revision fails closed.
          `${input.approvalId}:${input.revision}:${input.decision}`;

    let decideRaw: unknown;
    try {
      const { data, error } = await deps.supabase.rpc("decide_shoot_plan_revision", {
        p_approval_id: input.approvalId,
        p_revision: input.revision,
        p_plan_hash: input.planHash,
        p_decision: input.decision,
        p_idempotency_key: idempotencyKey,
        p_note: input.note ?? null,
      });
      if (error) return failure("DECISION_FAILED");
      decideRaw = data;
    } catch {
      return failure("DECISION_FAILED");
    }

    const parsed = parseShootPlanDecisionResponse(decideRaw);
    if (!parsed) return failure("DECISION_FAILED");
    if (!parsed.ok) return failure(parsed.code, parsed.currentRevision);
    replayed = parsed.replayed;
  } else if (
    snapshot.status === input.decision &&
    snapshot.revision === input.revision &&
    snapshot.planHash === input.planHash
  ) {
    // Durable replay / recovery: the decision committed on an earlier attempt but
    // the parked run never resumed (disconnect, cold start, crash). The row is
    // the truth, so reconcile the workflow from it instead of re-deciding — and
    // never re-decide from client input when the row says something else.
    replayed = true;
  } else {
    return failure("ALREADY_DECIDED", snapshot.revision);
  }

  const status: ShootPlanApprovalStatus =
    snapshot.status === PLAN_APPROVAL_PENDING ? input.decision : snapshot.status;
  const identity: ShootPlanApprovalIdentity = {
    approvalId: snapshot.approvalId,
    revision: snapshot.revision,
    planHash: snapshot.planHash,
    status,
  };

  // 2. State-aware resume. Mastra's persisted run state decides whether a resume
  //    is needed, so a redundant retry cannot double-advance the run and a failed
  //    resume cannot lose the already-durable decision. Every decision — approve,
  //    reject, changes-requested, cancel — resumes, so no outcome can leave the
  //    run parked forever.
  const resumeStep = deps.resumeStep ?? SHOOT_PLAN_REVIEW_RESUME_STEP;
  let resumeState: ShootPlanResumeState = "already_advanced";
  try {
    const runState = await deps.workflow.getWorkflowRunById(snapshot.workflowRunId);
    if (runState?.status === "suspended") {
      const run = await deps.workflow.createRun({ runId: snapshot.workflowRunId });
      const result = await run.resume({
        resumeData: {
          approvalId: identity.approvalId,
          revision: identity.revision,
          planHash: identity.planHash,
          decision: identity.status,
          note: input.note ?? null,
        },
        step: resumeStep,
      });
      resumeState = result.status === "success" ? "resumed" : "resume_failed";
    }
  } catch {
    resumeState = "resume_failed";
  }

  const label =
    identity.status === "approved"
      ? "Plan approved"
      : identity.status === "rejected"
        ? "Plan rejected"
        : identity.status === "changes_requested"
          ? "Changes requested"
          : "Plan cancelled";
  const base = replayed ? `${label} (already recorded)` : label;
  const message =
    resumeState === "resume_failed"
      ? `${base}. The decision is recorded, but the planner run has not resumed yet — try again in a moment.`
      : identity.status === "approved"
        ? `${base}. Only this exact revision may be saved downstream.`
        : `${base}. The planner run continues without saving anything.`;

  return { ok: true, identity, replayed, resumeState, message };
}
