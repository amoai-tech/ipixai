import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  owner: vi.fn(),
  history: vi.fn(),
  client: vi.fn(),
}));

vi.mock("../src/lib/auth/planner-session", () => ({
  requirePlannerResourceId: (...args: unknown[]) => mocks.session(...args),
}));
vi.mock("../src/lib/auth/thread-acl", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/auth/thread-acl")>();
  return { ...original, loadThreadOwner: (...args: unknown[]) => mocks.owner(...args) };
});
vi.mock("../src/mastra/thread-persistence", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/mastra/thread-persistence")>();
  return {
    ...original,
    getPlannerMemory: () => Promise.resolve({}),
    recallPlannerHistory: (...args: unknown[]) => mocks.history(...args),
  };
});
vi.mock("../src/lib/supabase/server", () => ({
  createClientFromRequest: (...args: unknown[]) => mocks.client(...args),
}));

import { GET } from "../src/app/api/planner/threads/[threadId]/messages/route";

const orgA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const orgB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const brand = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const threadId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const resourceId = "org:a::user:a";

function request(scope?: string) {
  const url = new URL(`https://ipix.test/api/planner/threads/${threadId}/messages`);
  if (scope !== undefined) url.searchParams.set("scope", scope);
  return GET(new Request(url), { params: Promise.resolve({ threadId }) });
}

describe("Planner history endpoint tenant boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ ok: true, orgId: orgA, resourceId });
    mocks.owner.mockResolvedValue({ status: "owned", resourceId });
    mocks.history.mockResolvedValue({ messages: [{ id: "safe", role: "assistant", content: "Owned data" }], genui: null });
  });

  it("rejects an Org B scope before querying the Brand database", async () => {
    const from = vi.fn();
    mocks.client.mockReturnValue({ from });
    const response = await request(`brand:${orgB}:${brand}`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_scope" });
    expect(from).not.toHaveBeenCalled();
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("rejects Org B even when it knows an Org A thread ID", async () => {
    mocks.session.mockResolvedValue({ ok: true, orgId: orgB, resourceId: "org:b::user:b" });
    mocks.client.mockReturnValue({ from: vi.fn() });
    const response = await request(`brand:${orgA}:${brand}`);
    expect(response.status).toBe(403);
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("rejects a forged same-org Brand without releasing thread contents", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mocks.client.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    const response = await request(`brand:${orgA}:${brand}`);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden_scope" });
    expect(query.eq).toHaveBeenCalledWith("org_id", orgA);
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("rejects another user's thread even with a valid workspace scope", async () => {
    mocks.owner.mockResolvedValue({ status: "owned", resourceId: "org:b::user:b" });
    mocks.client.mockReturnValue({ from: vi.fn() });
    const response = await request();
    expect(response.status).toBe(403);
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("allows the authenticated owner to retrieve workspace history", async () => {
    mocks.client.mockReturnValue({ from: vi.fn() });
    const response = await request();
    expect(response.status).toBe(200);
    expect((await response.json()).messages[0].content).toBe("Owned data");
    expect(mocks.history).toHaveBeenCalledWith(expect.anything(), {
      threadId, resourceId, scopeKey: "workspace",
    });
  });
});
