import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import { writePlannerGenUIKey } from "../src/mastra/planner-genui-atomic-save";

const request = {
  threadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  resourceId: "org:a::user:a",
  previous: undefined,
  next: { deleted: true, scopeKey: "workspace", reason: "rejected" },
};

function mockPool(guard: boolean, update?: () => Promise<unknown>) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM pg_trigger")) return { rows: [{ enabled: guard }] };
    if (sql.includes("UPDATE mastra.mastra_threads")) {
      if (update) return update();
      return { rowCount: 1 };
    }
    return {};
  });
  const release = vi.fn();
  const connect = vi.fn().mockResolvedValue({ query, release });
  return { pool: { connect } as unknown as Pick<Pool, "connect">, query, release };
}

describe("IPI-1449 owned-thread atomic save failure handling", () => {
  it("refuses to write before the guard migration is deployed", async () => {
    const { pool, query, release } = mockPool(false);
    await expect(writePlannerGenUIKey(pool, request)).rejects.toThrow(
      "planner.genui.atomic_guard_unavailable",
    );
    expect(query.mock.calls.map((args) => args[0])).toContain("ROLLBACK");
    expect(query.mock.calls.some((args) => args[0].includes("UPDATE mastra.mastra_threads"))).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });

  it("returns false on a CAS conflict rather than claiming durability", async () => {
    const { pool, query, release } = mockPool(true, async () => ({ rowCount: 0 }));
    expect(await writePlannerGenUIKey(pool, request)).toBe(false);
    expect(query.mock.calls.map((args) => args[0])).toContain("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back and releases its connection when the database rejects the update", async () => {
    const { pool, query, release } = mockPool(true, async () => { throw new Error("DB offline"); });
    await expect(writePlannerGenUIKey(pool, request)).rejects.toThrow("DB offline");
    expect(query.mock.calls.map((args) => args[0])).toContain("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });
});
