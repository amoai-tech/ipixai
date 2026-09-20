// IPI-1117 · HOST-RUNNER-001 — Phase 1 cross-process worker.
//
// Run only via `tsx` as a standalone OS process (see
// ../copilot-runner-cross-process.test.ts). Importing this file into a
// Vitest worker defeats the point: CopilotKit's InMemoryAgentRunner keeps
// its live-run state in a module-level singleton
// (ɵGLOBAL_STORE, node_modules/@copilotkit/runtime/dist/v2/runtime/runner/in-memory.mjs),
// so two runner instances in one process always share state. A real OS
// process boundary is the only thing that proves (or disproves) the
// cross-instance contract this task's Gate 2 requires.
//
// Modes (argv[2]):
//   owner            — starts a long-running run for threadId/runId and
//                       keeps emitting until abortRun() is called in THIS
//                       process (it never is, in Phase 1 — nothing outside
//                       this process can reach it).
//   remote-isRunning  — fresh runner instance, calls isRunning(threadId).
//   remote-connect    — fresh runner instance, calls connect(threadId) and
//                       collects whatever it replays for ~250ms.
//   remote-stop       — fresh runner instance, calls stop(threadId).
//
// Every mode reports over stdout as one JSON object per line so the parent
// test (which only has pipes, not IPC) can observe outcomes without racing
// on process exit codes.
import { InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import { AbstractAgent, EventType } from "@ag-ui/client";
import type { BaseEvent, RunAgentInput } from "@ag-ui/client";
import { Observable } from "rxjs";

const [, , mode, threadId, runId] = process.argv;
if (!mode || !threadId || !runId) {
  throw new Error("usage: copilot-runner-worker.ts <mode> <threadId> <runId>");
}

function send(message: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

/** Emits RUN_STARTED, then one TEXT_MESSAGE_CONTENT tick every 50ms forever
 * — deterministic, no model/API call — until abortRun() flips `stopped`.
 * Long enough to exercise a remote isRunning/connect/stop against a live
 * run without a fixed sleep race. */
class LongRunningAgent extends AbstractAgent {
  private stopped = false;

  abortRun(): void {
    this.stopped = true;
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      subscriber.next({
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      } as BaseEvent);
      // AG-UI's client-side verify() middleware requires an open
      // TEXT_MESSAGE_START before any TEXT_MESSAGE_CONTENT with the same
      // messageId — open it once, then tick CONTENT deltas into it.
      subscriber.next({
        type: EventType.TEXT_MESSAGE_START,
        messageId: "worker-tick",
        role: "assistant",
      } as unknown as BaseEvent);

      let tick = 0;
      const interval = setInterval(() => {
        if (this.stopped) {
          clearInterval(interval);
          subscriber.next({
            type: EventType.TEXT_MESSAGE_END,
            messageId: "worker-tick",
          } as unknown as BaseEvent);
          subscriber.next({
            type: EventType.RUN_FINISHED,
            threadId: input.threadId,
            runId: input.runId,
          } as BaseEvent);
          subscriber.complete();
          return;
        }
        tick += 1;
        subscriber.next({
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId: "worker-tick",
          delta: `tick-${tick}`,
        } as unknown as BaseEvent);
        send({ kind: "owner_tick", tick });
      }, 50);

      return () => clearInterval(interval);
    });
  }

  protected connect(): Observable<BaseEvent> {
    throw new Error("not exercised by owner mode");
  }
}

function ownerMode() {
  const runner = new InMemoryAgentRunner();
  const agent = new LongRunningAgent({ agentId: "default", threadId });

  runner
    .run({
      threadId,
      agent,
      input: {
        threadId,
        runId,
        messages: [],
        state: {},
        tools: [],
        context: [],
        forwardedProps: {},
      },
    })
    .subscribe({
      next: (event) => send({ kind: "owner_event", type: (event as BaseEvent).type }),
      complete: () => send({ kind: "owner_complete" }),
      error: (error) => send({ kind: "owner_error", message: String(error) }),
    });

  send({ kind: "ready" });
  // Stay alive until the parent test kills this process (SIGKILL in
  // afterEach) — nothing in Phase 1 can reach this process to stop it
  // cleanly, which is exactly the defect under test.
}

async function remoteIsRunningMode() {
  const runner = new InMemoryAgentRunner();
  const running = await runner.isRunning({ threadId });
  send({ kind: "result", op: "isRunning", value: running });
  process.exit(0);
}

async function remoteConnectMode() {
  const runner = new InMemoryAgentRunner();
  const events: string[] = [];
  await new Promise<void>((resolve) => {
    const subscription = runner.connect({ threadId }).subscribe({
      next: (event) => events.push((event as BaseEvent).type as string),
      complete: () => resolve(),
      error: () => resolve(),
    });
    // connect() on a fresh process's empty store completes synchronously
    // (see in-memory.mjs); this timeout only guards against a future
    // implementation that legitimately streams live events for a while.
    setTimeout(() => {
      subscription.unsubscribe();
      resolve();
    }, 250);
  });
  send({ kind: "result", op: "connect", value: events });
  process.exit(0);
}

async function remoteStopMode() {
  const runner = new InMemoryAgentRunner();
  const stopped = await runner.stop({ threadId });
  send({ kind: "result", op: "stop", value: Boolean(stopped) });
  process.exit(0);
}

switch (mode) {
  case "owner":
    ownerMode();
    break;
  case "remote-isRunning":
    void remoteIsRunningMode();
    break;
  case "remote-connect":
    void remoteConnectMode();
    break;
  case "remote-stop":
    void remoteStopMode();
    break;
  default:
    throw new Error(`unknown mode: ${mode}`);
}
