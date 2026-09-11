import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CopilotKitIntelligence,
  InMemoryAgentRunner,
  IntelligenceAgentRunner,
} from "@copilotkit/runtime/v2";

import { GET, POST } from "../src/app/api/copilotkit/[[...slug]]/route";
import { memoryResourceId } from "../src/lib/auth/verified-operator";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORG_A_THREAD = "thread-org-a-secret";
const RESOURCE_A = `org:${ORG_A}::user:${USER_A}`;
const RESOURCE_B = `org:${ORG_B}::user:${USER_B}`;
const RESOURCE_A_IN_ORG_B = `org:${ORG_B}::user:${USER_A}`;

const memberships: { rows: { org_id: string }[] } = { rows: [] };
const claims: { sub?: string; email?: string } = {
  sub: USER_A,
  email: "operator@example.com",
};

vi.mock("../src/lib/supabase/server", () => ({
  createClientFromRequest: () => ({
    auth: {
      getClaims: async () => ({
        data: { claims: { sub: claims.sub, email: claims.email } },
        error: claims.sub ? null : { message: "invalid JWT" },
      }),
      getSession: async () => ({
        data: { session: { access_token: "test-access-token" } },
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: async (column: string, value: string) => {
          if (table !== "org_members") {
            return { data: null, error: { message: "unexpected table" } };
          }
          if (column !== "user_id") {
            return { data: null, error: { message: `unexpected column ${column}` } };
          }
          if (value !== claims.sub) {
            return { data: [], error: null };
          }
          return { data: memberships.rows, error: null };
        },
      }),
    }),
  }),
  createClient: async () => null,
}));

