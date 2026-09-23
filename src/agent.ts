import { MastraAgent } from "@ag-ui/mastra";
import type { AbstractAgent } from "@ag-ui/client";
import { MastraClient } from "@mastra/client-js";
import { getMastra } from "@/mastra/runtime";

/**
 * The CopilotKit-facing agent id. Both agent sources must expose this key.
 *
 * `getLocalAgents()` keys by the Mastra *registration* key (`default` — see
 * src/mastra/runtime.ts) while `getRemoteAgents()` keys by each agent's own
 * `id` ("production-planner"). Every frontend call site uses
 * `agentId: "default"`, so the remote map is normalised onto this key.
 */
export const PLANNER_AGENT_ID = "default";

/**
 * Re-key a single-Planner agent map onto `PLANNER_AGENT_ID`.
 *
 * This product registers exactly one Planner, so a remote map's single entry
 * is the Planner regardless of the id the server advertised. A map that
 * already exposes the expected id (the local path) is returned unchanged.
 * Zero or multiple entries are rejected before CopilotKit can bind the wrong
 * agent or fail later in the browser with an opaque missing-agent error.
 */
export function withPlannerAgentId(
  agents: Record<string, AbstractAgent>,
): Record<string, AbstractAgent> {
  const entries = Object.entries(agents);
  if (entries.length !== 1) {
    const exposedIds = entries.map(([id]) => id).join(", ") || "none";
    throw new Error(
      `[agent] expected exactly one Planner but the agent source exposed ${entries.length}: ${exposedIds}`,
    );
  }
  if (agents[PLANNER_AGENT_ID]) return agents;
  return { [PLANNER_AGENT_ID]: entries[0][1] };
}

export function createMastraClientForRequest(accessToken: string): MastraClient {
  const baseUrl = process.env.MASTRA_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("MASTRA_BASE_URL is required for remote Planner execution");
  }
  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new Error("MASTRA_BASE_URL must be a valid URL");
  }
  if (parsedBaseUrl.protocol !== "http:" && parsedBaseUrl.protocol !== "https:") {
    throw new Error("MASTRA_BASE_URL must use http or https");
  }
  if (!accessToken) {
    throw new Error("Authenticated Supabase access token is required for Mastra");
  }
  return new MastraClient({
    baseUrl: parsedBaseUrl.toString().replace(/\/$/, ""),
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function createRemoteAgents(
  resourceId: string,
  accessToken: string,
): Promise<Record<string, AbstractAgent>> {
  const agents = (await MastraAgent.getRemoteAgents({
    mastraClient: createMastraClientForRequest(accessToken),
    resourceId,
  })) as Record<string, AbstractAgent>;
  return withPlannerAgentId(agents);
}

/** Local agents remain available for the non-Intelligence fallback and CLI/channel host. */
export function createLocalAgents(
  resourceId: string,
): Record<string, AbstractAgent> {
  return withPlannerAgentId(
    MastraAgent.getLocalAgents({
      mastra: getMastra(),
      resourceId,
    }) as Record<string, AbstractAgent>,
  );
}

export function createDefaultAgent(): AbstractAgent {
  const agents = createLocalAgents("default");
  const first = Object.values(agents)[0];
  if (!first) {
    throw new Error(
      "No local Mastra agents found — check src/mastra registers at least one.",
    );
  }
  return first;
}
