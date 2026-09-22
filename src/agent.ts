import { MastraAgent } from "@ag-ui/mastra";
import type { AbstractAgent } from "@ag-ui/client";
import { MastraClient } from "@mastra/client-js";
import { getMastra } from "@/mastra/runtime";

export function createMastraClientForRequest(accessToken: string): MastraClient {
  const baseUrl = process.env.MASTRA_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("MASTRA_BASE_URL is required for remote Planner execution");
  }
  if (!accessToken) {
    throw new Error("Authenticated Supabase access token is required for Mastra");
  }
  return new MastraClient({
    baseUrl,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function createRemoteAgents(
  resourceId: string,
  accessToken: string,
): Promise<Record<string, AbstractAgent>> {
  return (await MastraAgent.getRemoteAgents({
    mastraClient: createMastraClientForRequest(accessToken),
    resourceId,
  })) as Record<string, AbstractAgent>;
}

/** Local agents remain available for the non-Intelligence fallback and CLI/channel host. */
export function createLocalAgents(
  resourceId: string,
): Record<string, AbstractAgent> {
  return MastraAgent.getLocalAgents({
    mastra: getMastra(),
    resourceId,
  }) as Record<string, AbstractAgent>;
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
