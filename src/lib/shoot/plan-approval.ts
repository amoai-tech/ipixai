/**
 * IPI-1084 · APPROVAL-001 — ShootPlan exact-revision approval vocabulary.
 *
 * Pure and dependency-free on purpose: the server decision core, the Mastra
 * tool, the authorized route handler and the review UI all import this module,
 * so it must stay safe in a client bundle. Nothing here reads or writes
 * anything — the rows and SECURITY DEFINER RPCs created by
 * `supabase/migrations/20260918000000_ipi1084_shoot_plan_approval.sql` are the
 * only approval authority, and the plan hash is always computed server-side.
 *
 * The browser may carry an opaque locator (`approvalId` + `revision` +
 * `planHash`) but never a hash it computed itself, and never a brand id, org id
 * or user id that could create save authority.
 */

export const PLAN_APPROVAL_DECISIONS = [
  "approved",
  "rejected",
  "changes_requested",
  "cancelled",
] as const;

export type PlanApprovalDecision = (typeof PLAN_APPROVAL_DECISIONS)[number];

export const PLAN_APPROVAL_PENDING = "pending";

export type ShootPlanApprovalStatus = typeof PLAN_APPROVAL_PENDING | PlanApprovalDecision;

/**
 * The bounded handoff identity: the minimum IPI-1083 needs to independently
 * reload and revalidate the exact approved artifact. Deliberately excludes the
 * plan body, brand id, org id and every user id.
 */
export type ShootPlanApprovalIdentity = {
  approvalId: string;
  revision: number;
  planHash: string;
  status: ShootPlanApprovalStatus;
};

/**
 * Server read of one staged revision (`get_shoot_plan_approval`). `hashMatches`
 * and `isCurrent` are recomputed by the database on every read.
 */
export type ShootPlanApprovalSnapshot = {
  approvalId: string;
  brandId: string;
  workflowRunId: string;
  agentThreadId: string | null;
  revision: number;
  planHash: string;
  hashMatches: boolean;
  isCurrent: boolean;
  status: ShootPlanApprovalStatus;
  plan: unknown;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  expiresAt: string | null;
};

export type DecideShootPlanRevisionInput = {
  approvalId: string;
  revision: number;
  planHash: string;
  decision: PlanApprovalDecision;
  note?: string | null;
  idempotencyKey?: string | null;
};

/** What actually happened to the parked workflow run. */
export type ShootPlanResumeState = "resumed" | "already_advanced" | "resume_failed";

export type DecideShootPlanRevisionOutcome =
  | {
      ok: true;
      identity: ShootPlanApprovalIdentity;
      /** True when the decision was already durably committed (retry/reconnect). */
      replayed: boolean;
      resumeState: ShootPlanResumeState;
      message: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
      currentRevision: number | null;
    };

export const PLAN_APPROVAL_MESSAGES: Record<string, string> = {
  STALE_REVISION:
    "The plan changed since you reviewed it — reload the current revision before deciding.",
  SUPERSEDED_REVISION: "A newer revision is waiting — decide the current revision instead.",
  ALREADY_DECIDED: "This revision already has a decision and cannot be re-decided.",
  EXPIRED: "This revision expired before a decision — generate a fresh plan.",
  FORBIDDEN: "Only an owner or editor of this brand's organization can decide.",
  UNAUTHENTICATED: "Not signed in — please sign in and try again.",
  NOT_FOUND: "This plan revision was not found in your organization.",
  INVALID_INPUT: "The decision payload was invalid — reload and try again.",
  IDEMPOTENCY_CONFLICT: "A different decision was already recorded for this exact revision.",
  REVISION_CONFLICT: "A revision was staged at the same time — reload and retry.",
  STAGE_FAILED: "The plan revision could not be staged — try again.",
  LOOKUP_FAILED: "Could not verify the current revision — try again.",
  DECISION_FAILED: "The decision could not be recorded — try again.",
};

export function planApprovalMessage(code: string | null | undefined): string {
  if (!code) return "The decision could not be recorded.";
  return PLAN_APPROVAL_MESSAGES[code] ?? "The decision could not be recorded.";
}

