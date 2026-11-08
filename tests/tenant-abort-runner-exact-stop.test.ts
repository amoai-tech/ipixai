/**
 * IPI-1290 · COPILOTKIT-UPGRADE-001: with CopilotKit 1.85.0 the /stop body
 * carries `{ runId }`. TenantAbortRunner must forward that exact runId and
 * must never let a stale Stop(R1) cancel a newer run R2 — neither while R2
 * is still starting (pending) nor once it is active.
 */
import { AbstractAgent, EventType } from "@ag-ui/client";
import type { BaseEvent, RunAgentInput } from "@ag-ui/client";
import { InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import { Observable } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlannerRunControl } from "@/lib/copilotkit/planner-run-control";

let releaseMemory: () => void = () => {};
let memoryGate: Promise<void> = Promise.resolve();
let memoryAvailable = true;
/** Replaced per test to hold or fail Mastra thread setup. */
let threadSetup: () => Promise<void> = async () => {};

vi.mock("@/mastra/thread-persistence", () => ({
  splitRunThreadIds: (resourceId: string, threadId: string) => ({
    runnerThreadId: `${resourceId}::${threadId}`,
    mastraThreadId: threadId,
  }),
  getPlannerMemory: async () => {
    await memoryGate;
    return memoryAvailable ? {} : null;
  },
  ensureMastraThread: () => threadSetup(),
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

/** Emits one assistant message and a state snapshot so scoped reads have data. */
class ChattyAgent extends AbstractAgent {
  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      subscriber.next({
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      } as BaseEvent);
      subscriber.next({
        type: EventType.TEXT_MESSAGE_START,
        messageId: "m-owner",
        role: "assistant",
      } as BaseEvent);
      subscriber.next({
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: "m-owner",
        delta: "scoped history",
      } as BaseEvent);
      subscriber.next({
        type: EventType.TEXT_MESSAGE_END,
        messageId: "m-owner",
      } as BaseEvent);
      subscriber.next({
        type: EventType.STATE_SNAPSHOT,
        snapshot: { owner: input.runId },
      } as BaseEvent);
      // A delta gives the runtime a real state change to compact, so the
      // stored event stream keeps a trailing STATE_SNAPSHOT.
      subscriber.next({
        type: EventType.STATE_DELTA,
        delta: [{ op: "add", path: "/verified", value: true }],
      } as BaseEvent);
      subscriber.next({
        type: EventType.RUN_FINISHED,
        threadId: input.threadId,
        runId: input.runId,
      } as BaseEvent);
      subscriber.complete();
    });
  }
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
  memoryAvailable = true;
  threadSetup = async () => {};
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

  // Preview failure: the browser only sends its next message once the stopped
  // run's stream reports an end. A run cancelled while starting used to close
  // with no events, so the chat stayed "running" and R2 never left the browser.
  it("a run stopped while starting still reports RUN_STARTED then RUN_FINISHED for that run", async () => {
    memoryGate = new Promise((resolve) => (releaseMemory = resolve));
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);

    const r1 = collect(
      runner.run({ threadId, agent: wrapAbortRun(new SlowAgent()), input: input(threadId, "R1") }),
    );
    expect(await runner.stop({ threadId, runId: "R1" })).toBe(true);
    releaseMemory();
    await r1.done;

    expect(r1.events).toEqual([
      expect.objectContaining({ type: EventType.RUN_STARTED, threadId, runId: "R1" }),
      expect.objectContaining({ type: EventType.RUN_FINISHED, threadId, runId: "R1" }),
    ]);
  });

  it("a run stopped while starting still ends as stopped if thread setup then fails", async () => {
    let failSetup: () => void = () => {};
    threadSetup = () =>
      new Promise<void>((_, reject) => (failSetup = () => reject(new Error("thread_setup_failed"))));
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);

    const r1 = collect(
      runner.run({ threadId, agent: wrapAbortRun(new SlowAgent()), input: input(threadId, "R1") }),
    );
    // Let memory resolve so the run is parked inside thread setup.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await runner.stop({ threadId, runId: "R1" })).toBe(true);
    failSetup();
    await r1.done;

    expect(r1.events.map((e) => e.type)).toEqual([EventType.RUN_STARTED, EventType.RUN_FINISHED]);
  });

  it("a run that was not stopped still errors when memory is unavailable", async () => {
    memoryAvailable = false;
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);

    const r1 = collect(
      runner.run({ threadId, agent: wrapAbortRun(new SlowAgent()), input: input(threadId, "R1") }),
    );
    await expect(r1.done).rejects.toThrow("memory_unavailable");
  });

  it("a run whose client disconnected while starting ends silently", async () => {
    memoryGate = new Promise((resolve) => (releaseMemory = resolve));
    const threadId = nextThread();
    const controller = new AbortController();
    const slow = new SlowAgent();
    const runner = new TenantAbortRunner(RESOURCE, controller.signal);

    const r1 = collect(runner.run({ threadId, agent: wrapAbortRun(slow), input: input(threadId, "R1") }));
    controller.abort();
    releaseMemory();
    await r1.done;

    expect(r1.events).toEqual([]);
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

  // Regression: a cancelled run's late cleanup must not delete the next run's pending record.
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

  // Regression: two runs starting on one thread each keep their own pending record.
  it("Stop(R1) while R1 and R2 are both starting stops only R1", async () => {
    memoryGate = new Promise((resolve) => (releaseMemory = resolve));
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const slow1 = new SlowAgent();
    const slow2 = new SlowAgent();

    const r1 = collect(
      runner.run({ threadId, agent: wrapAbortRun(slow1), input: input(threadId, "R1") }),
    );
    const r2 = collect(
      runner.run({ threadId, agent: wrapAbortRun(slow2), input: input(threadId, "R2") }),
    );
    expect(await runner.stop({ threadId, runId: "R1" })).toBe(true);
    releaseMemory();

    await Promise.all([r1.done, r2.done]);
    expect(slow1.runs).toBe(0);
    expect(slow2.runs).toBe(1);
    expect(r2.events.map((e) => e.type)).toContain(EventType.RUN_FINISHED);
  });

  it("Stop(R2) while R1 and R2 are both starting stops only R2", async () => {
    memoryGate = new Promise((resolve) => (releaseMemory = resolve));
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const slow1 = new SlowAgent();
    const slow2 = new SlowAgent();

    const r1 = collect(
      runner.run({ threadId, agent: wrapAbortRun(slow1), input: input(threadId, "R1") }),
    );
    const r2 = collect(
      runner.run({ threadId, agent: wrapAbortRun(slow2), input: input(threadId, "R2") }),
    );
    expect(await runner.stop({ threadId, runId: "R2" })).toBe(true);
    releaseMemory();

    await Promise.all([r1.done, r2.done]);
    expect(slow2.runs).toBe(0);
    expect(slow1.runs).toBe(1);
    expect(r1.events.map((e) => e.type)).toContain(EventType.RUN_FINISHED);
  });

  it("a Stop without a runId stops every run still starting on the thread", async () => {
    memoryGate = new Promise((resolve) => (releaseMemory = resolve));
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const slow1 = new SlowAgent();
    const slow2 = new SlowAgent();

    const r1 = collect(
      runner.run({ threadId, agent: wrapAbortRun(slow1), input: input(threadId, "R1") }),
    );
    const r2 = collect(
      runner.run({ threadId, agent: wrapAbortRun(slow2), input: input(threadId, "R2") }),
    );
    expect(await runner.stop({ threadId })).toBe(true);
    releaseMemory();

    await Promise.all([r1.done, r2.done]);
    expect(slow1.runs).toBe(0);
    expect(slow2.runs).toBe(0);
  });

  // Full journey on the local (Production) path: R1 -> Stop(R1) -> R2 -> late Stop(R1).
  it("R1 stops on Stop(R1); a late Stop(R1) then leaves R2 running to completion", async () => {
    memoryGate = Promise.resolve();
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const slow1 = new SlowAgent();
    const slow2 = new SlowAgent();

    const r1 = collect(
      runner.run({ threadId, agent: wrapAbortRun(slow1), input: input(threadId, "R1") }),
    );
    await vi.waitFor(async () => expect(await runner.isRunning({ threadId })).toBe(true));
    expect(await runner.stop({ threadId, runId: "R1" })).toBe(true);
    await r1.done;

    const r2 = collect(
      runner.run({ threadId, agent: wrapAbortRun(slow2), input: input(threadId, "R2") }),
    );
    await vi.waitFor(async () => expect(await runner.isRunning({ threadId })).toBe(true));
    expect(await runner.stop({ threadId, runId: "R1" })).toBe(false);
    await r2.done;

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(slow1.finished).toBe(false);
    expect(slow2.finished).toBe(true);
    expect(r2.events.map((e) => e.type)).toContain(EventType.RUN_FINISHED);
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

  it("falls back to remote probe and exact Stop when this process does not own the run", async () => {
    const remote = {
      isRunning: vi.fn(async () => true),
      stop: vi.fn(async (_threadId: string, runId: string) => ({
        kind: "stop_ack" as const,
        requestId: "q1",
        runId,
        stopped: true,
        ownerInstanceId: "runtime-a",
      })),
    } as unknown as PlannerRunControl;
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal, remote);

    expect(await runner.isRunning({ threadId: "remote-thread" })).toBe(true);
    expect(await runner.stop({ threadId: "remote-thread", runId: "R1" })).toBe(true);
    expect(remote.isRunning).toHaveBeenCalledWith("remote-thread");
    expect(remote.stop).toHaveBeenCalledWith("remote-thread", "R1");
  });

  it("relays new live events from a remote owner instead of falling back to durable history", async () => {
    const close = vi.fn(async () => {});
    const remote = {
      connect: vi.fn(async () => ({
        runId: "R1",
        ownerInstanceId: "runtime-a",
        onEvent(handler: (event: BaseEvent) => void) {
          const timer = setTimeout(() => {
            handler({ type: EventType.RUN_STARTED, threadId: "remote-thread", runId: "R1" } as BaseEvent);
            handler({ type: EventType.RUN_FINISHED, threadId: "remote-thread", runId: "R1" } as BaseEvent);
          }, 0);
          return () => clearTimeout(timer);
        },
        close,
      })),
    } as unknown as PlannerRunControl;
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal, remote);

    const connected = collect(runner.connect({ threadId: "remote-thread" }));
    await connected.done;
    expect(connected.events.map((event) => event.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.RUN_FINISHED,
    ]);
    expect(remote.connect).toHaveBeenCalledWith("remote-thread");
    expect(close).toHaveBeenCalled();
  });

  it("registers the local owner before the model runs and publishes live events for remote listeners", async () => {
    const publish = vi.fn(async (_event: BaseEvent) => {});
    const close = vi.fn(async () => {});
    const own = vi.fn(async () => ({ publish, close }));
    const control = { own } as unknown as PlannerRunControl;
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal, control);

    const run = collect(
      runner.run({ threadId, agent: wrapAbortRun(new SlowAgent()), input: input(threadId, "R1") }),
    );
    await run.done;

    expect(own).toHaveBeenCalledWith(threadId, "R1", expect.any(Function));
    expect(publish.mock.calls.map(([event]) => event.type)).toEqual(
      expect.arrayContaining([EventType.RUN_STARTED, EventType.RUN_FINISHED]),
    );
    expect(close).toHaveBeenCalled();
  });
});

