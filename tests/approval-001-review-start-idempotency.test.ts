import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getVerifiedOperatorForRequest: vi.fn(),
  createClientFromRequest: vi.fn(),
  getWorkflow: vi.fn(),
}));

vi.mock("../src/lib/auth/operator-auth", () => ({
  getVerifiedOperatorForRequest: mocks.getVerifiedOperatorForRequest,
}));
vi.mock("../src/lib/supabase/server", () => ({
  createClientFromRequest: mocks.createClientFromRequest,
}));
vi.mock("@/mastra/runtime", () => ({
  getMastra: () => ({ getWorkflow: mocks.getWorkflow }),
}));

import { POST as startReview } from "../src/app/api/plans/reviews/route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BRAND_ID = "22222222-2222-4222-8222-222222222222";
const START_ID = "55555555-5555-4555-8555-555555555555";
const APPROVAL_ID = "33333333-3333-4333-8333-333333333333";

function client() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { org_id: ORG_ID }, error: null }) }),
      }),
    }),
    rpc: async (name: string) =>
      name === "is_org_editor_or_above"
        ? { data: true, error: null }
        : { data: null, error: null },
  };
}

function request(extra: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/plans/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      brandId: BRAND_ID,
      plan: { status: "complete" },
      reviewStartId: START_ID,
      expiresAt: "2999-01-01T00:00:00.000Z",
      ...extra,
    }),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-22T12:00:00.000Z"));
  mocks.getVerifiedOperatorForRequest.mockReset();
  mocks.createClientFromRequest.mockReset();
  mocks.getWorkflow.mockReset();
  mocks.getVerifiedOperatorForRequest.mockResolvedValue({ id: USER_ID });
  mocks.createClientFromRequest.mockReturnValue(client());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/plans/reviews retry identity", () => {
  it("groups retries under one server-bound run id and uses a server-owned expiry", async () => {
    const start = vi.fn(async () => ({
      status: "suspended",
      suspendPayload: {
        approvalId: APPROVAL_ID,
        brandId: BRAND_ID,
        revision: 1,
        planHash: "hash-1",
      },
    }));
    const createRun = vi.fn(async (options?: { runId?: string }) => ({
      runId: options?.runId ?? "unexpected-run",
      start,
    }));
    mocks.getWorkflow.mockReturnValue({ createRun });

    const first = await startReview(request());
    const second = await startReview(request());

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstRunId = createRun.mock.calls[0]?.[0]?.runId;
    const secondRunId = createRun.mock.calls[1]?.[0]?.runId;
    expect(firstRunId).toMatch(/^wizard-review-[0-9a-f]{64}$/);
    expect(secondRunId).toBe(firstRunId);
    expect(firstRunId).not.toBe(START_ID);

    for (const call of start.mock.calls) {
      const inputData = call[0].inputData;
      expect(inputData.stagedBy).toBe(USER_ID);
      expect(inputData.expiresAt).toBe("2026-09-23T12:00:00.000Z");
      expect(inputData.expiresAt).not.toBe("2999-01-01T00:00:00.000Z");
    }
  });
});