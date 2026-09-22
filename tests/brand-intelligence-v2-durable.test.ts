import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serviceClient: vi.fn(),
  fetch: vi.fn(),
  single: vi.fn(),
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
}function fakeAdmin() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: mocks.single })),
      })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.serviceClient.mockReturnValue(fakeAdmin());
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        ok: true,
        data: { crawlId: CRAWL_ID, firecrawlJobId: "fc-job-1" },
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
});describe("brand-intelligence-v2 durable crawl parity", () => {
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
  it("re-reads Supabase durable truth before accepting webhook resume", async () => {
    const inputData = { brandId: BRAND_ID, crawlId: CRAWL_ID, firecrawlJobId: "fc-job-1" };
    const suspend = vi.fn((payload: unknown) => payload);

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
    expect(mocks.single).toHaveBeenCalledTimes(1);
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
        inputData: { brandId: BRAND_ID, crawlId: CRAWL_ID, firecrawlJobId: "fc-job-1" },
        resumeData: { crawlId: CRAWL_ID },
        suspend: vi.fn(),
        runId: RUN_ID,
      }),
    ).rejects.toThrow("Firecrawl job mismatch");
  });
});