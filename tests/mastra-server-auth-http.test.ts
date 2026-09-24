import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * IPI-1308 + IPI-1326 — the real iPix `plannerMastraAuth` adapter over real
 * Mastra HTTP (`createNodeServer`). Only Supabase is faked: `getUser(jwt)` and
 * the user-scoped `org_members` lookup that yields the trusted org.
 */

const { ORG_A, ORG_B, USER_A, USER_B, BRAND_A, mocks } = vi.hoisted(() => ({
  ORG_A: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ORG_B: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  USER_A: "11111111-1111-4111-8111-111111111111",
  USER_B: "22222222-2222-4222-8222-222222222222",
  BRAND_A: "33333333-3333-4333-8333-333333333333",
  mocks: { createServiceRoleClient: vi.fn(() => null) },
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

vi.mock("@supabase/supabase-js", () => {
  const users: Record<string, { id: string; orgIds: string[] }> = {
    "org-a-token": { id: USER_A, orgIds: [ORG_A] },
    "org-b-token": { id: USER_B, orgIds: [ORG_B] },
  };
  const byId = Object.fromEntries(Object.values(users).map((u) => [u.id, u]));
  return {
    createClient: () => ({
      auth: {
        getUser: async (token: string) =>
          users[token]
            ? { data: { user: { id: users[token].id } }, error: null }
            : { data: { user: null }, error: { message: "invalid JWT" } },
      },
      from: (table: string) => ({
        select: () => ({
          eq: async (_column: string, userId: string) =>
            table === "org_members"
              ? { data: (byId[userId]?.orgIds ?? []).map((org_id: string) => ({ org_id })), error: null }
              : { data: null, error: { message: "unexpected table" } },
        }),
      }),
    }),
  };
});

import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { MastraClient } from "@mastra/client-js";
import { createNodeServer } from "@mastra/deployer/server";
import { registerApiRoute } from "@mastra/core/server";

import { plannerRunControlRoutes } from "@/mastra/run-control-routes";
import { isAllowedMastraRoute, plannerMastraAuth } from "@/mastra/server-auth";
import { MASTRA_USER_KEY, readAuthenticatedWorkflowUser } from "@/mastra/workflow-identity";
import { brandIntelligenceWorkflow } from "@/mastra/workflows/brand-intelligence";
import { shootPlanReviewWorkflow } from "@/mastra/workflows/shoot-plan-review";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Deterministic slow stream so a run stays active while control requests land.
const model = {
  specificationVersion: "v2" as const,
  provider: "ipix-fixture",
  modelId: "auth-http",
  supportedUrls: Promise.resolve({}),
  doGenerate: async () => ({ content: [{ type: "text", text: "fixture" }], finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, warnings: [] }),
  doStream: async (options: { abortSignal?: AbortSignal }) => ({
    stream: new ReadableStream({
      async start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });
        controller.enqueue({ type: "text-start", id: "t" });
        for (let i = 1; i <= 20; i++) {
          await sleep(100);
          if (options?.abortSignal?.aborted) break;
          controller.enqueue({ type: "text-delta", id: "t", delta: `tick-${i} ` });
        }
        if (!options?.abortSignal?.aborted) {
          controller.enqueue({ type: "text-end", id: "t" });
          controller.enqueue({ type: "finish", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 20, totalTokens: 21 } });
        }
        controller.close();
      },
    }),
  }),
};

let server: Awaited<ReturnType<typeof createNodeServer>>;
let baseUrl: string;

beforeAll(async () => {
  vi.stubEnv("IPIX_MASTRA_HOSTED", "");
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");

  const mastra = new Mastra({
    agents: {
      // Registered like production: key `default`, id `production-planner`.
      default: new Agent({ id: "production-planner", name: "Production Planner", instructions: "fixture", model: model as never }),
    },
    workflows: {
      "brand-intelligence": brandIntelligenceWorkflow,
      "shoot-plan-review": shootPlanReviewWorkflow,
    },
    server: {
      host: "127.0.0.1",
      port: 0,
      handleShutdownSignals: false,
      // Production auth, plus the test-only probe route below. Everything else
      // goes through the real deny-by-default allowlist.
      auth: {
        ...plannerMastraAuth,
        authorize: async (path, method, user, ctx) =>
          (method === "GET" && path === "/ipix/test/workflow-identity") ||
          plannerMastraAuth.authorize!(path, method, user, ctx),
      },
      apiRoutes: [
        ...plannerRunControlRoutes,
        // Test-only probe: what a privileged workflow step would read from the
        // RequestContext that real Mastra server auth populated.
        registerApiRoute("/ipix/test/workflow-identity", {
          method: "GET",
          requiresAuth: true,
          handler: async (c) => c.json(readAuthenticatedWorkflowUser(c.get("requestContext"))),
        }),
      ],
    },
  });
  server = await createNodeServer(mastra, { tools: {}, studio: false, isDev: false });
  if (!server.listening) await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server?.close(() => resolve(undefined)));
  vi.unstubAllEnvs();
});

