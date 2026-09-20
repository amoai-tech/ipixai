// IPI-1117 · HOST-RUNNER-001 — Phase 1 permanent cross-process contract.
//
// Assertions describe the REQUIRED distributed behavior (per the Linear
// issue's own P0-1/P0-2/P0-3 spec: "expected = true", "expected = receives
// LIVE R1 events", "expected = Process A actually terminates") — not the
// current broken behavior. On today's architecture every assertion here is
// expected to FAIL (RED). That is correct: a positive-contract test that
// currently fails is the standard TDD signal "not fixed yet", and the same
// unmodified file is what must go GREEN once a real distributed runner
// lands — on any candidate (current InMemoryAgentRunner, an upgraded
// version of it, CopilotKit Intelligence, or a custom shared runner).
//
// An earlier version of this file asserted the CURRENT (broken) behavior
// instead — e.g. `expect(isRunning).toBe(false)`. That version passed
// (green) precisely because the bug was present, which is a valid one-time
// diagnostic but the wrong long-term contract: it would have started
// FAILING the moment someone actually fixed IPI-1117, which inverts the
// normal "CI red until fixed, green once fixed" signal and reads as if the
// fix broke something. This version fixes that: RED now == not fixed yet,
// GREEN == fixed, for every future candidate.
//
// Proves (or, today, disproves) that CopilotKit's InMemoryAgentRunner keeps
// live-run state in ONE OS process. TenantAbortRunner
// (src/lib/copilotkit/tenant-abort-runner.ts) extends InMemoryAgentRunner
// and delegates every store read/write to `super.<method>()` — it inherits
// this defect rather than fixing it; its own pendingRuns/pendingStops Sets
// (tenant-abort-runner.ts:43-44) are a second, even narrower process-local
// layer on top. Testing the base InMemoryAgentRunner contract is therefore
// the correct, cheapest-decisive Phase 1 target — it needs no Mastra/
// Postgres dependency (TenantAbortRunner.run() calls getPlannerMemory()/
// ensureMastraThread(), which a real cross-process worker cannot mock the
// way tenant-abort-runner.test.ts does with vi.spyOn inside one Vitest
// process) and it is the shared root cause both classes exhibit.
//
// Two runner instances constructed inside a single Vitest worker would
// share the same module-level ɵGLOBAL_STORE and prove nothing (see
// node_modules/@copilotkit/runtime/dist/v2/runtime/runner/in-memory.mjs).
// This harness spawns real, separate `tsx` child processes instead, per
// ./fixtures/copilot-runner-worker.ts.
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type WorkerChild = ChildProcessByStdio<null, Readable, Readable>;

const TSX_BIN = path.join(process.cwd(), "node_modules", ".bin", "tsx");
const WORKER = path.join(process.cwd(), "tests", "fixtures", "copilot-runner-worker.ts");

type WorkerMessage = Record<string, unknown>;

function readLines(child: WorkerChild, onLine: (message: WorkerMessage) => void) {
  let buffer = "";
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;
      try {
        onLine(JSON.parse(line) as WorkerMessage);
      } catch {
        // tsx/Node diagnostic output on stdout — not a worker message.
      }
    }
  });
}

function waitFor(
  predicate: () => boolean,
  timeoutMs = 8000,
  intervalMs = 20,
  diagnose?: () => string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() > deadline) {
        return reject(new Error(`waitFor timed out${diagnose ? `: ${diagnose()}` : ""}`));
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

function spawnOwner(threadId: string, runId: string) {
  const child = spawn(TSX_BIN, [WORKER, "owner", threadId, runId], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const messages: WorkerMessage[] = [];
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });
  readLines(child, (message) => messages.push(message));
  return {
    child,
    messages,
    get stderr() {
      return stderr;
    },
  };
}

