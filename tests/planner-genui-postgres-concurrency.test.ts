import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { PostgresStore } from "@mastra/pg";
import { Memory } from "@mastra/memory";
import { ensureMastraThread, recallPlannerHistory, savePlannerGenUIActivity } from "../src/mastra/thread-persistence";
import { writePlannerGenUIKey } from "../src/mastra/planner-genui-atomic-save";

const url = process.env.IPIX_GENUI_TEST_DATABASE_URL;
const suite = url && new URL(url).hostname === "127.0.0.1" ? describe : describe.skip;
const resourceId = "org:ipi1449::user:tester";
const activity = {
  target: "planner-comparison" as const,
  surfaceId: "comparison-1", catalogId: "ipix/planner@1",
  operations: [
    { version: "1.0" as const, createSurface: { surfaceId: "comparison-1", catalogId: "ipix/planner@1" } },
    { version: "1.0" as const, updateComponents: { surfaceId: "comparison-1", components: [{
      id: "root", component: "ConceptComparison", title: "Three directions",
      options: [{ name: "Studio", rationale: "A" }, { name: "Outdoor", rationale: "B" }],
    }] } },
  ],
};
suite("IPI-1449 real PostgreSQL cross-writer atomicity", () => {
  let pool: Pool;
  let otherPool: Pool;
  let store: PostgresStore;
  let memory: Memory;
  let otherMemory: Memory;
  const ids: string[] = [];
  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 5 });
    store = new PostgresStore({ id: "ipi-1449-test", pool, schemaName: "mastra", disableInit: true });
    await store.init();
    memory = new Memory({ storage: store });
    // Simulates another Vercel process: separate pool and separate Mastra store.
    otherPool = new Pool({ connectionString: url, max: 2 });
    otherMemory = new Memory({ storage: new PostgresStore({
      id: "ipi-1449-other-instance", pool: otherPool, schemaName: "mastra", disableInit: true,
    }) });
  }, 30000);
  afterAll(async () => {
    if (pool) {
      for (const id of ids) await pool.query('DELETE FROM mastra.mastra_threads WHERE id = $1', [id]);
      await pool.end();
    }
    if (otherPool) await otherPool.end();
  });
  const make = async () => {
    const threadId = crypto.randomUUID();
    ids.push(threadId);
    await ensureMastraThread(memory, { threadId, resourceId });
    expect(await savePlannerGenUIActivity(memory, { threadId, resourceId, activity }, { pool })).toBe(true);
    return threadId;
  };
  const update = (threadId: string, text: string) =>
    savePlannerGenUIActivity(memory, {
      threadId, resourceId,
      update: { surfaceId: "comparison-1", operations: [
        { version: "1.0" as const, updateDataModel: {
          surfaceId: "comparison-1", path: "/data", value: { text },
        } },
      ] },
    }, { pool });
  it("retains two simultaneous deltas written on independent database connections", async () => {
    const threadId = await make();
    // Ensure both calls observe exactly the same original version before writing.
    const original = memory.getThreadById.bind(memory);
    let reads = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => { release = resolve; });
    const spy = vi.spyOn(memory, "getThreadById").mockImplementation(async (args) => {
      const result = await original(args);
      reads += 1;
      if (reads <= 2) {
        if (reads === 2) release();
        await bothRead;
      }
      return result;
    });
    const success = await Promise.all([update(threadId,"studio"),update(threadId,"outdoor")]);
    spy.mockRestore();
    expect(reads).toBeGreaterThanOrEqual(3); // one request retried the CAS
    expect(success).toEqual([true,true]);
    const saved = await recallPlannerHistory(memory,{ threadId, resourceId });
    expect(saved.genui?.operations).toHaveLength(4);
  });
  it("distinguishes an absent JSON key from a key containing JSON null", async () => {
    const threadId = crypto.randomUUID();
    ids.push(threadId);
    await ensureMastraThread(memory, { threadId, resourceId });
    const marker = { deleted: true, scopeKey: "workspace", surfaceId: "comparison-1", reason: "delete" };
    expect(await writePlannerGenUIKey(pool, { threadId, resourceId, previous: null, next: marker })).toBe(false);
    expect(await writePlannerGenUIKey(pool, { threadId, resourceId, previous: undefined, next: null })).toBe(true);
    expect(await writePlannerGenUIKey(pool, { threadId, resourceId, previous: undefined, next: marker })).toBe(false);
    expect(await writePlannerGenUIKey(pool, { threadId, resourceId, previous: null, next: marker })).toBe(true);
  });

  it("orders two independent Mastra instances and denies stale writes after deletion", async () => {
    const threadId = await make();
    const [a, b] = await Promise.all([pool.connect(), otherPool.connect()]);
    try {
      const first = await a.query("SELECT txid_current()::text AS seq");
      const second = await b.query("SELECT txid_current()::text AS seq");
      const older = first.rows[0].seq as string;
      const newer = second.rows[0].seq as string;
      expect(BigInt(newer)).toBeGreaterThan(BigInt(older));
      const newActivity = {
        ...activity,
        surfaceId: "comparison-2",
        operations: activity.operations.map((op) => {
          if ("createSurface" in op && op.createSurface) {
            return { ...op, createSurface: { ...op.createSurface, surfaceId: "comparison-2" } };
          }
          if ("updateComponents" in op && op.updateComponents) {
            return { ...op, updateComponents: { ...op.updateComponents, surfaceId: "comparison-2" } };
          }
          return op;
        }),
      };
      expect(await savePlannerGenUIActivity(otherMemory, {
        threadId, resourceId, runSequence: newer, activity: newActivity,
      }, { pool: otherPool })).toBe(true);
      expect(await savePlannerGenUIActivity(memory, {
        threadId, resourceId, runSequence: older, activity,
      }, { pool })).toBe(false);
      expect(await savePlannerGenUIActivity(memory, {
        threadId, resourceId: "org:another::user:other", runSequence: newer, activity,
      }, { pool })).toBe(false);
      expect(await savePlannerGenUIActivity(otherMemory, {
        threadId, resourceId, runSequence: newer, activity: null, surfaceId: "comparison-2",
      }, { pool: otherPool })).toBe(true);
      expect(await savePlannerGenUIActivity(memory, {
        threadId, resourceId, runSequence: older, activity,
      }, { pool })).toBe(false);
      expect((await recallPlannerHistory(otherMemory, { threadId, resourceId })).genui).toBeNull();
    } finally {
      a.release();
      b.release();
    }
  });

  it("keeps run retries idempotent while allowing a newer run to intentionally revert", async () => {
    const threadId = await make();
    const delta = (text: string, seq: string) => ({
      threadId, resourceId, runSequence: seq,
      update: { surfaceId: "comparison-1", operations: [
        { version: "1.0" as const, updateDataModel: {
          surfaceId: "comparison-1", path: "/data", value: { text },
        } },
      ] },
    });
    expect(await savePlannerGenUIActivity(memory, delta("Studio", "501"), { pool })).toBe(true);
    expect(await savePlannerGenUIActivity(otherMemory, delta("Outdoor", "502"), { pool: otherPool })).toBe(true);
    expect(await savePlannerGenUIActivity(memory, delta("Studio", "501"), { pool })).toBe(true);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui?.operations).toHaveLength(4);
    expect(await savePlannerGenUIActivity(otherMemory, delta("Studio", "503"), { pool: otherPool })).toBe(true);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui?.operations).toHaveLength(5);
  });

  it("requires the installed guard and rejects an unauthorized direct SQL write", async () => {
    const threadId = await make();
    const before = await pool.query('SELECT metadata FROM mastra.mastra_threads WHERE id=$1', [threadId]);
    const denied = await writePlannerGenUIKey(pool, {
      threadId, resourceId: "org:foreign::user:other",
      previous: before.rows[0].metadata.ipixGenUI,
      next: { deleted: true, scopeKey: "workspace", reason: "delete" },
    });
    expect(denied).toBe(false);
    const after = await pool.query('SELECT metadata FROM mastra.mastra_threads WHERE id=$1', [threadId]);
    expect(after.rows[0].metadata).toEqual(before.rows[0].metadata);
  });

  it("uses truly independent PostgreSQL connections", async () => {
    const [one, two] = await Promise.all([pool.connect(), pool.connect()]);
    try {
      const [a, b] = await Promise.all([
        one.query("SELECT pg_backend_pid() AS pid"),
        two.query("SELECT pg_backend_pid() AS pid"),
      ]);
      expect(a.rows[0].pid).not.toBe(b.rows[0].pid);
    } finally {
      one.release();
      two.release();
    }
  });

  it("keeps both keys when Mastra updateThread writes after GenUI", async () => {
    const threadId = await make();
    expect(await update(threadId, "studio")).toBe(true);
    await memory.updateThread({
      id: threadId,
      metadata: { mastraScratch: { progress: "done" } },
    });
    const row = await pool.query('SELECT metadata FROM mastra.mastra_threads WHERE id=$1', [threadId]);
    expect(row.rows[0].metadata.mastraScratch).toEqual({ progress: "done" });
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui?.operations).toHaveLength(3);
  });

  it("rejects a foreign writer, deduplicates a repeated delta and prevents deleted-card deltas", async () => {
    const threadId = await make();
    const denied = await savePlannerGenUIActivity(memory, {
      threadId, resourceId: "org:foreign::user:other",
      update: { surfaceId: "comparison-1", operations: [{
        version: "1.0", updateDataModel: { surfaceId: "comparison-1", path: "/data", value: { text: "bad" } },
      }] },
    }, { pool });
    expect(denied).toBe(false);
    expect(await update(threadId, "studio")).toBe(true);
    expect(await update(threadId, "studio")).toBe(true);
    expect((await recallPlannerHistory(memory, { threadId, resourceId })).genui?.operations).toHaveLength(3);
    expect(await savePlannerGenUIActivity(memory, {
      threadId, resourceId, activity: null, surfaceId: "comparison-1", reason: "delete",
    }, { pool })).toBe(true);
    expect(await update(threadId, "later")).toBe(false);
    const restored = await recallPlannerHistory(memory, { threadId, resourceId });
    expect(restored.genui).toBeNull();
    expect(restored.genuiRecovery).toBeUndefined(); // intentional deletion is not an error
  });

  it("does not let Mastra's stale whole-metadata writer erase a newer GenUI change", async () => {
    const threadId = await make();
    const stale = await pool.query('SELECT metadata FROM mastra.mastra_threads WHERE id=$1',[threadId]);
    expect(await update(threadId,"studio")).toBe(true);
    // Reproduce the exact whole-column UPDATE semantics used by @mastra/pg updateThread().
    await pool.query('UPDATE mastra.mastra_threads SET metadata = $1 WHERE id=$2',
      [{...stale.rows[0].metadata, unrelatedMastraKey:"kept"},threadId]);
    const saved = await recallPlannerHistory(memory,{threadId,resourceId});
    expect(saved.genui?.operations).toHaveLength(3);
    const row = await pool.query('SELECT metadata FROM mastra.mastra_threads WHERE id=$1',[threadId]);
    expect(row.rows[0].metadata.unrelatedMastraKey).toBe("kept");
  });
});
