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

/** Mimics `.from("assets").select("id, v2_shoot_id").in("v2_shoot_id", …).order(…)`. */
function fakeAssetsSupabase(
  rows: { id: string; v2_shoot_id: string | null }[],
  opts?: { error?: unknown; inCalls?: unknown[][]; orderCalls?: OrderCall[] },
) {
  const fake = {
    from(table: string) {
      expect(table).toBe("assets");
      return {
        select(columns: string) {
          expect(columns).toBe("id, v2_shoot_id");
          return {
            in(column: string, values: string[]) {
              expect(column).toBe("v2_shoot_id");
              opts?.inCalls?.push(values);
              return {
                order(column: string, orderOpts: { ascending: boolean }) {
                  opts?.orderCalls?.push({ column, opts: orderOpts });
                  return Promise.resolve(
                    opts?.error
                      ? { data: null, error: opts.error }
                      : { data: rows, error: null },
                  );
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
    const supabase = fakeAssetsSupabase([]);
    const result = await loadRecentWorkPreviews(supabase, OPERATOR, []);
    expect(result.size).toBe(0);
    expect(previewMock.getAuthorizedAssetPreview).not.toHaveBeenCalled();
  });

  it("picks the most-recently-created asset per shoot and signs it via the real preview helper", async () => {
    const orderCalls: OrderCall[] = [];
    // Query already returns created_at DESC — ASSET_NEW must win over ASSET_OLD.
    const supabase = fakeAssetsSupabase(
      [
        { id: ASSET_NEW, v2_shoot_id: SHOOT_1 },
        { id: ASSET_OLD, v2_shoot_id: SHOOT_1 },
      ],
      { orderCalls },
    );
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

  it("omits a shoot from the result when its candidate fails authorization/signing", async () => {
    const supabase = fakeAssetsSupabase([{ id: ASSET_NEW, v2_shoot_id: SHOOT_1 }]);
    previewMock.getAuthorizedAssetPreview.mockResolvedValue({
      ok: false,
      reason: "missing_cloudinary_mirror",
    });

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);

    expect(result.has(SHOOT_1)).toBe(false);
    expect(result.size).toBe(0);
  });

  it("resolves each shoot independently — one failure doesn't drop another shoot's real preview", async () => {
    const supabase = fakeAssetsSupabase([
      { id: ASSET_NEW, v2_shoot_id: SHOOT_1 },
      { id: ASSET_OLD, v2_shoot_id: SHOOT_2 },
    ]);
    previewMock.getAuthorizedAssetPreview.mockImplementation(async ({ assetId }) => {
      if (assetId === ASSET_NEW) {
        return { ok: true, url: "https://res.cloudinary.com/signed/shoot-1" };
      }
      return { ok: false, reason: "asset_not_found" };
    });

    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1, SHOOT_2]);

    expect(result.get(SHOOT_1)).toBe("https://res.cloudinary.com/signed/shoot-1");
    expect(result.has(SHOOT_2)).toBe(false);
  });

  it("returns an empty map (not a throw) when the candidate query fails", async () => {
    const supabase = fakeAssetsSupabase([], { error: { message: "boom" } });
    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);
    expect(result.size).toBe(0);
    expect(previewMock.getAuthorizedAssetPreview).not.toHaveBeenCalled();
  });

  it("ignores a candidate row with a null v2_shoot_id rather than crashing", async () => {
    const supabase = fakeAssetsSupabase([{ id: ASSET_NEW, v2_shoot_id: null }]);
    const result = await loadRecentWorkPreviews(supabase, OPERATOR, [SHOOT_1]);
    expect(result.size).toBe(0);
    expect(previewMock.getAuthorizedAssetPreview).not.toHaveBeenCalled();
  });
});