type PostRoute =
  | "activeRun"
  | "abortRun"
  | "startBrandIntelligence"
  | "startShootPlanReview"
  | "resumeBrandIntelligence";

function post(route: PostRoute, token: string | null, body: unknown) {
  const init: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  };

  // Keep every request destination literal at the fetch call site. This test
  // helper never accepts a URL/path from callers, so it cannot become an SSRF
  // primitive if a future test accidentally passes untrusted route text.
  switch (route) {
    case "activeRun":
      return fetch(`${baseUrl}/ipix/run-control/active`, init);
    case "abortRun":
      return fetch(`${baseUrl}/ipix/run-control/abort`, init);
    case "startBrandIntelligence":
      return fetch(`${baseUrl}/api/workflows/brand-intelligence/start-async`, init);
    case "startShootPlanReview":
      return fetch(`${baseUrl}/api/workflows/shoot-plan-review/start-async`, init);
    case "resumeBrandIntelligence":
      return fetch(`${baseUrl}/api/workflows/brand-intelligence/resume-async?runId=r-org-a`, init);
  }
}

describe("standalone Mastra auth over real HTTP (IPI-1308)", () => {
  it("rejects a missing bearer token with 401", async () => {
    expect((await fetch(`${baseUrl}/api/agents`)).status).toBe(401);
    expect((await post("activeRun", null, { threadId: "t-1" })).status).toBe(401);
  });

  it("rejects an invalid or expired Supabase JWT with 401", async () => {
    const res = await fetch(`${baseUrl}/api/agents`, {
      headers: { Authorization: "Bearer expired-or-forged" },
    });
    expect(res.status).toBe(401);
  });

  it("accepts a verified Org A user", async () => {
    const res = await fetch(`${baseUrl}/api/agents`, {
      headers: { Authorization: "Bearer org-a-token" },
    });
    expect(res.status).toBe(200);
  });

  it("scopes run control to the server-derived org+user: Org B cannot inspect or stop Org A's run", async () => {
    const client = new MastraClient({ baseUrl, headers: { Authorization: "Bearer org-a-token" } });
    const response = await client.getAgent("production-planner").stream(
      [{ role: "user", content: "start R1" }],
      // The browser-style resource claim is ignored: the server derives it.
      { runId: "R1", memory: { thread: "thread-a", resource: `org:${ORG_B}::user:${USER_B}` } },
    );
    const done = response.processDataStream({ onChunk: async () => {} });

    let activeA: { runId: string | null } = { runId: null };
    for (let i = 0; i < 30 && !activeA.runId; i++) {
      await sleep(50);
      activeA = await (await post("activeRun", "org-a-token", { threadId: "thread-a" })).json();
    }
    expect(activeA.runId).toBe("R1");

    const activeB = await post("activeRun", "org-b-token", { threadId: "thread-a" });
    expect(activeB.status).toBe(200);
    await expect(activeB.json()).resolves.toEqual({ runId: null });

    const abortB = await post("abortRun", "org-b-token", { threadId: "thread-a", runId: "R1" });
    await expect(abortB.json()).resolves.toEqual({ aborted: false });

    const abortA = await post("abortRun", "org-a-token", { threadId: "thread-a", runId: "R1" });
    await expect(abortA.json()).resolves.toEqual({ aborted: true });
    await done;
  }, 15000);
});

