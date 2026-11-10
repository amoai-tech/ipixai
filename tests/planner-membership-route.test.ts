import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const operatorId = "11111111-1111-4111-8111-111111111111";
  const orgId = "22222222-2222-4222-8222-222222222222";
  return {
    operatorId,
    orgId,
    resourceId: `org:${orgId}::user:${operatorId}`,
    authorized: true,
    member: true,
    failHandler: false,
    bodyless: false,
    checks: 0,
    lastRunnerSignal: null as AbortSignal | null,
    querySignal: null as AbortSignal | null,
    queryFilters: [] as Array<[string, string]>,
    responseSource: null as ReadableStreamDefaultController<Uint8Array> | null,
    sourceCancel: vi.fn(),
  };
});

vi.mock("@copilotkit/runtime/v2", () => ({
  CopilotRuntime: class {},
  createCopilotEndpoint: () => ({}),
}));
vi.mock("@/agent", () => ({ createLocalAgents: () => ({}) }));
vi.mock("@/lib/auth/copilot-hooks", () => ({
  copilotAuthHooksFor: () => ({}),
  identifyOperator: vi.fn(),
}));
vi.mock("@/lib/auth/planner-session", () => ({
  requirePlannerResourceId: async () =>
    state.authorized
      ? { ok: true, resourceId: state.resourceId, operator: { id: state.operatorId } }
      : { ok: false, response: new Response("not authorized", { status: 401 }) },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } } }) },
    from: () => ({
      select: () => {
        const builder = {
          eq(column: string, value: string) {
            state.queryFilters.push([column, value]);
            return builder;
          },
          abortSignal(signal: AbortSignal) {
            state.querySignal = signal;
            return builder;
          },
          async maybeSingle() {
            state.checks += 1;
            return {
              data: state.member ? { org_id: state.orgId } : null,
              error: null,
            };
          },
        };
        return builder;
      },
    }),
  }),
}));
vi.mock("@/lib/copilotkit/tenant-abort-runner", () => ({
  attachRunnerAbort: (agents: unknown) => agents,
  TenantAbortRunner: class {
    constructor(_resourceId: string, signal: AbortSignal) {
      state.lastRunnerSignal = signal;
    }
  },
}));
vi.mock("@/lib/copilotkit/planner-run-control-supabase", () => ({
  createPlannerRunControl: () => undefined,
}));
vi.mock("@/lib/request-token", () => ({
  requestToken: { run: (_token: string, fn: () => Promise<Response>) => fn() },
}));
vi.mock("hono/vercel", () => ({
  handle: () => async () => {
    if (state.failHandler) throw new Error("handler failed");
    if (state.bodyless) return new Response(null, { status: 204 });
    return new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        state.responseSource = controller;
      },
      cancel: (...args) => state.sourceCancel(...args),
    }), { headers: { "content-type": "text/event-stream" } });
  },
}));

import { POST } from "@/app/api/copilotkit/[[...slug]]/route";

const request = (signal?: AbortSignal) =>
  new Request("http://localhost/api/copilotkit", { method: "POST", signal });

describe("Planner membership revocation route boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.authorized = true;
    state.member = true;
    state.failHandler = false;
    state.bodyless = false;
    state.checks = 0;
    state.lastRunnerSignal = null;
    state.querySignal = null;
    state.queryFilters = [];
    state.responseSource = null;
    state.sourceCancel.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("rejects unauthorized requests before constructing a Planner runner", async () => {
    state.authorized = false;
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(state.lastRunnerSignal).toBeNull();
    expect(state.checks).toBe(0);
  });

  it("filters the verified user and org, then aborts the runner and response on revocation", async () => {
    const response = await POST(request());
    const reader = response.body!.getReader();
    state.responseSource!.enqueue(new TextEncoder().encode("data: first\\n\\n"));
    expect((await reader.read()).done).toBe(false);
    state.member = false; // Other Org B membership must not authorize original Org A stream
    await vi.advanceTimersByTimeAsync(5_000);
    expect(state.queryFilters).toContainEqual(["org_id", state.orgId]);
    expect(state.queryFilters).toContainEqual(["user_id", state.operatorId]);
    expect(state.querySignal).toBeTruthy();
    expect(state.lastRunnerSignal?.aborted).toBe(true);
    await expect(reader.read()).rejects.toMatchObject({ name: "AbortError" });
    expect(state.sourceCancel).toHaveBeenCalledTimes(1);
  });

  it("does not keep checking after a normal response completes", async () => {
    const response = await POST(request());
    const reader = response.body!.getReader();
    state.responseSource!.close();
    expect((await reader.read()).done).toBe(true);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(state.checks).toBe(0);
  });

  it("stops membership checks on downstream cancellation", async () => {
    const response = await POST(request());
    await response.body!.cancel("browser left");
    expect(state.sourceCancel).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(12_000);
    expect(state.checks).toBe(0);
  });

  it("cleans up after a handler throws or returns no response body", async () => {
    state.failHandler = true;
    await expect(POST(request())).rejects.toThrow("handler failed");
    await vi.advanceTimersByTimeAsync(12_000);
    expect(state.checks).toBe(0);
    state.failHandler = false;
    state.bodyless = true;
    expect((await POST(request())).status).toBe(204);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(state.checks).toBe(0);
  });

  it("never serves already-aborted requests", async () => {
    const aborted = new AbortController();
    aborted.abort();
    const response = await POST(request(aborted.signal));
    expect(state.lastRunnerSignal?.aborted).toBe(true);
    await expect(response.body!.getReader().read()).rejects.toMatchObject({ name: "AbortError" });
    expect(state.sourceCancel).toHaveBeenCalledOnce();
  });
});
