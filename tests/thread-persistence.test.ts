import { InMemoryStore } from "@mastra/core/storage";
import { Memory } from "@mastra/memory";
import { describe, expect, it } from "vitest";

import {
  plannerThreadStorageKey,
  resolvePlannerThreadId,
} from "../src/mastra/thread-types";
import {
  ensureMastraThread,
  listMastraThreadsForResource,
  mastraMessagesToChat,
  recallPlannerChatMessages,
  splitRunThreadIds,
} from "../src/mastra/thread-persistence";

function isolatedMemory() {
  return new Memory({
    storage: new InMemoryStore({
      id: `thread-persist-${crypto.randomUUID()}`,
    }),
  });
}

describe("splitRunThreadIds", () => {
  it("keeps the CopilotKit thread id for Mastra and prefixes only the abort store", () => {
    const clientThreadId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const resourceId = "org:org-a::user:user-a";
    expect(splitRunThreadIds(resourceId, clientThreadId)).toEqual({
      runnerThreadId: `${resourceId}\u001f${clientThreadId}`,
      mastraThreadId: clientThreadId,
    });
  });

  it("uses one lowercase UUID for Mastra storage and the abort store", () => {
    const mixed = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
    const canonical = mixed.toLowerCase();
    const resourceId = "org:org-a::user:user-a";
    expect(splitRunThreadIds(resourceId, mixed)).toEqual({
      runnerThreadId: `${resourceId}\u001f${canonical}`,
      mastraThreadId: canonical,
    });
  });
});

describe("ensureMastraThread + listMastraThreadsForResource", () => {
  it("creates a thread on first run and lists it for that resourceId", async () => {
    const memory = isolatedMemory();
    const threadId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const resourceId = "org:org-a::user:user-a";

    const first = await ensureMastraThread(memory, { threadId, resourceId });
    expect(first.created).toBe(true);

    const second = await ensureMastraThread(memory, { threadId, resourceId });
    expect(second.created).toBe(false);

    const listed = await listMastraThreadsForResource(memory, resourceId);
    expect(listed.map((thread) => thread.id)).toEqual([threadId]);

    const other = await listMastraThreadsForResource(
      memory,
      "org:org-b::user:user-b",
    );
    expect(other).toEqual([]);

    await expect(
      ensureMastraThread(memory, {
        threadId,
        resourceId: "org:org-b::user:user-b",
      }),
    ).rejects.toThrow("thread belongs to another resource");
  });

  it("stores an uppercase UUID as the canonical lowercase id", async () => {
    const memory = isolatedMemory();
    const mixed = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
    const canonical = mixed.toLowerCase();
    const resourceId = "org:org-a::user:user-a";

    await ensureMastraThread(memory, { threadId: mixed, resourceId });
    const stored = await memory.getThreadById({ threadId: canonical });
    const alias = await memory.getThreadById({ threadId: mixed });
    expect(stored?.id).toBe(canonical);
    expect(stored?.resourceId).toBe(resourceId);
    expect(alias).toBeNull();
  });

  it("keeps an existing uppercase UUID owned by Org A when Org B uses lowercase", async () => {
    const memory = isolatedMemory();
    const mixed = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
    const canonical = mixed.toLowerCase();
    const ownerA = "org:org-a::user:user-a";
    const ownerB = "org:org-b::user:user-b";

    await memory.createThread({
      threadId: mixed,
      resourceId: ownerA,
      title: "legacy",
    });

    await expect(
      ensureMastraThread(memory, { threadId: canonical, resourceId: ownerB }),
    ).rejects.toThrow("thread belongs to another resource");

    const stored = await memory.getThreadById({ threadId: mixed });
    const alias = await memory.getThreadById({ threadId: canonical });
    expect(stored?.resourceId).toBe(ownerA);
    expect(alias).toBeNull();

    const sameOwner = await ensureMastraThread(memory, {
      threadId: canonical,
      resourceId: ownerA,
    });
    expect(sameOwner.created).toBe(false);
  });

  it("leaves a new thread's title unset so Mastra's generateTitle can still fire (IPI-1164)", async () => {
    const memory = isolatedMemory();
    const threadId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const resourceId = "org:org-a::user:user-a";

    await ensureMastraThread(memory, { threadId, resourceId });

    const stored = await memory.getThreadById({ threadId });
    // Prove the thread actually exists before asserting on its title — a
    // silently-failed createThread would also make `stored` undefined, and
    // `undefined?.title` is falsy too, so this line by itself can't tell
    // "never created" apart from "created untitled".
    expect(stored).toBeDefined();
    // Mastra's generateTitle only runs when `!thread.title` — asserting the
    // exact falsy value (not just "not the old placeholder") proves the gate
    // that actually decides whether generation fires stays open.
    expect(stored!.title).toBeFalsy();
  });

  it("does not persist a whitespace-only title (IPI-1164)", async () => {
    const memory = isolatedMemory();
    const threadId = "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa";
    const resourceId = "org:org-a::user:user-a";

    await ensureMastraThread(memory, { threadId, resourceId, title: "   " });

    const stored = await memory.getThreadById({ threadId });
    expect(stored).toBeDefined();
    // A whitespace-only title is truthy as a string, so an untrimmed check
    // would persist "   " and leave generateTitle permanently blocked while
    // the list UI's fallback masks it as "Planner chat" — stored and
    // displayed truth would disagree.
    expect(stored!.title).toBeFalsy();
  });

  it("still shows a fallback title for an untitled thread in the list (IPI-1164)", async () => {
    const memory = isolatedMemory();
    const threadId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const resourceId = "org:org-a::user:user-a";

    await ensureMastraThread(memory, { threadId, resourceId });
    const listed = await listMastraThreadsForResource(memory, resourceId);

    expect(listed).toHaveLength(1);
    expect(listed[0].title).toBe("Planner chat");
  });

  it("persists an explicit title when the caller provides one", async () => {
    const memory = isolatedMemory();
    const threadId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const resourceId = "org:org-a::user:user-a";

    await ensureMastraThread(memory, {
      threadId,
      resourceId,
      title: "Spring Lookbook Shoot",
    });

    const stored = await memory.getThreadById({ threadId });
    expect(stored?.title).toBe("Spring Lookbook Shoot");
  });

  it("lists more than 50 threads for one resource", async () => {
    const memory = isolatedMemory();
    const resourceId = "org:org-a::user:user-a";
    const ids = Array.from({ length: 52 }, (_, index) =>
      `cccccccc-cccc-4ccc-8ccc-${index.toString().padStart(12, "0")}`,
    );
    for (const threadId of ids) {
      await ensureMastraThread(memory, { threadId, resourceId });
    }
    const listed = await listMastraThreadsForResource(memory, resourceId);
    expect(listed).toHaveLength(52);
  });
});