function runRemote(mode: string, threadId: string, runId: string): Promise<WorkerMessage> {
  return new Promise((resolve, reject) => {
    const child = spawn(TSX_BIN, [WORKER, mode, threadId, runId], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let result: WorkerMessage | undefined;
    let stderr = "";
    readLines(child, (message) => {
      if (message.kind === "result") result = message;
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("exit", (code) => {
      if (result) return resolve(result);
      reject(new Error(`${mode} produced no result (exit ${code}): ${stderr.slice(0, 2000)}`));
    });
  });
}

function tickCount(messages: WorkerMessage[]) {
  return messages.filter((m) => m.kind === "owner_tick").length;
}

function diag(owner: ReturnType<typeof spawnOwner>) {
  return `messages=${JSON.stringify(owner.messages)} stderr=${owner.stderr}`;
}

describe("IPI-1117 · cross-process CopilotKit runner contract (permanent P0-1/P0-2/P0-3)", () => {
  const spawned: WorkerChild[] = [];

  afterEach(() => {
    for (const child of spawned.splice(0)) {
      if (!child.killed) child.kill("SIGKILL");
    }
  });

  it("P0-1: a run started on process A is visible to isRunning() on process B", async () => {
    const threadId = randomUUID();
    const runId = randomUUID();
    const owner = spawnOwner(threadId, runId);
    spawned.push(owner.child);
    await waitFor(() => owner.messages.some((m) => m.kind === "ready"), 8000, 20, () => diag(owner));
    await waitFor(() => tickCount(owner.messages) >= 1, 8000, 20, () => diag(owner));

    const result = await runRemote("remote-isRunning", threadId, runId);

    // Required distributed behavior: a separate runtime instance must agree
    // that R1 is active. Today this is FALSE (RED) — process B has never
    // heard of this thread, because CopilotKit's runner store is
    // process-local. This assertion must go GREEN, unmodified, once a real
    // distributed runner is in place.
    expect(result.value).toBe(true);
  }, 10000);

  it("P0-2: connect() on process B receives process A's live run events", async () => {
    const threadId = randomUUID();
    const runId = randomUUID();
    const owner = spawnOwner(threadId, runId);
    spawned.push(owner.child);
    await waitFor(() => owner.messages.some((m) => m.kind === "ready"), 8000, 20, () => diag(owner));
    await waitFor(() => tickCount(owner.messages) >= 2, 8000, 20, () => diag(owner));

    const result = await runRemote("remote-connect", threadId, runId);
    const events = result.value as string[];

    // Required distributed behavior: B must receive A's still-active run —
    // at minimum the live TEXT_MESSAGE_CONTENT ticks A keeps emitting, not
    // just a historical replay. Today `events` is [] (RED) because B's
    // store never had this thread. Stored history alone would not satisfy
    // this either — it must include a live post-connect event, so this
    // checks for the actual tick event type, not merely "something arrived".
    expect(events.length).toBeGreaterThan(0);
    expect(events).toContain("TEXT_MESSAGE_CONTENT");
  }, 10000);

  it("P0-3: stop() on process B terminates process A's active run", async () => {
    const threadId = randomUUID();
    const runId = randomUUID();
    const owner = spawnOwner(threadId, runId);
    spawned.push(owner.child);
    await waitFor(() => owner.messages.some((m) => m.kind === "ready"), 8000, 20, () => diag(owner));
    await waitFor(() => tickCount(owner.messages) >= 2, 8000, 20, () => diag(owner));
    const ticksBeforeStop = tickCount(owner.messages);

    const result = await runRemote("remote-stop", threadId, runId);

    // Required distributed behavior: stop() must succeed...
    expect(result.value).toBe(true);

    // ...AND process A must actually terminate — no more ticks after a
    // short settle window, and an owner_complete/RUN_FINISHED outcome.
    // `stop() === true` alone is explicitly insufficient per the Linear
    // spec; both conditions must hold together. Today stop() returns false
    // and A keeps ticking forever (RED) because B's stop() can't reach A's
    // process-local state at all.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const ticksAfterSettle = tickCount(owner.messages);
    expect(ticksAfterSettle).toBe(ticksBeforeStop);
    expect(owner.messages.some((m) => m.kind === "owner_complete")).toBe(true);
  }, 15000);
});
