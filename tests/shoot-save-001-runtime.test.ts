import { describe, expect, it } from "vitest";

import { saveApprovedShoot } from "../src/lib/shoot/save-approved-shoot";

const APPROVAL_ID = "10000000-0000-4000-8000-000000000001";
const SHOOT_ID = "20000000-0000-4000-8000-000000000001";

describe("IPI-1083 · saveApprovedShoot application boundary", () => {
  it("sends only the approval locator to the authoritative RPC", async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const result = await saveApprovedShoot(APPROVAL_ID, {
      rpc: async (name, args) => {
        calls.push([name, args]);
        return { data: { ok: true, shootId: SHOOT_ID, replayed: false }, error: null };
      },
    });

    expect(calls).toEqual([["save_approved_shoot", { p_approval_id: APPROVAL_ID }]]);
    expect(result).toEqual({ ok: true, shootId: SHOOT_ID, replayed: false });
  });

  it("preserves typed database denials without inventing fallback writes", async () => {
    const result = await saveApprovedShoot(APPROVAL_ID, {
      rpc: async () => ({ data: { ok: false, code: "SUPERSEDED_REVISION" }, error: null }),
    });
    expect(result).toEqual({ ok: false, code: "SUPERSEDED_REVISION" });
  });
});
