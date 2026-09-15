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

vi.mock("../src/lib/auth/copilot-hooks", () => ({
  getVerifiedOperatorForRequest: authMocks.getVerifiedOperatorForRequest,
}));

vi.mock("../src/lib/supabase/server", () => ({
  createClientFromRequest: authMocks.createClientFromRequest,
}));

import { GET } from "../src/app/api/assets/[assetId]/preview/route";
import { getAuthorizedAssetPreview } from "../src/lib/cloudinary/get-authorized-asset-preview";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "11111111-1111-4111-8111-111111111111";
const ASSET_A = "c5901612-7aae-4752-a536-b31eb0674220";
const CLD_ID = "6fe8132caaeec0dcf43fd1560235df42";

const OLD_APPROVED_VERSION = 1789262790;
const CURRENT_VERSION = 1789450692;

type ApprovalRow = {
  assetId: string;
  cloudinaryAssetId: string | null;
  version: number;
  kind: string;
};

type EventsBuilder = {
  select: (columns: string) => EventsBuilder;
  eq: (column: string, value: string | number) => EventsBuilder;
  limit: (
    count: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
};

afterEach(() => {
  urlMock.mockClear();
  authMocks.getVerifiedOperatorForRequest.mockReset();
  authMocks.createClientFromRequest.mockReset();
});

function mockSupabase(options: {
  orgIds: string[];
  asset?: { orgId: string } | null;
  mirror?: {
    publicId?: string;
    version?: number | null;
    deliveryType?: string;
    resourceType?: string;
    format?: string;
    cloudinaryAssetId?: string | null;
  } | null;
  approvals?: ApprovalRow[];
  eventsError?: boolean;
  onEventsQuery?: () => void;
}) {
  return {
    from: (table: string) => {
      if (table === "org_members") {
        return {
          select: () => ({
            eq: async () => ({
              data: options.orgIds.map((org_id) => ({ org_id })),
              error: null,
            }),
          }),
        };
      }
      if (table === "assets") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                if (!options.asset) return { data: null, error: null };
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
                if (!options.mirror) return { data: null, error: null };
                return {
                  data: {
                    public_id: options.mirror.publicId ?? "folder/shot",
                    version: options.mirror.version ?? CURRENT_VERSION,
                    delivery_type: options.mirror.deliveryType ?? "authenticated",
                    resource_type: options.mirror.resourceType ?? "image",
                    format: options.mirror.format ?? "jpg",
                    cloudinary_asset_id:
                      options.mirror.cloudinaryAssetId === undefined
                        ? CLD_ID
                        : options.mirror.cloudinaryAssetId,
                  },
                  error: null,
                };
              },
            }),
          }),
        };
      }
      if (table === "asset_events") {
        const filters: Record<string, string | number> = {};
        const builder: EventsBuilder = {
          select: () => builder,
          eq: (column, value) => {
            filters[column] = value;
            return builder;
          },
          limit: async () => {
            options.onEventsQuery?.();
            if (options.eventsError) {
              return { data: null, error: { message: "db" } };
            }
            const data = (options.approvals ?? [])
              .filter(
                (row) =>
                  row.assetId === filters["asset_id"] &&
                  row.cloudinaryAssetId === filters["cloudinary_asset_id"] &&
                  row.version === filters["version"] &&
                  row.kind === filters["kind"],
              )
              .map((_, index) => ({ id: `ev-${index}` }));
            return { data, error: null };
          },
        };
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

const approvedOld: ApprovalRow = {
  assetId: ASSET_A,
  cloudinaryAssetId: CLD_ID,
  version: OLD_APPROVED_VERSION,
  kind: "approved",
};

function call(input: {
  preview?: unknown;
  intent?: unknown;
  version?: unknown;
  supabase: ReturnType<typeof mockSupabase>;
}) {
  return getAuthorizedAssetPreview({
    assetId: ASSET_A,
    preview: input.preview ?? "masonry",
    intent: input.intent,
    version: input.version,
    operator: { id: USER_A, name: "a" },
    supabase: input.supabase as never,
  });
}

describe("MEDIA-DELIVERY-001 — exact-version approval guard", () => {
  it("allows the exact approved current version", async () => {
    const result = await call({
      intent: "delivery",
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: { version: OLD_APPROVED_VERSION },
        approvals: [approvedOld],
      }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.approved).toBe(true);
    expect(result.intent).toBe("delivery");
    expect(result.version).toBe(OLD_APPROVED_VERSION);
    expect(result.url).toContain("/v" + OLD_APPROVED_VERSION + "/");
    expect(result.url).toContain("s--TESTSIG--");
  });

  it("denies a pending/unapproved exact version", async () => {
    const result = await call({
      intent: "delivery",
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: { version: CURRENT_VERSION },
        approvals: [approvedOld],
      }),
    });
    expect(result).toEqual({ ok: false, reason: "version_not_approved" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("denies a rejected exact version", async () => {
    const result = await call({
      intent: "delivery",
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: { version: CURRENT_VERSION },
        approvals: [
          { ...approvedOld, version: CURRENT_VERSION, kind: "rejected" },
        ],
      }),
    });
    expect(result).toEqual({ ok: false, reason: "version_not_approved" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("denies a requested version that has no approval", async () => {
    const result = await call({
      intent: "delivery",
      version: 1789300000,
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: { version: CURRENT_VERSION },
        approvals: [approvedOld],
      }),
    });
    expect(result).toEqual({ ok: false, reason: "version_not_approved" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("never lets a newer version inherit an older approved event", async () => {
    const result = await call({
      intent: "delivery",
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: { version: CURRENT_VERSION },
        approvals: [approvedOld],
      }),
    });
    expect(result).toEqual({ ok: false, reason: "version_not_approved" });
  });

  it("serves the approved historical version while the newer one stays denied", async () => {
    const supabase = mockSupabase({
      orgIds: [ORG_A],
      asset: { orgId: ORG_A },
      mirror: { version: CURRENT_VERSION },
      approvals: [approvedOld],
    });
    const allowed = await call({
      intent: "delivery",
      version: OLD_APPROVED_VERSION,
      supabase,
    });
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.version).toBe(OLD_APPROVED_VERSION);
    expect(allowed.currentVersion).toBe(CURRENT_VERSION);
    expect(allowed.url).toContain("/v" + OLD_APPROVED_VERSION + "/");
    expect(allowed.url).not.toContain("/v" + CURRENT_VERSION + "/");

    const denied = await call({ intent: "delivery", supabase });
    expect(denied).toEqual({ ok: false, reason: "version_not_approved" });
  });

  it("denies foreign-org assets even when an approval row exists", async () => {
    const onEventsQuery = vi.fn();
    const result = await call({
      intent: "delivery",
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_B },
        mirror: { version: OLD_APPROVED_VERSION },
        approvals: [approvedOld],
        onEventsQuery,
      }),
    });
    expect(result).toEqual({ ok: false, reason: "foreign_org" });
    expect(urlMock).not.toHaveBeenCalled();
    expect(onEventsQuery).not.toHaveBeenCalled();
  });

  it("denies delivery when the mirror has no immutable provider asset id", async () => {
    const result = await call({
      intent: "delivery",
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: { version: OLD_APPROVED_VERSION, cloudinaryAssetId: null },
        approvals: [approvedOld],
      }),
    });
    expect(result).toEqual({
      ok: false,
      reason: "missing_cloudinary_asset_id",
    });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("fails closed when the approval lookup errors", async () => {
    const result = await call({
      intent: "delivery",
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: { version: OLD_APPROVED_VERSION },
        eventsError: true,
      }),
    });
    expect(result).toEqual({ ok: false, reason: "lookup_failed" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("does not require approval for the default preview intent (review stays possible)", async () => {
    const onEventsQuery = vi.fn();
    const result = await call({
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: { version: CURRENT_VERSION },
        approvals: [approvedOld],
        onEventsQuery,
      }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.approved).toBe(false);
    expect(result.intent).toBe("preview");
    expect(result.url).toContain("/v" + CURRENT_VERSION + "/");
    expect(onEventsQuery).not.toHaveBeenCalled();
  });

  it("serves an explicit historical version for preview without requiring approval", async () => {
    const onEventsQuery = vi.fn();
    const result = await call({
      intent: "preview",
      version: OLD_APPROVED_VERSION,
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: { version: CURRENT_VERSION },
        approvals: [approvedOld],
        onEventsQuery,
      }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.approved).toBe(false);
    expect(result.intent).toBe("preview");
    expect(result.version).toBe(OLD_APPROVED_VERSION);
    expect(result.url).toContain("/v" + OLD_APPROVED_VERSION + "/");
    expect(result.url).not.toContain("/v" + CURRENT_VERSION + "/");
    expect(onEventsQuery).not.toHaveBeenCalled();
  });

  it("rejects a request for a version newer than the mirror", async () => {
    const result = await call({
      intent: "delivery",
      version: CURRENT_VERSION + 1,
      supabase: mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: { version: CURRENT_VERSION },
        approvals: [approvedOld],
      }),
    });
    expect(result).toEqual({ ok: false, reason: "invalid_requested_version" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("rejects malformed requested versions and unknown intents", async () => {
    const supabase = mockSupabase({
      orgIds: [ORG_A],
      asset: { orgId: ORG_A },
      mirror: { version: CURRENT_VERSION },
      approvals: [approvedOld],
    });
    for (const bad of [
      "0",
      "-3",
      "abc",
      "1.5",
      "0x10",
      "1e3",
      " ",
      "",
      "000123",
      String(Number.MAX_SAFE_INTEGER + 2),
    ]) {
      expect(await call({ intent: "delivery", version: bad, supabase })).toEqual({
        ok: false,
        reason: "invalid_requested_version",
      });
    }
    expect(await call({ intent: "ransom", supabase })).toEqual({
      ok: false,
      reason: "unsupported_intent",
    });
    expect(urlMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/assets/[assetId]/preview — delivery intent", () => {
  function deliveryRequest(
    assetId: string,
    params: { preview?: string; intent?: string; version?: number | string },
  ) {
    const qs = new URLSearchParams();
    qs.set("preview", params.preview ?? "masonry");
    if (params.intent) qs.set("intent", params.intent);
    if (params.version !== undefined) qs.set("version", String(params.version));
    return new Request(
      `http://localhost/api/assets/${assetId}/preview?${qs.toString()}`,
    );
  }

  it("returns 401 for anonymous delivery", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue(null);
    const res = await GET(
      deliveryRequest(ASSET_A, { intent: "delivery" }),
      { params: Promise.resolve({ assetId: ASSET_A }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 with version_not_approved for a pending version", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue({
      id: USER_A,
      name: "a",
    });
    authMocks.createClientFromRequest.mockReturnValue(
      mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: { version: CURRENT_VERSION },
        approvals: [approvedOld],
      }),
    );
    const res = await GET(
      deliveryRequest(ASSET_A, { intent: "delivery" }),
      { params: Promise.resolve({ assetId: ASSET_A }) },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: "forbidden",
      reason: "version_not_approved",
    });
  });

  it("returns 200 for the exact approved version and 400 for a bad intent", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue({
      id: USER_A,
      name: "a",
    });
    authMocks.createClientFromRequest.mockReturnValue(
      mockSupabase({
        orgIds: [ORG_A],
        asset: { orgId: ORG_A },
        mirror: { version: CURRENT_VERSION },
        approvals: [approvedOld],
      }),
    );
    const okRes = await GET(
      deliveryRequest(ASSET_A, {
        intent: "delivery",
        version: OLD_APPROVED_VERSION,
      }),
      { params: Promise.resolve({ assetId: ASSET_A }) },
    );
    expect(okRes.status).toBe(200);
    const body = await okRes.json();
    expect(body.approved).toBe(true);
    expect(body.intent).toBe("delivery");
    expect(body.version).toBe(OLD_APPROVED_VERSION);
    expect(body.url).toContain("/v" + OLD_APPROVED_VERSION + "/");

    const badRes = await GET(
      deliveryRequest(ASSET_A, { intent: "hero" }),
      { params: Promise.resolve({ assetId: ASSET_A }) },
    );
    expect(badRes.status).toBe(400);
    expect(await badRes.json()).toMatchObject({
      error: "bad_request",
      reason: "unsupported_intent",
    });
  });
});
