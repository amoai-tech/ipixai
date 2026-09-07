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
const ASSET_NEW = "aaaaaaaa-1111-4111-8111-111111111111";
const ASSET_OLD = "aaaaaaaa-2222-4222-8222-222222222222";

type OrderCall = { column: string; opts: { ascending: boolean } };
type PerShootRow = { id: string } | null;

/** Mimics `.from("assets").select("id").eq("v2_shoot_id", shootId).order(…)
 *  .limit(1).maybeSingle()` — one independent query per shoot, not one
 *  combined `.in()` read, so a fake per shootId is required (a busy shoot's
 *  assets can never crowd out another displayed shoot's candidate here). */
function fakeAssetsSupabase(
  rowByShootId: Record<string, PerShootRow>,
  opts?: { errorForShootId?: string; eqCalls?: string[]; orderCalls?: OrderCall[] },
) {
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
              return {
                order(column: string, orderOpts: { ascending: boolean }) {
                  opts?.orderCalls?.push({ column, opts: orderOpts });
                  return {
                    limit(n: number) {
                      expect(n).toBe(1);
                      return {
                        maybeSingle() {
                          if (opts?.errorForShootId === shootId) {
                            return Promise.resolve({ data: null, error: { message: "boom" } });
                          }
                          return Promise.resolve({
                            data: rowByShootId[shootId] ?? null,
                            error: null,
                          });
                        },
                      };
                    },
                  };
                },
              };
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

  it("queries each shoot independently (own .eq/.limit(1), not a combined .in() read) and signs the candidate via getAuthorizedAssetPreview", async () => {
    const orderCalls: OrderCall[] = [];
    const supabase = fakeAssetsSupabase({ [SHOOT_1]: { id: ASSET_NEW } }, { orderCalls });
    previewMock.getAuthorizedAssetPreview.mockResolvedValue({
      ok: true,
      url: "https://res.cloudinary.com/signed/shoot-1",
    });

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);

    expect(orderCalls).toEqual([{ column: "created_at", opts: { ascending: false } }]);
    expect(previewMock.getAuthorizedAssetPreview).toHaveBeenCalledTimes(1);
    expect(previewMock.getAuthorizedAssetPreview).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: ASSET_NEW, preview: "masonry", operator: OPERATOR }),
    );
    expect(result.get(SHOOT_1)).toBe("https://res.cloudinary.com/signed/shoot-1");
  });

  it("omits a shoot from the result when it has no candidate asset", async () => {
    const supabase = fakeAssetsSupabase({ [SHOOT_1]: null });
    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);
    expect(result.size).toBe(0);
    expect(previewMock.getAuthorizedAssetPreview).not.toHaveBeenCalled();
  });

  it("omits a shoot from the result when its candidate fails authorization/signing", async () => {
    const supabase = fakeAssetsSupabase({ [SHOOT_1]: { id: ASSET_NEW } });
    previewMock.getAuthorizedAssetPreview.mockResolvedValue({
      ok: false,
      reason: "missing_cloudinary_mirror",
    });

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);

    expect(result.has(SHOOT_1)).toBe(false);
    expect(result.size).toBe(0);
  });

  it("resolves each shoot independently — one shoot's candidate-query error doesn't drop another shoot's real preview", async () => {
    const supabase = fakeAssetsSupabase(
      { [SHOOT_1]: { id: ASSET_NEW }, [SHOOT_2]: { id: ASSET_OLD } },
      { errorForShootId: SHOOT_2 },
    );
    previewMock.getAuthorizedAssetPreview.mockResolvedValue({
      ok: true,
      url: "https://res.cloudinary.com/signed/shoot-1",
    });

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1, SHOOT_2]);

    expect(result.get(SHOOT_1)).toBe("https://res.cloudinary.com/signed/shoot-1");
    expect(result.has(SHOOT_2)).toBe(false);
    // Only the shoot with a real candidate reaches the signing helper.
    expect(previewMock.getAuthorizedAssetPreview).toHaveBeenCalledTimes(1);
  });

  it("resolves each shoot independently — one shoot's preview call rejecting doesn't drop another shoot's real preview", async () => {
    // The real regression this guards: a shared Promise.all over every
    // shoot's getAuthorizedAssetPreview call means one unexpected throw
    // (not just an {ok:false} result) rejects the whole batch and blanks
    // every other shoot's already-succeeding preview. Each shoot's own
    // try/catch must contain that.
    const supabase = fakeAssetsSupabase({
      [SHOOT_1]: { id: ASSET_NEW },
      [SHOOT_2]: { id: ASSET_OLD },
    });
    previewMock.getAuthorizedAssetPreview.mockImplementation(async ({ assetId }) => {
      if (assetId === ASSET_NEW) {
        return { ok: true, url: "https://res.cloudinary.com/signed/shoot-1" };
      }
      throw new Error("unexpected failure signing shoot-2's candidate");
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
                        return {
                          maybeSingle() {
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
        };
      },
    } as unknown as SupabaseClient;

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);
    expect(result.size).toBe(0);
    expect(previewMock.getAuthorizedAssetPreview).not.toHaveBeenCalled();
  });
});
