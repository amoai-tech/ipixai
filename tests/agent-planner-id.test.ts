import { afterEach, describe, expect, it, vi } from "vitest";
import type { AbstractAgent } from "@ag-ui/client";
import { MastraAgent } from "@ag-ui/mastra";

import {
  PLANNER_AGENT_ID,
  createRemoteAgents,
  withPlannerAgentId,
} from "@/agent";

// Stands in for the real Mastra agent, whose own `id` is "production-planner".
const fakeAgent = { agentId: "production-planner" } as unknown as AbstractAgent;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/**
 * IPI-1312 regression: switching Planner execution to remote Mastra changed the
 * registry key the frontend must resolve.
 *
 * The local path keys by the Mastra registration key ("default"), but the
 * remote path keys by each agent's own `id` ("production-planner"). The whole
 * frontend resolves `agentId: "default"`, so an unnormalised remote map made
 * `useAgent({ agentId: "default" })` throw "Agent 'default' not found after
 * runtime sync", which crashed the operator panel before the chat could mount.
 */
describe("Planner agent id contract", () => {
  it("exposes the id the frontend actually resolves", () => {
    expect(PLANNER_AGENT_ID).toBe("default");
  });

  it("re-keys a remote map keyed by the agent's own id", () => {
    const rekeyed = withPlannerAgentId({ "production-planner": fakeAgent });

    expect(Object.keys(rekeyed)).toEqual(["default"]);
    expect(rekeyed.default).toBe(fakeAgent);
  });

  it("leaves a map that already uses the frontend id untouched", () => {
    const alreadyCorrect = { default: fakeAgent };

    expect(withPlannerAgentId(alreadyCorrect)).toBe(alreadyCorrect);
  });

  it("fails closed when the agent source exposes more than one agent", () => {
    const ambiguous = { alpha: fakeAgent, beta: fakeAgent };

    expect(() => withPlannerAgentId(ambiguous)).toThrow(
      /expected exactly one Planner/i,
    );
  });

  it("fails closed when multiple agents include the frontend default key", () => {
    const wrongDefault = { agentId: "not-the-planner" } as unknown as AbstractAgent;
    const ambiguous = { default: wrongDefault, "production-planner": fakeAgent };

    expect(() => withPlannerAgentId(ambiguous)).toThrow(
      /expected exactly one Planner/i,
    );
  });

  it("fails closed when the agent source exposes no agents", () => {
    expect(() => withPlannerAgentId({})).toThrow(/expected exactly one Planner/i);
  });

  it("re-keys createRemoteAgents output when the server advertises the agent id", async () => {
    vi.stubEnv("MASTRA_BASE_URL", "http://127.0.0.1:4111");
    vi.spyOn(MastraAgent, "getRemoteAgents").mockResolvedValue({
      "production-planner": fakeAgent,
    } as never);

    const agents = await createRemoteAgents("org:a::user:u", "jwt");

    expect(Object.keys(agents)).toEqual(["default"]);
    expect(agents.default).toBe(fakeAgent);
  });
});
