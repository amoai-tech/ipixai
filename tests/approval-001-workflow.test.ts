import { readFile } from "node:fs/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

import { shootPlanReviewWorkflow } from "@/mastra/workflows/shoot-plan-review";

const WORKFLOW_PATH = new URL(
  "../src/mastra/workflows/shoot-plan-review.ts",
  import.meta.url,
);

const BRAND_ID = "22222222-2222-4222-8222-222222222222";
const APPROVAL_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_HASH = "hash-abc";
const REVISION = 3;
const RUN_ID = "run-abc";

const PLAN = {
  objective: { value: "Launch the spring capsule", status: "confirmed" },
  channels: ["shopify"],
  referencesUsed: [{ id: "ref-1", angle: "front" }],
};

function snapshot(overrides: Record<string, unknown> = {}) {
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
    status: "approved",
    plan: PLAN,
    decisionNote: "looks good",
    decidedAt: "2026-09-18T00:00:00.000Z",
    decidedBy: "33333333-3333-4333-8333-333333333333",
    expiresAt: null,
    ...overrides,
  };
}

function stageResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    approvalId: APPROVAL_ID,
    revision: REVISION,
    planHash: PLAN_HASH,
    status: "pending",
    ...overrides,
  };
}

type StepExecute = (args: Record<string, unknown>) => Promise<unknown>;

function stepExecute(id: "stageRevision" | "awaitDecision"): StepExecute {
  const step = shootPlanReviewWorkflow.steps[id] as unknown as {
    execute: StepExecute;
  };
  return step.execute;
}

beforeEach(() => {
  mocks.createServiceRoleClient.mockReset();
  mocks.rpc.mockReset();
  mocks.createServiceRoleClient.mockReturnValue({ rpc: mocks.rpc });
});

