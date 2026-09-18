import { describe, expect, it, vi } from "vitest";

import {
  decideShootPlanRevision,
  SHOOT_PLAN_REVIEW_RESUME_STEP,
  type ShootPlanReviewWorkflowRunner,
} from "../src/lib/shoot/decide-shoot-plan-revision";
import type { ShootPlanApprovalSnapshot } from "../src/lib/shoot/plan-approval";

const APPROVAL_ID = "11111111-1111-4111-8111-111111111111";
const BRAND_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "run-abc";
const PLAN_HASH = "hash-abc";
const REVISION = 3;

/**
 * The RPC payload carries `ok: true` alongside the snapshot fields; the parser
 * requires it, but the parsed snapshot type deliberately excludes it.
 */
type SnapshotPayload = ShootPlanApprovalSnapshot & { ok: true };

function snapshot(overrides: Partial<SnapshotPayload> = {}): SnapshotPayload {
  return {
    ok: true,
    approvalId: APPROVAL_ID,
    brandId: BRAND_ID,
    workflowRunId: RUN_ID,
    agentThreadId: null,
    revision: REVISION,
    planHash: PLAN_HASH,
    hashMatches: true,
    isCurrent: true,
    status: "pending",
    plan: { objective: "x" },
    decisionNote: null,
    decidedAt: null,
    decidedBy: null,
    expiresAt: null,
    ...overrides,
  };
}

function decisionResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    replayed: false,
    approvalId: APPROVAL_ID,
    revision: REVISION,
    planHash: PLAN_HASH,
    decision: "approved",
    status: "approved",
    decidedAt: "2026-09-18T00:00:00.000Z",
    decidedBy: "user-1",
    ...overrides,
  };
}

type RpcCall = { name: string; args: Record<string, unknown> };

function makeDeps(options: {
  snapshot?: ShootPlanApprovalSnapshot | null;
  snapshotError?: unknown;
  decision?: unknown;
  decisionError?: unknown;
  runStatus?: string | null;
  resumeStatus?: string;
  resumeThrows?: boolean;
} = {}) {
  const calls: RpcCall[] = [];
  const resume = vi.fn(
    async (_args: { resumeData: unknown; step: string }) => {
      if (options.resumeThrows) throw new Error("resume exploded");
      return { status: options.resumeStatus ?? "success" };
    },
  );
  const createRun = vi.fn(async () => ({ resume }));
  const getWorkflowRunById = vi.fn(async () => ({ status: options.runStatus ?? "suspended" }));

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === "get_shoot_plan_approval") {
      if (options.snapshotError) return { data: null, error: options.snapshotError };
      return { data: options.snapshot === undefined ? snapshot() : options.snapshot, error: null };
    }
    if (name === "decide_shoot_plan_revision") {
      if (options.decisionError) return { data: null, error: options.decisionError };
      return { data: options.decision ?? decisionResponse(), error: null };
    }
    return { data: null, error: { message: `unexpected rpc ${name}` } };
  });

  const workflow: ShootPlanReviewWorkflowRunner = { getWorkflowRunById, createRun };
  return { deps: { supabase: { rpc }, workflow }, calls, resume, createRun, getWorkflowRunById };
}

const INPUT = {
  approvalId: APPROVAL_ID,
  revision: REVISION,
  planHash: PLAN_HASH,
  decision: "approved" as const,
};

