import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { urlMock } = vi.hoisted(() => ({
  urlMock: vi.fn(
    (
      publicId: string,
      opts: {
        type?: string;
        version?: number;
        sign_url?: boolean;
        transformation?: { transformation: string }[];
        format?: string;
        resource_type?: string;
      },
    ) => {
      const named = opts.transformation?.[0]?.transformation ?? "";
      const sig = opts.sign_url ? "s--TESTSIG--" : "UNSIGNED";
      const fmt = opts.format ? `.${opts.format}` : "";
      return `https://res.cloudinary.com/ipix-cloudinary/${opts.resource_type}/${opts.type}/${sig}/t_${named}/v${opts.version}/${publicId}${fmt}`;
    },
  ),
}));

vi.mock("../src/lib/cloudinary/config", () => ({
  cloudinary: {
    url: urlMock,
    config: vi.fn(),
  },
}));

const authMocks = vi.hoisted(() => ({
  getVerifiedOperatorForRequest: vi.fn(),
  createClientFromRequest: vi.fn(),
}));

vi.mock("../src/lib/auth/operator-auth", () => ({
  getVerifiedOperatorForRequest: authMocks.getVerifiedOperatorForRequest,
}));

vi.mock("../src/lib/supabase/server", () => ({
  createClientFromRequest: authMocks.createClientFromRequest,
}));

import { GET } from "../src/app/api/assets/[assetId]/preview/route";
import {
  getAuthorizedAssetPreview,
  isUuid,
} from "../src/lib/cloudinary/get-authorized-asset-preview";
import {
  ASSET_PREVIEW_KINDS,
  PREVIEW_NAMED_TRANSFORMS,
  SIGNED_UPLOAD_PRESET,
  isAssetPreviewKind,
  namedTransformForPreview,
} from "../src/lib/cloudinary/preview-contract";
import { signExactVersionPreviewUrl } from "../src/lib/cloudinary/sign-delivery-url";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "11111111-1111-4111-8111-111111111111";
const ASSET_A = "c5901612-7aae-4752-a536-b31eb0674220";

afterEach(() => {
  urlMock.mockClear();
  authMocks.getVerifiedOperatorForRequest.mockReset();
  authMocks.createClientFromRequest.mockReset();
});

describe("preview-contract", () => {
  it("allowlists masonry/review/detail → SDK names without t_ (URL uses t_)", () => {
    expect(ASSET_PREVIEW_KINDS).toEqual(["masonry", "review", "detail"]);
    expect(namedTransformForPreview("masonry")).toBe("asset-masonry");
    expect(namedTransformForPreview("review")).toBe("asset-review");
    expect(namedTransformForPreview("detail")).toBe("asset-detail");
    expect(isAssetPreviewKind("masonry")).toBe(true);
    expect(isAssetPreviewKind("hero")).toBe(false);
    expect(SIGNED_UPLOAD_PRESET).toBe("ipix-signed-upload");
    for (const name of Object.values(PREVIEW_NAMED_TRANSFORMS)) {
      expect(name.startsWith("t_")).toBe(false);
    }
  });
});

describe("signExactVersionPreviewUrl", () => {
  it("signs authenticated named transform with exact version", () => {
    const url = signExactVersionPreviewUrl({
      publicId: "folder/shot",
      version: 7,
      preview: "masonry",
      format: "jpg",
    });
    expect(url).toContain("/image/authenticated/s--TESTSIG--/");
    expect(url).toContain("/t_asset-masonry/");
    expect(url).toContain("/v7/");
    expect(url).toContain("folder/shot.jpg");
    expect(urlMock).toHaveBeenCalledWith(
      "folder/shot",
      expect.objectContaining({
        resource_type: "image",
        type: "authenticated",
        version: 7,
        sign_url: true,
        transformation: [{ transformation: "asset-masonry" }],
      }),
    );
  });

  it("keeps exact version when signing", () => {
    const url = signExactVersionPreviewUrl({
      publicId: "folder/shot",
      version: 7,
      preview: "detail",
    });
    expect(url).toContain("/v7/");
    expect(url).not.toContain("/v8/");
  });
});

