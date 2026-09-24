import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * IPI-1326 · MASTRA-WORKFLOW-AUTHZ-001 — privileged workflow steps bind the
 * actor/org to the authenticated Mastra user in RequestContext, never to
 * caller `actorId` / `stagedBy`, before any service-role write.
 */

const { ORG_A, ORG_B, USER_A, USER_B, BRAND_A, mocks } = vi.hoisted(() => ({
  ORG_A: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ORG_B: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  USER_A: "11111111-1111-4111-8111-111111111111",
  USER_B: "22222222-2222-4222-8222-222222222222",
  BRAND_A: "33333333-3333-4333-8333-333333333333",
  mocks: {
    createServiceRoleClient: vi.fn(),
    serviceUpdate: vi.fn(),
    serviceRpc: vi.fn(),
    userRpc: vi.fn(),
    userBrandLookup: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

// User-scoped client used by shoot-plan-review's authenticated authorization.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.userBrandLookup, single: mocks.userBrandLookup }) }),
    }),
    rpc: mocks.userRpc,
  }),
}));

import { RequestContext, MASTRA_AUTH_TOKEN_KEY } from "@mastra/core/request-context";

import {
  MASTRA_USER_KEY,
  resolveWorkflowActorId,
} from "@/mastra/workflow-identity";
import { brandIntelligenceWorkflow } from "@/mastra/workflows/brand-intelligence";
import { shootPlanReviewWorkflow } from "@/mastra/workflows/shoot-plan-review";

type StepExecute = (_args: Record<string, unknown>) => Promise<unknown>;

function authenticated(userId: string, orgId: string): RequestContext {
  const ctx = new RequestContext();
  ctx.set(MASTRA_USER_KEY, { id: userId, orgId, resourceId: `org:${orgId}::user:${userId}` });
  ctx.set(MASTRA_AUTH_TOKEN_KEY, `jwt-${userId}`);
  return ctx;
}

/** Service-role fake: brands row for BRAND_A in ORG_A; USER_A is its owner. */
function serviceRoleFake() {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (_c: string, value: string) => ({
          single: async () =>
            table === "brands" && value === BRAND_A
              ? { data: { id: BRAND_A, brand_url: "https://brand.example", name: "A", org_id: ORG_A, user_id: USER_A }, error: null }
              : { data: null, error: { message: "not found" } },
          eq: (_c2: string, userId: string) => ({
            maybeSingle: async () => ({ data: userId === USER_A ? { role: "owner" } : null, error: null }),
          }),
        }),
      }),
      update: (patch: unknown) => {
        mocks.serviceUpdate(table, patch);
        return {
          eq: () => ({
            not: () => ({ select: () => ({ single: async () => ({ data: { id: BRAND_A }, error: null }) }) }),
          }),
        };
      },
    }),
    rpc: mocks.serviceRpc,
  };
}

function step(workflow: typeof brandIntelligenceWorkflow | typeof shootPlanReviewWorkflow, id: string): StepExecute {
  return (workflow.steps as unknown as Record<string, { execute: StepExecute }>)[id].execute;
}

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  for (const fn of Object.values(mocks)) fn.mockReset();
  mocks.createServiceRoleClient.mockImplementation(serviceRoleFake);
});

describe("resolveWorkflowActorId", () => {
  it("uses the authenticated user even when no claim is sent", () => {
    expect(resolveWorkflowActorId(authenticated(USER_B, ORG_B), undefined)).toBe(USER_B);
  });

  it("rejects a caller claim that differs from the authenticated user", () => {
    expect(() => resolveWorkflowActorId(authenticated(USER_B, ORG_B), USER_A)).toThrow(
      "does not match the authenticated user",
    );
  });

  it("rejects a present-but-incomplete authenticated identity", () => {
    const ctx = new RequestContext();
    ctx.set(MASTRA_USER_KEY, { id: USER_B });
    expect(() => resolveWorkflowActorId(ctx, USER_B)).toThrow("identity is incomplete");
  });

  it("never falls back to a caller claim when there is no authenticated identity", () => {
    expect(() => resolveWorkflowActorId(new RequestContext(), USER_A)).toThrow(
      "Authenticated workflow identity required",
    );
    expect(() => resolveWorkflowActorId(undefined, USER_A)).toThrow(
      "Authenticated workflow identity required",
    );
  });
});