export function isPlanApprovalDecision(value: unknown): value is PlanApprovalDecision {
  return (
    typeof value === "string" &&
    (PLAN_APPROVAL_DECISIONS as readonly string[]).includes(value)
  );
}

export function isShootPlanApprovalStatus(value: unknown): value is ShootPlanApprovalStatus {
  return value === PLAN_APPROVAL_PENDING || isPlanApprovalDecision(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function nonBlank(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function positiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null;
  return value;
}

/** Extracts only {approvalId, revision, planHash, status} from an RPC payload. */
export function toShootPlanApprovalIdentity(raw: unknown): ShootPlanApprovalIdentity | null {
  const record = asRecord(raw);
  if (!record) return null;
  const approvalId = nonBlank(record.approvalId);
  const revision = positiveInteger(record.revision);
  const planHash = nonBlank(record.planHash);
  const status = record.status ?? record.decision;
  if (!approvalId || !revision || !planHash || !isShootPlanApprovalStatus(status)) return null;
  return { approvalId, revision, planHash, status };
}

export function parseShootPlanApprovalSnapshot(raw: unknown): ShootPlanApprovalSnapshot | null {
  const record = asRecord(raw);
  if (!record || record.ok !== true) return null;
  const approvalId = nonBlank(record.approvalId);
  const brandId = nonBlank(record.brandId);
  const workflowRunId = nonBlank(record.workflowRunId);
  const revision = positiveInteger(record.revision);
  const planHash = nonBlank(record.planHash);
  if (!approvalId || !brandId || !workflowRunId || !revision || !planHash) return null;
  if (!isShootPlanApprovalStatus(record.status)) return null;
  return {
    approvalId,
    brandId,
    workflowRunId,
    agentThreadId: nonBlank(record.agentThreadId),
    revision,
    planHash,
    hashMatches: record.hashMatches === true,
    isCurrent: record.isCurrent === true,
    status: record.status,
    plan: record.plan,
    decisionNote: nonBlank(record.decisionNote),
    decidedAt: nonBlank(record.decidedAt),
    decidedBy: nonBlank(record.decidedBy),
    expiresAt: nonBlank(record.expiresAt),
  };
}

export type ShootPlanDecisionResponse =
  | { ok: true; identity: ShootPlanApprovalIdentity; replayed: boolean }
  | { ok: false; code: string; currentRevision: number | null };

/** Parses `decide_shoot_plan_revision`'s envelope without trusting its shape. */
export function parseShootPlanDecisionResponse(raw: unknown): ShootPlanDecisionResponse | null {
  const record = asRecord(raw);
  if (!record) return null;
  if (record.ok === true) {
    const identity = toShootPlanApprovalIdentity(record);
    if (!identity) return null;
    return { ok: true, identity, replayed: record.replayed === true };
  }
  if (record.ok === false) {
    return {
      ok: false,
      code: nonBlank(record.code) ?? "INVALID_INPUT",
      currentRevision: positiveInteger(record.currentRevision),
    };
  }
  return null;
}

export type SuspendedPlanReview = {
  approvalId: string;
  brandId: string;
  revision: number;
  planHash: string;
};

/**
 * Reads the bounded identity a suspended `shoot-plan-review` run published —
 * the run-level `suspendPayload` or the `awaitDecision` step's payload. The
 * caller never accepts a client-supplied identity in its place.
 */
export function readSuspendedPlanReview(payload: unknown): SuspendedPlanReview | null {
  const record = asRecord(payload);
  if (!record) return null;
  const steps = asRecord(record.steps);
  const step = asRecord(steps?.awaitDecision);
  const candidates: unknown[] = [record.suspendPayload, step?.suspendPayload, step?.payload];
  for (const candidate of candidates) {
    const value = asRecord(candidate);
    if (!value) continue;
    const approvalId = nonBlank(value.approvalId);
    const brandId = nonBlank(value.brandId);
    const revision = positiveInteger(value.revision);
    const planHash = nonBlank(value.planHash);
    if (approvalId && brandId && revision && planHash) {
      return { approvalId, brandId, revision, planHash };
    }
  }
  return null;
}
