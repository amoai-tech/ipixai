import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * IPI-1084 · APPROVAL-001 — the real Mastra engine lifecycle.
 *
 * The other approval suites drive the workflow's steps and the route in
 * isolation. This suite runs the actual installed Mastra engine over an
 * in-memory store, so it proves the runtime contract that unit mocks hid:
 *
 *   createRun() is asynchronous
 *   → run.start() reaches status "suspended" and publishes the bounded identity
 *   → the human decision is recorded elsewhere
 *   → the suspended run resumes and re-reads durable truth through the
 *     service-side proof read
 *
 * No database is involved here; the DB/ACL half is proven by
 * supabase/tests/security/ipi1084-shoot-plan-approval-acl.sql.
 */

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

// IPI-1326: stageRevision re-checks editor authority under the operator's own
// session before service-role staging. This is that user-scoped client.
const userClient = vi.hoisted(() => ({
  orgId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  editor: true,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { org_id: userClient.orgId }, error: null }) }),
      }),
    }),
    rpc: async (name: string) =>
      name === "is_org_editor_or_above"
        ? { data: userClient.editor, error: null }
        : { data: null, error: { message: "unexpected rpc" } },
  }),
}));

import { Mastra } from "@mastra/core/mastra";
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from "@mastra/core/request-context";
import { MASTRA_USER_KEY } from "@/mastra/workflow-identity";
import { InMemoryStore } from "@mastra/core/storage";

import { readSuspendedPlanReview } from "@/lib/shoot/plan-approval";
import { shootPlanReviewWorkflow } from "@/mastra/workflows/shoot-plan-review";

const BRAND_ID = "22222222-2222-4222-8222-222222222222";
const APPROVAL_ID = "11111111-1111-4111-8111-111111111111";
const STAGED_BY = "33333333-3333-4333-8333-333333333333";
const PLAN_HASH = "hash-abc";
const REVISION = 1;

function editorContext(userId: string): RequestContext {
  const ctx = new RequestContext();
  ctx.set(MASTRA_USER_KEY, {
    id: userId,
    orgId: userClient.orgId,
    resourceId: `org:${userClient.orgId}::user:${userId}`,
  });
  ctx.set(MASTRA_AUTH_TOKEN_KEY, "jwt-editor");
  return ctx;
}

const PLAN = {
  objective: { value: "Launch the spring capsule", status: "confirmed" },
  channels: ["shopify"],
  referencesUsed: [{ id: "ref-1", angle: "front" }],
};

function newEngine() {
  return new Mastra({
    storage: new InMemoryStore(),
    workflows: { "shoot-plan-review": shootPlanReviewWorkflow },
  });
}

type StartResult = { status: string; runId?: string; result?: unknown };

function proofPayload(status: string) {
  return {
    ok: true,
    approvalId: APPROVAL_ID,
    brandId: BRAND_ID,
    workflowRunId: "engine-run",
    revision: REVISION,
    planHash: PLAN_HASH,
    status,
    decision: status,
    hashMatches: true,
    isCurrent: true,
  };
}

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  mocks.rpc.mockReset();
  mocks.createServiceRoleClient.mockReset();
  mocks.createServiceRoleClient.mockReturnValue({ rpc: mocks.rpc });
});

describe("shoot-plan-review — real Mastra engine lifecycle", () => {
  it("stages once, suspends with the bounded identity, and resumes on a durable decision", async () => {
    let durableStatus = "pending";
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "stage_shoot_plan_revision") {
        return {
          data: {
            ok: true,
            approvalId: APPROVAL_ID,
            revision: REVISION,
            planHash: PLAN_HASH,
            status: "pending",
          },
          error: null,
        };
      }
      if (name === "get_shoot_plan_approval_proof") {
        return { data: proofPayload(durableStatus), error: null };
      }
      return { data: null, error: null };
    });

    const mastra = newEngine();
    const workflow = mastra.getWorkflow("shoot-plan-review");
    const run = await workflow.createRun();
    expect(typeof run.runId).toBe("string");

    const started = (await run.start({
      inputData: { brandId: BRAND_ID, plan: PLAN, stagedBy: STAGED_BY },
      requestContext: editorContext(STAGED_BY),
    })) as StartResult;

    expect(started.status).toBe("suspended");
    expect(readSuspendedPlanReview(started)).toEqual({
      approvalId: APPROVAL_ID,
      brandId: BRAND_ID,
      revision: REVISION,
      planHash: PLAN_HASH,
    });

    const stagedCalls = mocks.rpc.mock.calls.filter(
      (call) => call[0] === "stage_shoot_plan_revision",
    );
    expect(stagedCalls).toHaveLength(1);

    // The operator records their decision through the authenticated route; the
    // workflow must not see it until it re-reads durable truth.
    durableStatus = "approved";

    const resumed = await workflow.createRun({ runId: run.runId });
    const result = (await resumed.resume({
      step: "awaitDecision",
      resumeData: {
        approvalId: APPROVAL_ID,
        revision: REVISION,
        planHash: PLAN_HASH,
        decision: "approved",
        note: null,
      },
    })) as StartResult;

    expect(result.status).toBe("success");
    expect(result.result).toMatchObject({
      approvalId: APPROVAL_ID,
      brandId: BRAND_ID,
      revision: REVISION,
      planHash: PLAN_HASH,
      decision: "approved",
    });

    // The resume re-read durable state through the service-side proof contract.
    const proofCalls = mocks.rpc.mock.calls.filter(
      (call) => call[0] === "get_shoot_plan_approval_proof",
    );
    expect(proofCalls.length).toBeGreaterThanOrEqual(1);
    expect(mocks.rpc.mock.calls.map((call) => call[0])).not.toContain(
      "get_shoot_plan_approval",
    );

    // Nothing here writes a Shoot.
    const writeCalls = mocks.rpc.mock.calls.filter((call) =>
      String(call[0]).includes("shoot_") && !String(call[0]).includes("shoot_plan"),
    );
    expect(writeCalls).toHaveLength(0);
  });

  it("fails closed when no decision was recorded for the revision", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "stage_shoot_plan_revision") {
        return {
          data: {
            ok: true,
            approvalId: APPROVAL_ID,
            revision: REVISION,
            planHash: PLAN_HASH,
            status: "pending",
          },
          error: null,
        };
      }
      // Durable truth is still pending: the resume is transport-only and must
      // not un-park the run.
      return { data: proofPayload("pending"), error: null };
    });

    const mastra = newEngine();
    const workflow = mastra.getWorkflow("shoot-plan-review");
    const run = await workflow.createRun();
    await run.start({
      inputData: { brandId: BRAND_ID, plan: PLAN, stagedBy: STAGED_BY },
      requestContext: editorContext(STAGED_BY),
    });

    const resumed = await workflow.createRun({ runId: run.runId });
    const result = (await resumed.resume({
      step: "awaitDecision",
      resumeData: {
        approvalId: APPROVAL_ID,
        revision: REVISION,
        planHash: PLAN_HASH,
        decision: "approved",
        note: null,
      },
    })) as StartResult;

    expect(result.status).not.toBe("success");
  });
});
