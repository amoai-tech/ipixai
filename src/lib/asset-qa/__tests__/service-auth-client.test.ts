import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serviceRpc: vi.fn(),
  authRpc: vi.fn(),
  loadSpecs: vi.fn(),
  resource: vi.fn(),
  resourceByAssetId: vi.fn(),
  mirror: {
    public_id: "p",
    version: 1,
    delivery_type: "authenticated",
    resource_type: "image",
    format: "jpg",
    cloudinary_asset_id: "cld-1",
    width: 1080,
    height: 1080,
    bytes: 1000,
  },
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => createServiceClient(),
}));

vi.mock("../load-channel-specs", () => ({
  loadChannelSpecsForQA: (...args: unknown[]) => mocks.loadSpecs(...args),
}));

vi.mock("@/lib/cloudinary/config", () => ({
  cloudinary: { api: { resource: mocks.resource, resource_by_asset_id: mocks.resourceByAssetId } },
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
        return queryResult({ id: "asset-1", v2_shoot_id: "shoot-1", brand_id: "brand-1", metadata: {} });
      }
      if (table === "brands") return queryResult({ org_id: "org-1" });
      if (table === "cloudinary_assets") return queryResult({ ...mocks.mirror });
      throw new Error(`unexpected table: ${table}`);
    }),
    rpc: mocks.serviceRpc,
  };
}

const canonicalSpec = {
  platformId: "instagram-id",
  platformSlug: "instagram",
  platformName: "Instagram",
  imageTypeId: "feed-id",
  imageTypeSlug: "feed_post",
  imageTypeName: "Feed Post",
  widthPx: 1080,
  heightPx: 1350,
  minWidthPx: 1080,
  minHeightPx: 1350,
  maxWidthPx: null,
  maxHeightPx: null,
  aspectRatioW: 4,
  aspectRatioH: 5,
  aspectRatioLabel: "4:5",
  acceptedFormats: ["JPG"],
  maxFileSizeMb: 8,
  recommendedColorMode: null,
  safeZoneTopPx: null,
  safeZoneBottomPx: null,
  safeZoneLeftPx: null,
  safeZoneRightPx: null,
  backgroundRequired: null,
  productFillMinPct: null,
  specConfidence: "official" as const,
  organic: true,
  paid: false,
  shoppingSupport: false,
  mobileNotes: null,
  desktopNotes: null,
  cropNotes: null,
  bestUseCases: null,
  sourceUrl: "https://example.com/spec",
  lastVerifiedAt: "2026-06-26T00:00:00Z",
};

function authenticatedClient() {
  return { rpc: mocks.authRpc };
}

describe("IPI-1138 service boundaries and precedence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.mirror, {
      public_id: "p", version: 1, delivery_type: "authenticated", resource_type: "image",
      format: "jpg", cloudinary_asset_id: "cld-1", width: 1080, height: 1080, bytes: 1000,
    });
    mocks.serviceRpc.mockRejectedValue(new Error("service-role RPC must not be used"));
    mocks.authRpc.mockResolvedValue({
      data: {
        shoot: { id: "shoot-1", target_channels: ["instagram_feed"], brand_id: "brand-1" },
        deliverables: [{ id: "deliverable-1", channel: "instagram_feed", format: "1:1 JPG", aspect_ratio: "1:1", origin: "saved", quantity: 1, status: "planned" }],
      },
      error: null,
    });
    mocks.loadSpecs.mockResolvedValue(new Map());
    mocks.resource.mockResolvedValue(undefined);
    mocks.resourceByAssetId.mockResolvedValue({
      asset_id: "cld-1", public_id: "p", version: 1, width: 1080, height: 1080,
      format: "jpg", bytes: 1000, resource_type: "image", type: "authenticated",
    });
  });

  it("uses the request-scoped authenticated client for get_shoot_detail, never service role", async () => {
    const { runAssetQA } = await import("../service");
    const result = await runAssetQA({ assetId: "asset-1", orgId: "org-1", authClient: authenticatedClient() } as never);
    expect(mocks.authRpc).toHaveBeenCalledWith("get_shoot_detail", { p_shoot_id: "shoot-1" });
    expect(mocks.serviceRpc).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("does not hard-fail 1080x1080 saved 1:1 deliverable because generic recommendation is 1080x1350 4:5", async () => {
    mocks.loadSpecs.mockResolvedValue(new Map([["instagram_feed", { status: "resolved", spec: canonicalSpec }]]));
    const { runAssetQA } = await import("../service");
    const result = await runAssetQA({ assetId: "asset-1", orgId: "org-1", authClient: authenticatedClient() } as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const channel = result.result.channels[0];
    expect(channel.findings.some((f) => f.code === "resolution_insufficient")).toBe(false);
    expect(channel.findings.some((f) => f.code === "aspect_ratio_mismatch")).toBe(false);
    expect(channel.overallStatus).not.toBe("fail");
  });

  it("uses immutable Cloudinary asset_id lookup and never public-id resource version guessing", async () => {
    mocks.loadSpecs.mockResolvedValue(new Map([["instagram_feed", { status: "resolved", spec: canonicalSpec }]]));
    mocks.resource.mockRejectedValue(new Error("public-id resource lookup must not be used"));
    const { runAssetQA } = await import("../service");
    const result = await runAssetQA({ assetId: "asset-1", orgId: "org-1", authClient: authenticatedClient() } as never);
    expect(result.ok).toBe(true);
    expect(mocks.resourceByAssetId).toHaveBeenCalledWith("cld-1", expect.objectContaining({ accessibility_analysis: true, phash: true }));
    expect(mocks.resource).not.toHaveBeenCalled();
  });

  it("surfaces ambiguous channel specs explicitly instead of running checks against a fake 0x0 spec", async () => {
    mocks.loadSpecs.mockResolvedValue(new Map([["instagram_feed", {
      status: "ambiguous",
      candidates: [{ platformSlug: "instagram", imageTypeSlug: "feed_post" }, { platformSlug: "instagram", imageTypeSlug: "story" }],
    }]]));
    const { runAssetQA } = await import("../service");
    const result = await runAssetQA({ assetId: "asset-1", orgId: "org-1", authClient: authenticatedClient() } as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.channels[0].findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "spec_ambiguous", status: "unknown" }),
    ]));
  });

  it("returns typed 503 when channel-spec infrastructure fails instead of pretending the spec is missing", async () => {
    mocks.loadSpecs.mockRejectedValue(new Error("database unavailable"));
    const { runAssetQA } = await import("../service");
    const result = await runAssetQA({ assetId: "asset-1", orgId: "org-1", authClient: authenticatedClient() } as never);
    expect(result).toEqual({ ok: false, reason: "qa_spec_service_unavailable", status: 503 });
  });
});
