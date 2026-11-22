import { afterEach, describe, expect, it, vi } from "vitest";
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { RequestContext } from "@mastra/core/request-context";
import { InMemoryStore } from "@mastra/core/storage";
import { MastraAgent } from "@ag-ui/mastra";
import type { AbstractAgent } from "@ag-ui/client";

import { PLANNER_AGENT_ID, withPlannerAgentId } from "@/agent";
import { PLANNING_ONLY_TOOLS } from "@/mastra/planner-tool-gate";

/**
 * IPI-1474 · AGENTS-001 — prove native supervisor → specialist delegation
 * BEFORE changing the CopilotKit agent registry.
 *
 * The open question in the epic was whether seven logical iPix agent roles
 * need seven *top-level* CopilotKit/Mastra registrations. `src/agent.ts`'s
 * `withPlannerAgentId()` throws unless the source exposes exactly one agent,
 * so a second top-level registration would break `/app` chat.
 *
 * These tests pin the installed `@mastra/core@1.84.0` behaviour the decision
 * rests on:
 *
 *   1. nested agents live on `Agent.#agents`, NOT on `Mastra.#agents`, so
 *      `MastraAgent.getLocalAgents()` (which reads `mastra.listAgents()`)
 *      still yields exactly ONE CopilotKit entry keyed `default`;
 *   2. a delegation forwards a *copy* of the parent `RequestContext` with the
 *      run-scoped identity keys stripped — context propagation, never a
 *      capability grant;
 *   3. a delegation invokes the child through `generate()` or `stream()`
 *      depending on the parent method, and NEVER forwards the parent's
 *      `activeTools` — the child must apply its own tool policy;
 *   4. the parent `abortSignal` reaches the nested run (Stop is not only SSE).
 *
 * No model call is made: the child's `generate`/`stream` are spied, so every
 * assertion is deterministic and offline.
 */

const RESOURCE_ID = "org:a::user:u";

function buildSpecialist(): Agent {
  return new Agent({
    id: "test-specialist",
    name: "Test Specialist",
    description:
      "Read-only test specialist. Used only to prove nested delegation wiring.",
    model: openai("gpt-5.6-luna"),
    instructions: "Return the single word OK.",
  });
}

function buildSupervisor(): { supervisor: Agent; specialist: Agent } {
  const specialist = buildSpecialist();
  const supervisor = new Agent({
    id: "test-supervisor",
    name: "Test Supervisor",
    description: "Test supervisor that delegates to one nested specialist.",
    model: openai("gpt-5.6-luna"),
    instructions: "Delegate to testSpecialist when a specialist answer is needed.",
    // The registration key becomes the delegation tool name: `agent-testSpecialist`.
    agents: { testSpecialist: specialist },
  });
  return { supervisor, specialist };
}

function buildRegistry(): { mastra: Mastra; supervisor: Agent; specialist: Agent } {
  const { supervisor, specialist } = buildSupervisor();
  // Mirrors src/mastra/runtime.ts: one top-level registration named `default`.
  const mastra = new Mastra({
    agents: { default: supervisor },
    // Disposable in-memory store: this test proves registry shape only and must
    // never connect to the shared Postgres memory cabinet.
    storage: new InMemoryStore(),
  });
  return { mastra, supervisor, specialist };
}

type DelegationTool = {
  execute: (
    input: unknown,
    context: unknown,
  ) => Promise<{ text?: string; subAgentThreadId?: string; subAgentResourceId?: string }>;
};

