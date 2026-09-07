import { describe, expect, it } from "vitest";

import { mastra } from "../src/mastra";
import { productionPlannerAgent } from "../src/mastra/agents";

// IPI-1048 · PLANNER-001 — the `default` registry key stays as-is (Planner
// UI, thread drawer, history restore, and operator chat all hard-code
// agentId="default"); only the agent instance behind it changes from the
// starter weather demo to the Production Planner.
describe("IPI-1048 PLANNER-001: production planner replaces the weather demo", () => {
  it("`default` resolves to the canonical Production Planner instance", () => {
    expect(mastra.getAgent("default")).toBe(productionPlannerAgent);
  });

  it("agent identity is the Production Planner, not the weather demo", () => {
    expect(productionPlannerAgent.id).toBe("production-planner");
    expect(productionPlannerAgent.name).toBe("Production Planner");
  });

  it("uses GPT-5.6 Luna as the configured OpenAI model", () => {
    expect(productionPlannerAgent.model.modelId).toBe("gpt-5.6-luna");
  });

  it("no weather tool is attached — IPI-1049 · TOOL-001 owns the actual tool set", async () => {
    const tools = await productionPlannerAgent.listTools();
    expect(Object.keys(tools)).not.toContain("get-weather");
  });

  it("instructions carry the fashion-production contract, not the generic demo prompt", async () => {
    const instructions = await productionPlannerAgent.getInstructions();
    const text = String(instructions).toLowerCase();
    expect(text).not.toBe("you are a helpful assistant.");
    expect(text).not.toContain("weather");
    for (const term of ["shoot", "deliverable", "budget", "production"]) {
      expect(text).toContain(term);
    }
  });

  it("never claims a save/approval/booking/payment occurred, and asks rather than invents", async () => {
    const instructions = String(await productionPlannerAgent.getInstructions()).toLowerCase();
    expect(instructions).toContain("ask for missing information");
    expect(instructions).toContain("draft from anything actually saved or approved");
    // A behavioral rule ("unless the operator explicitly confirms"), not a
    // "no tools yet" caveat — stays true after IPI-1049 attaches real tools.
    expect(instructions).toContain("never claim");
    expect(instructions).toContain("unless the operator explicitly confirms");
  });

  it("keeps the existing resource-scoped Postgres/Memory configuration attached", async () => {
    const memory = await productionPlannerAgent.getMemory();
    expect(memory).toBeDefined();
  });

  it("no production registry entry exposes the weather agent", () => {
    const registeredIds = Object.values(mastra.listAgents()).map((agent) => agent.id);
    expect(registeredIds).not.toContain("weather-agent");
    expect(registeredIds).toContain("production-planner");
  });
});
