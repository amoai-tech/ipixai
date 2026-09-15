import { InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import { EventType, randomUUID } from "@ag-ui/client";
import type { AbstractAgent, BaseEvent } from "@ag-ui/client";
import { Observable } from "rxjs";

import {
  ensureMastraThread,
  getPlannerMemory,
  recallPlannerChatMessages,
  splitRunThreadIds,
} from "@/mastra/thread-persistence";

/**
 * Mastra local agents inherit AbstractAgent.abortRun() as a no-op.
 * CopilotKit clones the registered agent per /run (`cloneAgentForRequest`);
 * clone() is Object.create(prototype) and drops instance abortRun.
 * UI Stop → POST /stop → InMemoryAgentRunner.stop → stored clone.abortRun().
 * detachActiveRun() completes the runAgent takeUntil, which ends the SSE.
 */
export function wrapAbortRun(agent: AbstractAgent): AbstractAgent {
  const previousAbort = agent.abortRun.bind(agent);
  agent.abortRun = () => {
    previousAbort();
    void agent.detachActiveRun();
  };
  const previousClone = agent.clone.bind(agent);
  agent.clone = () => wrapAbortRun(previousClone());
  return agent;
}

export function attachRunnerAbort(agents: Record<string, AbstractAgent>) {
  for (const [id, agent] of Object.entries(agents)) {
    agents[id] = wrapAbortRun(agent);
  }
  return agents;
}

/**
 * Process-global InMemoryAgentRunner is keyed by threadId only. Prefix with the
 * AUTH-002 resourceId so /stop cannot cancel another org/user's run.
 * Bind abort on run() after the store registers the thread (not a one-shot body peek).
 */
const pendingRuns = new Set<string>();
const pendingStops = new Set<string>();

export class TenantAbortRunner extends InMemoryAgentRunner {
  constructor(
    private readonly resourceId: string,
    private readonly signal: AbortSignal,
  ) {
    super();
  }

  private scope(threadId: string) {
    return splitRunThreadIds(this.resourceId, threadId).runnerThreadId;
  }

  private shouldSkipRun(runnerThreadId: string, cancelled: boolean) {
    return (
      cancelled ||
      this.signal.aborted ||
      pendingStops.has(runnerThreadId)
    );
  }

  override run(request: Parameters<InMemoryAgentRunner["run"]>[0]) {
    const { runnerThreadId, mastraThreadId } = splitRunThreadIds(
      this.resourceId,
      request.threadId,
    );
    const input = request.input
      ? { ...request.input, threadId: mastraThreadId }
      : request.input;
    const agent = request.agent;
    const runAgent = agent.runAgent.bind(agent);
    agent.runAgent = (runInput, subscribers) => {
      if (this.signal.aborted) {
        agent.abortRun();
        return Promise.resolve({ result: undefined, newMessages: [] });
      }
      this.signal.addEventListener(
        "abort",
        () => {
          agent.abortRun();
        },
        { once: true },
      );
      return runAgent(runInput, subscribers);
    };
    pendingRuns.add(runnerThreadId);
    return new Observable<BaseEvent>((subscriber) => {
      let inner: { unsubscribe: () => void } | undefined;
      let cancelled = false;
      const releasePending = () => {
        pendingStops.delete(runnerThreadId);
        pendingRuns.delete(runnerThreadId);
      };
      void (async () => {
        if (this.shouldSkipRun(runnerThreadId, cancelled)) {
          releasePending();
          subscriber.complete();
          return;
        }
        const memory = await getPlannerMemory();
        if (this.shouldSkipRun(runnerThreadId, cancelled)) {
          releasePending();
          subscriber.complete();
          return;
        }
        if (!memory) {
          releasePending();
          subscriber.error(new Error("memory_unavailable"));
          return;
        }
        await ensureMastraThread(memory, {
          threadId: mastraThreadId,
          resourceId: this.resourceId,
        });
        if (this.shouldSkipRun(runnerThreadId, cancelled)) {
          releasePending();
          subscriber.complete();
          return;
        }
        inner = super
          .run({ ...request, threadId: runnerThreadId, input })
          .subscribe(subscriber);
        pendingRuns.delete(runnerThreadId);
      })().catch((error) => {
        releasePending();
        if (!cancelled) subscriber.error(error);
      });
      return () => {
        cancelled = true;
        pendingRuns.delete(runnerThreadId);
        inner?.unsubscribe();
      };
    });
  }

  override async stop(request: Parameters<InMemoryAgentRunner["stop"]>[0]) {
    const runnerThreadId = this.scope(request.threadId);
    if (pendingRuns.has(runnerThreadId)) {
      pendingStops.add(runnerThreadId);
    }
    const stopped = await super.stop({
      ...request,
      threadId: runnerThreadId,
    });
    return Boolean(stopped) || pendingStops.has(runnerThreadId);
  }

  /**
   * IPI-1217 · COPILOT-APP-DOCK-002: InMemoryAgentRunner.connect() only
   * replays events from its own process-local, non-durable store — "bounded
   * and non-durable by design" per its own guidance string
   * (@copilotkit/runtime dist/v2/runtime/runner/in-memory.mjs). On the
   * FIRST connect of any explicit thread, CopilotKit's own
   * CopilotKitCore.connectAgent() unconditionally clears agent.messages
   * (isFreshRestore is always true against a freshly-loaded page) and
   * expects the gateway's connect() to "ask... for a full replay" (that
   * file's own doc comment on _lastConnectedThreadIdsByAgent). A resumed
   * thread in a process that never ran it (a fresh serverless instance, a
   * restart, or just a different worker) gets zero replayed events and
   * the wipe is never refilled — proven deterministically in
   * tenant-abort-runner.test.ts and
   * src/components/operator-panel/copilotkit-reconnect-history.test.tsx.
   *
   * Fix: when the in-memory replay produces nothing, fall back to durable
   * Mastra history via the same authorized recallPlannerChatMessages()
   * helper the /api/planner/threads/:id/messages route uses — resourceId
   * is this.resourceId, server-derived from requirePlannerResourceId in
   * handleCopilot, never client-supplied, and recallPlannerChatMessages
   * itself fails closed (returns []) when the thread belongs to another
   * resource. A thread that is genuinely running live is untouched: the
   * in-memory observable only completes without emitting when there is
   * nothing in flight for it (see in-memory.mjs's connect()).
   */
  override connect(request: Parameters<InMemoryAgentRunner["connect"]>[0]) {
    const { mastraThreadId } = splitRunThreadIds(
      this.resourceId,
      request.threadId,
    );
    const resourceId = this.resourceId;
    const inMemory$ = super.connect({
      ...request,
      threadId: this.scope(request.threadId),
    });
    return new Observable<BaseEvent>((subscriber) => {
      let sawEvent = false;
      let cancelled = false;
      const inner = inMemory$.subscribe({
        next: (event) => {
          sawEvent = true;
          subscriber.next(event);
        },
        error: (error) => subscriber.error(error),
        complete: () => {
          if (sawEvent) {
            subscriber.complete();
            return;
          }
          void (async () => {
            const memory = await getPlannerMemory();
            if (cancelled) return;
            const messages = memory
              ? await recallPlannerChatMessages(memory, {
                  threadId: mastraThreadId,
                  resourceId,
                })
              : [];
            if (cancelled) return;
            if (messages.length > 0) {
              const runId = randomUUID();
              subscriber.next({
                type: EventType.RUN_STARTED,
                threadId: mastraThreadId,
                runId,
              } as BaseEvent);
              subscriber.next({
                type: EventType.MESSAGES_SNAPSHOT,
                messages,
              } as unknown as BaseEvent);
              subscriber.next({
                type: EventType.RUN_FINISHED,
                threadId: mastraThreadId,
                runId,
              } as BaseEvent);
            }
            subscriber.complete();
          })().catch((error) => {
            if (!cancelled) subscriber.error(error);
          });
        },
      });
      return () => {
        cancelled = true;
        inner.unsubscribe();
      };
    });
  }

  override isRunning(request: Parameters<InMemoryAgentRunner["isRunning"]>[0]) {
    return super.isRunning({ threadId: this.scope(request.threadId) });
  }

  override getThreadMessages(threadId: string) {
    return super.getThreadMessages(this.scope(threadId));
  }

  override getThreadEvents(threadId: string) {
    return super.getThreadEvents(this.scope(threadId));
  }

  override getThreadState(threadId: string) {
    return super.getThreadState(this.scope(threadId));
  }

  override listThreads() {
    const prefix = splitRunThreadIds(this.resourceId, "").runnerThreadId;
    return super
      .listThreads()
      .filter((thread) => thread.id.startsWith(prefix))
      .map((thread) => ({ ...thread, id: thread.id.slice(prefix.length) }));
  }
}
