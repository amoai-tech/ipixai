import type { Agent } from "@mastra/core/agent";

type ActiveRunAgent = Pick<Agent, "listActiveThreadRuns">;
type AbortableActiveRunAgent = Pick<
  Agent,
  "listActiveThreadRuns" | "abortRunStream"
>;

export function findOwnedActiveRun(
  agent: ActiveRunAgent,
  resourceId: string,
  threadId: string,
) {
  return agent
    .listActiveThreadRuns()
    .find(
      (run) =>
        run.resourceId === resourceId && run.threadId === threadId,
    );
}

export function abortOwnedActiveRun(
  agent: AbortableActiveRunAgent,
  resourceId: string,
  threadId: string,
  runId: string,
): boolean {
  const active = findOwnedActiveRun(agent, resourceId, threadId);
  if (!active || active.runId !== runId) return false;
  return agent.abortRunStream(runId);
}
