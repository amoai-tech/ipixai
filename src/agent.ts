import { MastraAgent } from "@ag-ui/mastra";
import type { AbstractAgent } from "@ag-ui/client";
import { getMastra } from "@/mastra/runtime";

/**
 * Every local Mastra agent, keyed by name — what the web route mounts.
 *
 * Unlike the HTTP-backed starters there is no agent server here: the agents run
 * in this process.
 */
export function createLocalAgents(
  resourceId: string,
): Record<string, AbstractAgent> {
  // resourceId is required when the Mastra agent has Memory enabled.
  // Without it, CopilotKit seeds working memory onto a frontend-minted
  // threadId that does not exist in LibSQL yet ("Thread … not found").
  return MastraAgent.getLocalAgents({
    mastra: getMastra(),
    resourceId,
  }) as Record<string, AbstractAgent>;
}

/**
 * The single agent the Channel drives.
 *
 * A Channel is one conversation surface, so it takes one agent. The first local
 * agent is the deliberate choice, and an empty registry is a configuration error
 * worth failing loudly on rather than starting a Channel that answers nothing.
 */
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
