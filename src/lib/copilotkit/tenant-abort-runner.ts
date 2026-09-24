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
/**
 * runnerThreadId → the run still starting (before super.run registers it).
 * One record per run: a Stop marks only the record whose runId it names, and
 * each run removes only its own record, so an overlapping or cancelled start
 * can never erase or inherit another run's Stop.
 */
type PendingRun = { runId: string | undefined; stopRequested: boolean };
const pendingRuns = new Map<string, PendingRun>();

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

  private shouldSkipRun(pending: PendingRun, cancelled: boolean) {
    return cancelled || this.signal.aborted || pending.stopRequested;
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
    const pending: PendingRun = { runId: request.input?.runId, stopRequested: false };
    pendingRuns.set(runnerThreadId, pending);
    return new Observable<BaseEvent>((subscriber) => {
      let inner: { unsubscribe: () => void } | undefined;
      let cancelled = false;
      const releasePending = () => {
        if (pendingRuns.get(runnerThreadId) === pending) {
          pendingRuns.delete(runnerThreadId);
        }
      };
      void (async () => {
        if (this.shouldSkipRun(pending, cancelled)) {
          releasePending();
          subscriber.complete();
          return;
        }
        const memory = await getPlannerMemory();
        if (this.shouldSkipRun(pending, cancelled)) {
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
        if (this.shouldSkipRun(pending, cancelled)) {
          releasePending();
          subscriber.complete();
          return;
        }
        inner = super
          .run({ ...request, threadId: runnerThreadId, input })
          .subscribe(subscriber);
        releasePending();
      })().catch((error) => {
        releasePending();
        if (!cancelled) subscriber.error(error);
      });
      return () => {
        cancelled = true;
        releasePending();
        inner?.unsubscribe();
      };
    });
  }

  override async stop(request: Parameters<InMemoryAgentRunner["stop"]>[0]) {
    const runnerThreadId = this.scope(request.threadId);
    // IPI-1290: a Stop scoped to another run (e.g. a late Stop(R1) while R2
    // is still starting) must not cancel the pending run.
    const pending = pendingRuns.get(runnerThreadId);
    const stopsPending =
      pending !== undefined &&
      (request.runId === undefined || request.runId === pending.runId);
    if (stopsPending) pending.stopRequested = true;
    const stopped = await super.stop({
      ...request,
      threadId: runnerThreadId,
    });
    return Boolean(stopped) || stopsPending;
  }

  /**
   * IPI-1217 · COPILOT-APP-DOCK-002: CopilotKitCore.connectAgent()
   * (@copilotkit/core) unconditionally clears agent.messages on the FIRST
   * connect of any explicit thread in a fresh browser JS heap — that
   * tracking map is CLIENT-side, so this happens on every page reload
   * regardless of whether the SERVER process happens to still be warm.
   * It then expects the gateway's connect() to "ask... for a full replay"
   * (that file's own doc comment on _lastConnectedThreadIdsByAgent).
   *
   * A prior version of this fix only consulted durable Mastra history when
   * the in-memory replay produced ZERO events ("cold process"). That
   * missed the more common case this exact CI job hits: a single
   * long-lived server process where the in-memory store DOES still have
   * historic events from the original run, so the durable fallback never
   * engaged — leaving the same reload-restoration defect live for the
   * ordinary same-process case (proven red by
   * e2e/planner-journey.spec.ts's "...and it survives reload" job on PR
   * #171 head 9be9f55, and by the missing "warm process" case in
   * tenant-abort-runner.test.ts).
   *
   * Fix: source replay from durable Mastra history (via the same
   * authorized recallPlannerChatMessages() helper
   * /api/planner/threads/:id/messages already uses) whenever the thread is
   * NOT currently running — never from the process-local in-memory store,
   * which is "bounded and non-durable by design" per its own guidance
   * string (@copilotkit/runtime dist/v2/runtime/runner/in-memory.mjs) and
   * therefore not a reliable source of truth for a finished conversation
   * even within the same process. Only a thread with a genuinely active
   * run reconnects to the live in-memory stream. resourceId is
   * this.resourceId, server-derived from requirePlannerResourceId in
   * handleCopilot, never client-supplied, and recallPlannerChatMessages
   * itself fails closed (returns []) when the thread belongs to another
   * resource.
   */
  override connect(request: Parameters<InMemoryAgentRunner["connect"]>[0]) {
    const { mastraThreadId } = splitRunThreadIds(
      this.resourceId,
      request.threadId,
    );
    const resourceId = this.resourceId;
    return new Observable<BaseEvent>((subscriber) => {
      let cancelled = false;
      let inner: { unsubscribe: () => void } | undefined;
      void (async () => {
        const running = await this.isRunning({ threadId: request.threadId });
        if (cancelled) return;
        if (running) {
          inner = super
            .connect({ ...request, threadId: this.scope(request.threadId) })
            .subscribe(subscriber);
          return;
        }
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
      return () => {
        cancelled = true;
        inner?.unsubscribe();
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
