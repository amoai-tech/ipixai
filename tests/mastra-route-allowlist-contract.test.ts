import type { AddressInfo } from "node:net";

import { lastValueFrom, toArray } from "rxjs";
import { EMPTY } from "rxjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AbstractAgent, BaseEvent, RunAgentInput } from "@ag-ui/client";
import type { AgentRunner } from "@copilotkit/runtime/v2";

/**
 * IPI-1326 — SDK route contract. Drives the real installed Planner client
 * stack (`createRemoteAgents` → `@ag-ui/mastra` → `@mastra/client-js`, plus
 * `MastraControlRunner`) against a real Mastra HTTP server using production
 * `plannerMastraAuth`, records every METHOD + path that reaches authorization,
 * and requires each one to be on the deny-by-default allowlist. A Mastra /
 * AG-UI / CopilotKit upgrade that starts calling a new route fails here
 * instead of breaking the Planner in production.
 */

const { ORG_A, USER_A } = vi.hoisted(() => ({
  ORG_A: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  USER_A: "11111111-1111-4111-8111-111111111111",
}));

vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => null }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) =>
        token === "org-a-token"
          ? { data: { user: { id: USER_A } }, error: null }
          : { data: { user: null }, error: { message: "invalid JWT" } },
    },
    from: () => ({
      select: () => ({ eq: async () => ({ data: [{ org_id: ORG_A }], error: null }) }),
    }),
  }),
}));

import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { createNodeServer } from "@mastra/deployer/server";

import { createRemoteAgents } from "@/agent";
import { MastraControlRunner } from "@/lib/copilotkit/mastra-control-runner";
import { plannerRunControlRoutes } from "@/mastra/run-control-routes";
import { isAllowedMastraRoute, plannerMastraAuth } from "@/mastra/server-auth";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const RESOURCE = `org:${ORG_A}::user:${USER_A}`;
const HITL_TOOL = "confirmShootPlan";

type Prompt = Array<{ role: string; content: unknown }>;

// Fixture model: "hitl" → calls the frontend HITL tool; a tool result → short
// answer; anything else → a slow stream that stays active for Stop.
const model = {
  specificationVersion: "v2" as const,
  provider: "ipix-fixture",
  modelId: "route-contract",
  supportedUrls: Promise.resolve({}),
  doGenerate: async () => {
    throw new Error("generate is not part of the Planner contract");
  },
  doStream: async (options: { prompt: Prompt; abortSignal?: AbortSignal }) => {
    const last = options.prompt[options.prompt.length - 1];
    const text = JSON.stringify(last?.content ?? "");
    return {
      stream: new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          if (last?.role === "user" && text.includes("hitl")) {
            controller.enqueue({
              type: "tool-call",
              toolCallId: "call-1",
              toolName: HITL_TOOL,
              input: JSON.stringify({ planId: "plan-1" }),
            });
            controller.enqueue({ type: "finish", finishReason: "tool-calls", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } });
            controller.close();
            return;
          }
          const ticks = last?.role === "tool" ? 1 : 40;
          controller.enqueue({ type: "text-start", id: "t" });
          for (let i = 1; i <= ticks; i++) {
            if (ticks > 1) await sleep(100);
            if (options.abortSignal?.aborted) break;
            controller.enqueue({ type: "text-delta", id: "t", delta: `tick-${i} ` });
          }
          if (!options.abortSignal?.aborted) {
            controller.enqueue({ type: "text-end", id: "t" });
            controller.enqueue({ type: "finish", finishReason: "stop", usage: { inputTokens: 1, outputTokens: ticks, totalTokens: ticks + 1 } });
          }
          controller.close();
        },
      }),
    };
  },
};

const observed: string[] = [];
let server: Awaited<ReturnType<typeof createNodeServer>>;
let baseUrl: string;

