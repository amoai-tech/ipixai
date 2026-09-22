import { describe, expect, it } from "vitest";

import {
  brandIntelligenceWorkflow,
  commitOrReject,
  extractProfile,
  saveDraftAndWait,
  validateBrand,
} from "@/mastra/workflows/brand-intelligence";
import { officialBrandIntelligenceGoldenPathWorkflow } from "@/mastra/workflows/brand-intelligence-v2";

describe("brand-intelligence-v2 parity reuse", () => {
  it("reuses the exact production authorization, extraction, HITL, and commit steps", () => {
    expect(officialBrandIntelligenceGoldenPathWorkflow.steps.validateBrand).toBe(validateBrand);
    expect(officialBrandIntelligenceGoldenPathWorkflow.steps.extractProfile).toBe(extractProfile);
    expect(officialBrandIntelligenceGoldenPathWorkflow.steps.saveDraftAndWait).toBe(saveDraftAndWait);
    expect(officialBrandIntelligenceGoldenPathWorkflow.steps.commitOrReject).toBe(commitOrReject);
  });

  it("changes only the crawl start/wait seam relative to v1", () => {
    expect(Object.keys(brandIntelligenceWorkflow.steps).sort()).toEqual([
      "commitOrReject",
      "extractProfile",
      "saveDraftAndWait",
      "startCrawl",
      "validateBrand",
      "waitForCrawl",
    ]);
    expect(Object.keys(officialBrandIntelligenceGoldenPathWorkflow.steps).sort()).toEqual([      "commitOrReject",
      "extractProfile",
      "saveDraftAndWait",
      "startDurableCrawl",
      "validateBrand",
      "waitForCrawl",
    ]);
  });
});