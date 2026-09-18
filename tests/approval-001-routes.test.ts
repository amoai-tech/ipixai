import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMocks = vi.hoisted(() => ({
  getVerifiedOperatorForRequest: vi.fn(),
  createClientFromRequest: vi.fn(),
}));

vi.mock("../src/lib/auth/operator-auth", () => ({
  getVerifiedOperatorForRequest: authMocks.getVerifiedOperatorForRequest,
}));

vi.mock("../src/lib/supabase/server", () => ({
  createClientFromRequest: authMocks.createClientFromRequest,
}));

const serviceRoleMocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("../src/lib/supabase/service-role", () => ({
  createServiceRoleClient: serviceRoleMocks.createServiceRoleClient,
}));

const mastraMocks = vi.hoisted(() => ({
  getWorkflow: vi.fn(),
}));

vi.mock("@/mastra/runtime", () => ({
  getMastra: () => ({ getWorkflow: mastraMocks.getWorkflow }),
}));

import { POST as startReview } from "../src/app/api/plans/reviews/route";
import { POST as decideRevision } from "../src/app/api/plans/approvals/[approvalId]/decision/route";
import { POST as reviseRevision } from "../src/app/api/plans/approvals/[approvalId]/revision/route";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "44444444-4444-4444-8444-444444444444";
const BRAND_A = "22222222-2222-4222-8222-222222222222";
const APPROVAL_ID = "33333333-3333-4333-8333-333333333333";
const PLAN_HASH = "hash-abc";
const REVISION = 3;
const RUN_ID = "run-abc";

const PLAN = {
  objective: { value: "Launch the spring capsule", status: "confirmed" },
  channels: ["shopify"],
};

type RpcCall = { name: string; args: Record<string, unknown> };

type SupabaseMockOptions = {
  orgId?: string | null;
  brandError?: unknown;
  editor?: boolean;
  editorError?: unknown;
  rpc?: (call: RpcCall) => { data: unknown; error: unknown };
};

function mockSupabase(options: SupabaseMockOptions = {}) {
  const calls: RpcCall[] = [];
  const client = {
    from: (table: string) => {
      expect(table).toBe("brands");
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: options.orgId ? { org_id: options.orgId } : null,
              error: options.brandError ?? null,
            }),
          }),
        }),
      };
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "is_org_editor_or_above") {
        return { data: options.editor ?? true, error: options.editorError ?? null };
      }
      if (options.rpc) return options.rpc({ name, args });
      return { data: null, error: null };
    },
  };
  return { client, calls };
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    approvalId: APPROVAL_ID,
    brandId: BRAND_A,
    workflowRunId: RUN_ID,
    agentThreadId: null,
    revision: REVISION,
    planHash: PLAN_HASH,
    hashMatches: true,
    isCurrent: true,
    status: "pending",
    plan: PLAN,
    decisionNote: null,
    decidedAt: null,
    decidedBy: null,
    expiresAt: null,
    ...overrides,
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/plans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(approvalId: string) {
  return { params: Promise.resolve({ approvalId }) };
}

