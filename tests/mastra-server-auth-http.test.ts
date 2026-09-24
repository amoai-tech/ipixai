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

import { plannerRunControlRoutes } from "@/mastra/run-control-routes";
import { plannerMastraAuth } from "@/mastra/server-auth";
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
      default: new Agent({ id: "default", name: "default", instructions: "fixture", model: model as never }),
    },
    workflows: {
      "brand-intelligence": brandIntelligenceWorkflow,
      "shoot-plan-review": shootPlanReviewWorkflow,
    },
    server: {
      host: "127.0.0.1",
      port: 0,
      handleShutdownSignals: false,
      auth: plannerMastraAuth,
      apiRoutes: plannerRunControlRoutes,
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

function allowedPostUrl(route: PostRoute): string {
  // Keep the HTTP test helper on an explicit allowlist. Besides making the
  // test intent obvious, this prevents a future caller from turning the helper
  // into an arbitrary server-side request primitive.
  switch (route) {
    case "activeRun":
      return `${baseUrl}/ipix/run-control/active`;
    case "abortRun":
      return `${baseUrl}/ipix/run-control/abort`;
    case "startBrandIntelligence":
      return `${baseUrl}/api/workflows/brand-intelligence/start-async`;
    case "startShootPlanReview":
      return `${baseUrl}/api/workflows/shoot-plan-review/start-async`;
    case "resumeBrandIntelligence":
      return `${baseUrl}/api/workflows/brand-intelligence/resume-async?runId=r-org-a`;
  }
}

function post(route: PostRoute, token: string | null, body: unknown) {
  return fetch(allowedPostUrl(route), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
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
    const response = await client.getAgent("default").stream(
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
