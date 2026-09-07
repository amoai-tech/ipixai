import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VerifiedOperator } from "@/lib/auth/verified-operator";

const previewMock = vi.hoisted(() => ({
  getAuthorizedAssetPreview: vi.fn(),
}));

vi.mock("@/lib/cloudinary/get-authorized-asset-preview", () => ({
  getAuthorizedAssetPreview: previewMock.getAuthorizedAssetPreview,
}));

// Imported after the mock so recent-work-media.ts picks up the mocked helper.
const { loadRecentWorkPreviews } = await import("@/lib/dashboard/recent-work-media");

const OPERATOR: VerifiedOperator = { id: "user-1", name: "Test Operator" };
const SHOOT_1 = "eeeeeeee-0000-4000-8000-000000000001";
const SHOOT_2 = "eeeeeeee-0000-4000-8000-000000000002";
const ASSET_NEWEST = "aaaaaaaa-1111-4111-8111-111111111111";
const ASSET_MIDDLE = "aaaaaaaa-2222-4222-8222-222222222222";
const ASSET_OLDEST = "aaaaaaaa-3333-4333-8333-333333333333";

type OrderCall = { column: string; opts: { ascending: boolean } };
type CandidateRow = { id: string };

/** Mimics `.from("assets").select("id").eq("v2_shoot_id", shootId)
 *  .order("created_at", …).order("id", …).limit(CANDIDATE_LIMIT)` — one
 *  independent, bounded query per shoot (not one combined `.in()` read, and
 *  not `.limit(1)`), chainable through both `.order()` calls (created_at
 *  desc, then id asc as the stable tie-breaker) before `.limit()`, so a fake
 *  per shootId returns its own ordered candidate list. */
function fakeAssetsSupabase(
  rowsByShootId: Record<string, CandidateRow[] | null>,
  opts?: { errorForShootId?: string; eqCalls?: string[]; orderCalls?: OrderCall[]; limitCalls?: number[] },
) {
  const orderBuilder = (shootId: string) => ({
    order(column: string, orderOpts: { ascending: boolean }) {
      opts?.orderCalls?.push({ column, opts: orderOpts });
      return orderBuilder(shootId);
    },
    limit(n: number) {
      opts?.limitCalls?.push(n);
      if (opts?.errorForShootId === shootId) {
        return Promise.resolve({ data: null, error: { message: "boom" } });
      }
      return Promise.resolve({
        data: rowsByShootId[shootId] ?? [],
        error: null,
      });
    },
  });
  const fake = {
    from(table: string) {
      expect(table).toBe("assets");
      return {
        select(columns: string) {
          expect(columns).toBe("id");
          return {
            eq(column: string, shootId: string) {
              expect(column).toBe("v2_shoot_id");
              opts?.eqCalls?.push(shootId);
              return orderBuilder(shootId);
            },
          };
        },
      };
    },
  };
  return fake as unknown as SupabaseClient;
}

afterEach(() => {
  previewMock.getAuthorizedAssetPreview.mockReset();
});