beforeEach(() => {
  authMocks.getVerifiedOperatorForRequest.mockReset();
  authMocks.createClientFromRequest.mockReset();
  serviceRoleMocks.createServiceRoleClient.mockReset();
  mastraMocks.getWorkflow.mockReset();
  authMocks.getVerifiedOperatorForRequest.mockResolvedValue({ id: USER_A, name: "a@ipix.co" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/plans/reviews", () => {
  it("denies an unauthenticated caller", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue(null);

    const response = await startReview(jsonRequest({ brandId: BRAND_A, plan: PLAN }));

    expect(response.status).toBe(401);
    expect(mastraMocks.getWorkflow).not.toHaveBeenCalled();
  });

  it("denies a caller with no session client", async () => {
    authMocks.createClientFromRequest.mockReturnValue(null);

    const response = await startReview(jsonRequest({ brandId: BRAND_A, plan: PLAN }));

    expect(response.status).toBe(401);
  });

  it("rejects a malformed body", async () => {
    const { client } = mockSupabase({ orgId: ORG_A });
    authMocks.createClientFromRequest.mockReturnValue(client);

    const response = await startReview(jsonRequest({ brandId: "not-a-uuid", plan: PLAN }));

    expect(response.status).toBe(400);
    expect(mastraMocks.getWorkflow).not.toHaveBeenCalled();
  });

  it("denies a viewer who is not an editor or owner", async () => {
    const { client } = mockSupabase({ orgId: ORG_A, editor: false });
    authMocks.createClientFromRequest.mockReturnValue(client);

    const response = await startReview(jsonRequest({ brandId: BRAND_A, plan: PLAN }));

    expect(response.status).toBe(403);
    expect(mastraMocks.getWorkflow).not.toHaveBeenCalled();
  });

  it("hides a brand the caller cannot see behind a 404", async () => {
    const { client } = mockSupabase({ orgId: null });
    authMocks.createClientFromRequest.mockReturnValue(client);

    const response = await startReview(jsonRequest({ brandId: BRAND_A, plan: PLAN }));

    expect(response.status).toBe(404);
  });

  it("starts the review and returns the bounded identity for an editor", async () => {
    const { client } = mockSupabase({ orgId: ORG_A });
    authMocks.createClientFromRequest.mockReturnValue(client);
    // The installed Mastra contract is `createRun(): Promise<Run>` and
    // `run.start(...): Promise<WorkflowResult>`. A synchronous mock here is what
    // hid the production `run.startAsync is not a function` failure, so this
    // mock returns a real Promise.
    const start = vi.fn(async (_input: { inputData: Record<string, unknown> }) => ({
      status: "suspended",
      suspendPayload: {
        approvalId: APPROVAL_ID,
        brandId: BRAND_A,
        revision: REVISION,
        planHash: PLAN_HASH,
      },
    }));
    const createRun = vi.fn(async () => ({ runId: RUN_ID, start }));
    mastraMocks.getWorkflow.mockReturnValue({ createRun });

    const response = await startReview(jsonRequest({ brandId: BRAND_A, plan: PLAN }));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body).toEqual({
      runId: RUN_ID,
      approvalId: APPROVAL_ID,
      brandId: BRAND_A,
      revision: REVISION,
      planHash: PLAN_HASH,
    });
    expect(createRun).toHaveBeenCalledTimes(1);
    // `start` is what reaches the suspended state and carries the payload;
    // `startAsync` resolves immediately with only a run id and cannot.
    expect(start).toHaveBeenCalledTimes(1);
    const input = start.mock.calls[0][0] as { inputData: Record<string, unknown> };
    expect(input.inputData.brandId).toBe(BRAND_A);
    expect(input.inputData.stagedBy).toBe(USER_A);
  });

  it("does not accept agentThreadId or expiresAt from the browser", async () => {
    const { client } = mockSupabase({ orgId: ORG_A });
    authMocks.createClientFromRequest.mockReturnValue(client);
    const start = vi.fn(async (_input: { inputData: Record<string, unknown> }) => ({
      status: "suspended",
      suspendPayload: {
        approvalId: APPROVAL_ID,
        brandId: BRAND_A,
        revision: REVISION,
        planHash: PLAN_HASH,
      },
    }));
    const createRun = vi.fn(async () => ({ runId: RUN_ID, start }));
    mastraMocks.getWorkflow.mockReturnValue({ createRun });

    const response = await startReview(
      jsonRequest({
        brandId: BRAND_A,
        plan: PLAN,
        agentThreadId: "attacker-thread",
        expiresAt: "2999-01-01T00:00:00.000Z",
      }),
    );

    expect(response.status).toBe(201);
    const input = start.mock.calls[0][0] as { inputData: Record<string, unknown> };
    expect(input.inputData).not.toHaveProperty("agentThreadId");
    expect(input.inputData).not.toHaveProperty("expiresAt");
  });

  it("fails closed when the async createRun rejects", async () => {
    const { client } = mockSupabase({ orgId: ORG_A });
    authMocks.createClientFromRequest.mockReturnValue(client);
    mastraMocks.getWorkflow.mockReturnValue({
      createRun: vi.fn(async () => {
        throw new Error("storage unavailable");
      }),
    });

    const response = await startReview(jsonRequest({ brandId: BRAND_A, plan: PLAN }));

    expect(response.status).toBe(502);
  });

  it("ignores client-supplied org and user authority", async () => {
    const { client, calls } = mockSupabase({ orgId: ORG_A });
    authMocks.createClientFromRequest.mockReturnValue(client);
    const start = vi.fn(async (_input: { inputData: Record<string, unknown> }) => ({
      status: "suspended",
      suspendPayload: {
        approvalId: APPROVAL_ID,
        brandId: BRAND_A,
        revision: REVISION,
        planHash: PLAN_HASH,
      },
    }));
    mastraMocks.getWorkflow.mockReturnValue({ createRun: vi.fn(async () => ({ runId: RUN_ID, start })) });

    await startReview(
      jsonRequest({
        brandId: BRAND_A,
        plan: PLAN,
        orgId: ORG_B,
        userId: USER_B,
        stagedBy: USER_B,
      }),
    );

    const input = start.mock.calls[0][0] as { inputData: Record<string, unknown> };
    expect(input.inputData.stagedBy).toBe(USER_A);
    expect(input.inputData).not.toHaveProperty("orgId");
    expect(input.inputData).not.toHaveProperty("userId");
    const editorCall = calls.find((call) => call.name === "is_org_editor_or_above");
    expect(editorCall?.args.p_org_id).toBe(ORG_A);
  });

  it("fails closed when the run does not suspend", async () => {
    const { client } = mockSupabase({ orgId: ORG_A });
    authMocks.createClientFromRequest.mockReturnValue(client);
    mastraMocks.getWorkflow.mockReturnValue({
      createRun: vi.fn(async () => ({ runId: RUN_ID, start: vi.fn(async () => ({ status: "success" })) })),
    });

    const response = await startReview(jsonRequest({ brandId: BRAND_A, plan: PLAN }));

    expect(response.status).toBe(502);
  });
});