describe("resolvePlannerThreadId", () => {
  const rowA = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
  const rowB = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
  const orphan = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("uses the stored id when it is in the listed rows", () => {
    expect(resolvePlannerThreadId([rowA, rowB], rowB.id)).toBe(rowB.id);
  });

  // IPI-1217: confirmed live that a stored id can go temporarily missing
  // from a fresh listing (deletion, staleness, or a transient gap) while
  // OTHER real conversations for the same resource still list fine —
  // silently resuming one of those instead is a worse failure than
  // starting fresh, since the operator's next message would land in a
  // conversation they didn't choose.
  it("never substitutes a different existing conversation when the stored id is absent", () => {
    const next = resolvePlannerThreadId([rowA, rowB], orphan);
    expect(next).not.toBe(rowA.id);
    expect(next).not.toBe(rowB.id);
    expect(next).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("treats an empty stored value as stale instead of resuming another conversation", () => {
    const next = resolvePlannerThreadId([rowA, rowB], "");
    expect(next).not.toBe(rowA.id);
    expect(next).not.toBe(rowB.id);
    expect(next).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("treats an undefined stored value as missing and resumes the listed conversation", () => {
    expect(resolvePlannerThreadId([rowA, rowB], undefined)).toBe(rowA.id);
  });

  it("does not reuse a stored id when the list is empty", () => {
    const next = resolvePlannerThreadId([], orphan);
    expect(next).not.toBe(orphan);
    expect(next).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("generates an id when there are no rows and no stored id", () => {
    const next = resolvePlannerThreadId([], null);
    expect(next).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("scopes localStorage keys to the signed-in resource", () => {
    expect(plannerThreadStorageKey("org:a::user:u")).toBe(
      "ipix.planner.threadId:org:a::user:u",
    );
  });
});

describe("mastraMessagesToChat", () => {
  it("keeps user and assistant text for CopilotKit setMessages", () => {
    expect(
      mastraMessagesToChat([
        {
          id: "m1",
          role: "user",
          content: {
            content: "PERSIST-OK-0901",
            parts: [{ type: "text", text: "PERSIST-OK-0901" }],
          },
        },
        {
          id: "m2",
          role: "assistant",
          content: {
            content: "saved",
            parts: [{ type: "text", text: "saved" }],
          },
        },
        {
          id: "m3",
          role: "tool",
          content: { content: "ignore", parts: [] },
        },
      ]),
    ).toEqual([
      { id: "m1", role: "user", content: "PERSIST-OK-0901" },
      { id: "m2", role: "assistant", content: "saved" },
    ]);
  });

  // IPI-1233 · PLAN-CARD-001 — the P0 reload fix: a completed composeShootPlan
  // tool-invocation part must survive conversion as a paired
  // assistant.toolCalls + tool-result message, so the named renderer can
  // reconstruct the same Production Plan Card after agent.setMessages().
  it("preserves a completed composeShootPlan tool call/result as paired assistant.toolCalls + tool messages", () => {
    const result = { status: "complete", channels: ["shopify"] };
    expect(
      mastraMessagesToChat([
        {
          id: "m1",
          role: "assistant",
          content: {
            content: "Here is your plan.",
            parts: [
              { type: "text", text: "Here is your plan." },
              {
                type: "tool-invocation",
                toolInvocation: {
                  state: "result",
                  toolCallId: "call-1",
                  toolName: "composeShootPlan",
                  args: { channels: ["shopify"] },
                  result,
                },
              },
            ],
          },
        },
      ]),
    ).toEqual([
      {
        id: "m1",
        role: "assistant",
        content: "Here is your plan.",
        toolCalls: [
          {
            id: "call-1",
            type: "function",
            function: { name: "composeShootPlan", arguments: JSON.stringify({ channels: ["shopify"] }) },
          },
        ],
      },
      {
        id: "m1:tool:call-1",
        role: "tool",
        toolCallId: "call-1",
        content: JSON.stringify(result),
      },
    ]);
  });

  it("drops an in-progress (non-result) composeShootPlan tool-invocation, same as before this task", () => {
    expect(
      mastraMessagesToChat([
        {
          id: "m1",
          role: "assistant",
          content: {
            content: "",
            parts: [
              {
                type: "tool-invocation",
                toolInvocation: { state: "call", toolCallId: "call-1", toolName: "composeShootPlan" },
              },
            ],
          },
        },
      ]),
    ).toEqual([{ id: "m1", role: "assistant", content: "" }]);
  });

  it("does not preserve rich history for a tool not in the reload-survival allowlist", () => {
    expect(
      mastraMessagesToChat([
        {
          id: "m1",
          role: "assistant",
          content: {
            content: "Reviewing your plan.",
            parts: [
              {
                type: "tool-invocation",
                toolInvocation: {
                  state: "result",
                  toolCallId: "call-1",
                  toolName: "reviewShootPlan",
                  result: { ok: true },
                },
              },
            ],
          },
        },
      ]),
    ).toEqual([{ id: "m1", role: "assistant", content: "Reviewing your plan." }]);
  });
});

describe("recallPlannerChatMessages — rich history", () => {
  it("restores a completed composeShootPlan result for its own org and reload produces the same data", async () => {
    const memory = isolatedMemory();
    const threadId = "11111111-1111-4111-8111-111111111111";
    const resourceId = "org:org-a::user:user-a";
    await ensureMastraThread(memory, { threadId, resourceId });

    const result = { status: "complete", channels: ["shopify"] };
    await memory.saveMessages({
      messages: [
        {
          id: "msg-1",
          role: "assistant",
          createdAt: new Date(),
          threadId,
          resourceId,
          content: {
            format: 2,
            parts: [
              { type: "text", text: "Here is your plan." },
              {
                type: "tool-invocation",
                toolInvocation: {
                  state: "result",
                  toolCallId: "call-1",
                  toolName: "composeShootPlan",
                  args: { channels: ["shopify"] },
                  result,
                },
              },
            ],
          },
        },
      ],
    });

    const first = await recallPlannerChatMessages(memory, { threadId, resourceId });
    const second = await recallPlannerChatMessages(memory, { threadId, resourceId });
    // Same restore twice (mirrors a page reload re-fetching history) must
    // produce the exact same messages — not just "some" tool result.
    expect(second).toEqual(first);
    expect(first).toEqual([
      {
        id: "msg-1",
        role: "assistant",
        content: "Here is your plan.",
        toolCalls: [
          {
            id: "call-1",
            type: "function",
            function: { name: "composeShootPlan", arguments: JSON.stringify({ channels: ["shopify"] }) },
          },
        ],
      },
      { id: "msg-1:tool:call-1", role: "tool", toolCallId: "call-1", content: JSON.stringify(result) },
    ]);
  });

  it("Org B cannot recall Org A's rich composeShootPlan tool history", async () => {
    const memory = isolatedMemory();
    const threadId = "22222222-2222-4222-8222-222222222222";
    const ownerA = "org:org-a::user:user-a";
    const ownerB = "org:org-b::user:user-b";
    await ensureMastraThread(memory, { threadId, resourceId: ownerA });

    await memory.saveMessages({
      messages: [
        {
          id: "msg-1",
          role: "assistant",
          createdAt: new Date(),
          threadId,
          resourceId: ownerA,
          content: {
            format: 2,
            parts: [
              { type: "text", text: "Here is your plan." },
              {
                type: "tool-invocation",
                toolInvocation: {
                  state: "result",
                  toolCallId: "call-1",
                  toolName: "composeShootPlan",
                  args: { channels: ["shopify"] },
                  result: { status: "complete", channels: ["shopify"] },
                },
              },
            ],
          },
        },
      ],
    });

    const asOwnerA = await recallPlannerChatMessages(memory, { threadId, resourceId: ownerA });
    expect(asOwnerA.length).toBeGreaterThan(0);

    const asOwnerB = await recallPlannerChatMessages(memory, { threadId, resourceId: ownerB });
    expect(asOwnerB).toEqual([]);
  });
});
