import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serviceClient: vi.fn(),
  fetch: vi.fn(),
  single: vi.fn(),
  updateEq: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mocks.serviceClient,
}));
vi.mock("@/lib/supabase/env", () => ({
  getPublicSupabaseConfig: () => ({ url: "https://example.supabase.co" }),
}));

import { officialBrandIntelligenceGoldenPathWorkflow } from "@/mastra/workflows/brand-intelligence-v2";

const BRAND_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const CRAWL_ID = "33333333-3333-4333-8333-333333333333";
const RUN_ID = "run-v2-durable";

type StepExecute = (args: Record<string, unknown>) => Promise<unknown>;

function stepExecute(id: string): StepExecute {
  const step = officialBrandIntelligenceGoldenPathWorkflow.steps[id] as unknown as { execute: StepExecute };
  return step.execute;
}

function fakeAdmin() {
  return {
    from: vi.fn((table: string) => {
      if (table === "brands") {
        return {
          update: vi.fn(() => ({ eq: mocks.updateEq })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: mocks.single })),
        })),
      };
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SUPABASE_SECRET_KEYS;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.serviceClient.mockReturnValue(fakeAdmin());
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        ok: true,
        data: { crawlId: CRAWL_ID, firecrawlJobId: "fc-job-1", reused: false },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  mocks.single.mockResolvedValue({
    data: {
      brand_id: BRAND_ID,
      firecrawl_job_id: "fc-job-1",
      job_status: "complete",
      workflow_id: RUN_ID,
    },
    error: null,
  });
  mocks.updateEq.mockResolvedValue({ error: null });
});

describe("brand-intelligence-v2 durable crawl parity", () => {
  it("uses the same modern default service key contract as production v1", async () => {
    process.env.SUPABASE_SECRET_KEYS = JSON.stringify({ default: "sb_secret_v2_modern" });
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await stepExecute("startDurableCrawl")({
      inputData: {
        brandId: BRAND_ID,
        actorId: ACTOR_ID,
        brandUrl: "https://brand.example",
      },
      runId: RUN_ID,
    });

    const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ apikey: "sb_secret_v2_modern" });
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("starts through the existing durable Edge seam and binds the Mastra run id", async () => {
    const result = await stepExecute("startDurableCrawl")({
      inputData: {
        brandId: BRAND_ID,
        actorId: ACTOR_ID,
        brandUrl: "https://brand.example",
      },
      runId: RUN_ID,
    });

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/functions/v1/start-brand-crawl");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      apikey: "test-service-role",
    });
    expect(init.headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(String(init.body))).toEqual({
      brandId: BRAND_ID,
      url: "https://brand.example",
      actorId: ACTOR_ID,
      workflowId: RUN_ID,
    });
    expect(result).toEqual({
      brandId: BRAND_ID,
      crawlId: CRAWL_ID,
      firecrawlJobId: "fc-job-1",
    });
  });
  it("re-reads Supabase durable truth before suspending and before accepting webhook resume", async () => {
    const inputData = {
      brandId: BRAND_ID,
      crawlId: CRAWL_ID,
      firecrawlJobId: "fc-job-1",
    };
    const suspend = vi.fn((payload: unknown) => payload);

    mocks.single
      .mockResolvedValueOnce({
        data: {
          brand_id: BRAND_ID,
          firecrawl_job_id: "fc-job-1",
          job_status: "running",
          workflow_id: RUN_ID,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          brand_id: BRAND_ID,
          firecrawl_job_id: "fc-job-1",
          job_status: "complete",
          workflow_id: RUN_ID,
        },
        error: null,
      });

    await stepExecute("waitForCrawl")({ inputData, resumeData: undefined, suspend, runId: RUN_ID });
    expect(suspend).toHaveBeenCalledWith(
      { crawlId: CRAWL_ID, firecrawlJobId: "fc-job-1" },
      { resumeLabel: "crawl-complete" },
    );

    const resumed = await stepExecute("waitForCrawl")({
      inputData,
      resumeData: { crawlId: CRAWL_ID },
      suspend,
      runId: RUN_ID,
    });
    expect(resumed).toEqual(inputData);
    expect(mocks.single).toHaveBeenCalledTimes(2);
  });

  it("records analysis failure for a malformed successful Edge response", async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    mocks.updateEq.mockResolvedValueOnce({ error: null });

    await expect(
      stepExecute("startDurableCrawl")({
        inputData: {
          brandId: BRAND_ID,
          actorId: ACTOR_ID,
          brandUrl: "https://brand.example",
        },
        runId: RUN_ID,
      }),
    ).rejects.toThrow("Crawl start response missing durable crawl identity");

    expect(mocks.updateEq).toHaveBeenCalledWith("id", BRAND_ID);
  });

  it("fails closed when the durable provider job does not match", async () => {
    mocks.single.mockResolvedValueOnce({
      data: {
        brand_id: BRAND_ID,
        firecrawl_job_id: "different-job",
        job_status: "complete",
        workflow_id: RUN_ID,
      },
      error: null,
    });

    await expect(
      stepExecute("waitForCrawl")({
        inputData: {
          brandId: BRAND_ID,
          crawlId: CRAWL_ID,
          firecrawlJobId: "fc-job-1",
            },
        resumeData: { crawlId: CRAWL_ID },
        suspend: vi.fn(),
        runId: RUN_ID,
      }),
    ).rejects.toThrow("Firecrawl job mismatch");
  });

  it("fails fast instead of suspending on a reused active crawl owned by another workflow", async () => {
    const suspend = vi.fn();
    mocks.single.mockResolvedValueOnce({
      data: {
        brand_id: BRAND_ID,
        firecrawl_job_id: "fc-job-1",
        job_status: "running",
        workflow_id: "older-workflow-run",
      },
      error: null,
    });

    await expect(
      stepExecute("waitForCrawl")({
        inputData: {
          brandId: BRAND_ID,
          crawlId: CRAWL_ID,
          firecrawlJobId: "fc-job-1",
            },
        resumeData: undefined,
        suspend,
        runId: RUN_ID,
      }),
    ).rejects.toThrow("Durable crawl belongs to another workflow");
    expect(suspend).not.toHaveBeenCalled();
  });
});