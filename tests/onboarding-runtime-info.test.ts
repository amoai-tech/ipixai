import { afterEach, describe, expect, it, vi } from "vitest";
import * as agent from "../src/agent";
import { DELETE, GET, PATCH, POST } from "../src/app/api/copilotkit/[[...slug]]/route";

// IPI-1462 · ONBOARD-A2UI-01 — a signed-in founder with no organization gets
// an agentless runtime /info (so the onboarding form's CopilotKit provider
// connects cleanly) and nothing else. Every other method/path stays refused,
// and the Planner is unchanged for members.

const USER_A = "11111111-1111-4111-8111-111111111111";
const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const state: { sub?: string; rows: { org_id: string }[]; lookupError: boolean } = {
  sub: USER_A,
  rows: [],
  lookupError: false,
};

vi.mock("../src/lib/supabase/server", () => ({
  createClientFromRequest: () => ({
    auth: {
      getClaims: async () => ({
        data: { claims: { sub: state.sub, email: "founder@example.com" } },
        error: state.sub ? null : { message: "invalid JWT" },
      }),
      getSession: async () => ({ data: { session: { access_token: "test-access-token" } } }),
    },
    from: () => ({
      select: () => ({
        eq: async () =>
          state.lookupError
            ? { data: null, error: { message: "db down" } }
            : { data: state.rows, error: null },
      }),
    }),
  }),
  createClient: async () => null,
}));

afterEach(() => {
  state.sub = USER_A;
  state.rows = [];
  state.lookupError = false;
  vi.restoreAllMocks();
});

const req = (path: string, method = "GET", body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

describe("IPI-1462 zero-org runtime /info", () => {
  it("answers GET /info with no agents for a verified zero-org founder, without building Planner agents", async () => {
    const spy = vi.spyOn(agent, "createLocalAgents");
    const response = await GET(req("/api/copilotkit/info"));
    expect(response.status).toBe(200);
    const info = (await response.json()) as { agents?: Record<string, unknown> };
    expect(info.agents).toEqual({});
    expect(spy).not.toHaveBeenCalled();
  });

  it("still refuses every other zero-org request with needs_onboarding", async () => {
    const spy = vi.spyOn(agent, "createLocalAgents");
    const run = { threadId: "t", runId: "r", state: {}, messages: [], tools: [], context: [], forwardedProps: {} };
    const denied = [
      await POST(req("/api/copilotkit/agent/default/run", "POST", run)),
      await POST(req("/api/copilotkit/info", "POST", {})),
      await GET(req("/api/copilotkit/threads")),
      await GET(req("/api/copilotkit/info/extra")),
      await PATCH(req("/api/copilotkit/threads/t", "PATCH", {})),
      await DELETE(req("/api/copilotkit/threads/t", "DELETE")),
    ];
    for (const response of denied) {
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "forbidden", reason: "needs_onboarding" });
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses a signed-out caller", async () => {
    state.sub = undefined;
    expect((await GET(req("/api/copilotkit/info"))).status).toBe(401);
  });

  it("fails closed when the membership lookup fails", async () => {
    state.lookupError = true;
    const spy = vi.spyOn(agent, "createLocalAgents");
    const response = await GET(req("/api/copilotkit/info"));
    // Existing fail-closed contract: a DB error is never treated as zero orgs.
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ reason: "membership_lookup_failed" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps the Planner for an organization member", async () => {
    state.rows = [{ org_id: ORG_A }];
    const spy = vi.spyOn(agent, "createLocalAgents");
    const response = await GET(req("/api/copilotkit/info"));
    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalled();
  });
});
