import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { productionPlannerAgent } from "../src/mastra/agents";
import {
  PLANNING_ONLY_TOOLS,
  CONSEQUENTIAL_WRITE_TOOLS,
  ALL_AGENT_TOOLS,
} from "../src/mastra/planner-tool-gate";

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
      "composeShootPlan",
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

describe("IPI-1208 · PLANNER-TOOLGATE-001 — activeTools injection in agent stream", () => {
  it("still has all 7 tools registered on the agent (listTools not filtered)", async () => {
    const tools = await productionPlannerAgent.listTools();
    expect(Object.keys(tools).sort()).toEqual(ALL_AGENT_TOOLS.slice().sort());
  });

  it("does not remove approveDraft/startBrandAnalysis from the agent instruction text", () => {
    // Read the source to confirm the agent instructions still mention
    // brand-intelligence tools (they are just gated per-turn, not removed).
    const source = readFileSync(
      new URL("../src/mastra/agents/index.ts", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(/approveDraft/);
    expect(source).toMatch(/startBrandAnalysis/);
    // The stream wrapper is present
    expect(source).toMatch(/activeTools/);
  });

  it("uses the correct tool categories", () => {
    expect(PLANNING_ONLY_TOOLS).toEqual([
      "recommendShootType",
      "planDeliverables",
      "generateShotListDraft",
      "estimateShootBudget",
      "composeShootPlan",
    ]);
    expect(CONSEQUENTIAL_WRITE_TOOLS).toEqual(["approveDraft", "startBrandAnalysis"]);
    expect(ALL_AGENT_TOOLS.length).toBe(7);
  });
});
