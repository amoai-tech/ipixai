import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { startBrandSiteCrawl } from "@/mastra/tools/firecrawl";

const startInputSchema = z.object({
  brandId: z.string().uuid(),
  actorId: z.string().uuid(),
  crawlId: z.string().uuid(),
  brandUrl: z.string().url(),
  webhookUrl: z.string().url(),
});

const crawlIdentitySchema = z.object({
  brandId: z.string().uuid(),
  crawlId: z.string().uuid(),
  firecrawlJobId: z.string().min(1),
});
const waitResumeSchema = z.object({
  crawlId: z.string().uuid(),
  firecrawlJobId: z.string().min(1),
  failed: z.boolean().optional(),
  error: z.string().optional(),
});

const waitSuspendSchema = z.object({
  crawlId: z.string().uuid(),
  firecrawlJobId: z.string().min(1),
});

const startOfficialCrawl = createStep({
  id: "startOfficialCrawl",
  inputSchema: startInputSchema,
  outputSchema: crawlIdentitySchema,
  execute: async ({ inputData, runId }) => {
    const result = await startBrandSiteCrawl({
      url: inputData.brandUrl,
      webhookUrl: inputData.webhookUrl,
      metadata: {
        brand_id: inputData.brandId,
        crawl_id: inputData.crawlId,
        workflow_id: runId,
        started_by: inputData.actorId,
      },
    });
    return {
      brandId: inputData.brandId,
      crawlId: inputData.crawlId,
      firecrawlJobId: result.id,
    };
  },
});

const waitForOfficialCrawl = createStep({
  id: "waitForOfficialCrawl",
  inputSchema: crawlIdentitySchema,
  outputSchema: crawlIdentitySchema,
  resumeSchema: waitResumeSchema,
  suspendSchema: waitSuspendSchema,
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return suspend(
        {
          crawlId: inputData.crawlId,
          firecrawlJobId: inputData.firecrawlJobId,
        },
        { resumeLabel: "crawl-complete" },
      );
    }
    if (resumeData.failed) {
      throw new Error(resumeData.error || "Firecrawl crawl failed");
    }
    if (resumeData.crawlId !== inputData.crawlId) {
      throw new Error("Crawl ID mismatch");
    }
    if (resumeData.firecrawlJobId !== inputData.firecrawlJobId) {
      throw new Error("Firecrawl job mismatch");
    }

    return inputData;
  },
});

export const officialBrandIntelligenceGoldenPathWorkflow = createWorkflow({
  id: "brand-intelligence-v2-golden",
  inputSchema: startInputSchema,
  outputSchema: crawlIdentitySchema,
  steps: [startOfficialCrawl, waitForOfficialCrawl],
})
  .then(startOfficialCrawl)
  .then(waitForOfficialCrawl)
  .commit();