describe("loadRecentWorkPreviews", () => {
  it("returns an empty map without querying when there are no shoots", async () => {
    const eqCalls: string[] = [];
    const supabase = fakeAssetsSupabase({}, { eqCalls });
    const result = await loadRecentWorkPreviews(supabase, OPERATOR, []);
    expect(result.size).toBe(0);
    expect(eqCalls).toEqual([]);
    expect(previewMock.getAuthorizedAssetPreview).not.toHaveBeenCalled();
  });

  it("queries each shoot independently, newest-first, bounded (not .limit(1))", async () => {
    const orderCalls: OrderCall[] = [];
    const limitCalls: number[] = [];
    const supabase = fakeAssetsSupabase(
      { [SHOOT_1]: [{ id: ASSET_NEWEST }] },
      { orderCalls, limitCalls },
    );
    previewMock.getAuthorizedAssetPreview.mockResolvedValue({
      ok: true,
      url: "https://res.cloudinary.com/signed/shoot-1",
    });

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);

    expect(orderCalls).toEqual([
      { column: "created_at", opts: { ascending: false } },
      // Stable tie-breaker for assets sharing a created_at timestamp — same
      // contract as command-center.ts's own created_at-ordered reads.
      { column: "id", opts: { ascending: true } },
    ]);
    // Bounded (>1, so an older-valid fallback is possible), not unlimited.
    expect(limitCalls).toEqual([5]);
    expect(result.get(SHOOT_1)).toBe("https://res.cloudinary.com/signed/shoot-1");
  });

  it("newest candidate invalid, older candidate valid: falls back to the older asset's real preview", async () => {
    const supabase = fakeAssetsSupabase({
      [SHOOT_1]: [{ id: ASSET_NEWEST }, { id: ASSET_MIDDLE }],
    });
    previewMock.getAuthorizedAssetPreview.mockImplementation(async ({ assetId }) => {
      if (assetId === ASSET_NEWEST) {
        return { ok: false, reason: "missing_cloudinary_mirror" };
      }
      if (assetId === ASSET_MIDDLE) {
        return { ok: true, url: "https://res.cloudinary.com/signed/middle" };
      }
      throw new Error(`unexpected assetId ${assetId}`);
    });

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);

    expect(result.get(SHOOT_1)).toBe("https://res.cloudinary.com/signed/middle");
  });

  it("tries candidates newest-first and stops at the first success (does not authorize an older candidate once a newer one already passed)", async () => {
    const supabase = fakeAssetsSupabase({
      [SHOOT_1]: [{ id: ASSET_NEWEST }, { id: ASSET_MIDDLE }, { id: ASSET_OLDEST }],
    });
    const seen: string[] = [];
    previewMock.getAuthorizedAssetPreview.mockImplementation(async ({ assetId }) => {
      seen.push(assetId);
      if (assetId === ASSET_NEWEST) {
        return { ok: true, url: "https://res.cloudinary.com/signed/newest" };
      }
      return { ok: true, url: "https://res.cloudinary.com/signed/should-not-be-used" };
    });

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);

    expect(seen).toEqual([ASSET_NEWEST]);
    expect(result.get(SHOOT_1)).toBe("https://res.cloudinary.com/signed/newest");
  });

  it("all candidates invalid: no map entry (placeholder remains)", async () => {
    const supabase = fakeAssetsSupabase({
      [SHOOT_1]: [{ id: ASSET_NEWEST }, { id: ASSET_MIDDLE }, { id: ASSET_OLDEST }],
    });
    previewMock.getAuthorizedAssetPreview.mockResolvedValue({
      ok: false,
      reason: "missing_cloudinary_mirror",
    });

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);

    expect(result.has(SHOOT_1)).toBe(false);
    expect(previewMock.getAuthorizedAssetPreview).toHaveBeenCalledTimes(3);
  });

  it("omits a shoot from the result when it has no candidate assets at all", async () => {
    const supabase = fakeAssetsSupabase({ [SHOOT_1]: [] });
    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);
    expect(result.size).toBe(0);
    expect(previewMock.getAuthorizedAssetPreview).not.toHaveBeenCalled();
  });

  it("resolves each shoot independently — one shoot's candidate-query error doesn't drop another shoot's real preview", async () => {
    const supabase = fakeAssetsSupabase(
      { [SHOOT_1]: [{ id: ASSET_NEWEST }], [SHOOT_2]: [{ id: ASSET_OLDEST }] },
      { errorForShootId: SHOOT_2 },
    );
    previewMock.getAuthorizedAssetPreview.mockResolvedValue({
      ok: true,
      url: "https://res.cloudinary.com/signed/shoot-1",
    });

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1, SHOOT_2]);

    expect(result.get(SHOOT_1)).toBe("https://res.cloudinary.com/signed/shoot-1");
    expect(result.has(SHOOT_2)).toBe(false);
    expect(previewMock.getAuthorizedAssetPreview).toHaveBeenCalledTimes(1);
  });

  it("an unexpected throw from one candidate's preview call falls through to the next candidate", async () => {
    const supabase = fakeAssetsSupabase({
      [SHOOT_1]: [{ id: ASSET_NEWEST }, { id: ASSET_MIDDLE }],
    });
    previewMock.getAuthorizedAssetPreview.mockImplementation(async ({ assetId }) => {
      if (assetId === ASSET_NEWEST) {
        throw new Error("unexpected failure signing newest candidate");
      }
      return { ok: true, url: "https://res.cloudinary.com/signed/middle" };
    });

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);

    expect(result.get(SHOOT_1)).toBe("https://res.cloudinary.com/signed/middle");
  });

  it("resolves each shoot independently — one shoot's preview call throwing (even after exhausting candidates) doesn't drop another shoot's real preview", async () => {
    const supabase = fakeAssetsSupabase({
      [SHOOT_1]: [{ id: ASSET_NEWEST }],
      [SHOOT_2]: [{ id: ASSET_OLDEST }],
    });
    previewMock.getAuthorizedAssetPreview.mockImplementation(async ({ assetId }) => {
      if (assetId === ASSET_NEWEST) {
        return { ok: true, url: "https://res.cloudinary.com/signed/shoot-1" };
      }
      throw new Error("unexpected failure signing shoot-2's only candidate");
    });

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1, SHOOT_2]);

    expect(result.get(SHOOT_1)).toBe("https://res.cloudinary.com/signed/shoot-1");
    expect(result.has(SHOOT_2)).toBe(false);
  });

  it("does not throw and omits the shoot when its own candidate query throws", async () => {
    const supabase = {
      from(table: string) {
        expect(table).toBe("assets");
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      limit() {
                        throw new Error("connection reset");
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);
    expect(result.size).toBe(0);
    expect(previewMock.getAuthorizedAssetPreview).not.toHaveBeenCalled();
  });
});
