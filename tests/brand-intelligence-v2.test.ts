import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { officialBrandIntelligenceGoldenPathWorkflow } from "@/mastra/workflows/brand-intelligence-v2";

const WORKFLOW_PATH = new URL(
  "../src/mastra/workflows/brand-intelligence-v2.ts",
  import.meta.url,
);

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