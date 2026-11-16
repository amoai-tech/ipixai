import { InMemoryStore } from "@mastra/core/storage";
import { Memory } from "@mastra/memory";
import { describe, expect, it, vi } from "vitest";

import {
  plannerThreadStorageKey,
  resolvePlannerThreadId,
} from "../src/mastra/thread-types";
import {
  RICH_RESULT_DECODE_CAP,
  canonicalRichToolResult,
  ensureMastraThread,
  findMastraThread,
  listMastraThreadsForResource,
  mastraMessagesToChat,
  recallPlannerChatMessages,
  recallPlannerHistory,
  savePlannerGenUIActivity,
  splitRunThreadIds,
} from "../src/mastra/thread-persistence";
import { describeProductionPlanCard } from "../src/lib/shoot/compose-shoot-plan-card-view";

function isolatedMemory() {
  return new Memory({
    storage: new InMemoryStore({
      id: `thread-persist-${crypto.randomUUID()}`,
    }),
  });
}

/** Re-encodes `value` once per layer, reproducing the replay amplification. */
function nestJson(value: unknown, layers: number): string {
  let current: unknown = value;
  for (let layer = 0; layer < layers; layer += 1) current = JSON.stringify(current);
  return String(current);
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

describe("persisted GenUI metadata", () => {
  const activity = {
    target: "planner-comparison" as const,
    surfaceId: "comparison-1",
    catalogId: "ipix/planner@1",
    operations: [
      {
        version: "1.0" as const,
        createSurface: { surfaceId: "comparison-1", catalogId: "ipix/planner@1" },
      },
      {
        version: "1.0" as const,
        updateComponents: {
          surfaceId: "comparison-1",
          components: [{
            id: "root",
            component: "ConceptComparison",
            title: "Saved comparison",
            options: [
              { name: "Studio", rationale: "Controlled light." },
              { name: "Outdoor", rationale: "Natural light." },
            ],
          }],
        },
      },
    ],
  };

  it("round-trips an accepted activity and rejects a foreign resource", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });

    expect(await savePlannerGenUIActivity(memory, {
      threadId,
      resourceId,
      activity,
    })).toBe(true);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui).toEqual({
      ...activity,
      scopeKey: "workspace",
    });

    expect(await savePlannerGenUIActivity(memory, {
      threadId,
      resourceId: "org:b::user:v",
      activity: null,
    })).toBe(false);
    expect((await recallPlannerHistory(memory, {
      threadId,
      resourceId: "org:b::user:v",
    })).genui).toBeNull();
  });

  it("rejects an older run snapshot or delete after a newer run, even with different surface IDs", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, runSequence: "100", activity,
    })).toBe(true);
    const newSurface = "comparison-new";
    const newActivity = {
      ...activity,
      surfaceId: newSurface,
      operations: activity.operations.map((op) => {
        if ("createSurface" in op && op.createSurface) {
          return { ...op, createSurface: { ...op.createSurface, surfaceId: newSurface } };
        }
        if ("updateComponents" in op && op.updateComponents) {
          return { ...op, updateComponents: { ...op.updateComponents, surfaceId: newSurface } };
        }
        return op;
      }),
    };
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, runSequence: "102", activity: newActivity,
    })).toBe(true);
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, runSequence: "101", activity,
    })).toBe(false);
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, runSequence: "101", activity: null, surfaceId: newSurface,
    })).toBe(false);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui?.surfaceId).toBe(newSurface);
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, runSequence: "103", activity: null, surfaceId: newSurface,
    })).toBe(true);
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, runSequence: "101", activity,
    })).toBe(false);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui).toBeNull();
  });

  it("deduplicates run X after Y, yet allows a NEW run to deliberately return to X", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, runSequence: "100", activity,
    })).toBe(true);
    const delta = (text: string, runSequence: string) => ({
      threadId, resourceId, runSequence,
      update: { surfaceId: "comparison-1", operations: [{
        version: "1.0" as const,
        updateDataModel: { surfaceId: "comparison-1", path: "/data", value: { text } },
      }] },
    });
    expect(await savePlannerGenUIActivity(memory, delta("Studio", "101"))).toBe(true);
    expect(await savePlannerGenUIActivity(memory, delta("Outdoor", "102"))).toBe(true);
    expect(await savePlannerGenUIActivity(memory, delta("Studio", "101"))).toBe(true);
    let restored = await recallPlannerHistory(memory, { threadId, resourceId });
    expect(restored.genui?.operations).toHaveLength(activity.operations.length + 2);
    expect(restored.genui?.operations.at(-1)).toEqual(delta("Outdoor", "102").update.operations[0]);
    // The SAME payload in a genuinely newer run is an intentional new edit.
    expect(await savePlannerGenUIActivity(memory, delta("Studio", "103"))).toBe(true);
    restored = await recallPlannerHistory(memory, { threadId, resourceId });
    expect(restored.genui?.operations).toHaveLength(activity.operations.length + 3);
    expect(restored.genui?.operations.at(-1)).toEqual(delta("Studio", "103").update.operations[0]);
  });

  it("keeps the last good comparison when too many valid deltas exceed the storage bound", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });
    expect(await savePlannerGenUIActivity(memory, { threadId, resourceId, activity })).toBe(true);
    for (let i = 0; i < 18; i++) {
      expect(await savePlannerGenUIActivity(memory, {
        threadId, resourceId,
        update: { surfaceId: "comparison-1", operations: [{
          version: "1.0", updateDataModel: {
            surfaceId: "comparison-1", path: "/data", value: { iteration: i },
          },
        }] },
      })).toBe(true);
    }
    const before = await recallPlannerHistory(memory, { threadId, resourceId });
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId,
      update: { surfaceId: "comparison-1", operations: [{
        version: "1.0", updateDataModel: {
          surfaceId: "comparison-1", path: "/data", value: { iteration: 18 },
        },
      }] },
    })).toBe(false);
    const saved = await recallPlannerHistory(memory, { threadId, resourceId });
    expect(saved.genui?.operations).toEqual(before.genui?.operations);
    expect(saved.genui?.operations).toHaveLength(20);
    expect(saved.genuiRecovery).toBeUndefined();
  });

  it("rejects a stale snapshot for a deleted surface but accepts a new surface ID", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });
    expect(await savePlannerGenUIActivity(memory, { threadId, resourceId, activity })).toBe(true);
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, activity: null, surfaceId: "comparison-1",
    })).toBe(true);
    expect(await savePlannerGenUIActivity(memory, { threadId, resourceId, activity })).toBe(false);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui).toBeNull();
    const nextId = "comparison-new-run";
    const newActivity = {
      ...activity, surfaceId: nextId,
      operations: activity.operations.map((op) => {
        if ("createSurface" in op && op.createSurface) {
          return { ...op, createSurface: { ...op.createSurface, surfaceId: nextId } };
        }
        if ("updateComponents" in op && op.updateComponents) {
          return { ...op, updateComponents: { ...op.updateComponents, surfaceId: nextId } };
        }
        return op;
      }),
    };
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, activity: newActivity,
    })).toBe(true);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui?.surfaceId).toBe(nextId);
  });

  it("records a deletion marker that suppresses older history", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });
    await savePlannerGenUIActivity(memory, { threadId, resourceId, activity });
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, activity: null, surfaceId: "comparison-1",
    })).toBe(true);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui).toBeNull();
  });
  it("scopes saved cards to the exact Brand and rejects other scopes", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    const brandA = "brand:org-a:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const brandB = "brand:org-a:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await ensureMastraThread(memory, { threadId, resourceId });
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, scopeKey: brandA, activity,
    })).toBe(true);
    expect((await recallPlannerHistory(memory, { threadId, resourceId, scopeKey: brandA })).genui?.scopeKey)
      .toBe(brandA);
    expect((await recallPlannerHistory(memory, { threadId, resourceId, scopeKey: brandB })).genui)
      .toBeNull();
    expect((await recallPlannerHistory(memory, { threadId, resourceId, scopeKey: "workspace" })).genui)
      .toBeNull();
  });

  it("applies update-only deltas, deduplicates replays and invalidates a rejected card", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });
    await savePlannerGenUIActivity(memory, { threadId, resourceId, activity });
    const newRoot = {
      version: "1.0" as const,
      updateComponents: {
        surfaceId: "comparison-1",
        components: [{
          id: "root",
          component: "ConceptComparison",
          title: "New editorial direction",
          options: [
            { name: "Editorial", rationale: "Dramatic lighting." },
            { name: "Studio", rationale: "Controlled light." },
          ],
        }],
      },
    };
    const write = { threadId, resourceId, update: {
      surfaceId: "comparison-1", operations: [newRoot],
    } };
    expect(await savePlannerGenUIActivity(memory, write)).toBe(true);
    expect(await savePlannerGenUIActivity(memory, write)).toBe(true);
    const updated = (await recallPlannerHistory(memory, { threadId, resourceId })).genui;
    expect(updated?.operations).toHaveLength(3);
    expect(updated?.operations[2]).toEqual(newRoot);
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, activity: null, surfaceId: "some-other-card",
    })).toBe(false);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui).not.toBeNull();
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, activity: null, surfaceId: "comparison-1",
    })).toBe(true);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui).toBeNull();
  });

  it("does not restore scope-less legacy metadata as a workspace or Brand card", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });
    await memory.updateThread({
      id: threadId,
      metadata: { ipixGenUI: activity },
    });
    expect((await recallPlannerHistory(memory, { threadId, resourceId, scopeKey: "workspace" })).genui)
      .toBeNull();
    expect((await recallPlannerHistory(memory, {
      threadId, resourceId,
      scopeKey: "brand:org-a:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    })).genui).toBeNull();
  });

  it("refuses wildcard deletions and preserves the existing scoped card", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });
    expect(await savePlannerGenUIActivity(memory, { threadId, resourceId, activity })).toBe(true);
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, activity: null,
    })).toBe(false);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui?.surfaceId)
      .toBe("comparison-1");
  });

  it("deduplicates equivalent deltas with reordered nested JSON properties", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });
    await savePlannerGenUIActivity(memory, { threadId, resourceId, activity });
    const updateA = {
      version: "1.0" as const,
      updateDataModel: { surfaceId: "comparison-1", path: "/data", value: { a: 1, b: 2 } },
    };
    const updateB = {
      updateDataModel: { value: { b: 2, a: 1 }, path: "/data", surfaceId: "comparison-1" },
      version: "1.0" as const,
    };
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, update: { surfaceId: "comparison-1", operations: [updateA] },
    })).toBe(true);
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, update: { surfaceId: "comparison-1", operations: [updateB] },
    })).toBe(true);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui?.operations).toHaveLength(
      activity.operations.length + 1,
    );
  });

  it("preserves metadata written after a concurrent initial read", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });
    const originalUpdate = memory.updateThread.bind(memory);
    const spy = vi.spyOn(memory, "updateThread");
    spy.mockImplementationOnce(async (args) => {
      // A title/working-memory writer changed the row after our read.
      await originalUpdate({ id: args.id, metadata: { otherFeature: "new" } });
      return originalUpdate(args);
    });
    expect(await savePlannerGenUIActivity(memory, { threadId, resourceId, activity })).toBe(true);
    const thread = await findMastraThread(memory, threadId);
    expect(thread?.metadata?.otherFeature).toBe("new");
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui)
      .toMatchObject({ surfaceId: "comparison-1" });
  });

  it("restores recovery, not an obsolete card, after a rejected update", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });
    await savePlannerGenUIActivity(memory, { threadId, resourceId, activity });
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, activity: null,
      surfaceId: "comparison-1", reason: "rejected",
    })).toBe(true);
    const history = await recallPlannerHistory(memory, {
      threadId, resourceId, scopeKey: "workspace",
    });
    expect(history.genui).toBeNull();
    expect(history.genuiRecovery).toBe(true);
  });

  it("rejects cross-surface delta updates and records recovery without saving foreign operations", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });
    expect(await savePlannerGenUIActivity(memory, { threadId, resourceId, activity })).toBe(true);

    const foreignDelta = {
      version: "1.0" as const,
      updateDataModel: { surfaceId: "foreign-surface", path: "/data", value: { state: "bad" } },
    };
    // The request is handled by writing a rejection marker, not the foreign delta.
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, update: { surfaceId: "comparison-1", operations: [foreignDelta] },
    })).toBe(true);

    const restored = await recallPlannerHistory(memory, { threadId, resourceId });
    // The existing contract deliberately invalidates a rejected update so
    // an old comparison does not masquerade as the new AI result.
    expect(restored.genui).toBeNull();
    expect(restored.genuiRecovery).toBe(true);
  });

  it("never persists a create/update pair targeting two different surfaces", async () => {
    const memory = isolatedMemory();
    const threadId = crypto.randomUUID();
    const resourceId = "org:a::user:u";
    await ensureMastraThread(memory, { threadId, resourceId });
    const broken = {
      ...activity,
      operations: [
        activity.operations[0],
        {
          version: "1.0" as const,
          updateComponents: {
            surfaceId: "foreign-surface",
            components: [{
              id: "root",
              component: "ConceptComparison",
              title: "Mismatched surface",
              options: [
                { name: "Studio", rationale: "Controlled." },
                { name: "Outdoor", rationale: "Natural." },
              ],
            }],
          },
        },
      ],
    };
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, activity: broken,
    })).toBe(false);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui).toBeNull();
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

  // IPI-1339 · PLANNER-PAYLOAD-001 — the production P0: a restored result that
  // was persisted back as JSON *text* must come out of recall as one canonical
  // layer, not as the latest link in a growing escaping chain.
  it("normalizes a legacy multi-layer composeShootPlan result on recall", async () => {
    const memory = isolatedMemory();
    const threadId = "33333333-3333-4333-8333-333333333333";
    const resourceId = "org:org-a::user:user-a";
    const plan = { status: "complete", channels: ["shopify"], objective: "Linen lookbook" };
    await ensureMastraThread(memory, { threadId, resourceId });

    await memory.saveMessages({
      messages: [
        {
          id: "msg-legacy",
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
                  toolCallId: "call-legacy",
                  toolName: "composeShootPlan",
                  args: { channels: ["shopify"] },
                  // Exactly what the replay loop persisted: the result as a
                  // string, re-encoded once per restore cycle.
                  result: nestJson(plan, 14),
                },
              },
            ],
          },
        },
      ],
    });

    const recalled = await recallPlannerChatMessages(memory, { threadId, resourceId });
    const toolMessage = recalled.find((message) => message.role === "tool");
    expect(toolMessage).toBeDefined();
    // One parse is all the plan-card renderer does — this must succeed.
    expect(describeProductionPlanCard(JSON.parse(String(toolMessage?.content)))).not.toBeNull();
    expect(toolMessage?.content).toBe(JSON.stringify(plan));
  });
});

