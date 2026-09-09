import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { productionPlannerAgent } from "../src/mastra/agents";

const mastraIndexSource = readFileSync(
  new URL("../src/mastra/index.ts", import.meta.url),
  "utf8",
);
const productRouteSource = readFileSync(
  new URL("../src/app/api/copilotkit/[[...slug]]/route.ts", import.meta.url),
  "utf8",
);

describe("Mastra registry contract", () => {
  it("registers the Production Planner behind the load-bearing default key", () => {
    const agent = productionPlannerAgent as unknown as { id?: string; name?: string };

    expect(agent.id).toBe("production-planner");
    expect(agent.name).toBe("Production Planner");
    expect(mastraIndexSource).toMatch(/default\s*:\s*productionPlannerAgent\b/);
  });

  it("does not register or mount the old weather/demo agent on the product route", () => {
    const productSurface = `${mastraIndexSource}\n${productRouteSource}`;

    expect(productSurface).not.toMatch(/weatherAgent|weather-agent|demoAgent|demo-agent/);
    expect(productRouteSource).toMatch(/createLocalAgents\(resourceId\)/);
  });
});

describe("Production Planner registered tool contract", () => {
  it("exposes the four planning tools plus the two brand-intelligence tools, every one with input/output schemas", async () => {
    const tools = await productionPlannerAgent.listTools();
    const expected = [
      "approveDraft",
      "estimateShootBudget",
      "generateShotListDraft",
      "planDeliverables",
      "recommendShootType",
      "startBrandAnalysis",
    ].sort();

    expect(Object.keys(tools).sort()).toEqual(expected);

    for (const [name, tool] of Object.entries(tools)) {
      const contract = tool as unknown as {
        inputSchema?: unknown;
        outputSchema?: unknown;
      };
      expect(contract.inputSchema, `${name} inputSchema`).toBeTruthy();
      expect(contract.outputSchema, `${name} outputSchema`).toBeTruthy();
    }
  });
});
