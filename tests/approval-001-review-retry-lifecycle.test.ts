import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

import { Mastra } from "@mastra/core/mastra";
import { InMemoryStore } from "@mastra/core/storage";
import { shootPlanReviewWorkflow } from "@/mastra/workflows/shoot-plan-review";

const BRAND_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "wizard-review-retry-proof";
const EXPIRES_AT = "2026-09-23T12:00:00.000Z";
const PLAN = { status: "complete", channels: ["shopify"] };

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.createServiceRoleClient.mockReset();
  mocks.createServiceRoleClient.mockReturnValue({ rpc: mocks.rpc });
});

describe("shoot-plan-review retry lineage", () => {
  it("can restart the same explicit run id without creating a second workflow lineage", async () => {
    let revision = 0;
    mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name !== "stage_shoot_plan_revision") return { data: null, error: null };
      revision += 1;
      return {
        data: {
          ok: true,
          approvalId: `approval-${revision}`,
          revision,
          planHash: `hash-${revision}`,
          status: "pending",
          workflowRunId: args.p_workflow_run_id,
        },
        error: null,
      };
    });

    const mastra = new Mastra({
      storage: new InMemoryStore(),
      workflows: { "shoot-plan-review": shootPlanReviewWorkflow },
    });
    const workflow = mastra.getWorkflow("shoot-plan-review");
    const inputData = {
      brandId: BRAND_ID,
      plan: PLAN,
      stagedBy: USER_ID,
      expiresAt: EXPIRES_AT,
    };

    const first = await workflow.createRun({ runId: RUN_ID });
    const firstResult = await first.start({ inputData });
    expect(firstResult.status).toBe("suspended");

    const retry = await workflow.createRun({ runId: RUN_ID });
    const retryResult = await retry.start({ inputData });
    expect(retryResult.status).toBe("suspended");

    const stageCalls = mocks.rpc.mock.calls.filter((call) => call[0] === "stage_shoot_plan_revision");
    expect(stageCalls.length).toBeGreaterThanOrEqual(1);
    expect(stageCalls.every((call) => call[1].p_workflow_run_id === RUN_ID)).toBe(true);
    expect(stageCalls.every((call) => call[1].p_expires_at === EXPIRES_AT)).toBe(true);
  });
});