async function delegationToolFor(
  supervisor: Agent,
  requestContext: RequestContext,
  methodType: "generate" | "stream",
): Promise<DelegationTool> {
  const tools = await supervisor.getToolsForExecution({
    requestContext,
    methodType,
    runId: "run-ipi-1474",
    threadId: "thread-ipi-1474",
    resourceId: RESOURCE_ID,
  });
  const tool = tools["agent-testSpecialist"] as unknown as DelegationTool | undefined;
  if (!tool) {
    throw new Error("nested specialist delegation tool was not generated");
  }
  return tool;
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Reads the options object a delegated child received.
 *
 * `vi.spyOn` on an overloaded method types `mock.calls` by the first overload,
 * so the options argument has to be read through a plain array view.
 */
function childCallOptions(
  spy: { mock: { calls: readonly unknown[][] } },
  index = 0,
): {
  requestContext?: RequestContext;
  activeTools?: string[];
  abortSignal?: AbortSignal;
} {
  const call = spy.mock.calls[index] as readonly unknown[] | undefined;
  return (call?.[1] ?? {}) as {
    requestContext?: RequestContext;
    activeTools?: string[];
    abortSignal?: AbortSignal;
  };
}


describe("IPI-1474 · native delegation does not expand the top-level registry", () => {
  it("registers exactly one top-level agent even when the supervisor nests a specialist", async () => {
    const { mastra, supervisor } = buildRegistry();

    // Mastra.listAgents() reads #agents — populated only from `new Mastra({agents})`.
    expect(Object.keys(mastra.listAgents())).toEqual(["default"]);

    // The specialist is reachable for delegation, but only through the parent.
    expect(Object.keys(await supervisor.listAgents())).toEqual(["testSpecialist"]);
  });

  it("still yields exactly one CopilotKit entry keyed `default`, so withPlannerAgentId stays valid", () => {
    const { mastra } = buildRegistry();

    // Same call the CopilotKit route makes through src/agent.ts.
    const agents = MastraAgent.getLocalAgents({
      mastra,
      resourceId: RESOURCE_ID,
    }) as Record<string, AbstractAgent>;

    expect(Object.keys(agents)).toEqual([PLANNER_AGENT_ID]);
    // The unchanged adapter must accept the map (it throws on 0 or 2+ entries).
    expect(withPlannerAgentId(agents)).toBe(agents);
  });
});

describe("IPI-1474 · delegation context is scoped, not a capability grant", () => {
  it("forwards a copy of the request context with run-scoped identity keys stripped", async () => {
    const { supervisor } = buildRegistry();
    const generateSpy = vi
      .spyOn(Agent.prototype, "generate")
      .mockResolvedValue({
        text: "OK",
        finishReason: "stop",
        runId: "child-run",
        response: { dbMessages: [] },
        toolCalls: [],
        toolResults: [],
      } as never);

    const requestContext = new RequestContext();
    requestContext.set("ipix.orgId", "org-a");
    requestContext.set("ipix.userId", "user-a");
    requestContext.setRaw("mastra__threadId", "parent-thread");
    requestContext.setRaw("mastra__resourceId", RESOURCE_ID);

    const tool = await delegationToolFor(supervisor, requestContext, "generate");
    await tool.execute(
      { prompt: "Draft a two-shot plan." },
      {
        agent: { messages: [], toolCallId: "tc-1" },
        threadId: "parent-thread",
        resourceId: RESOURCE_ID,
      },
    );

    expect(generateSpy).toHaveBeenCalledTimes(1);
    const childOptions = childCallOptions(generateSpy);

    // Tenant values propagate (server-derived upstream), but as a COPY.
    expect(childOptions.requestContext).toBeInstanceOf(RequestContext);
    expect(childOptions.requestContext).not.toBe(requestContext);
    expect(childOptions.requestContext?.get("ipix.orgId")).toBe("org-a");
    expect(childOptions.requestContext?.get("ipix.userId")).toBe("user-a");

    // Run-scoped identity is deliberately not inherited: the child gets its own
    // thread/resource rather than writing into the parent's conversation.
    expect(childOptions.requestContext?.get("mastra__threadId")).toBeUndefined();
    expect(childOptions.requestContext?.get("mastra__resourceId")).toBeUndefined();
  });

  it("does not forward the parent's active-tool policy to the nested agent", async () => {
    const { supervisor } = buildRegistry();
    const generateSpy = vi
      .spyOn(Agent.prototype, "generate")
      .mockResolvedValue({
        text: "OK",
        finishReason: "stop",
        runId: "child-run",
        response: { dbMessages: [] },
        toolCalls: [],
        toolResults: [],
      } as never);

    const requestContext = new RequestContext();
    requestContext.set("ipix.orgId", "org-a");

    const tool = await delegationToolFor(supervisor, requestContext, "generate");
    await tool.execute(
      { prompt: "Draft a two-shot plan." },
      { agent: { messages: [], toolCallId: "tc-2" } },
    );

    const childOptions = childCallOptions(generateSpy);
    // The child must derive its own policy; a parent decision is not inherited
    // authority. This is why the planner gate has to cover the nested method.
    expect(childOptions.activeTools).toBeUndefined();
  });

  it("forwards the parent abort signal to the nested run (Stop reaches delegated work)", async () => {
    const { supervisor } = buildRegistry();
    const generateSpy = vi
      .spyOn(Agent.prototype, "generate")
      .mockResolvedValue({
        text: "OK",
        finishReason: "stop",
        runId: "child-run",
        response: { dbMessages: [] },
        toolCalls: [],
        toolResults: [],
      } as never);

    const controller = new AbortController();
    const requestContext = new RequestContext();
    const tool = await delegationToolFor(supervisor, requestContext, "generate");
    await tool.execute(
      { prompt: "Draft a two-shot plan." },
      {
        agent: { messages: [], toolCallId: "tc-3" },
        abortSignal: controller.signal,
      },
    );

    const childOptions = childCallOptions(generateSpy);
    expect(childOptions.abortSignal).toBe(controller.signal);
  });

  it("invokes the child through stream() when the parent run is streaming", async () => {
    const { supervisor } = buildRegistry();
    const generateSpy = vi.spyOn(Agent.prototype, "generate");
    const streamSpy = vi
      .spyOn(Agent.prototype, "stream")
      .mockResolvedValue({
        fullStream: (async function* () {})(),
        text: Promise.resolve("OK"),
        toolResults: Promise.resolve([]),
        // The delegation tool persists the child transcript through this shape.
        messageList: { getPersisted: { response: { db: () => [] } } },
        runId: "child-run",
      } as never);

    const requestContext = new RequestContext();
    const tool = await delegationToolFor(supervisor, requestContext, "stream");
    await tool.execute(
      { prompt: "Draft a two-shot plan." },
      { agent: { messages: [], toolCallId: "tc-4" } },
    );

    expect(streamSpy).toHaveBeenCalledTimes(1);
    expect(generateSpy).not.toHaveBeenCalled();
  });
});

describe("IPI-1474 · the planner tool gate must cover the method delegation can use", () => {
  /**
   * NEGATIVE CONTROL / CURRENT DEFECT.
   *
   * `src/mastra/agents/production-planner.ts` wraps `stream()` and
   * `resumeStream()` with the IPI-1208 tool gate but NOT `generate()` or
   * `resumeGenerate()`. The delegation tool above calls `generate()` when the
   * parent run is a generate run, so a Concierge that delegated to the real
   * Planner would hand the model `approveDraft` / `startBrandAnalysis` with no
   * per-turn restriction. This asserts the gate is applied, so it fails while
   * that hole exists and passes once `generate()` is gated the same way.
   */
  it("applies the planning-only policy when the Planner is driven through generate()", async () => {
    vi.resetModules();
    const { Agent: FreshAgent } = await import("@mastra/core/agent");
    const generateSpy = vi
      .spyOn(FreshAgent.prototype as unknown as {
        generate: (...args: unknown[]) => unknown;
      }, "generate")
      .mockImplementation((async () => ({})) as never);

    try {
      const { getProductionPlannerAgent: factory } = await import(
        "@/mastra/agents"
      );
      const agent = factory() as unknown as {
        generate: (messages: unknown, options?: unknown) => Promise<unknown>;
      };

      await agent.generate([
        { role: "user", content: "Plan the shoot schedule." },
      ]);

      const options = generateSpy.mock.calls[0]?.[1] as
        | { activeTools?: string[] }
        | undefined;
      expect(options?.activeTools).toEqual([...PLANNING_ONLY_TOOLS]);
    } finally {
      generateSpy.mockRestore();
      vi.resetModules();
    }
  });

  /**
   * The options assertion above proves the wrapper ran. It does NOT prove the
   * model was denied the tools: a future refactor could inject `activeTools`
   * that Mastra then ignores. This drives the real model boundary with the
   * vendored mock model (same pattern as PLAN-001's stream proof) and reads
   * the tools the model was actually offered.
   *
   * NEGATIVE CONTROL: delete the `generate` wrapper and this fails, because
   * `approveDraft` / `startBrandAnalysis` reappear in `doGenerateCalls[0].tools`.
   */
  it("never offers the write tools to the model on a generate run", async () => {
    vi.resetModules();
    const { MastraLanguageModelV2Mock } = await import(
      "@mastra/core/test-utils/llm-mock"
    );
    const model = new MastraLanguageModelV2Mock({
      provider: "mock",
      modelId: "mock-planner",
      doGenerate: async () => ({
        content: [{ type: "text", text: "Plan ready." }],
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      }),
    });

    try {
      const { getProductionPlannerAgent: factory } = await import(
        "@/mastra/agents"
      );
      const agent = factory() as unknown as {
        __updateModel: (options: { model: unknown }) => void;
        __resetToOriginalModel: () => void;
        generate: (messages: unknown, options?: unknown) => Promise<unknown>;
      };
      agent.__updateModel({ model });

      await agent.generate(
        [{ role: "user", content: "Plan the shoot schedule." }],
        { maxSteps: 1 },
      );

      const exposed = (
        (model.doGenerateCalls[0]?.tools ?? []) as Array<{ name?: string }>
      ).map((tool) => tool.name ?? "");

      expect(exposed).toContain("composeShootPlan");
      expect(exposed).not.toContain("approveDraft");
      expect(exposed).not.toContain("startBrandAnalysis");

      agent.__resetToOriginalModel();
    } finally {
      vi.resetModules();
    }
  });

  /**
   * A delegated run that suspended resumes through `resumeGenerate`
   * (`@mastra/core@1.84.0` delegation: `resolvedAgent.resumeGenerate(...)`), so
   * that path needs the fail-closed policy too. Without this test, deleting the
   * `resumeGenerate` wrapper leaves every other test green.
   */
  it("reapplies the planning-only policy on resumeGenerate", async () => {
    vi.resetModules();
    const { Agent: FreshAgent } = await import("@mastra/core/agent");
    const resumeSpy = vi
      .spyOn(FreshAgent.prototype as unknown as {
        resumeGenerate: (...args: unknown[]) => unknown;
      }, "resumeGenerate")
      .mockImplementation((async () => ({})) as never);

    try {
      const { getProductionPlannerAgent: factory } = await import(
        "@/mastra/agents"
      );
      const agent = factory() as unknown as {
        resumeGenerate: (data: unknown, options?: unknown) => Promise<unknown>;
      };

      await agent.resumeGenerate({ approved: true }, {});

      const options = resumeSpy.mock.calls[0]?.[1] as
        | {
            requestContext?: RequestContext;
            prepareStep?: (args: {
              requestContext: RequestContext;
            }) => Promise<{ activeTools?: string[] }>;
          }
        | undefined;

      expect(options?.requestContext).toBeInstanceOf(RequestContext);
      expect(typeof options?.prepareStep).toBe("function");
      // The restored policy is planning-only when the caller supplied none.
      const applied = await options?.prepareStep?.({
        requestContext: options.requestContext as RequestContext,
      });
      expect(applied?.activeTools).toEqual([...PLANNING_ONLY_TOOLS]);
    } finally {
      resumeSpy.mockRestore();
      vi.resetModules();
    }
  });
});