describe("IPI-1084 · APPROVAL-001 — decideShootPlanRevision core", () => {
  it("records an approval and resumes the parked run", async () => {
    const { deps, calls, resume } = makeDeps();
    const outcome = await decideShootPlanRevision(INPUT, deps);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.identity).toEqual({
      approvalId: APPROVAL_ID,
      revision: REVISION,
      planHash: PLAN_HASH,
      status: "approved",
    });
    expect(outcome.replayed).toBe(false);
    expect(outcome.resumeState).toBe("resumed");
    expect(outcome.message).toContain("Only this exact revision may be saved downstream.");

    const decideCall = calls.find((call) => call.name === "decide_shoot_plan_revision");
    expect(decideCall?.args).toMatchObject({
      p_approval_id: APPROVAL_ID,
      p_revision: REVISION,
      p_plan_hash: PLAN_HASH,
      p_decision: "approved",
    });
    expect(resume).toHaveBeenCalledTimes(1);
    expect(resume.mock.calls[0][0]).toMatchObject({
      step: SHOOT_PLAN_REVIEW_RESUME_STEP,
      resumeData: { approvalId: APPROVAL_ID, revision: REVISION, planHash: PLAN_HASH, decision: "approved" },
    });
  });

  it.each(["rejected", "changes_requested", "cancelled"] as const)(
    "records a %s decision and still resumes so the run is never left parked",
    async (decision) => {
      const { deps, resume } = makeDeps({
        decision: decisionResponse({ decision, status: decision }),
      });
      const outcome = await decideShootPlanRevision({ ...INPUT, decision }, deps);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.identity.status).toBe(decision);
      expect(outcome.resumeState).toBe("resumed");
      expect(resume).toHaveBeenCalledTimes(1);
    },
  );

  it("uses a deterministic idempotency key so a retry replays instead of conflicting", async () => {
    const { deps, calls } = makeDeps();
    await decideShootPlanRevision(INPUT, deps);
    const decideCall = calls.find((call) => call.name === "decide_shoot_plan_revision");
    expect(decideCall?.args.p_idempotency_key).toBe(`${APPROVAL_ID}:${REVISION}:approved`);
  });

  it("honours a caller-supplied idempotency key", async () => {
    const { deps, calls } = makeDeps();
    await decideShootPlanRevision({ ...INPUT, idempotencyKey: "  my-key  " }, deps);
    const decideCall = calls.find((call) => call.name === "decide_shoot_plan_revision");
    expect(decideCall?.args.p_idempotency_key).toBe("my-key");
  });

  it("replays a same-actor retry without a second decision write", async () => {
    const { deps, calls, resume } = makeDeps({
      snapshot: snapshot({ status: "approved", decidedAt: "2026-09-18T00:00:00.000Z" }),
    });
    const outcome = await decideShootPlanRevision(INPUT, deps);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.replayed).toBe(true);
    expect(outcome.message).toContain("(already recorded)");
    expect(calls.some((call) => call.name === "decide_shoot_plan_revision")).toBe(false);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the durable record already holds a different decision", async () => {
    const { deps, calls } = makeDeps({ snapshot: snapshot({ status: "rejected" }) });
    const outcome = await decideShootPlanRevision(INPUT, deps);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("ALREADY_DECIDED");
    expect(calls.some((call) => call.name === "decide_shoot_plan_revision")).toBe(false);
  });

  it("fails closed on a superseded revision before writing anything", async () => {
    const { deps, calls } = makeDeps({ snapshot: snapshot({ isCurrent: false }) });
    const outcome = await decideShootPlanRevision(INPUT, deps);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("SUPERSEDED_REVISION");
    expect(calls.some((call) => call.name === "decide_shoot_plan_revision")).toBe(false);
  });

  it("fails closed when the reviewed hash no longer matches the staged plan", async () => {
    const { deps, calls } = makeDeps({ snapshot: snapshot({ hashMatches: false }) });
    const outcome = await decideShootPlanRevision(INPUT, deps);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("STALE_REVISION");
    expect(calls.some((call) => call.name === "decide_shoot_plan_revision")).toBe(false);
  });

  it("fails closed when the caller sends a stale revision or hash", async () => {
    const staleRevision = makeDeps();
    const revisionOutcome = await decideShootPlanRevision({ ...INPUT, revision: REVISION - 1 }, staleRevision.deps);
    expect(revisionOutcome.ok).toBe(false);
    if (!revisionOutcome.ok) expect(revisionOutcome.code).toBe("STALE_REVISION");

    const staleHash = makeDeps();
    const hashOutcome = await decideShootPlanRevision({ ...INPUT, planHash: "other" }, staleHash.deps);
    expect(hashOutcome.ok).toBe(false);
    if (!hashOutcome.ok) expect(hashOutcome.code).toBe("STALE_REVISION");
  });

  it("surfaces the database failure codes verbatim", async () => {
    const { deps } = makeDeps({
      decision: { ok: false, code: "IDEMPOTENCY_CONFLICT" },
    });
    const outcome = await decideShootPlanRevision(INPUT, deps);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("reports the current revision when the database rejects a superseded decision", async () => {
    const { deps } = makeDeps({
      decision: { ok: false, code: "SUPERSEDED_REVISION", currentRevision: 9 },
    });
    const outcome = await decideShootPlanRevision(INPUT, deps);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("SUPERSEDED_REVISION");
    expect(outcome.currentRevision).toBe(9);
  });

  it("fails closed on a malformed decision response", async () => {
    const { deps } = makeDeps({ decision: { nonsense: true } });
    const outcome = await decideShootPlanRevision(INPUT, deps);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("DECISION_FAILED");
  });

  it("fails closed when the approval cannot be read", async () => {
    const missing = makeDeps({ snapshot: null });
    const notFound = await decideShootPlanRevision(INPUT, missing.deps);
    expect(notFound.ok).toBe(false);
    if (!notFound.ok) expect(notFound.code).toBe("NOT_FOUND");

    const errored = makeDeps({ snapshotError: { message: "boom" } });
    const lookup = await decideShootPlanRevision(INPUT, errored.deps);
    expect(lookup.ok).toBe(false);
    if (!lookup.ok) expect(lookup.code).toBe("LOOKUP_FAILED");
  });

  it("rejects malformed input before touching the database", async () => {
    const { deps, calls } = makeDeps();
    const outcome = await decideShootPlanRevision({ ...INPUT, decision: "maybe" as never }, deps);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("INVALID_INPUT");
    expect(calls).toHaveLength(0);
  });

  it("keeps the durable decision when the resume fails and reports it recoverably", async () => {
    const { deps } = makeDeps({ resumeThrows: true });
    const outcome = await decideShootPlanRevision(INPUT, deps);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.resumeState).toBe("resume_failed");
    expect(outcome.message).toContain("The decision is recorded, but the planner run has not resumed yet");
  });

  it("does not resume a run that has already advanced", async () => {
    const { deps, resume } = makeDeps({ runStatus: "success" });
    const outcome = await decideShootPlanRevision(INPUT, deps);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.resumeState).toBe("already_advanced");
    expect(resume).not.toHaveBeenCalled();
  });

  it("reports a non-success resume status as resume_failed", async () => {
    const { deps } = makeDeps({ resumeStatus: "failed" });
    const outcome = await decideShootPlanRevision(INPUT, deps);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.resumeState).toBe("resume_failed");
  });
});