describe("workflow identity key matches the installed Mastra server (IPI-1326)", () => {
  it("pins MASTRA_USER_KEY to the constant exported by @mastra/server/auth", async () => {
    const serverAuth = (await import("@mastra/server/auth")) as { MASTRA_USER_KEY?: string };
    expect(serverAuth.MASTRA_USER_KEY).toBe(MASTRA_USER_KEY);
  });

  it("real server auth stores the verified user where privileged workflows read it", async () => {
    const res = await fetch(`${baseUrl}/ipix/test/workflow-identity`, {
      headers: { Authorization: "Bearer org-a-token" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      userId: USER_A,
      orgId: ORG_A,
      accessToken: "org-a-token",
    });
  });
});

describe("privileged workflows are not reachable over raw Mastra HTTP (IPI-1326)", () => {
  it("still requires authentication first", async () => {
    expect((await fetch(`${baseUrl}/api/workflows`)).status).toBe(401);
  });

  it("denies an authenticated user listing workflows or runs", async () => {
    const list = await fetch(`${baseUrl}/api/workflows`, {
      headers: { Authorization: "Bearer org-a-token" },
    });
    expect(list.status).toBe(403);
    const runs = await fetch(`${baseUrl}/api/workflows/brand-intelligence/runs`, {
      headers: { Authorization: "Bearer org-b-token" },
    });
    expect(runs.status).toBe(403);
  });

  it("denies Org B starting Brand Intelligence for an Org A brand with an Org A actorId", async () => {
    mocks.createServiceRoleClient.mockClear();
    const res = await post(
      "startBrandIntelligence",
      "org-b-token",
      { inputData: { brandId: BRAND_A, actorId: USER_A } },
    );
    expect(res.status).toBe(403);
    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("denies Org B staging a shoot plan for an Org A brand with a forged stagedBy", async () => {
    mocks.createServiceRoleClient.mockClear();
    const res = await post(
      "startShootPlanReview",
      "org-b-token",
      { inputData: { brandId: BRAND_A, plan: { objective: "x" }, stagedBy: USER_A } },
    );
    expect(res.status).toBe(403);
    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("denies resuming another org's suspended run", async () => {
    const res = await post(
      "resumeBrandIntelligence",
      "org-b-token",
      { step: "waitForCrawl", resumeData: { failed: true, error: "forged" } },
    );
    expect(res.status).toBe(403);
  });
});

type DeniedRoute =
  | "POST /api/datasets"
  | "POST /api/stored/workflows"
  | "GET /api/schedules"
  | "POST /api/schedules"
  | "GET /api/agent-builder/x/runs"
  | "POST /api/agent-builder/x/start-async"
  | "GET /api/workflows"
  | "POST /api/workflows/brand-intelligence/start-async"
  | "GET /api/stored/agents"
  | "POST /api/stored/agents"
  | "GET /api/tools"
  | "POST /api/tools/x/execute"
  | "GET /api/mcp/v0/servers"
  | "POST /api/mcp/x/mcp"
  | "POST /api/agents"
  | "DELETE /api/agents"
  | "GET /ipix/run-control/abort"
  | "GET /api/agents/production-planner"
  | "POST /api/agents/production-planner/resume-stream"
  | "POST /api/agents/production-planner/generate"
  | "GET /api/memory/threads"
  | "POST /api/memory/threads"
  | "GET /api/agents/"
  | "GET /api/agents/production-planner/tools";

/** Static URL per route (no caller-supplied paths reach fetch). */
function requestDenied(route: DeniedRoute, token: string) {
  const headers = { Authorization: `Bearer ${token}`, "content-type": "application/json" };
  const get: RequestInit = { method: "GET", headers };
  const post: RequestInit = { method: "POST", headers, body: "{}" };
  switch (route) {
    case "POST /api/datasets": return fetch(`${baseUrl}/api/datasets`, post);
    case "POST /api/stored/workflows": return fetch(`${baseUrl}/api/stored/workflows`, post);
    case "GET /api/schedules": return fetch(`${baseUrl}/api/schedules`, get);
    case "POST /api/schedules": return fetch(`${baseUrl}/api/schedules`, post);
    case "GET /api/agent-builder/x/runs": return fetch(`${baseUrl}/api/agent-builder/x/runs`, get);
    case "POST /api/agent-builder/x/start-async": return fetch(`${baseUrl}/api/agent-builder/x/start-async`, post);
    case "GET /api/workflows": return fetch(`${baseUrl}/api/workflows`, get);
    case "POST /api/workflows/brand-intelligence/start-async": return fetch(`${baseUrl}/api/workflows/brand-intelligence/start-async`, post);
    case "GET /api/stored/agents": return fetch(`${baseUrl}/api/stored/agents`, get);
    case "POST /api/stored/agents": return fetch(`${baseUrl}/api/stored/agents`, post);
    case "GET /api/tools": return fetch(`${baseUrl}/api/tools`, get);
    case "POST /api/tools/x/execute": return fetch(`${baseUrl}/api/tools/x/execute`, post);
    case "GET /api/mcp/v0/servers": return fetch(`${baseUrl}/api/mcp/v0/servers`, get);
    case "POST /api/mcp/x/mcp": return fetch(`${baseUrl}/api/mcp/x/mcp`, post);
    case "POST /api/agents": return fetch(`${baseUrl}/api/agents`, post);
    case "DELETE /api/agents": return fetch(`${baseUrl}/api/agents`, { method: "DELETE", headers });
    case "GET /ipix/run-control/abort": return fetch(`${baseUrl}/ipix/run-control/abort`, get);
    case "GET /api/agents/production-planner": return fetch(`${baseUrl}/api/agents/production-planner`, get);
    case "POST /api/agents/production-planner/resume-stream": return fetch(`${baseUrl}/api/agents/production-planner/resume-stream`, post);
    case "POST /api/agents/production-planner/generate": return fetch(`${baseUrl}/api/agents/production-planner/generate`, post);
    case "GET /api/memory/threads": return fetch(`${baseUrl}/api/memory/threads`, get);
    case "POST /api/memory/threads": return fetch(`${baseUrl}/api/memory/threads`, post);
    case "GET /api/agents/": return fetch(`${baseUrl}/api/agents/`, get);
    case "GET /api/agents/production-planner/tools": return fetch(`${baseUrl}/api/agents/production-planner/tools`, get);
  }
}

const DENIED_ROUTES: DeniedRoute[] = [
  "POST /api/datasets",
  "POST /api/stored/workflows",
  "GET /api/schedules",
  "POST /api/schedules",
  "GET /api/agent-builder/x/runs",
  "POST /api/agent-builder/x/start-async",
  "GET /api/workflows",
  "POST /api/workflows/brand-intelligence/start-async",
  "GET /api/stored/agents",
  "POST /api/stored/agents",
  "GET /api/tools",
  "POST /api/tools/x/execute",
  "GET /api/mcp/v0/servers",
  "POST /api/mcp/x/mcp",
  "GET /api/agents/production-planner",
  "POST /api/agents/production-planner/resume-stream",
  "POST /api/agents/production-planner/generate",
  "GET /api/memory/threads",
  "POST /api/memory/threads",
];

describe("deny-by-default Mastra HTTP allowlist (IPI-1326)", () => {
  it.each(DENIED_ROUTES)("authenticated tenant gets 403 for %s", async (route) => {
    const res = await requestDenied(route, "org-b-token");
    expect(res.status).toBe(403);
  });

  // Wrong method / unknown path: Mastra has no handler, so the request never
  // reaches auth or any route logic. Unmatched GETs fall through to Mastra's
  // static welcome HTML; everything else is a plain 404. Neither runs code.
  it.each([
    "POST /api/agents",
    "DELETE /api/agents",
    "GET /ipix/run-control/abort",
    "GET /api/agents/",
    "GET /api/agents/production-planner/tools",
  ] as DeniedRoute[])("%s reaches no handler", async (route) => {
    const res = await requestDenied(route, "org-b-token");
    const body = await res.text();
    if (route.startsWith("GET ")) {
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.headers.get("content-type")).toContain("text/html");
        expect(body).not.toMatch(/"(aborted|runId|agents|name)"/);
      }
    } else {
      expect(res.status).toBe(404);
    }
  });

  it("unauthenticated requests still get 401 before authorization", async () => {
    expect((await fetch(`${baseUrl}/api/datasets`, { method: "POST", body: "{}" })).status).toBe(401);
  });

  it("public health stays reachable", async () => {
    expect((await fetch(`${baseUrl}/health`)).status).toBe(200);
  });

  it.each([
    ["GET", "/api/agents", true],
    ["POST", "/api/agents/production-planner/stream", true],
    ["POST", "/ipix/run-control/active", true],
    ["POST", "/ipix/run-control/abort", true],
    ["get", "/api/agents", false],
    ["HEAD", "/api/agents", false],
    ["GET", "/api/agents/", false],
    ["POST", "/api/agents/production-planner/stream/", false],
    ["POST", "/api/agents/production-planner%2Fstream", false],
    ["POST", "/api/agents/default/stream", false],
    ["POST", "/api/agents/production-planner/resume-stream", false],
    ["GET", "/api/workflows", false],
    ["POST", "/api/datasets", false],
  ] as const)("isAllowedMastraRoute(%s, %s) === %s", (method, path, allowed) => {
    expect(isAllowedMastraRoute(method, path)).toBe(allowed);
  });
});