describe("canonicalRichToolResult — IPI-1339 amplification guard", () => {
  const plan = {
    status: "complete" as const,
    channels: ["shopify", "instagram"],
    objective: "Linen dress lookbook",
    shotListResult: { totalShots: 8, shots: [{ id: "s1" }] },
    deliverablesResult: { totalAssets: 24 },
  };
  const clean = JSON.stringify(plan);

  it("serializes a clean object or array result exactly once", () => {
    expect(canonicalRichToolResult(plan)).toBe(clean);
    expect(canonicalRichToolResult([plan])).toBe(JSON.stringify([plan]));
  });

  it("recovers the measured 14-layer legacy corruption to the canonical result", () => {
    const corrupted = nestJson(plan, 14);
    // Sanity: the corrupted value really is explosive (this is the 8.4 MB row).
    expect(corrupted.length).toBeGreaterThan(clean.length * 100);

    const recovered = canonicalRichToolResult(corrupted);
    expect(recovered).toBe(clean);
    // Recovered history stays renderable by the existing plan-card path.
    expect(describeProductionPlanCard(JSON.parse(recovered))).toEqual(
      describeProductionPlanCard(plan),
    );
  });

  it("is idempotent — 20 restore/replay cycles never grow the bytes", () => {
    let content = canonicalRichToolResult(plan);
    const sizes = [content.length];
    for (let cycle = 0; cycle < 20; cycle += 1) {
      // Next cycle's stored value is what the client sent back last time.
      content = canonicalRichToolResult(content);
      sizes.push(content.length);
    }
    expect(new Set(sizes).size).toBe(1);
    expect(content).toBe(clean);
  });

  it("bounds work at the decode cap instead of decoding without limit", () => {
    // A JSON-string chain roughly doubles per layer, so an object fixture one
    // layer past the cap would be tens of MB. Nesting a number instead keeps
    // the fixture exactly one layer deeper than the cap at a cheap ~2 MB
    // (lengths are exactly 2^n - 1).
    const beyondCap = nestJson(1, RICH_RESULT_DECODE_CAP + 1);
    expect(beyondCap.length).toBe(2 ** (RICH_RESULT_DECODE_CAP + 1) - 1);

    // Unwrapping stops at the cap: the result is still valid, re-serializable
    // JSON text, orders of magnitude smaller than the input, and never throws.
    const firstPass = canonicalRichToolResult(beyondCap);
    expect(JSON.parse(firstPass)).toBeDefined();
    expect(firstPass.length).toBeLessThan(beyondCap.length / 1000);

    // The next pass is already inside the cap and reaches the chain's terminal
    // value, so a capped value degrades safely instead of being lost.
    expect(canonicalRichToolResult(firstPass)).toBe(JSON.stringify(1));
  });

  it("keeps the existing safe unreadable-result behavior for invalid input", () => {
    expect(canonicalRichToolResult(plan)).toBe(clean);
    expect(canonicalRichToolResult("not json at all")).toBe(JSON.stringify("not json at all"));
    expect(canonicalRichToolResult("{ truncated")).toBe(JSON.stringify("{ truncated"));
    expect(canonicalRichToolResult(undefined)).toBe("null");
    expect(canonicalRichToolResult(null)).toBe("null");
  });
});