describe("IPI-1389 CopilotKit 1.85 authenticated runner ownership", () => {
  const OWNER = "operator-a";
  const FOREIGN = "operator-b";

  it("recognizes a running, authenticated thread under the same owner", async () => {
    memoryGate = Promise.resolve();
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const agent = wrapAbortRun(new SlowAgent());
    const running = collect(
      runner.run({ threadId, agent, input: input(threadId, "OWN-R1"), ownerId: OWNER }),
    );

    await vi.waitFor(async () => {
      expect(
        await InMemoryAgentRunner.prototype.isRunning.call(runner, {
          threadId: `${RESOURCE}::${threadId}`,
          ownerId: OWNER,
        }),
      ).toBe(true);
    });
    expect(await runner.isRunning({ threadId, ownerId: OWNER })).toBe(true);
    expect(await runner.isRunning({ threadId, ownerId: FOREIGN })).toBe(false);
    await running.done;
  });

  it("keeps thread events and listing scoped to the authenticated owner", async () => {
    memoryGate = Promise.resolve();
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const run = collect(
      runner.run({
        threadId,
        agent: wrapAbortRun(new SlowAgent()),
        input: input(threadId, "OWN-R2"),
        ownerId: OWNER,
      }),
    );
    await run.done;

    const scopedRunner: InMemoryAgentRunner = runner;
    expect(scopedRunner.getThreadEvents(threadId, { ownerId: OWNER }).length).toBeGreaterThan(0);
    expect(scopedRunner.getThreadEvents(threadId, { ownerId: FOREIGN })).toEqual([]);
    expect(scopedRunner.listThreads({ ownerId: OWNER }).map((thread) => thread.id)).toContain(
      threadId,
    );
    expect(scopedRunner.listThreads({ ownerId: FOREIGN })).toEqual([]);
  });

  it("checks ownership for the resource-prefixed internal thread id", async () => {
    memoryGate = Promise.resolve();
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const run = collect(
      runner.run({
        threadId,
        agent: wrapAbortRun(new SlowAgent()),
        input: input(threadId, "OWN-R3"),
        ownerId: OWNER,
      }),
    );
    await run.done;

    expect(runner.isThreadAccessible(threadId, { ownerId: OWNER })).toBe(true);
    expect(runner.isThreadAccessible(threadId, { ownerId: FOREIGN })).toBe(false);
  });

  it("refuses a foreign-owner connect and forwards ownerId on the owner path", async () => {
    memoryGate = Promise.resolve();
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const running = collect(
      runner.run({
        threadId,
        agent: wrapAbortRun(new SlowAgent()),
        input: input(threadId, "OWN-R4"),
        ownerId: OWNER,
      }),
    );
    await vi.waitFor(async () => {
      expect(await runner.isRunning({ threadId, ownerId: OWNER })).toBe(true);
    });

    const connectSpy = vi.spyOn(InMemoryAgentRunner.prototype, "connect");
    const isRunningSpy = vi.spyOn(InMemoryAgentRunner.prototype, "isRunning");

    // A foreign owner gets no replay and never reaches the parent connect().
    const foreign = collect(runner.connect({ threadId, ownerId: FOREIGN }));
    await foreign.done;
    expect(foreign.events).toEqual([]);
    expect(connectSpy).not.toHaveBeenCalled();

    // The owner reaches connect() with the scoped id AND its ownerId, so the
    // parent's own visibility check cannot silently fall back to the server
    // owner (the review's fail-open concern).
    const ownerSub = runner.connect({ threadId, ownerId: OWNER }).subscribe(() => {});
    await vi.waitFor(() => {
      expect(connectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: `${RESOURCE}::${threadId}`,
          ownerId: OWNER,
        }),
      );
    });
    expect(isRunningSpy).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: `${RESOURCE}::${threadId}`, ownerId: OWNER }),
    );

    ownerSub.unsubscribe();
    connectSpy.mockRestore();
    isRunningSpy.mockRestore();
    await running.done;
  });

  it("forwards the scoped thread identity to the owner-filtered read methods", () => {
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const threadId = nextThread();
    const scope = { ownerId: OWNER };
    const messages = vi
      .spyOn(InMemoryAgentRunner.prototype, "getThreadMessages")
      .mockReturnValue([]);
    const events = vi
      .spyOn(InMemoryAgentRunner.prototype, "getThreadEvents")
      .mockReturnValue([]);

    runner.getThreadMessages(threadId, scope);
    // getThreadState deliberately reads the parent's event list directly, so
    // the scoped identity must reach getThreadEvents (not the parent state
    // method, which would re-enter the overridden getThreadEvents).
    runner.getThreadState(threadId, scope);

    expect(messages).toHaveBeenCalledWith(`${RESOURCE}::${threadId}`, scope);
    expect(events).toHaveBeenCalledWith(`${RESOURCE}::${threadId}`, scope);
    messages.mockRestore();
    events.mockRestore();
  });

  it("forwards the run owner when a remote Stop resolves through the owner callback", async () => {
    memoryGate = Promise.resolve();
    const threadId = nextThread();
    let stopFromOwner: ((remoteRunId: string) => Promise<boolean>) | undefined;
    const own = vi.fn(
      async (
        _threadId: string,
        _runId: string,
        callback: (remoteRunId: string) => Promise<boolean>,
      ) => {
        stopFromOwner = callback;
        return { publish: async () => {}, close: async () => {} };
      },
    );
    const control = { own } as unknown as PlannerRunControl;
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal, control);
    const run = collect(
      runner.run({
        threadId,
        agent: wrapAbortRun(new SlowAgent()),
        input: input(threadId, "OWN-R5"),
        ownerId: OWNER,
      }),
    );
    await vi.waitFor(() => expect(stopFromOwner).toBeTypeOf("function"));

    const stopSpy = vi.spyOn(InMemoryAgentRunner.prototype, "stop").mockResolvedValue(true);
    try {
      await stopFromOwner?.("R-remote");

      expect(stopSpy).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: OWNER, runId: "R-remote" }),
      );
    } finally {
      stopSpy.mockRestore();
    }
    await run.done;
  });

  it("returns thread messages and state only to the owning identity", async () => {
    memoryGate = Promise.resolve();
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const run = collect(
      runner.run({
        threadId,
        agent: wrapAbortRun(new ChattyAgent()),
        input: input(threadId, "OWN-R6"),
        ownerId: OWNER,
      }),
    );
    await run.done;

    const scopedRunner: InMemoryAgentRunner = runner;
    expect(scopedRunner.getThreadMessages(threadId, { ownerId: OWNER }).length).toBeGreaterThan(0);
    expect(scopedRunner.getThreadMessages(threadId, { ownerId: FOREIGN })).toEqual([]);
    expect(scopedRunner.getThreadState(threadId, { ownerId: OWNER })).toEqual(
      expect.objectContaining({ owner: "OWN-R6" }),
    );
    expect(scopedRunner.getThreadState(threadId, { ownerId: FOREIGN })).toBeNull();
  });

  it("lets the owning identity reconnect to a live run and hides it from others", async () => {
    memoryGate = Promise.resolve();
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const running = collect(
      runner.run({
        threadId,
        agent: wrapAbortRun(new SlowAgent()),
        input: input(threadId, "OWN-R7"),
        ownerId: OWNER,
      }),
    );
    await vi.waitFor(async () => {
      expect(await runner.isRunning({ threadId, ownerId: OWNER })).toBe(true);
    });

    const ownerEvents: BaseEvent[] = [];
    const ownerSub = runner.connect({ threadId, ownerId: OWNER }).subscribe((event) => {
      ownerEvents.push(event);
    });
    const foreign = collect(runner.connect({ threadId, ownerId: FOREIGN }));
    await foreign.done;
    expect(foreign.events).toEqual([]);

    await vi.waitFor(
      () => {
        expect(ownerEvents.some((event) => event.type === EventType.RUN_FINISHED)).toBe(true);
      },
      { timeout: 5_000 },
    );
    ownerSub.unsubscribe();
    await running.done;
  });

  it("refuses a foreign-owner Stop for an active run", async () => {
    memoryGate = Promise.resolve();
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const slow = new SlowAgent();
    const agent = wrapAbortRun(slow);
    const running = collect(
      runner.run({
        threadId,
        agent,
        input: input(threadId, "OWN-R8"),
        ownerId: OWNER,
      }),
    );
    await vi.waitFor(async () => {
      expect(await runner.isRunning({ threadId, ownerId: OWNER })).toBe(true);
    });

    expect(await runner.stop({ threadId, runId: "OWN-R8", ownerId: FOREIGN })).toBe(false);
    await running.done;
    expect(slow.finished).toBe(true);
    expect(running.events.map((event) => event.type)).toContain(EventType.RUN_FINISHED);
  });

  it("does not let a foreign owner stop a run during startup", async () => {
    let release!: () => void;
    memoryGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const threadId = nextThread();
    const runner = new TenantAbortRunner(RESOURCE, new AbortController().signal);
    const slow = new SlowAgent();
    const agent = wrapAbortRun(slow);
    const running = collect(
      runner.run({
        threadId,
        agent,
        input: input(threadId, "OWN-R9"),
        ownerId: OWNER,
      }),
    );

    // The run is registered as pending but super.run() has not claimed the
    // thread yet, so only the owner-scoped pending match can stop it.
    expect(await runner.stop({ threadId, runId: "OWN-R9", ownerId: FOREIGN })).toBe(false);
    release();
    await running.done;
    expect(slow.finished).toBe(true);
    expect(running.events.map((event) => event.type)).toContain(EventType.RUN_FINISHED);
  });
});
