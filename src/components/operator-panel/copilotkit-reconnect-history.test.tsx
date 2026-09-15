// @vitest-environment jsdom
//
// IPI-1217 · COPILOT-APP-DOCK-002 — deterministic regression test for the
// real reconnect-history defect, using REAL (unmocked) library code:
//   - @copilotkit/core's CopilotKitCore.connectAgent() (the same class
//     @copilotkit/react-core/v2's <CopilotChat> calls on mount)
//   - @copilotkit/runtime/v2's InMemoryAgentRunner (the exact base class
//     TenantAbortRunner extends in ../../app/api/copilotkit/[[...slug]]/
//     route.ts — TenantAbortRunner.connect() is a pure threadId-scoping
//     pass-through to InMemoryAgentRunner.connect(), verified by reading
//     that file; nothing about scoping changes replay behavior)
//   - this repo's real RestoreMastraHistory component
//
// Root cause (verified by direct source read, not speculation):
//
//   1. CopilotKitCore.connectAgent() (@copilotkit/core/dist/index.mjs
//      ~L2158-2168) tracks the last-connected threadId per agentId in an
//      in-memory Map (`_lastConnectedThreadIdsByAgent`). On a browser
//      reload this map is empty, so the FIRST connect of ANY explicit
//      thread is always judged `isFreshRestore = true` — which
//      unconditionally calls `agent.setMessages([])` BEFORE calling
//      `agent.connectAgent(...)`. This is intentional upstream behavior
//      (see that file's own doc comment: a fresh restore "must clear
//      messages/state and ask the gateway for a full replay").
//
//   2. "Ask the gateway for a full replay" means CopilotKit expects the
//      SERVER's connect() to replay full durable history as AG-UI events
//      immediately after the wipe. But InMemoryAgentRunner.connect()
//      (@copilotkit/runtime/dist/v2/runtime/runner/in-memory.mjs
//      ~L407-432) only replays events from ITS OWN process-local,
//      non-durable `sharedStore` — "bounded and non-durable by design"
//      per that file's own guidance string. TenantAbortRunner never
//      teaches it about Mastra/Postgres.
//
//   3. So any thread resumed in a process that didn't itself run the
//      original conversation (a fresh serverless instance, a restarted
//      server, or simply a different worker) gets connect()-replayed
//      ZERO events, and step 1's wipe is never refilled.
//
// RestoreMastraHistory populating agent.messages from durable Mastra
// history, gated to run BEFORE <CopilotChat> mounts, cannot survive this
// on its own: CopilotChat's own mount-time connectAgent() call happens
// AFTER RestoreMastraHistory settles, and unconditionally wipes whatever
// RestoreMastraHistory just set — a `agent.setMessages(x)` done before
// mount is strictly upstream of a wipe that always fires on first connect.
// Test 1 below proves this against the REAL, FIXED TenantAbortRunner
// (src/lib/copilotkit/tenant-abort-runner.ts): the server's connect() now
// falls back to durable Mastra history itself when the in-memory replay is
// empty, so CopilotKit's own "ask the gateway for a full replay" contract
// is actually satisfied — history survives even though RestoreMastraHistory's
// own client-side setMessages() call gets wiped moments later. Test 2 uses
// the bare InMemoryAgentRunner to document why: real historic AG-UI events
// arriving via connect()'s replay survive the wipe, unlike a same-tick
// client-side setMessages() call made before mount.
import { createContext, useContext } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopilotKitCore } from "@copilotkit/core";
import { InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import { AbstractAgent, EventType } from "@ag-ui/client";
import type { BaseEvent, Message, RunAgentInput } from "@ag-ui/client";
import { Observable } from "rxjs";

import { RestoreMastraHistory } from "@/components/restore-mastra-history";
import * as threadPersistence from "@/mastra/thread-persistence";
import type { PlannerChatMessage } from "@/mastra/thread-persistence";
import { TenantAbortRunner } from "@/lib/copilotkit/tenant-abort-runner";

vi.mock("@/components/ui/error-state.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

// RestoreMastraHistory only needs useAgent({agentId}) -> {agent}; stub the
// real @copilotkit/react-core/v2 hook (its package entry pulls in bundled
// CSS this plain vitest config can't load — see tests/app-001-shell.test.ts
// for the same constraint) with a trivial context carrying our real agent
// instance, so RestoreMastraHistory's own logic runs completely unmocked.
const AgentCtx = createContext<AbstractAgent | null>(null);
vi.mock("@copilotkit/react-core/v2", () => ({
  useAgent: () => {
    const agent = useContext(AgentCtx);
    if (!agent) throw new Error("no agent in context");
    return { agent };
  },
}));

const history: Message[] = [
  { id: "m1", role: "user", content: "alpha-fact" },
  { id: "m2", role: "assistant", content: "remembered" },
] as Message[];

/**
 * Bridges directly to a real runner's connect() — the same way HttpAgent
 * bridges to it over HTTP/SSE in production — so only the wire transport
 * is skipped, not any actual server-side logic.
 */
class RunnerBackedAgent extends AbstractAgent {
  constructor(
    config: ConstructorParameters<typeof AbstractAgent>[0],
    private readonly runner: Pick<InMemoryAgentRunner, "connect">,
  ) {
    super(config);
  }
  run(_input: RunAgentInput): Observable<BaseEvent> {
    throw new Error("run() not exercised by this test");
  }
  protected connect(input: RunAgentInput) {
    return this.runner.connect({ threadId: input.threadId });
  }
}

class SeedAgent extends AbstractAgent {
  constructor(
    config: ConstructorParameters<typeof AbstractAgent>[0],
    private readonly seedMessages: Message[],
  ) {
    super(config);
  }
  run(input: RunAgentInput): Observable<BaseEvent> {
    const messages = this.seedMessages;
    return new Observable<BaseEvent>((subscriber) => {
      subscriber.next({
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      } as unknown as BaseEvent);
      subscriber.next({
        type: EventType.MESSAGES_SNAPSHOT,
        messages,
      } as unknown as BaseEvent);
      subscriber.next({
        type: EventType.RUN_FINISHED,
        threadId: input.threadId,
        runId: input.runId,
      } as unknown as BaseEvent);
      subscriber.complete();
    });
  }
  protected connect(): Observable<BaseEvent> {
    throw new Error("seed agent never reconnects");
  }
}

function RestoreMastraHistoryTestHarness({
  agent,
  onSettled,
}: {
  agent: AbstractAgent;
  onSettled: () => void;
}) {
  return (
    <AgentCtx.Provider value={agent}>
      <RestoreMastraHistory threadId={agent.threadId} onSettled={onSettled} />
    </AgentCtx.Provider>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("IPI-1217: CopilotKit reconnect vs. RestoreMastraHistory (real library code)", () => {
  it("restored history survives CopilotChat's real mount-time connect against a cold (never-ran-this-thread) TenantAbortRunner, via its durable-Mastra fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: history }) }),
    );
    const historyAsChat: PlannerChatMessage[] = history as unknown as PlannerChatMessage[];
    vi.spyOn(threadPersistence, "getPlannerMemory").mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof threadPersistence.getPlannerMemory>>,
    );
    vi.spyOn(threadPersistence, "recallPlannerChatMessages").mockResolvedValue(historyAsChat);

    const runner = new TenantAbortRunner("resource-a", new AbortController().signal);
    const agent = new RunnerBackedAgent(
      { agentId: "default", threadId: "existing-thread" },
      runner,
    );
    const core = new CopilotKitCore({ runtimeUrl: "/api/copilotkit" });

    // RestoreMastraHistory hydrates the agent from durable Mastra history —
    // the same real component /app's dock renders, gated before CopilotChat.
    const restored = vi.fn();
    render(<RestoreMastraHistoryTestHarness agent={agent} onSettled={restored} />);
    await waitFor(() => expect(restored).toHaveBeenCalledTimes(1));
    expect(agent.messages).toEqual(history); // hydration worked, in isolation

    // Then CopilotChat's real mount-time connect fires (this is exactly
    // what @copilotkit/react-core/v2's CopilotChat does internally) —
    // this wipes agent.messages, but TenantAbortRunner.connect() now
    // refills it from durable Mastra history since its in-memory replay
    // for "existing-thread" is empty in this (cold) process.
    await core.connectAgent({ agent });

    expect(agent.messages).toEqual(history);
  });

  it("once the server's connect() itself replays durable history as real AG-UI events, history survives — the correct fix location", async () => {
    const runner = new InMemoryAgentRunner();
    const agent = new RunnerBackedAgent(
      { agentId: "default", threadId: "existing-thread-2" },
      runner,
    );
    const core = new CopilotKitCore({ runtimeUrl: "/api/copilotkit" });

    // Simulate the "Preferred implementation": connect() sourcing real
    // history and replaying it as valid AG-UI events (RUN_STARTED ->
    // MESSAGES_SNAPSHOT -> RUN_FINISHED). Here we drive it through the
    // runner's own run() to seed its in-memory store, proving the
    // mechanism: history arriving via connect()'s replay DOES survive
    // CopilotKitCore's wipe, unlike a client-side setMessages() call
    // made before CopilotChat mounts (test 1, above).
    await new Promise<void>((resolve) => {
      runner
        .run({
          threadId: "existing-thread-2",
          agent: new SeedAgent(
            { agentId: "default", threadId: "existing-thread-2" },
            history,
          ),
          input: {
            threadId: "existing-thread-2",
            runId: "seed-run",
            messages: [],
            state: {},
            tools: [],
            context: [],
            forwardedProps: {},
          },
        })
        .subscribe({ complete: resolve });
    });

    await core.connectAgent({ agent });

    expect(agent.messages).toEqual(history);
  });
});
