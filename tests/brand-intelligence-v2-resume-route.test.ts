import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWorkflow: vi.fn(),
  v1State: vi.fn(),
  v2State: vi.fn(),
  v2CreateRun: vi.fn(),
  resume: vi.fn(),
}));

vi.mock("@/mastra/runtime", () => ({
  getMastra: () => ({ getWorkflow: mocks.getWorkflow }),
}));

import { POST } from "@/app/api/workflows/brand-intelligence/resume/route";

const SECRET = "resume-secret";
const RUN_ID = "run-v2-1";
const CRAWL_ID = "33333333-3333-4333-8333-333333333333";

function req(body: Record<string, unknown>) {
  return new Request("http://localhost/api/workflows/brand-intelligence/resume", {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": SECRET },
    body: JSON.stringify(body),
  });
}beforeEach(() => {
  vi.clearAllMocks();
  process.env.INTERNAL_WEBHOOK_SECRET = SECRET;
  mocks.v1State.mockResolvedValue(null);
  mocks.v2State.mockResolvedValue({ status: "suspended" });
  mocks.resume.mockResolvedValue({ status: "success" });
  mocks.v2CreateRun.mockResolvedValue({ resume: mocks.resume });
  mocks.getWorkflow.mockImplementation((key: string) => {
    if (key === "brand-intelligence") {
      return { getWorkflowRunById: mocks.v1State, createRun: vi.fn() };
    }
    if (key === "brand-intelligence-v2-golden") {
      return { getWorkflowRunById: mocks.v2State, createRun: mocks.v2CreateRun };
    }
    throw new Error(`unexpected workflow ${key}`);
  });
});

describe("brand-intelligence resume route v2 parity", () => {
  it("discovers the durable workflow owner server-side and resumes v2 with provider correlation", async () => {
    const res = await POST(req({
      runId: RUN_ID,
      crawlId: CRAWL_ID,
    }));

    expect(res.status).toBe(200);
    expect(mocks.v2CreateRun).toHaveBeenCalledWith({ runId: RUN_ID });    expect(mocks.resume).toHaveBeenCalledWith({
      resumeData: {
        crawlId: CRAWL_ID,
        failed: false,
        error: undefined,
      },
      step: "waitForCrawl",
    });
  });

  it("fails closed if the same run id exists in both workflow definitions", async () => {
    mocks.v1State.mockResolvedValue({ status: "suspended" });

    const res = await POST(req({ runId: RUN_ID, crawlId: CRAWL_ID }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.message).toMatch(/ambiguous workflow run/i);
    expect(mocks.resume).not.toHaveBeenCalled();
  });
});