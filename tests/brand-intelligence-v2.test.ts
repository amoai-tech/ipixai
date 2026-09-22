import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { officialBrandIntelligenceGoldenPathWorkflow } from "@/mastra/workflows/brand-intelligence-v2";

const WORKFLOW_PATH = new URL(
  "../src/mastra/workflows/brand-intelligence-v2.ts",
  import.meta.url,
);
const CRAWL_ID = "33333333-3333-4333-8333-333333333333";

type ResumeSchema = {
  safeParse: (value: unknown) => { success: boolean };
};

describe("official Brand Intelligence v2 strangler contract", () => {
  it("reuses production steps around the isolated durable crawl seam", () => {
    expect(officialBrandIntelligenceGoldenPathWorkflow.id).toBe(
      "brand-intelligence-v2-golden",
    );
    expect(
      Object.keys(officialBrandIntelligenceGoldenPathWorkflow.steps).sort(),
    ).toEqual([
      "commitOrReject",
      "extractProfile",
      "saveDraftAndWait",
      "startDurableCrawl",
      "validateBrand",
      "waitForCrawl",
    ]);
  });

  it("requires crawlId in the waitForCrawl resume schema", () => {
    const waitStep = officialBrandIntelligenceGoldenPathWorkflow.steps.waitForCrawl as unknown as {
      resumeSchema: ResumeSchema;
    };

    expect(
      waitStep.resumeSchema.safeParse({
        failed: true,
        error: "provider failure",
      }).success,
    ).toBe(false);
    expect(
      waitStep.resumeSchema.safeParse({
        crawlId: CRAWL_ID,
        failed: true,
        error: "provider failure",
      }).success,
    ).toBe(true);
  });

  it("reuses the existing start-brand-crawl durability seam", async () => {
    const source = await readFile(WORKFLOW_PATH, "utf8");
    expect(source).toContain('/functions/v1/start-brand-crawl');
    expect(source).toContain('workflowId: runId');
    expect(source).toContain('.from("brand_crawls")');
  });

  it("does not switch the provider seam before durability parity is proven", async () => {
    const source = await readFile(WORKFLOW_PATH, "utf8");
    expect(source).not.toContain('startBrandSiteCrawl');
    expect(source).not.toContain('from "@/mastra/tools/firecrawl"');
  });
});