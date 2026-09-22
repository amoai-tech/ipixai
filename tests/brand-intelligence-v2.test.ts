import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startBrandSiteCrawl: vi.fn(),
}));

vi.mock("@/mastra/tools/firecrawl", () => ({
  startBrandSiteCrawl: mocks.startBrandSiteCrawl,
}));

import { officialBrandIntelligenceGoldenPathWorkflow } from "@/mastra/workflows/brand-intelligence-v2";

const BRAND_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const CRAWL_ID = "33333333-3333-4333-8333-333333333333";
const RUN_ID = "run-official-1";
const WEBHOOK = "https://example.supabase.co/functions/v1/firecrawl-webhook";

type StepExecute = (args: Record<string, unknown>) => Promise<unknown>;

function stepExecute(id: "startOfficialCrawl" | "waitForOfficialCrawl"): StepExecute {
  const step = officialBrandIntelligenceGoldenPathWorkflow.steps[id] as unknown as {
    execute: StepExecute;
  };
  return step.execute;
}
beforeEach(() => {
  mocks.startBrandSiteCrawl.mockReset();
  mocks.startBrandSiteCrawl.mockResolvedValue({ id: "fc-job-1" });
});

describe("official Brand Intelligence golden path", () => {
  it("starts Firecrawl through the official SDK boundary with durable correlation metadata", async () => {
    const result = await stepExecute("startOfficialCrawl")({
      inputData: {
        brandId: BRAND_ID,
        actorId: ACTOR_ID,
        crawlId: CRAWL_ID,
        brandUrl: "https://brand.example",
        webhookUrl: WEBHOOK,
      },
      runId: RUN_ID,
    });

    expect(mocks.startBrandSiteCrawl).toHaveBeenCalledWith({
      url: "https://brand.example",
      webhookUrl: WEBHOOK,
      metadata: {
        brand_id: BRAND_ID,
        crawl_id: CRAWL_ID,
        workflow_id: RUN_ID,
        started_by: ACTOR_ID,
      },
    });
    expect(result).toEqual({ brandId: BRAND_ID, crawlId: CRAWL_ID, firecrawlJobId: "fc-job-1" });
  });
  it("suspends on the exact Firecrawl job and resumes only the matching job", async () => {
    const suspend = vi.fn((payload: unknown) => payload);
    const inputData = { brandId: BRAND_ID, crawlId: CRAWL_ID, firecrawlJobId: "fc-job-1" };

    const suspended = await stepExecute("waitForOfficialCrawl")({
      inputData,
      resumeData: undefined,
      suspend,
    });
    expect(suspend).toHaveBeenCalledWith(
      { crawlId: CRAWL_ID, firecrawlJobId: "fc-job-1" },
      { resumeLabel: "crawl-complete" },
    );
    expect(suspended).toEqual({ crawlId: CRAWL_ID, firecrawlJobId: "fc-job-1" });

    const resumed = await stepExecute("waitForOfficialCrawl")({
      inputData,
      resumeData: { crawlId: CRAWL_ID, firecrawlJobId: "fc-job-1", failed: false },
      suspend,
    });
    expect(resumed).toEqual(inputData);
  });

  it("fails closed on a mismatched provider job", async () => {
    await expect(
      stepExecute("waitForOfficialCrawl")({
        inputData: { brandId: BRAND_ID, crawlId: CRAWL_ID, firecrawlJobId: "fc-job-1" },
        resumeData: { crawlId: CRAWL_ID, firecrawlJobId: "other-job", failed: false },
        suspend: vi.fn(),
      }),
    ).rejects.toThrow("Firecrawl job mismatch");
  });
});