function copilotRequest(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Request {
  const method = options.method ?? "GET";
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (options.body && method !== "GET" && method !== "HEAD") {
    init.body = JSON.stringify(options.body);
  }
  return new Request(`http://localhost${path}`, init);
}

function emptyThreadList() {
  return { threads: [] as { id: string; name: string | null }[], joinCode: "" };
}

function orgAThreadList() {
  return {
    threads: [{ id: ORG_A_THREAD, name: "SS26 shot list" }],
    joinCode: "join-org-a",
  };
}

function runBody(threadId: string) {
  return {
    threadId,
    runId: `run-${threadId}`,
    state: {},
    messages: [
      {
        id: "msg-user-1",
        role: "user" as const,
        content: "Create a SS26 campaign shoot plan.",
      },
    ],
    tools: [],
    context: [],
    forwardedProps: {},
  };
}

/**
 * Installed @copilotkit/runtime@1.68.1 has no public connectThread.
 * HTTP /connect calls CopilotKitIntelligence.prototype.ɵconnectThread.
 */
function mockOrgAThreadAccess() {
  const listSpy = vi
    .spyOn(CopilotKitIntelligence.prototype, "listThreads")
    .mockImplementation(async ({ userId }) => {
      if (userId === RESOURCE_A) {
        return orgAThreadList();
      }
      return emptyThreadList();
    });

  const connect = CopilotKitIntelligence.prototype.ɵconnectThread;
  if (typeof connect !== "function") {
    throw new Error(
      "CopilotKitIntelligence.prototype.ɵconnectThread missing on installed @copilotkit/runtime",
    );
  }
  const connectSpy = vi
    .spyOn(CopilotKitIntelligence.prototype, "ɵconnectThread")
    .mockImplementation(async ({ userId, threadId }) => {
      if (userId === RESOURCE_A && threadId === ORG_A_THREAD) {
        return { threadId: ORG_A_THREAD, joinToken: "org-a-token" };
      }
      return null;
    });

  return { listSpy, connectSpy };
}

describe("IPI-1009 intelligence tenant safety", () => {
  const previousLicense = process.env.COPILOTKIT_LICENSE_TOKEN;
  // IPI-1191 · COPILOT-INTEL-001 — route.ts reads CPK_INTELLIGENCE_API_KEY
  // (COPILOTKIT_API_KEY alias), not the stale INTELLIGENCE_API_KEY name.
  const previousIntelligence = process.env.CPK_INTELLIGENCE_API_KEY;

  afterEach(() => {
    memberships.rows = [];
    claims.sub = USER_A;
    claims.email = "operator@example.com";
    if (previousLicense === undefined) {
      delete process.env.COPILOTKIT_LICENSE_TOKEN;
    } else {
      process.env.COPILOTKIT_LICENSE_TOKEN = previousLicense;
    }
    if (previousIntelligence === undefined) {
      delete process.env.CPK_INTELLIGENCE_API_KEY;
    } else {
      process.env.CPK_INTELLIGENCE_API_KEY = previousIntelligence;
    }
    vi.restoreAllMocks();
  });

  function enableIntelligence() {
    process.env.COPILOTKIT_LICENSE_TOKEN = "test-license-token";
    process.env.CPK_INTELLIGENCE_API_KEY = "test-intelligence-key";
  }

  it("encodes Intelligence identity as org+user, not JWT user id", () => {
    expect(RESOURCE_A).toBe(`org:${ORG_A}::user:${USER_A}`);
    expect(RESOURCE_A).not.toBe(USER_A);
    expect(memoryResourceId({ userId: USER_A, orgId: ORG_A })).toBe(RESOURCE_A);
    expect(memoryResourceId({ userId: USER_A, orgId: ORG_B })).toBe(
      RESOURCE_A_IN_ORG_B,
    );
  });

  // Key-selection coverage: CPK_INTELLIGENCE_API_KEY present -> intelligence
  // is already exercised by every enableIntelligence()-based test below, so
  // it isn't duplicated here. These two cases were the genuinely uncovered
  // ones (route.ts:212-215's `||` fallback chain).
  it("uses COPILOTKIT_API_KEY fallback to select Intelligence mode", async () => {
    const previousAlias = process.env.COPILOTKIT_API_KEY;
    delete process.env.CPK_INTELLIGENCE_API_KEY;
    process.env.COPILOTKIT_API_KEY = "test-alias-key";
    memberships.rows = [{ org_id: ORG_A }];
    try {
      const info = await GET(
        copilotRequest("/api/copilotkit/info", { method: "GET" }),
      );
      expect(info.status).toBe(200);
      const payload = (await info.json()) as { mode?: string };
      expect(payload.mode).toBe("intelligence");
    } finally {
      if (previousAlias === undefined) {
        delete process.env.COPILOTKIT_API_KEY;
      } else {
        process.env.COPILOTKIT_API_KEY = previousAlias;
      }
    }
  });

  it("falls back to SSE mode when neither Intelligence key is set", async () => {
    const previousAlias = process.env.COPILOTKIT_API_KEY;
    delete process.env.CPK_INTELLIGENCE_API_KEY;
    delete process.env.COPILOTKIT_API_KEY;
    memberships.rows = [{ org_id: ORG_A }];
    try {
      const info = await GET(
        copilotRequest("/api/copilotkit/info", { method: "GET" }),
      );
      expect(info.status).toBe(200);
      const payload = (await info.json()) as { mode?: string };
      expect(payload.mode).toBe("sse");
    } finally {
      if (previousAlias === undefined) {
        delete process.env.COPILOTKIT_API_KEY;
      } else {
        process.env.COPILOTKIT_API_KEY = previousAlias;
      }
    }
  });

  it("selects Intelligence mode without TenantAbortRunner", async () => {
    enableIntelligence();
    const sseStop = vi.spyOn(InMemoryAgentRunner.prototype, "stop");
    const intelligenceStop = vi.spyOn(IntelligenceAgentRunner.prototype, "stop");
    memberships.rows = [{ org_id: ORG_A }];

    const info = await GET(
      copilotRequest("/api/copilotkit/info", { method: "GET" }),
    );
    expect(info.status).toBe(200);
    const payload = (await info.json()) as { mode?: string };
    expect(payload.mode).toBe("intelligence");

    const stop = await POST(
      copilotRequest(
        `/api/copilotkit/agent/default/stop/${encodeURIComponent(ORG_A_THREAD)}`,
        { method: "POST" },
      ),
    );
    expect(stop.status).toBe(200);
    expect(sseStop).not.toHaveBeenCalled();
    expect(intelligenceStop).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: ORG_A_THREAD }),
    );
  });

  it("lists threads under the org+user Intelligence identity", async () => {
    enableIntelligence();
    memberships.rows = [{ org_id: ORG_A }];
    const { listSpy } = mockOrgAThreadAccess();

    const response = await GET(
      copilotRequest("/api/copilotkit/threads?agentId=default", {
        method: "GET",
      }),
    );
    expect(response.status).toBe(200);
    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ userId: RESOURCE_A, agentId: "default" }),
    );
    expect(listSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_A }),
    );
    expect(await response.json()).toEqual(orgAThreadList());
  });

  it("does not let Org B list or connect to Org A Intelligence threads", async () => {
    enableIntelligence();
    const { connectSpy } = mockOrgAThreadAccess();

    claims.sub = USER_B;
    memberships.rows = [{ org_id: ORG_B }];

    const listed = await GET(
      copilotRequest("/api/copilotkit/threads?agentId=default", {
        method: "GET",
      }),
    );
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody).toEqual(emptyThreadList());
    expect(JSON.stringify(listedBody)).not.toContain("SS26 shot list");

    const connected = await POST(
      copilotRequest("/api/copilotkit/agent/default/connect", {
        method: "POST",
        body: runBody(ORG_A_THREAD),
      }),
    );
    expect(connected.status).toBe(204);
    expect(connectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: RESOURCE_B,
        threadId: ORG_A_THREAD,
        agentId: "default",
      }),
    );
    expect(connectSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: RESOURCE_A }),
    );
  });

  it("does not let the same user attach Org A Intelligence threads from Org B", async () => {
    enableIntelligence();
    const { connectSpy } = mockOrgAThreadAccess();

    claims.sub = USER_A;
    memberships.rows = [{ org_id: ORG_B }];

    const listed = await GET(
      copilotRequest("/api/copilotkit/threads?agentId=default", {
        method: "GET",
      }),
    );
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual(emptyThreadList());

    const connected = await POST(
      copilotRequest("/api/copilotkit/agent/default/connect", {
        method: "POST",
        body: runBody(ORG_A_THREAD),
      }),
    );
    expect(connected.status).toBe(204);
    expect(connectSpy.mock.calls[0]?.[0]).toMatchObject({
      userId: RESOURCE_A_IN_ORG_B,
      threadId: ORG_A_THREAD,
    });
    expect(RESOURCE_A_IN_ORG_B).not.toBe(RESOURCE_A);
  });
});