describe("brand-intelligence validateBrand", () => {
  const validate = step(brandIntelligenceWorkflow, "validateBrand");

  it("Org B cannot impersonate an Org A owner via actorId", async () => {
    await expect(
      validate({ inputData: { brandId: BRAND_A, actorId: USER_A }, requestContext: authenticated(USER_B, ORG_B) }),
    ).rejects.toThrow("does not match the authenticated user");
    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
    expect(mocks.serviceUpdate).not.toHaveBeenCalled();
  });

  it("Org B acting as itself cannot run against an Org A brand", async () => {
    await expect(
      validate({ inputData: { brandId: BRAND_A, actorId: USER_B }, requestContext: authenticated(USER_B, ORG_B) }),
    ).rejects.toThrow("outside the authenticated organization");
    expect(mocks.serviceUpdate).not.toHaveBeenCalled();
  });

  it("a user whose trusted org is not the brand's org is denied even if the claim is theirs", async () => {
    // USER_A is a real Org A owner, but this request's server-derived tenant is Org B.
    await expect(
      validate({ inputData: { brandId: BRAND_A, actorId: USER_A }, requestContext: authenticated(USER_A, ORG_B) }),
    ).rejects.toThrow("outside the authenticated organization");
    expect(mocks.serviceUpdate).not.toHaveBeenCalled();
  });

  it("missing RequestContext + a valid-looking Org A owner actorId is still denied", async () => {
    await expect(
      validate({ inputData: { brandId: BRAND_A, actorId: USER_A }, requestContext: new RequestContext() }),
    ).rejects.toThrow("Authenticated workflow identity required");
    await expect(validate({ inputData: { brandId: BRAND_A, actorId: USER_A } })).rejects.toThrow(
      "Authenticated workflow identity required",
    );
    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
    expect(mocks.serviceUpdate).not.toHaveBeenCalled();
  });

  it("the authenticated Org A owner can claim the Org A brand", async () => {
    await expect(
      validate({ inputData: { brandId: BRAND_A, actorId: USER_A }, requestContext: authenticated(USER_A, ORG_A) }),
    ).resolves.toMatchObject({ brandId: BRAND_A, actorId: USER_A });
    expect(mocks.serviceUpdate).toHaveBeenCalledWith("brands", expect.objectContaining({ intake_status: "crawl_running" }));
  });
});

describe("shoot-plan-review stageRevision", () => {
  const stage = step(shootPlanReviewWorkflow, "stageRevision");
  const plan = { objective: { value: "x", status: "confirmed" } };

  it("Org B cannot stage for an Org A brand with a forged stagedBy", async () => {
    await expect(
      stage({ inputData: { brandId: BRAND_A, plan, stagedBy: USER_A }, runId: "r", requestContext: authenticated(USER_B, ORG_B) }),
    ).rejects.toThrow("does not match the authenticated user");
    expect(mocks.serviceRpc).not.toHaveBeenCalled();
  });

  it("missing RequestContext + a valid-looking stagedBy is still denied", async () => {
    await expect(
      stage({ inputData: { brandId: BRAND_A, plan, stagedBy: USER_A }, runId: "r", requestContext: new RequestContext() }),
    ).rejects.toThrow("Authenticated workflow identity required");
    await expect(
      stage({ inputData: { brandId: BRAND_A, plan, stagedBy: USER_A }, runId: "r" }),
    ).rejects.toThrow("Authenticated workflow identity required");
    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
    expect(mocks.serviceRpc).not.toHaveBeenCalled();
  });

  it("Org B cannot stage for an Org A brand as itself (RLS hides the brand)", async () => {
    mocks.userBrandLookup.mockResolvedValue({ data: null, error: null });
    await expect(
      stage({ inputData: { brandId: BRAND_A, plan }, runId: "r", requestContext: authenticated(USER_B, ORG_B) }),
    ).rejects.toThrow("Plan review not authorized: NOT_FOUND");
    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
    expect(mocks.serviceRpc).not.toHaveBeenCalled();
  });

  it("a non-editor in the brand's org is refused before service-role staging", async () => {
    mocks.userBrandLookup.mockResolvedValue({ data: { org_id: ORG_A }, error: null });
    mocks.userRpc.mockResolvedValue({ data: false, error: null });
    await expect(
      stage({ inputData: { brandId: BRAND_A, plan }, runId: "r", requestContext: authenticated(USER_A, ORG_A) }),
    ).rejects.toThrow("Plan review not authorized: FORBIDDEN");
    expect(mocks.serviceRpc).not.toHaveBeenCalled();
  });

  it("an authorized Org A editor stages with stagedBy bound to the authenticated user", async () => {
    mocks.userBrandLookup.mockResolvedValue({ data: { org_id: ORG_A }, error: null });
    mocks.userRpc.mockResolvedValue({ data: true, error: null });
    mocks.serviceRpc.mockResolvedValue({
      data: { ok: true, approvalId: "ap-1", revision: 1, planHash: "h", status: "pending" },
      error: null,
    });
    await expect(
      stage({ inputData: { brandId: BRAND_A, plan }, runId: "r", requestContext: authenticated(USER_A, ORG_A) }),
    ).resolves.toMatchObject({ approvalId: "ap-1", brandId: BRAND_A });
    expect(mocks.userRpc).toHaveBeenCalledWith("is_org_editor_or_above", { p_org_id: ORG_A });
    const [, args] = mocks.serviceRpc.mock.calls[0];
    expect(JSON.stringify(args)).toContain(USER_A);
  });
});
