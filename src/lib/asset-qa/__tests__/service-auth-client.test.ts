import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serviceRpc: vi.fn(),
  authRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => createServiceClient(),
}));

vi.mock("../load-channel-specs", () => ({
  loadChannelSpecsForQA: vi.fn(async () => new Map()),
}));

vi.mock("@/lib/cloudinary/config", () => ({
  cloudinary: { api: { resource: vi.fn() } },
}));

function queryResult(data: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  return query;
}
function createServiceClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === "assets") {
        return queryResult({
          id: "asset-1",
          v2_shoot_id: "shoot-1",
          brand_id: "brand-1",
          metadata: {},
        });
      }
      if (table === "brands") return queryResult({ org_id: "org-1" });
      if (table === "cloudinary_assets") {
        return queryResult({
          public_id: "p",
          version: 1,
          delivery_type: "authenticated",
          resource_type: "image",
          format: "jpg",
          cloudinary_asset_id: "cld-1",
          width: 100,
          height: 100,
          bytes: 1000,
        });
      }
      throw new Error(`unexpected table: ${table}`);
    }),
    rpc: mocks.serviceRpc,
  };
}
describe("IPI-1138 authenticated shoot RPC boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.serviceRpc.mockRejectedValue(new Error("service-role RPC must not be used"));
    mocks.authRpc.mockResolvedValue({
      data: {
        shoot: { id: "shoot-1", target_channels: ["instagram_feed"], brand_id: "brand-1" },
        deliverables: [{
          id: "deliverable-1",
          channel: "instagram_feed",
          format: "1:1 JPG",
          aspect_ratio: "1:1",
          origin: "saved",
          quantity: 1,
          status: "planned",
        }],
      },
      error: null,
    });
  });

  it("uses the request-scoped authenticated client for get_shoot_detail, never service role", async () => {
    const { runAssetQA } = await import("../service");
    const authClient = { rpc: mocks.authRpc };

    const result = await runAssetQA({
      assetId: "asset-1",
      orgId: "org-1",
      authClient,
    } as never);

    expect(mocks.authRpc).toHaveBeenCalledWith("get_shoot_detail", { p_shoot_id: "shoot-1" });
    expect(mocks.serviceRpc).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });
});