describe("getAuthorizedAssetPreview", () => {
  function mockSupabase(options: {
    orgIds: string[];
    membershipError?: boolean;
    asset?: { orgId: string } | null;
    assetError?: boolean;
    mirror?: {
      publicId: string;
      version: number | null;
      deliveryType: string;
      resourceType?: string;
      format?: string;
      cloudinaryAssetId?: string;
      secureUrl?: string;
    } | null;
    mirrorError?: boolean;
  }) {
    return {
      from: (table: string) => {
        if (table === "org_members") {
          return {
            select: () => ({
              eq: async () => {
                if (options.membershipError) {
                  return { data: null, error: { message: "db" } };
                }
                return {
                  data: options.orgIds.map((org_id) => ({ org_id })),
                  error: null,
                };
              },
            }),
          };
        }
        if (table === "assets") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => {
                  if (options.assetError) {
                    return { data: null, error: { message: "db" } };
                  }
                  if (!options.asset) {
                    return { data: null, error: null };
                  }
                  return {
                    data: {
                      id: ASSET_A,
                      brands: { org_id: options.asset.orgId },
                    },
                    error: null,
                  };
                },
              }),
            }),
          };
        }
        if (table === "cloudinary_assets") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => {
                  if (options.mirrorError) {
                    return { data: null, error: { message: "db" } };
                  }
                  if (!options.mirror) {
                    return { data: null, error: null };
                  }
                  return {
                    data: {
                      public_id: options.mirror.publicId,
                      version: options.mirror.version,
                      delivery_type: options.mirror.deliveryType,
                      resource_type: options.mirror.resourceType ?? "image",
                      format: options.mirror.format ?? "png",
                      cloudinary_asset_id:
                        options.mirror.cloudinaryAssetId ?? "cld-1",
                      secure_url:
                        options.mirror.secureUrl ??
                        "https://res.cloudinary.com/ipix-cloudinary/image/authenticated/SHOULD_NOT_USE.png",
                    },
                    error: null,
                  };
                },
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
  }

  it("rejects unsupported preview before signing", async () => {
    const result = await getAuthorizedAssetPreview({
      assetId: ASSET_A,
      preview: "c_fill,w_999",
      operator: { id: USER_A, name: "a" },
      supabase: mockSupabase({ orgIds: [ORG_A] }) as never,
    });
    expect(result).toEqual({ ok: false, reason: "unsupported_preview" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("fail-closes multi-org without selection", async () => {
    const result = await getAuthorizedAssetPreview({
      assetId: ASSET_A,
      preview: "masonry",
      operator: { id: USER_A, name: "a" },
      supabase: mockSupabase({ orgIds: [ORG_A, ORG_B] }) as never,
    });
    expect(result).toEqual({ ok: false, reason: "needs_org_selection" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("rejects foreign-org assets before URL generation", async () => {
    const result = await getAuthorizedAssetPreview({
      assetId: ASSET_A,
      preview: "review",
      operator: { id: USER_A, name: "a" },
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_B },
        mirror: {
          publicId: "secret/b",
          version: 7,
          deliveryType: "authenticated",
        },
      }) as never,
    });
    expect(result).toEqual({ ok: false, reason: "foreign_org" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("returns missing_cloudinary_mirror when asset exists without mirror", async () => {
    const result = await getAuthorizedAssetPreview({
      assetId: ASSET_A,
      preview: "detail",
      operator: { id: USER_A, name: "a" },
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: null,
      }) as never,
    });
    expect(result).toEqual({ ok: false, reason: "missing_cloudinary_mirror" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("rejects video/raw resource types", async () => {
    const result = await getAuthorizedAssetPreview({
      assetId: ASSET_A,
      preview: "detail",
      operator: { id: USER_A, name: "a" },
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: {
          publicId: "folder/clip",
          version: 7,
          deliveryType: "authenticated",
          resourceType: "video",
        },
      }) as never,
    });
    expect(result).toEqual({ ok: false, reason: "unsupported_resource_type" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("rejects non-authenticated delivery type without flipping it", async () => {
    const result = await getAuthorizedAssetPreview({
      assetId: ASSET_A,
      preview: "detail",
      operator: { id: USER_A, name: "a" },
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: {
          publicId: "folder/shot",
          version: 7,
          deliveryType: "upload",
        },
      }) as never,
    });
    expect(result).toEqual({ ok: false, reason: "invalid_delivery_type" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("signs allowlisted preview for trusted org and ignores stored secure_url", async () => {
    const result = await getAuthorizedAssetPreview({
      assetId: ASSET_A,
      preview: "masonry",
      operator: { id: USER_A, name: "a" },
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: {
          publicId: "folder/shot",
          version: 7,
          deliveryType: "authenticated",
          secureUrl: "https://evil.example/SHOULD_NOT_USE",
        },
      }) as never,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toContain("s--TESTSIG--");
    expect(result.url).toContain("t_asset-masonry");
    expect(result.url).toContain("/v7/");
    expect(result.url).not.toContain("SHOULD_NOT_USE");
    expect(result.namedTransform).toBe("asset-masonry");
    expect(result.version).toBe(7);
  });

  it("validates uuid helper", () => {
    expect(isUuid(ASSET_A)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});

describe("GET /api/assets/[assetId]/preview", () => {
  function previewRequest(assetId: string, preview?: string | null) {
    const qs =
      preview === undefined
        ? "?preview=masonry"
        : preview === null
          ? ""
          : `?preview=${encodeURIComponent(preview)}`;
    return new Request(`http://localhost/api/assets/${assetId}/preview${qs}`);
  }

  function mockOkClient() {
    return {
      from: (table: string) => {
        if (table === "org_members") {
          return {
            select: () => ({
              eq: async () => ({
                data: [{ org_id: ORG_A }],
                error: null,
              }),
            }),
          };
        }
        if (table === "assets") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: ASSET_A, brands: { org_id: ORG_A } },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "cloudinary_assets") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    public_id: "folder/shot",
                    version: 7,
                    delivery_type: "authenticated",
                    resource_type: "image",
                    format: "jpg",
                    cloudinary_asset_id: "cld-1",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
  }

  it("returns 401 when unsigned", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue(null);
    const res = await GET(previewRequest(ASSET_A), {
      params: Promise.resolve({ assetId: ASSET_A }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for bad preview enum", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue({
      id: USER_A,
      name: "a",
    });
    authMocks.createClientFromRequest.mockReturnValue(mockOkClient());
    const res = await GET(previewRequest(ASSET_A, "hero"), {
      params: Promise.resolve({ assetId: ASSET_A }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "bad_request",
      reason: "unsupported_preview",
    });
  });

  it("returns 403 for foreign org", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue({
      id: USER_A,
      name: "a",
    });
    authMocks.createClientFromRequest.mockReturnValue({
      from: (table: string) => {
        if (table === "org_members") {
          return {
            select: () => ({
              eq: async () => ({
                data: [{ org_id: ORG_A }],
                error: null,
              }),
            }),
          };
        }
        if (table === "assets") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: ASSET_A, brands: { org_id: ORG_B } },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected ${table}`);
      },
    });
    const res = await GET(previewRequest(ASSET_A), {
      params: Promise.resolve({ assetId: ASSET_A }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: "forbidden",
      reason: "foreign_org",
    });
  });

  it("returns 404 when asset missing", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue({
      id: USER_A,
      name: "a",
    });
    authMocks.createClientFromRequest.mockReturnValue({
      from: (table: string) => {
        if (table === "org_members") {
          return {
            select: () => ({
              eq: async () => ({
                data: [{ org_id: ORG_A }],
                error: null,
              }),
            }),
          };
        }
        if (table === "assets") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected ${table}`);
      },
    });
    const res = await GET(previewRequest(ASSET_A), {
      params: Promise.resolve({ assetId: ASSET_A }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 for invalid delivery_type (data integrity)", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue({
      id: USER_A,
      name: "a",
    });
    authMocks.createClientFromRequest.mockReturnValue({
      from: (table: string) => {
        if (table === "org_members") {
          return {
            select: () => ({
              eq: async () => ({
                data: [{ org_id: ORG_A }],
                error: null,
              }),
            }),
          };
        }
        if (table === "assets") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: ASSET_A, brands: { org_id: ORG_A } },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "cloudinary_assets") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    public_id: "folder/shot",
                    version: 7,
                    delivery_type: "upload",
                    resource_type: "image",
                    format: "jpg",
                    cloudinary_asset_id: "cld-1",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected ${table}`);
      },
    });
    const res = await GET(previewRequest(ASSET_A), {
      params: Promise.resolve({ assetId: ASSET_A }),
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "conflict",
      reason: "invalid_delivery_type",
    });
  });

  it("returns 200 with signed url for trusted org", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue({
      id: USER_A,
      name: "a",
    });
    authMocks.createClientFromRequest.mockReturnValue(mockOkClient());
    const res = await GET(previewRequest(ASSET_A), {
      params: Promise.resolve({ assetId: ASSET_A }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain("s--TESTSIG--");
    expect(body.namedTransform).toBe("asset-masonry");
    expect(body.version).toBe(7);
  });
});
