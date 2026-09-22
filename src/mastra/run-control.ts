type ActiveRun = {
  runId: string;
  resourceId?: string;
  threadId: string;
};

type ActiveRunAgent = {
  listActiveThreadRuns(): ActiveRun[];
};

type AbortableActiveRunAgent = ActiveRunAgent & {
  abortRunStream(runId: string): boolean;
};

export function findOwnedActiveRun(
  agent: ActiveRunAgent,
  resourceId: string,
  threadId: string,
): ActiveRun | undefined {
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
