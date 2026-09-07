import { LibSQLStore } from "@mastra/libsql";
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
  splitRunThreadIds,
} from "../src/mastra/thread-persistence";

function isolatedMemory() {
  return new Memory({
    storage: new LibSQLStore({
      id: `thread-persist-${crypto.randomUUID()}`,
      url: ":memory:",
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

  it("uses the first listed row when the stored id is absent", () => {
    expect(resolvePlannerThreadId([rowA, rowB], orphan)).toBe(rowA.id);
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
});
