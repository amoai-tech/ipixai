import { AbstractAgent, type BaseEvent } from "@ag-ui/client";
import { EventType, type RunAgentInput } from "@ag-ui/core";
import { Observable } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as agent from "../src/agent";
import { GET, PATCH, POST, DELETE } from "../src/app/api/copilotkit/[[...slug]]/route";
import { GET as getPlannerMessages } from "../src/app/api/planner/threads/[threadId]/messages/route";
import {
  authorizeThreadAccess,
  loadThreadOwner,
} from "../src/lib/auth/thread-acl";
import * as threadClaim from "../src/lib/auth/thread-claim";
import { memoryResourceId } from "../src/lib/auth/verified-operator";
import * as threadPersistence from "../src/mastra/thread-persistence";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORG_A_SECRET = "SS26 Org A shot-list — do not leak";

const memberships: {
  rows: { org_id: string }[];
  calls: number;
  failOnCall: number | null;
} = { rows: [], calls: 0, failOnCall: null };
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
        eq: async () => {
          if (table !== "org_members") {
            return { data: null, error: { message: "unexpected table" } };
          }
          memberships.calls += 1;
          if (memberships.failOnCall === memberships.calls) {
            return { data: null, error: { message: "db unavailable" } };
          }
          return { data: memberships.rows, error: null };
        },
      }),
    }),
  }),
  createClient: async () => null,
}));

afterEach(() => {
  memberships.rows = [];
  memberships.calls = 0;
  memberships.failOnCall = null;
  claims.sub = USER_A;
  claims.email = "operator@example.com";
  vi.restoreAllMocks();
});

let runSeq = 0;

function runBody(threadId?: string) {
  runSeq += 1;
  return {
    threadId: threadId ?? `thread-access-001-${runSeq}`,
    runId: `run-access-001-${runSeq}`,
    state: {},
    messages: [
      {
        id: `msg-user-${runSeq}`,
        role: "user" as const,
        content: ORG_A_SECRET,
      },
    ],
    tools: [{ name: "planShoot", description: "Org A planner tool" }],
    context: [],
    forwardedProps: {},
  };
}

function copilotRequest(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
  } = {},
): Request {
  const method = options.method ?? "POST";
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (options.body && method !== "GET" && method !== "HEAD") {
    init.body = JSON.stringify(options.body);
  }
  return new Request(`http://localhost${path}`, init);
}

function createFiniteAgent() {
  class AccessTestAgent extends AbstractAgent {
    constructor() {
      super({ agentId: "default", description: "access-001 test agent" });
    }

    override run(input: RunAgentInput): Observable<BaseEvent> {
      const messageId = "msg-assistant-access";
      return new Observable((subscriber) => {
        subscriber.next({
          type: EventType.RUN_STARTED,
          threadId: input.threadId,
          runId: input.runId,
        });
        subscriber.next({
          type: EventType.TEXT_MESSAGE_START,
          messageId,
          role: "assistant",
        });
        subscriber.next({
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId,
          delta: ORG_A_SECRET,
        });
        subscriber.next({ type: EventType.TEXT_MESSAGE_END, messageId });
        subscriber.next({
          type: EventType.RUN_FINISHED,
          threadId: input.threadId,
          runId: input.runId,
        });
        subscriber.complete();
      });
    }
  }
  return new AccessTestAgent();
}

function parseSseEvents(text: string): Array<{ type?: string }> {
  const events: Array<{ type?: string }> = [];
  for (const block of text.split("\n\n")) {
    const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
    if (!dataLine) continue;
    const payload = dataLine.slice("data:".length).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      events.push(JSON.parse(payload) as { type?: string });
    } catch {
      // ignore
    }
  }
  return events;
}

async function readSseUntilFinished(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("missing SSE body");
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const chunk = await Promise.race([
      reader.read().then((result) => ({ kind: "read" as const, result })),
      new Promise<{ kind: "timeout" }>((resolve) =>
        setTimeout(() => resolve({ kind: "timeout" }), remaining),
      ),
    ]);
    if (chunk.kind === "timeout") {
      await reader.cancel().catch(() => undefined);
      break;
    }
    if (chunk.result.value) {
      text +=
        typeof chunk.result.value === "string"
          ? chunk.result.value
          : decoder.decode(chunk.result.value, { stream: true });
    }
    const events = parseSseEvents(text);
    if (
      events.some((event) => event.type === EventType.RUN_FINISHED) ||
      chunk.result.done
    ) {
      return text;
    }
  }
  return text;
}