describe("POST /api/plans/approvals/[approvalId]/decision", () => {
  function decisionRequest(body: unknown) {
    return jsonRequest(body);
  }

  it("denies an unauthenticated caller", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue(null);

    const response = await decideRevision(
      decisionRequest({ revision: REVISION, planHash: PLAN_HASH, decision: "approved" }),
      params(APPROVAL_ID),
    );

    expect(response.status).toBe(401);
  });

  it("rejects a non-uuid approval id", async () => {
    const { client } = mockSupabase({ orgId: ORG_A });
    authMocks.createClientFromRequest.mockReturnValue(client);

    const response = await decideRevision(
      decisionRequest({ revision: REVISION, planHash: PLAN_HASH, decision: "approved" }),
      params("not-a-uuid"),
    );

    expect(response.status).toBe(400);
  });

  it("rejects an unknown decision verb", async () => {
    const { client } = mockSupabase({ orgId: ORG_A });
    authMocks.createClientFromRequest.mockReturnValue(client);

    const response = await decideRevision(
      decisionRequest({ revision: REVISION, planHash: PLAN_HASH, decision: "maybe" }),
      params(APPROVAL_ID),
    );

    expect(response.status).toBe(400);
  });

  it("denies a viewer", async () => {
    const { client } = mockSupabase({
      orgId: ORG_A,
      editor: false,
      rpc: ({ name }) =>
        name === "get_shoot_plan_approval"
          ? { data: snapshot(), error: null }
          : { data: null, error: null },
    });
    authMocks.createClientFromRequest.mockReturnValue(client);

    const response = await decideRevision(
      decisionRequest({ revision: REVISION, planHash: PLAN_HASH, decision: "approved" }),
      params(APPROVAL_ID),
    );

    expect(response.status).toBe(403);
  });

  it("denies a cross-org caller", async () => {
    const { client } = mockSupabase({
      orgId: null,
      rpc: ({ name }) =>
        name === "get_shoot_plan_approval"
          ? { data: snapshot(), error: null }
          : { data: null, error: null },
    });
    authMocks.createClientFromRequest.mockReturnValue(client);

    const response = await decideRevision(
      decisionRequest({ revision: REVISION, planHash: PLAN_HASH, decision: "approved" }),
      params(APPROVAL_ID),
    );

    expect(response.status).toBe(404);
  });

  it("records the decision and resumes the parked run", async () => {
    const { client } = mockSupabase({
      orgId: ORG_A,
      rpc: ({ name }) => {
        if (name === "get_shoot_plan_approval") return { data: snapshot(), error: null };
        if (name === "decide_shoot_plan_revision") {
          return {
            data: {
              ok: true,
              replayed: false,
              approvalId: APPROVAL_ID,
              revision: REVISION,
              planHash: PLAN_HASH,
              decision: "approved",
              status: "approved",
              decidedAt: "2026-09-18T00:00:00.000Z",
              decidedBy: USER_A,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    authMocks.createClientFromRequest.mockReturnValue(client);
    const resume = vi.fn(async () => ({ status: "success" }));
    mastraMocks.getWorkflow.mockReturnValue({
      getWorkflowRunById: vi.fn(async () => ({ status: "suspended" })),
      createRun: () => ({ resume }),
    });

    const response = await decideRevision(
      decisionRequest({ revision: REVISION, planHash: PLAN_HASH, decision: "approved" }),
      params(APPROVAL_ID),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.resumeState).toBe("resumed");
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("maps a stale revision to 409", async () => {
    const { client } = mockSupabase({
      orgId: ORG_A,
      rpc: ({ name }) =>
        name === "get_shoot_plan_approval"
          ? { data: snapshot({ hashMatches: false }), error: null }
          : { data: null, error: null },
    });
    authMocks.createClientFromRequest.mockReturnValue(client);
    mastraMocks.getWorkflow.mockReturnValue({});

    const response = await decideRevision(
      decisionRequest({ revision: REVISION, planHash: PLAN_HASH, decision: "approved" }),
      params(APPROVAL_ID),
    );

    expect(response.status).toBe(409);
  });

  it("maps a superseded revision to 409", async () => {
    const { client } = mockSupabase({
      orgId: ORG_A,
      rpc: ({ name }) =>
        name === "get_shoot_plan_approval"
          ? { data: snapshot({ isCurrent: false }), error: null }
          : { data: null, error: null },
    });
    authMocks.createClientFromRequest.mockReturnValue(client);
    mastraMocks.getWorkflow.mockReturnValue({});

    const response = await decideRevision(
      decisionRequest({ revision: REVISION, planHash: PLAN_HASH, decision: "approved" }),
      params(APPROVAL_ID),
    );

    expect(response.status).toBe(409);
  });

  it("maps a missing approval to 404", async () => {
    const { client } = mockSupabase({
      orgId: ORG_A,
      rpc: () => ({ data: null, error: null }),
    });
    authMocks.createClientFromRequest.mockReturnValue(client);

    const response = await decideRevision(
      decisionRequest({ revision: REVISION, planHash: PLAN_HASH, decision: "approved" }),
      params(APPROVAL_ID),
    );

    expect(response.status).toBe(404);
  });

  it("never reaches service-role from the browser decision path", async () => {
    const { client } = mockSupabase({
      orgId: ORG_A,
      rpc: ({ name }) => {
        if (name === "get_shoot_plan_approval") return { data: snapshot(), error: null };
        return {
          data: {
            ok: true,
            replayed: false,
            approvalId: APPROVAL_ID,
            revision: REVISION,
            planHash: PLAN_HASH,
            decision: "approved",
            status: "approved",
            decidedAt: "2026-09-18T00:00:00.000Z",
            decidedBy: USER_A,
          },
          error: null,
        };
      },
    });
    authMocks.createClientFromRequest.mockReturnValue(client);
    mastraMocks.getWorkflow.mockReturnValue({
      getWorkflowRunById: vi.fn(async () => ({ status: "suspended" })),
      createRun: () => ({ resume: vi.fn(async () => ({ status: "success" })) }),
    });

    await decideRevision(
      decisionRequest({ revision: REVISION, planHash: PLAN_HASH, decision: "approved" }),
      params(APPROVAL_ID),
    );

    expect(serviceRoleMocks.createServiceRoleClient).not.toHaveBeenCalled();
  });
});

describe("POST /api/plans/approvals/[approvalId]/revision", () => {
  it("denies an unauthenticated caller", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue(null);

    const response = await reviseRevision(jsonRequest({ plan: PLAN }), params(APPROVAL_ID));

    expect(response.status).toBe(401);
  });

  it("stages a new revision for an editor and reports the superseded revision", async () => {
    const { client } = mockSupabase({
      orgId: ORG_A,
      rpc: ({ name }) =>
        name === "get_shoot_plan_approval"
          ? { data: snapshot(), error: null }
          : { data: null, error: null },
    });
    authMocks.createClientFromRequest.mockReturnValue(client);
    const serviceRole = {
      rpc: async (name: string) => {
        expect(name).toBe("stage_shoot_plan_revision");
        return {
          data: {
            ok: true,
            approvalId: APPROVAL_ID,
            revision: REVISION + 1,
            planHash: "hash-new",
            status: "pending",
          },
          error: null,
        };
      },
    };
    serviceRoleMocks.createServiceRoleClient.mockReturnValue(serviceRole);

    const response = await reviseRevision(jsonRequest({ plan: PLAN }), params(APPROVAL_ID));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body.revision).toBe(REVISION + 1);
    expect(body.supersededRevision).toBe(REVISION);
  });

  it("refuses to edit a revision that is already decided", async () => {
    const { client } = mockSupabase({
      orgId: ORG_A,
      rpc: ({ name }) =>
        name === "get_shoot_plan_approval"
          ? { data: snapshot({ status: "approved" }), error: null }
          : { data: null, error: null },
    });
    authMocks.createClientFromRequest.mockReturnValue(client);

    const response = await reviseRevision(jsonRequest({ plan: PLAN }), params(APPROVAL_ID));

    expect(response.status).toBe(409);
    expect(serviceRoleMocks.createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("refuses to edit a superseded revision", async () => {
    const { client } = mockSupabase({
      orgId: ORG_A,
      rpc: ({ name }) =>
        name === "get_shoot_plan_approval"
          ? { data: snapshot({ isCurrent: false }), error: null }
          : { data: null, error: null },
    });
    authMocks.createClientFromRequest.mockReturnValue(client);

    const response = await reviseRevision(jsonRequest({ plan: PLAN }), params(APPROVAL_ID));

    expect(response.status).toBe(409);
  });

  it("denies a viewer", async () => {
    const { client } = mockSupabase({
      orgId: ORG_A,
      editor: false,
      rpc: ({ name }) =>
        name === "get_shoot_plan_approval"
          ? { data: snapshot(), error: null }
          : { data: null, error: null },
    });
    authMocks.createClientFromRequest.mockReturnValue(client);

    const response = await reviseRevision(jsonRequest({ plan: PLAN }), params(APPROVAL_ID));

    expect(response.status).toBe(403);
  });

  it("maps a typed REVISION_CONFLICT from staging to 409", async () => {
    const { client } = mockSupabase({
      orgId: ORG_A,
      rpc: ({ name }) =>
        name === "get_shoot_plan_approval"
          ? { data: snapshot(), error: null }
          : { data: null, error: null },
    });
    authMocks.createClientFromRequest.mockReturnValue(client);
    serviceRoleMocks.createServiceRoleClient.mockReturnValue({
      rpc: async () => ({
        data: { ok: false, code: "REVISION_CONFLICT", detail: "retry" },
        error: null,
      }),
    });

    const response = await reviseRevision(jsonRequest({ plan: PLAN }), params(APPROVAL_ID));
    const body = (await response.json()) as Record<string, unknown>;

    // The wrapper used to collapse this to STAGE_FAILED (502), which broke the
    // retry contract the revision route already advertises.
    expect(response.status).toBe(409);
    expect(body.reason).toBe("revision_conflict");
  });

  it("maps an unexpected staging failure to 502", async () => {
    const { client } = mockSupabase({
      orgId: ORG_A,
      rpc: ({ name }) =>
        name === "get_shoot_plan_approval"
          ? { data: snapshot(), error: null }
          : { data: null, error: null },
    });
    authMocks.createClientFromRequest.mockReturnValue(client);
    serviceRoleMocks.createServiceRoleClient.mockReturnValue({
      rpc: async () => ({ data: null, error: { message: "connection reset" } }),
    });

    const response = await reviseRevision(jsonRequest({ plan: PLAN }), params(APPROVAL_ID));

    expect(response.status).toBe(502);
  });
});
