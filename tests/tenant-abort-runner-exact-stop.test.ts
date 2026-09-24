/**
 * IPI-1290 · COPILOTKIT-UPGRADE-001: with CopilotKit 1.73.3 the /stop body
 * carries `{ runId }`. TenantAbortRunner must forward that exact runId and
 * must never let a stale Stop(R1) cancel a newer run R2 — neither while R2
 * is still starting (pending) nor once it is active.
 */
import { AbstractAgent, EventType } from "@ag-ui/client";
import type { BaseEvent, RunAgentInput } from "@ag-ui/client";
import { InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import { Observable } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";

let releaseMemory: () => void = () => {};
let memoryGate: Promise<void> = Promise.resolve();

vi.mock("@/mastra/thread-persistence", () => ({
  splitRunThreadIds: (resourceId: string, threadId: string) => ({
    runnerThreadId: `${resourceId}::${threadId}`,
    mastraThreadId: threadId,
  }),
  getPlannerMemory: async () => {
    await memoryGate;
    return {};
  },
  ensureMastraThread: async () => {},
  recallPlannerChatMessages: async () => [],
}));

const { TenantAbortRunner, wrapAbortRun } = await import(
  "@/lib/copilotkit/tenant-abort-runner"
);

class SlowAgent extends AbstractAgent {
  runs = 0;
  /** True only if the model stream reached its own natural end. */
  finished = false;
  run(input: RunAgentInput): Observable<BaseEvent> {
    this.runs += 1;
    return new Observable<BaseEvent>((subscriber) => {
      subscriber.next({
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      } as BaseEvent);
      const timer = setTimeout(() => {
        this.finished = true;
        subscriber.next({
          type: EventType.RUN_FINISHED,
          threadId: input.threadId,
          runId: input.runId,
        } as BaseEvent);
        subscriber.complete();
      }, 150);
      return () => clearTimeout(timer);
    });
  }
}

function input(threadId: string, runId: string): RunAgentInput {
  return { threadId, runId, messages: [], tools: [], context: [], state: {}, forwardedProps: {} };
}

function collect(observable: Observable<BaseEvent>) {
  const events: BaseEvent[] = [];
  const done = new Promise<void>((resolve, reject) => {
    observable.subscribe({ next: (e) => events.push(e), complete: resolve, error: reject });
  });
  return { events, done };
}

const RESOURCE = "org-a:user-a";
let threadSeq = 0;
const nextThread = () => `thread-${++threadSeq}`;

afterEach(() => {
  releaseMemory();
  vi.restoreAllMocks();
});

describe("IPI-1290 TenantAbortRunner exact-run Stop", () => {
  it("forwards the exact runId to the CopilotKit runner under the tenant-scoped thread", async () => {
    const spy = vi.spyOn(InMemoryAgentRunner.prototype, "stop");
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);

    await runner.stop({ threadId: "t-forward", runId: "R1" });

    expect(spy).toHaveBeenCalledWith({ threadId: `${RESOURCE}::t-forward`, runId: "R1" });
  });

  it("a stale Stop(R1) cannot cancel R2 while R2 is still starting", async () => {
    memoryGate = new Promise((resolve) => (releaseMemory = resolve));
    const threadId = nextThread();
    const agent = wrapAbortRun(new SlowAgent());
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);

    const r2 = collect(runner.run({ threadId, agent, input: input(threadId, "R2") }));
    expect(await runner.stop({ threadId, runId: "R1" })).toBe(false);

    releaseMemory();
    await r2.done;
    expect(r2.events.map((e) => e.type)).toContain(EventType.RUN_FINISHED);
  });

  it("Stop(R2) while R2 is still starting cancels R2 before the model runs", async () => {
    memoryGate = new Promise((resolve) => (releaseMemory = resolve));
    const threadId = nextThread();
    const slow = new SlowAgent();
    const agent = wrapAbortRun(slow);
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);

    const r2 = collect(runner.run({ threadId, agent, input: input(threadId, "R2") }));
    expect(await runner.stop({ threadId, runId: "R2" })).toBe(true);

    releaseMemory();
    await r2.done;
    expect(slow.runs).toBe(0);
  });

  it("a stale Stop(R1) is a no-op against an active R2, and Stop(R2) still works", async () => {
    memoryGate = Promise.resolve();
    const threadId = nextThread();
    const slow = new SlowAgent();
    const agent = wrapAbortRun(slow);
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);

    const r2 = collect(runner.run({ threadId, agent, input: input(threadId, "R2") }));
    await vi.waitFor(async () => expect(await runner.isRunning({ threadId })).toBe(true));

    expect(await runner.stop({ threadId, runId: "R1" })).toBe(false);
    expect(await runner.isRunning({ threadId })).toBe(true);

    expect(await runner.stop({ threadId, runId: "R2" })).toBe(true);
    await r2.done;
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(slow.finished).toBe(false);
  });

  // Codacy review on PR 270: pending-run cleanup must be run-specific. A run
  // cancelled while starting must not erase the next run's pending record,
  // or a Stop for that next run is lost and it runs anyway.
  it("a cancelled starting run cannot erase the next run's pending Stop", async () => {
    memoryGate = new Promise((resolve) => (releaseMemory = resolve));
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);

    const first = runner
      .run({ threadId, agent: wrapAbortRun(new SlowAgent()), input: input(threadId, "RA") })
      .subscribe();
    first.unsubscribe();

    const slowB = new SlowAgent();
    const rb = collect(
      runner.run({ threadId, agent: wrapAbortRun(slowB), input: input(threadId, "RB") }),
    );
    // Stop RB while it is still starting, then let RA's late cleanup run.
    expect(await runner.stop({ threadId, runId: "RB" })).toBe(true);
    releaseMemory();
    await rb.done;
    expect(slowB.runs).toBe(0);
  });

  it("another tenant cannot stop the run", async () => {
    memoryGate = Promise.resolve();
    const threadId = nextThread();
    const agent = wrapAbortRun(new SlowAgent());
    const owner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const other = new TenantAbortRunner("org-b:user-b", new AbortController().signal);

    const r2 = collect(owner.run({ threadId, agent, input: input(threadId, "R2") }));
    await vi.waitFor(async () => expect(await owner.isRunning({ threadId })).toBe(true));

    expect(await other.stop({ threadId, runId: "R2" })).toBe(false);
    await r2.done;
    expect(r2.events.map((e) => e.type)).toContain(EventType.RUN_FINISHED);
  });
});