describe("shoot-plan-review workflow — stageRevision", () => {
  it("stages exactly one revision using the workflow run id", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: stageResponse(), error: null });

    const result = await stepExecute("stageRevision")({
      inputData: { brandId: BRAND_ID, plan: PLAN, stagedBy: null },
      runId: RUN_ID,
    });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const [name, args] = mocks.rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe("stage_shoot_plan_revision");
    expect(args.p_brand_id).toBe(BRAND_ID);
    expect(args.p_workflow_run_id).toBe(RUN_ID);
    expect(args.p_plan).toEqual(PLAN);
    expect(result).toEqual({
      approvalId: APPROVAL_ID,
      brandId: BRAND_ID,
      revision: REVISION,
      planHash: PLAN_HASH,
    });
  });

  it("fails closed when staging is rejected", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { ok: false, code: "REVISION_CONFLICT" },
      error: null,
    });

    await expect(
      stepExecute("stageRevision")({
        inputData: { brandId: BRAND_ID, plan: PLAN },
        runId: RUN_ID,
      }),
    ).rejects.toThrow(/Plan revision staging failed: STAGE_FAILED/);
  });

  it("refuses a plan larger than the reviewable limit", async () => {
    const huge = { blob: "x".repeat(300_000) };

    await expect(
      stepExecute("stageRevision")({
        inputData: { brandId: BRAND_ID, plan: huge },
        runId: RUN_ID,
      }),
    ).rejects.toThrow(/maximum reviewable size/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("shoot-plan-review workflow — awaitDecision", () => {
  it("suspends with a bounded identity only", async () => {
    const suspend = vi.fn(
      (payload: unknown, _options?: Record<string, unknown>) => payload,
    );

    await stepExecute("awaitDecision")({
      inputData: {
        approvalId: APPROVAL_ID,
        brandId: BRAND_ID,
        revision: REVISION,
        planHash: PLAN_HASH,
      },
      resumeData: undefined,
      suspend,
    });

    expect(suspend).toHaveBeenCalledTimes(1);
    const [payload, options] = suspend.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(payload).toEqual({
      approvalId: APPROVAL_ID,
      brandId: BRAND_ID,
      revision: REVISION,
      planHash: PLAN_HASH,
    });
    expect(Object.keys(payload).sort()).toEqual([
      "approvalId",
      "brandId",
      "planHash",
      "revision",
    ]);
    expect(options).toEqual({ resumeLabel: "operator-review" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("re-reads the durable approval row on resume and returns the bounded outcome", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: snapshot(), error: null });

    const result = await stepExecute("awaitDecision")({
      inputData: {
        approvalId: APPROVAL_ID,
        brandId: BRAND_ID,
        revision: REVISION,
        planHash: PLAN_HASH,
      },
      resumeData: {
        approvalId: APPROVAL_ID,
        revision: REVISION,
        planHash: PLAN_HASH,
        decision: "approved",
        note: null,
      },
    });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const [name, args] = mocks.rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe("get_shoot_plan_approval");
    expect(args.p_approval_id).toBe(APPROVAL_ID);
    expect(result).toEqual({
      approvalId: APPROVAL_ID,
      brandId: BRAND_ID,
      revision: REVISION,
      planHash: PLAN_HASH,
      decision: "approved",
      note: "looks good",
    });
  });

  it.each([
    ["a still-pending revision", { status: "pending" }, /No decision has been recorded/],
    ["a hash mismatch", { hashMatches: false }, /no longer matches the staged plan/],
    ["a superseded revision", { isCurrent: false }, /newer revision superseded/],
  ])("fails closed on %s", async (_label, overrides, pattern) => {
    mocks.rpc.mockResolvedValueOnce({ data: snapshot(overrides), error: null });

    await expect(
      stepExecute("awaitDecision")({
        inputData: {
          approvalId: APPROVAL_ID,
          brandId: BRAND_ID,
          revision: REVISION,
          planHash: PLAN_HASH,
        },
        resumeData: {
          approvalId: APPROVAL_ID,
          revision: REVISION,
          planHash: PLAN_HASH,
          decision: "approved",
          note: null,
        },
      }),
    ).rejects.toThrow(pattern);
  });

  it("fails closed when the durable record disagrees with the transport payload", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: snapshot({ status: "rejected" }),
      error: null,
    });

    await expect(
      stepExecute("awaitDecision")({
        inputData: {
          approvalId: APPROVAL_ID,
          brandId: BRAND_ID,
          revision: REVISION,
          planHash: PLAN_HASH,
        },
        resumeData: {
          approvalId: APPROVAL_ID,
          revision: REVISION,
          planHash: PLAN_HASH,
          decision: "approved",
          note: null,
        },
      }),
    ).rejects.toThrow(/does not match the durable record/);
  });

  it("fails closed when the durable row cannot be read", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    await expect(
      stepExecute("awaitDecision")({
        inputData: {
          approvalId: APPROVAL_ID,
          brandId: BRAND_ID,
          revision: REVISION,
          planHash: PLAN_HASH,
        },
        resumeData: {
          approvalId: APPROVAL_ID,
          revision: REVISION,
          planHash: PLAN_HASH,
          decision: "approved",
          note: null,
        },
      }),
    ).rejects.toThrow(/Could not re-read the durable approval state/);
  });
});

describe("shoot-plan-review workflow — contract", () => {
  it("registers the workflow under the expected id with both steps", () => {
    expect(shootPlanReviewWorkflow.id).toBe("shoot-plan-review");
    expect(Object.keys(shootPlanReviewWorkflow.steps).sort()).toEqual([
      "awaitDecision",
      "stageRevision",
    ]);
  });

  it("never composes a plan and never writes a Shoot", async () => {
    const source = await readFile(WORKFLOW_PATH, "utf8");

    expect(source).not.toMatch(/composeShootPlan|compose-shoot-plan/);
    expect(source).not.toMatch(/commit_shoot_draft/);
    expect(source).not.toMatch(/(from|into|update|join)\s+shoot\.shoots/i);
    expect(source).not.toMatch(/(from|into|update|join)\s+shoot\.shot_list/i);
    expect(source).not.toMatch(/(from|into|update|join)\s+shoot\.shoot_deliverables/i);
  });
});