function assertEmptyOfOrgA(body: unknown) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  expect(raw).not.toContain(ORG_A_SECRET);
  expect(raw).not.toContain("planShoot");
  expect(raw).not.toContain("msg-assistant-access");
  expect(raw).not.toMatch(/SS26/);
}

async function asOrgA() {
  claims.sub = USER_A;
  memberships.rows = [{ org_id: ORG_A }];
}

async function asOrgB() {
  claims.sub = USER_B;
  memberships.rows = [{ org_id: ORG_B }];
}

describe("IPI-1047 · ACCESS-001 thread ownership", () => {
  const owner = memoryResourceId({ userId: USER_A, orgId: ORG_A });
  const other = memoryResourceId({ userId: USER_B, orgId: ORG_B });

  beforeEach(() => {
    vi.spyOn(threadClaim, "claimPlannerThread").mockImplementation(
      async ({ resourceId }) => ({
        status: "owned",
        resourceId,
      }),
    );
  });

  it.each([
    {
      name: "allows the stored owner",
      input: {
        threadId: "thread-org-a",
        callerResourceId: owner,
        owner: { status: "owned" as const, resourceId: owner },
        allowMissing: false,
      },
      expected: { ok: true },
    },
    {
      name: "denies a foreign owner even when missing threads are allowed",
      input: {
        threadId: "thread-org-a",
        callerResourceId: other,
        owner: { status: "owned" as const, resourceId: owner },
        allowMissing: true,
      },
      expected: { ok: false },
    },
    {
      name: "allows a missing thread when the route may create",
      input: {
        threadId: "thread-new",
        callerResourceId: owner,
        owner: { status: "not_found" as const },
        allowMissing: true,
      },
      expected: { ok: true },
    },
    {
      name: "denies lookup failure on run/connect",
      input: {
        threadId: "thread-new",
        callerResourceId: owner,
        owner: { status: "lookup_failed" as const },
        allowMissing: true,
      },
      expected: { ok: false },
    },
    {
      name: "denies lookup failure on stop",
      input: {
        threadId: "thread-new",
        callerResourceId: owner,
        owner: { status: "lookup_failed" as const },
        allowMissing: true,
      },
      expected: { ok: false },
    },
    {
      name: "denies lookup failure on read routes",
      input: {
        threadId: "thread-new",
        callerResourceId: owner,
        owner: { status: "lookup_failed" as const },
        allowMissing: false,
      },
      expected: { ok: false },
    },
    {
      name: "denies an unowned thread",
      input: {
        threadId: "thread-unowned",
        callerResourceId: owner,
        owner: { status: "unowned" as const },
        allowMissing: true,
      },
      expected: { ok: false },
    },
  ])("$name", ({ input, expected }) => {
    expect(authorizeThreadAccess(input)).toEqual(expected);
  });

  it("fails closed on malformed thread IDs", () => {
    const caller = memoryResourceId({ userId: USER_A, orgId: ORG_A });
    for (const threadId of ["", "../etc/passwd", "thread id", null, 12, {}]) {
      expect(
        authorizeThreadAccess({
          threadId,
          callerResourceId: caller,
          owner: { status: "not_found" },
          allowMissing: true,
        }),
      ).toEqual({ ok: false });
    }
  });

  it("lets the same operator continue the same thread", async () => {
    vi.spyOn(agent, "createLocalAgents").mockReturnValue({
      default: createFiniteAgent(),
    });
    await asOrgA();
    const body = runBody("thread-access-continue");

    const first = await POST(
      copilotRequest("/api/copilotkit/agent/default/run", { body }),
    );
    expect(first.status).toBe(200);
    const firstText = await readSseUntilFinished(first);
    expect(parseSseEvents(firstText).some((e) => e.type === EventType.RUN_FINISHED)).toBe(
      true,
    );

    const second = await POST(
      copilotRequest("/api/copilotkit/agent/default/run", { body }),
    );
    expect(second.status).toBe(200);
    const secondText = await readSseUntilFinished(second);
    expect(parseSseEvents(secondText).some((e) => e.type === EventType.RUN_STARTED)).toBe(
      true,
    );
  });

  it("returns 403 with no Org A content when Org B opens Org A's thread", async () => {
    vi.spyOn(agent, "createLocalAgents").mockReturnValue({
      default: createFiniteAgent(),
    });
    await asOrgA();
    const body = runBody("thread-access-cross-org");
    const created = await POST(
      copilotRequest("/api/copilotkit/agent/default/run", { body }),
    );
    expect(created.status).toBe(200);
    await readSseUntilFinished(created);
    const ownerBefore = await loadThreadOwner(body.threadId);

    await asOrgB();
    const denied = await POST(
      copilotRequest("/api/copilotkit/agent/default/run", { body }),
    );
    expect(denied.status).toBe(403);
    const deniedBody = await denied.json();
    expect(deniedBody).toEqual({
      error: "forbidden",
      reason: "thread_forbidden",
    });
    assertEmptyOfOrgA(deniedBody);
    expect(await loadThreadOwner(body.threadId)).toEqual(ownerBefore);
  });

  it("returns 403 with no writes on Org B read, rename, archive, delete, and stop", async () => {
    vi.spyOn(agent, "createLocalAgents").mockReturnValue({
      default: createFiniteAgent(),
    });
    await asOrgA();
    const body = runBody("thread-access-mutations");
    const created = await POST(
      copilotRequest("/api/copilotkit/agent/default/run", { body }),
    );
    expect(created.status).toBe(200);
    await readSseUntilFinished(created);
    const ownerBefore = await loadThreadOwner(body.threadId);

    await asOrgB();
    const paths: Array<{
      method: "GET" | "POST" | "PATCH" | "DELETE";
      path: string;
      body?: Record<string, unknown>;
    }> = [
      { method: "GET", path: `/api/copilotkit/threads/${body.threadId}/messages` },
      { method: "GET", path: `/api/copilotkit/threads/${body.threadId}/events` },
      { method: "GET", path: `/api/copilotkit/threads/${body.threadId}/state` },
      {
        method: "PATCH",
        path: `/api/copilotkit/threads/${body.threadId}`,
        body: { name: "stolen-title" },
      },
      { method: "POST", path: `/api/copilotkit/threads/${body.threadId}/archive` },
      { method: "DELETE", path: `/api/copilotkit/threads/${body.threadId}` },
      {
        method: "POST",
        path: `/api/copilotkit/agent/default/stop/${encodeURIComponent(body.threadId)}`,
      },
    ];
    const handlers = { GET, POST, PATCH, DELETE };
    for (const step of paths) {
      const response = await handlers[step.method](
        copilotRequest(step.path, { method: step.method, body: step.body }),
      );
      expect(response.status, step.path).toBe(403);
      const deniedBody = await response.json();
      expect(deniedBody).toEqual({
        error: "forbidden",
        reason: "thread_forbidden",
      });
      assertEmptyOfOrgA(deniedBody);
    }
    expect(await loadThreadOwner(body.threadId)).toEqual(ownerBefore);
  });

  it("returns 403 thread_forbidden for planner /messages owned by another org", async () => {
    const threadId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const owner = memoryResourceId({ userId: USER_A, orgId: ORG_A });
    vi.spyOn(agent, "createLocalAgents").mockReturnValue({
      default: createFiniteAgent(),
    });
    const memory = await threadPersistence.getPlannerMemory();
    expect(memory).toBeTruthy();
    await memory!.createThread({
      threadId,
      resourceId: owner,
      title: ORG_A_SECRET,
    });

    await asOrgB();
    const denied = await getPlannerMessages(
      copilotRequest(`/api/planner/threads/${threadId}/messages`, {
        method: "GET",
      }),
      { params: Promise.resolve({ threadId }) },
    );
    expect(denied.status).toBe(403);
    const deniedBody = await denied.json();
    expect(deniedBody).toEqual({
      error: "forbidden",
      reason: "thread_forbidden",
    });
    assertEmptyOfOrgA(deniedBody);

    await asOrgA();
    const allowed = await getPlannerMessages(
      copilotRequest(`/api/planner/threads/${threadId}/messages`, {
        method: "GET",
      }),
      { params: Promise.resolve({ threadId }) },
    );
    expect(allowed.status).toBe(200);
    const allowedBody = await allowed.json();
    expect(allowedBody.threadId).toBe(threadId);
    expect(Array.isArray(allowedBody.messages)).toBe(true);
  });

  it("keeps Org A thread titles out of Org B's CopilotKit list", async () => {
    vi.spyOn(agent, "createLocalAgents").mockReturnValue({
      default: createFiniteAgent(),
    });
    await asOrgA();
    const body = runBody("thread-access-list");
    const created = await POST(
      copilotRequest("/api/copilotkit/agent/default/run", { body }),
    );
    expect(created.status).toBe(200);
    await readSseUntilFinished(created);

    await asOrgB();
    const listed = await GET(copilotRequest("/api/copilotkit/threads", { method: "GET" }));
    expect(listed.status).toBe(200);
    const listBody = await listed.text();
    expect(listBody).not.toContain(body.threadId);
    assertEmptyOfOrgA(listBody);
  });

  it("fails closed on malformed thread IDs at the route", async () => {
    vi.spyOn(agent, "createLocalAgents").mockReturnValue({
      default: createFiniteAgent(),
    });
    await asOrgA();
    for (const threadId of ["", "../etc/passwd", "thread id"]) {
      const response = await POST(
        copilotRequest("/api/copilotkit/agent/default/run", {
          body: { ...runBody(), threadId },
        }),
      );
      expect(response.status).toBe(403);
      assertEmptyOfOrgA(await response.json());
    }
  });

  it("returns 403 with no handler events when owner lookup fails on a read route", async () => {
    let ran = false;
    class LookupFailAgent extends AbstractAgent {
      constructor() {
        super({ agentId: "default", description: "access-001 lookup fail" });
      }
      override run(input: RunAgentInput): Observable<BaseEvent> {
        ran = true;
        return createFiniteAgent().run(input);
      }
    }
    vi.spyOn(agent, "createLocalAgents").mockReturnValue({
      default: new LookupFailAgent(),
    });
    vi.spyOn(threadPersistence, "getPlannerMemory").mockRejectedValue(
      new Error("memory down"),
    );
    await asOrgA();
    const response = await GET(
      copilotRequest("/api/copilotkit/threads/thread-access-lookup-failed/messages", {
        method: "GET",
      }),
    );
    expect(response.status).toBe(403);
    const deniedBody = await response.json();
    expect(deniedBody).toEqual({
      error: "forbidden",
      reason: "thread_forbidden",
    });
    assertEmptyOfOrgA(deniedBody);
    expect(ran).toBe(false);
  });

  it("returns 403 for stop when owner lookup fails", async () => {
    vi.spyOn(agent, "createLocalAgents").mockReturnValue({
      default: createFiniteAgent(),
    });
    vi.spyOn(threadPersistence, "getPlannerMemory").mockRejectedValue(
      new Error("memory down"),
    );
    await asOrgA();
    const response = await POST(
      copilotRequest("/api/copilotkit/agent/default/stop/thread-access-stop-lookup", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(403);
    const deniedBody = await response.json();
    expect(deniedBody).toEqual({
      error: "forbidden",
      reason: "thread_forbidden",
    });
    assertEmptyOfOrgA(deniedBody);
  });

  it("returns 503 memory_unavailable when planner /messages memory rejects", async () => {
    const threadId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    vi.spyOn(threadPersistence, "getPlannerMemory").mockRejectedValue(
      new Error("memory down"),
    );
    await asOrgA();
    const response = await getPlannerMessages(
      copilotRequest(`/api/planner/threads/${threadId}/messages`, {
        method: "GET",
      }),
      { params: Promise.resolve({ threadId }) },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "memory_unavailable" });
  });

  it("returns 503 memory_unavailable when getThreadById rejects", async () => {
    const threadId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    vi.spyOn(threadPersistence, "getPlannerMemory").mockResolvedValue({
      getThreadById: async () => {
        throw new Error("thread lookup down");
      },
    } as unknown as Awaited<ReturnType<typeof threadPersistence.getPlannerMemory>>);
    await asOrgA();
    const response = await getPlannerMessages(
      copilotRequest(`/api/planner/threads/${threadId}/messages`, {
        method: "GET",
      }),
      { params: Promise.resolve({ threadId }) },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "memory_unavailable" });
  });
});