beforeAll(async () => {
  vi.stubEnv("IPIX_MASTRA_HOSTED", "");
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");

  const mastra = new Mastra({
    agents: {
      default: new Agent({ id: "production-planner", name: "Production Planner", instructions: "fixture", model: model as never }),
    },
    server: {
      host: "127.0.0.1",
      port: 0,
      handleShutdownSignals: false,
      auth: {
        ...plannerMastraAuth,
        authorize: async (path, method, user, ctx) => {
          observed.push(`${method} ${path}`);
          return plannerMastraAuth.authorize!(path, method, user, ctx);
        },
      },
      apiRoutes: plannerRunControlRoutes,
    },
  });
  server = await createNodeServer(mastra, { tools: {}, studio: false, isDev: false });
  if (!server.listening) await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  vi.stubEnv("MASTRA_BASE_URL", baseUrl);
});

afterAll(async () => {
  await new Promise((resolve) => server?.close(() => resolve(undefined)));
  vi.unstubAllEnvs();
});

function input(threadId: string, runId: string, messages: RunAgentInput["messages"]): RunAgentInput {
  // The shape CopilotKit's runtime forwards: messages, frontend tools, empty state.
  return {
    threadId,
    runId,
    messages,
    tools: [
      {
        name: HITL_TOOL,
        description: "Ask the operator to approve the shoot plan",
        parameters: { type: "object", properties: { planId: { type: "string" } }, required: ["planId"] },
      },
    ],
    context: [],
    state: {},
    forwardedProps: {},
  };
}

const run = (agent: AbstractAgent, runInput: RunAgentInput) =>
  lastValueFrom((agent as unknown as { run: (i: RunAgentInput) => import("rxjs").Observable<BaseEvent> }).run(runInput).pipe(toArray()));

const delegate = {
  run: vi.fn(() => EMPTY),
  connect: vi.fn(() => EMPTY),
  isRunning: vi.fn(async () => false),
  stop: vi.fn(async () => false),
} as unknown as AgentRunner;

describe("Planner client routes ⊆ Mastra allowlist (IPI-1326)", () => {
  it("discovery, chat stream, HITL round trip and Stop use only allowlisted routes", async () => {
    // 1. Discovery (CopilotKit /info → getRemoteAgents).
    const agents = await createRemoteAgents(RESOURCE, "org-a-token");
    expect(Object.keys(agents)).toEqual(["default"]);
    const planner = agents.default;

    // 2. HITL: the Planner calls the frontend tool; the browser answers with a
    //    tool result in a new run (useHumanInTheLoop), which streams again.
    const first = await run(planner, input("thread-hitl", "run-hitl-1", [{ id: "m1", role: "user", content: "hitl please" }]));
    expect(first.map((e) => e.type)).toContain("TOOL_CALL_START");
    const second = await run(
      planner,
      input("thread-hitl", "run-hitl-2", [
        { id: "m1", role: "user", content: "hitl please" },
        { id: "m2", role: "assistant", toolCalls: [{ id: "call-1", type: "function", function: { name: HITL_TOOL, arguments: '{"planId":"plan-1"}' } }] },
        { id: "m3", role: "tool", toolCallId: "call-1", content: '{"approved":true}' },
      ]),
    );
    expect(second.map((e) => e.type)).toContain("RUN_FINISHED");

    // 3. Chat + Stop (MastraControlRunner over /ipix/run-control/*).
    const streaming = run(planner, input("thread-stop", "run-stop-1", [{ id: "s1", role: "user", content: "long answer" }]));
    const runner = new MastraControlRunner(delegate, baseUrl, "org-a-token");
    let running = false;
    for (let i = 0; i < 40 && !running; i++) {
      await sleep(50);
      running = await runner.isRunning({ threadId: "thread-stop" });
    }
    expect(running).toBe(true);
    await expect(runner.stop({ threadId: "thread-stop", runId: "run-stop-1" })).resolves.toBe(true);
    await streaming.catch(() => undefined);

    // 4. The contract: every route the real clients produced is allowlisted.
    const unique = [...new Set(observed)].sort();
    expect(unique.length).toBeGreaterThan(0);
    expect(unique.filter((route) => {
      const [method, path] = route.split(" ");
      return !isAllowedMastraRoute(method, path);
    })).toEqual([]);
    expect(unique).toEqual(
      expect.arrayContaining([
        "GET /api/agents",
        "POST /api/agents/production-planner/stream",
        "POST /ipix/run-control/active",
        "POST /ipix/run-control/abort",
      ]),
    );
  }, 30_000);
});
