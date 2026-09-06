import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACME_ORG = "00000000-0000-0000-0000-000000000001";
const BRAND = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ASSET = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SHOOT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PROVIDER = "provider-asset-111";
const PROVIDER_B = "provider-asset-222";

function signBody(body: string, timestamp: number, secret: string): string {
  return createHash("sha1")
    .update(body + String(timestamp) + secret)
    .digest("hex");
}

describe("IPI-1111 Cloudinary webhook normalize + context", () => {
  it("fail-closed outcomeNeedsRetry: only WEBHOOK_OK_OUTCOMES are terminal", async () => {
    const { outcomeNeedsRetry, WEBHOOK_OK_OUTCOMES, WEBHOOK_RETRY_OUTCOMES } =
      await import("../src/lib/cloudinary/webhook-normalize");

    expect(outcomeNeedsRetry(null)).toBe(true);
    expect(outcomeNeedsRetry(undefined)).toBe(true);
    expect(outcomeNeedsRetry("")).toBe(true);
    expect(outcomeNeedsRetry("totally_unknown")).toBe(true);
    expect(outcomeNeedsRetry("noop_missing_provider_id")).toBe(true);
    expect(WEBHOOK_RETRY_OUTCOMES.has("noop_missing_provider_id")).toBe(true);

    expect(outcomeNeedsRetry("noop_missing_brand_id")).toBe(false);
    expect(WEBHOOK_OK_OUTCOMES.has("noop_missing_brand_id")).toBe(true);
    expect(WEBHOOK_RETRY_OUTCOMES.has("noop_missing_brand_id")).toBe(false);
    expect(outcomeNeedsRetry("noop_missing_schema_version")).toBe(false);
    expect(WEBHOOK_OK_OUTCOMES.has("noop_missing_schema_version")).toBe(true);
    expect(outcomeNeedsRetry("noop_missing_org_id")).toBe(false);
    expect(WEBHOOK_OK_OUTCOMES.has("noop_missing_org_id")).toBe(true);
    expect(outcomeNeedsRetry("applied")).toBe(false);
    expect(outcomeNeedsRetry("batch_applied")).toBe(false);
  });

  it("reads signed upload context fields and tolerates unknown payload keys", async () => {
    const { normalizeCloudinaryNotifications, toRpcPayload } = await import(
      "../src/lib/cloudinary/webhook-normalize"
    );

    const [event] = normalizeCloudinaryNotifications({
      notification_type: "upload",
      request_id: "req-1",
      asset_id: PROVIDER,
      public_id: "brands/x/shot",
      version: 8,
      secure_url: "https://res.cloudinary.com/demo/image/authenticated/v8/brands/x/shot",
      resource_type: "image",
      type: "authenticated",
      width: 100,
      height: 200,
      totally_unknown_future_field: { nested: true },
      context: {
        custom: {
          asset_id: ASSET,
          org_id: ORG,
          brand_id: BRAND,
          v2_shoot_id: SHOOT,
          schema_version: "1",
        },
      },
    });

    expect(event).toBeDefined();
    expect(event!.kind).toBe("upload");
    expect(event!.cloudinaryAssetId).toBe(PROVIDER);
    expect(event!.version).toBe(8);
    expect(event!.context.assetId).toBe(ASSET);
    expect(event!.context.brandId).toBe(BRAND);
    expect(event!.context.orgId).toBe(ORG);
    expect(event!.context.v2ShootId).toBe(SHOOT);
    expect(event!.requestId).toBe("req-1");

    const payload = toRpcPayload(event!);
    expect(payload.asset_id).toBe(ASSET);
    expect(payload.cloudinary_asset_id).toBe(PROVIDER);
  });

  it("uses deterministic request_id fallback for the same notification twice", async () => {
    const { normalizeCloudinaryNotifications } = await import(
      "../src/lib/cloudinary/webhook-normalize"
    );

    const body = {
      notification_type: "upload",
      asset_id: PROVIDER,
      public_id: "a/b",
      version: 3,
    };
    const firstPass = normalizeCloudinaryNotifications(body)[0]!;
    const secondPass = normalizeCloudinaryNotifications(body)[0]!;
    expect(firstPass.requestId).toBe(secondPass.requestId);
    expect(firstPass.requestId.startsWith("cld:evt:")).toBe(true);
  });

  it("expands every resource in a bulk delete notification", async () => {
    const { normalizeCloudinaryNotifications, toRpcPayload } = await import(
      "../src/lib/cloudinary/webhook-normalize"
    );

    const events = normalizeCloudinaryNotifications({
      notification_type: "delete",
      request_id: "del-batch",
      resources: [
        { public_id: "old/a", asset_id: PROVIDER, type: "authenticated" },
        { public_id: "old/b", asset_id: PROVIDER_B, type: "authenticated" },
      ],
    });
    expect(events).toHaveLength(2);
    expect(events[0]!.kind).toBe("deleted");
    expect(events[0]!.cloudinaryAssetId).toBe(PROVIDER);
    expect(events[1]!.cloudinaryAssetId).toBe(PROVIDER_B);
    expect(events[0]!.requestId).not.toBe(events[1]!.requestId);
    expect(toRpcPayload(events[0]!).cloudinary_asset_id).toBe(PROVIDER);
    expect(toRpcPayload(events[1]!).cloudinary_asset_id).toBe(PROVIDER_B);
  });

  it("omits resource_type and delivery_type defaults on partial rename", async () => {
    const { normalizeCloudinaryNotifications, toRpcPayload } = await import(
      "../src/lib/cloudinary/webhook-normalize"
    );

    const [renamed] = normalizeCloudinaryNotifications({
      notification_type: "rename",
      request_id: "ren-1",
      asset_id: PROVIDER,
      public_id: "new/name",
      version: 9,
    });
    expect(renamed!.kind).toBe("rename");
    expect(renamed!.resourceType).toBeNull();
    expect(renamed!.deliveryType).toBeNull();
    const payload = toRpcPayload(renamed!);
    expect(payload.resource_type).toBeNull();
    expect(payload.delivery_type).toBeNull();
  });

  it("preserves the production Acme org id for trusted schema_version=1 context", async () => {
    const { readIpixUploadContext } = await import(
      "../src/lib/cloudinary/upload-context"
    );
    const ctx = readIpixUploadContext(
      `asset_id=${ASSET}|brand_id=${BRAND}|org_id=${ACME_ORG}|schema_version=1|v2_shoot_id=${SHOOT}`,
    );
    expect(ctx.assetId).toBe(ASSET);
    expect(ctx.orgId).toBe(ACME_ORG);
    expect(ctx.brandId).toBe(BRAND);
    expect(ctx.v2ShootId).toBe(SHOOT);
    expect(ctx.schemaVersion).toBe("1");
  });

  it("parses pipe-delimited context strings with schema_version=1", async () => {
    const { readIpixUploadContext } = await import(
      "../src/lib/cloudinary/upload-context"
    );
    const ctx = readIpixUploadContext(
      `asset_id=${ASSET}|brand_id=${BRAND}|org_id=${ORG}|schema_version=1`,
    );
    expect(ctx.assetId).toBe(ASSET);
    expect(ctx.brandId).toBe(BRAND);
    expect(ctx.schemaVersion).toBe("1");
  });

  it("nulls out org/brand/v2_shoot_id when schema_version is absent", async () => {
    const { readIpixUploadContext } = await import(
      "../src/lib/cloudinary/upload-context"
    );
    const ctx = readIpixUploadContext({
      custom: { asset_id: ASSET, brand_id: BRAND, org_id: ORG, v2_shoot_id: SHOOT },
    });
    expect(ctx.assetId).toBe(ASSET);
    expect(ctx.schemaVersion).toBeNull();
    expect(ctx.orgId).toBeNull();
    expect(ctx.brandId).toBeNull();
    expect(ctx.v2ShootId).toBeNull();
  });

  it("nulls out org/brand/v2_shoot_id when schema_version is not '1'", async () => {
    const { readIpixUploadContext } = await import(
      "../src/lib/cloudinary/upload-context"
    );
    const ctx = readIpixUploadContext({
      custom: {
        asset_id: ASSET,
        brand_id: BRAND,
        org_id: ORG,
        v2_shoot_id: SHOOT,
        schema_version: "2",
      },
    });
    expect(ctx.assetId).toBe(ASSET);
    expect(ctx.schemaVersion).toBe("2");
    expect(ctx.orgId).toBeNull();
    expect(ctx.brandId).toBeNull();
    expect(ctx.v2ShootId).toBeNull();
  });

  it("propagates schema_version through toRpcPayload", async () => {
    const { normalizeCloudinaryNotifications, toRpcPayload } = await import(
      "../src/lib/cloudinary/webhook-normalize"
    );
    const [event] = normalizeCloudinaryNotifications({
      notification_type: "upload",
      request_id: "req-1",
      asset_id: PROVIDER,
      public_id: "brands/x/shot",
      version: 8,
      secure_url: "https://res.cloudinary.com/demo/image/authenticated/v8/brands/x/shot",
      resource_type: "image",
      type: "authenticated",
      context: {
        custom: {
          asset_id: ASSET,
          org_id: ORG,
          brand_id: BRAND,
          v2_shoot_id: SHOOT,
          schema_version: "1",
        },
      },
    });
    const payload = toRpcPayload(event!);
    expect(payload.schema_version).toBe("1");
    expect(payload.asset_id).toBe(ASSET);
    expect(payload.brand_id).toBe(BRAND);
    expect(payload.org_id).toBe(ORG);
    expect(payload.v2_shoot_id).toBe(SHOOT);
  });

  it("propagates null schema_version through toRpcPayload", async () => {
    const { normalizeCloudinaryNotifications, toRpcPayload } = await import(
      "../src/lib/cloudinary/webhook-normalize"
    );
    const [event] = normalizeCloudinaryNotifications({
      notification_type: "upload",
      request_id: "req-2",
      asset_id: PROVIDER,
      public_id: "brands/x/shot",
      version: 8,
      secure_url: "https://res.cloudinary.com/demo/image/authenticated/v8/brands/x/shot",
      resource_type: "image",
      type: "authenticated",
      context: {
        custom: {
          asset_id: ASSET,
          org_id: ORG,
          brand_id: BRAND,
        },
      },
    });
    const payload = toRpcPayload(event!);
    expect(payload.schema_version).toBeNull();
    expect(payload.org_id).toBeNull();
    expect(payload.brand_id).toBeNull();
    expect(payload.v2_shoot_id).toBeNull();
  });

  it("keeps signed context.custom authoritative over metadata with schema_version=1", async () => {
    const { readIpixUploadContext } = await import(
      "../src/lib/cloudinary/upload-context"
    );
    const foreignBrand = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const ctx = readIpixUploadContext(
      {
        custom: { asset_id: ASSET, brand_id: BRAND, org_id: ORG, schema_version: "1" },
        brand_id: foreignBrand,
      },
      { brand_id: foreignBrand, org_id: foreignBrand },
    );
    expect(ctx.brandId).toBe(BRAND);
    expect(ctx.orgId).toBe(ORG);
    expect(ctx.assetId).toBe(ASSET);
  });

  it("accepts deprecated ipix_asset_id only as fallback", async () => {
    const { readIpixUploadContext } = await import(
      "../src/lib/cloudinary/upload-context"
    );
    const legacy = readIpixUploadContext({
      custom: { ipix_asset_id: ASSET, brand_id: BRAND },
    });
    expect(legacy.assetId).toBe(ASSET);

    const preferred = readIpixUploadContext({
      custom: {
        asset_id: ASSET,
        ipix_asset_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        brand_id: BRAND,
      },
    });
    expect(preferred.assetId).toBe(ASSET);
  });
});

describe("IPI-1111 signature verify", () => {
  const secret = "test-notification-secret";
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.CLOUDINARY_CLOUD_NAME = "ipix-cloudinary";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = secret;
    delete process.env.CLOUDINARY_NOTIFICATION_API_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("accepts a valid signature without mutating process-wide config secret", async () => {
    const { cloudinary } = await import("../src/lib/cloudinary/config");
    const before = cloudinary.config().api_secret;
    const { verifyCloudinaryNotification } = await import(
      "../src/lib/cloudinary/webhook-verify"
    );
    const body = JSON.stringify({ notification_type: "upload", asset_id: PROVIDER });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signBody(body, timestamp, secret);

    expect(
      verifyCloudinaryNotification({
        rawBody: body,
        timestampHeader: String(timestamp),
        signatureHeader: signature,
      }).ok,
    ).toBe(true);
    expect(cloudinary.config().api_secret).toBe(before);

    expect(
      verifyCloudinaryNotification({
        rawBody: body + " ",
        timestampHeader: String(timestamp),
        signatureHeader: signature,
      }).ok,
    ).toBe(false);

    expect(
      verifyCloudinaryNotification({
        rawBody: body,
        timestampHeader: null,
        signatureHeader: signature,
      }).ok,
    ).toBe(false);

    const expiredTs = timestamp - 7201;
    const expiredSig = signBody(body, expiredTs, secret);
    expect(
      verifyCloudinaryNotification({
        rawBody: body,
        timestampHeader: String(expiredTs),
        signatureHeader: expiredSig,
      }),
    ).toEqual({ ok: false, reason: "timestamp_expired" });

    delete process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_NOTIFICATION_API_SECRET;
    expect(
      verifyCloudinaryNotification({
        rawBody: body,
        timestampHeader: String(timestamp),
        signatureHeader: signature,
      }),
    ).toEqual({ ok: false, reason: "missing_api_secret" });
  });
});

describe("IPI-1111 webhook route", () => {
  const secret = "route-secret";
  const originalEnv = { ...process.env };
  const rpc = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    rpc.mockReset();
    process.env.CLOUDINARY_CLOUD_NAME = "ipix-cloudinary";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = secret;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

    vi.doMock("../src/lib/cloudinary/webhook-persist", () => ({
      applyCloudinaryAssetEvents: rpc,
      applyCloudinaryAssetEvent: async (payload: unknown) => {
        const batch = await rpc([payload]);
        if (!batch.ok) return batch;
        return { ok: true, result: batch.result.results[0] };
      },
    }));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("../src/lib/cloudinary/webhook-persist");
  });

  function signedRequest(body: unknown, mutate?: (raw: string) => string) {
    const raw = typeof body === "string" ? body : JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = mutate ? mutate(raw) : raw;
    const signature = signBody(raw, timestamp, secret);
    return new Request("http://localhost/api/cloudinary/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cld-timestamp": String(timestamp),
        "x-cld-signature": signature,
        "x-cld-signature_v2": "observed-but-unused",
      },
      body: payload,
    });
  }

  it("returns 200 after successful upload apply", async () => {
    rpc.mockResolvedValue({
      ok: true,
      result: {
        outcome: "batch_applied",
        results: [{ outcome: "applied", asset_id: ASSET, version: 8 }],
      },
    });
    const { POST } = await import("../src/app/api/cloudinary/webhook/route");
    const res = await POST(
      signedRequest({
        notification_type: "upload",
        request_id: "req-upload-1",
        asset_id: PROVIDER,
        public_id: "p/1",
        version: 8,
        secure_url: "https://example.test/u",
        type: "authenticated",
        context: { custom: { asset_id: ASSET, brand_id: BRAND, org_id: ORG } },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.outcome).toBe("batch_applied");
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("batches every resource in a two-resource delete into one RPC call", async () => {
    rpc.mockResolvedValue({
      ok: true,
      result: {
        outcome: "batch_applied",
        results: [{ outcome: "archived" }, { outcome: "archived" }],
      },
    });
    const { POST } = await import("../src/app/api/cloudinary/webhook/route");
    const res = await POST(
      signedRequest({
        notification_type: "delete",
        request_id: "del-2",
        resources: [
          { asset_id: PROVIDER, public_id: "x" },
          { asset_id: PROVIDER_B, public_id: "y" },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledOnce();
    const payloads = rpc.mock.calls[0]![0] as Array<{ cloudinary_asset_id: string }>;
    expect(payloads).toHaveLength(2);
    expect(payloads.map((p) => p.cloudinary_asset_id)).toEqual([PROVIDER, PROVIDER_B]);
  });

  it("returns 200 for duplicate / stale / equal-version outcomes", async () => {
    rpc.mockResolvedValue({
      ok: true,
      result: { outcome: "batch_applied", results: [{ outcome: "noop_duplicate" }] },
    });
    const { POST } = await import("../src/app/api/cloudinary/webhook/route");
    expect(
      (
        await POST(
          signedRequest({
            notification_type: "upload",
            request_id: "d",
            asset_id: PROVIDER,
            version: 8,
          }),
        )
      ).status,
    ).toBe(200);

    rpc.mockResolvedValue({
      ok: true,
      result: { outcome: "batch_applied", results: [{ outcome: "noop_stale", version: 8 }] },
    });
    expect(
      (
        await POST(
          signedRequest({
            notification_type: "upload",
            request_id: "s",
            asset_id: PROVIDER,
            version: 7,
          }),
        )
      ).status,
    ).toBe(200);
  });

  it("returns 200 for permanent missing-brand (replay cannot invent brand)", async () => {
    rpc.mockResolvedValue({
      ok: true,
      result: {
        outcome: "batch_applied",
        results: [{ outcome: "noop_missing_brand_id" }],
      },
    });
    const { POST } = await import("../src/app/api/cloudinary/webhook/route");
    const res = await POST(
      signedRequest({
        notification_type: "upload",
        request_id: "miss-brand",
        asset_id: PROVIDER,
        version: 1,
      }),
    );
    expect(res.status).toBe(200);
  });

  it("returns 503 for unrecognized or empty RPC outcomes (fail closed)", async () => {
    rpc.mockResolvedValue({
      ok: true,
      result: {
        outcome: "batch_applied",
        results: [{ outcome: "totally_unknown_outcome" }],
      },
    });
    const { POST } = await import("../src/app/api/cloudinary/webhook/route");
    expect(
      (
        await POST(
          signedRequest({
            notification_type: "upload",
            request_id: "unk-1",
            asset_id: PROVIDER,
            version: 1,
          }),
        )
      ).status,
    ).toBe(503);

    rpc.mockResolvedValue({
      ok: true,
      result: { outcome: "batch_applied", results: [] },
    });
    expect(
      (
        await POST(
          signedRequest({
            notification_type: "upload",
            request_id: "empty-1",
            asset_id: PROVIDER,
            version: 1,
          }),
        )
      ).status,
    ).toBe(503);
  });

  it("returns 503 when persistence declines missing provider metadata", async () => {
    rpc.mockResolvedValue({
      ok: true,
      result: {
        outcome: "batch_applied",
        results: [{ outcome: "noop_missing_provider_id" }],
      },
    });
    const { POST } = await import("../src/app/api/cloudinary/webhook/route");
    const res = await POST(
      signedRequest({
        notification_type: "upload",
        request_id: "miss-provider",
        asset_id: PROVIDER,
        version: 1,
      }),
    );
    expect(res.status).toBe(503);
  });

  it("returns 401 for tampered body with reused signature", async () => {
    rpc.mockResolvedValue({
      ok: true,
      result: { outcome: "batch_applied", results: [{ outcome: "applied" }] },
    });
    const { POST } = await import("../src/app/api/cloudinary/webhook/route");
    const original = JSON.stringify({
      notification_type: "upload",
      request_id: "t1",
      asset_id: PROVIDER,
      version: 1,
    });
    const res = await POST(signedRequest(original, (raw) => raw.replace("t1", "HACKED")));
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 503 when persistence fails so Cloudinary retries", async () => {
    rpc.mockResolvedValue({ ok: false, status: 503, error: "forced_db_fail" });
    const { POST } = await import("../src/app/api/cloudinary/webhook/route");
    const res = await POST(
      signedRequest({
        notification_type: "upload",
        request_id: "fail-1",
        asset_id: PROVIDER,
        version: 1,
      }),
    );
    expect(res.status).toBe(503);
  });

  it("returns 413 when content-length exceeds body bound", async () => {
    const { POST } = await import("../src/app/api/cloudinary/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/cloudinary/webhook", {
        method: "POST",
        headers: {
          "content-length": String(2_000_000),
          "x-cld-timestamp": "1",
          "x-cld-signature": "x",
        },
        body: "{}",
      }),
    );
    expect(res.status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 413 when UTF-8 bytes exceed bound despite short string length", async () => {
    const verify = vi.fn();
    vi.doMock("../src/lib/cloudinary/webhook-verify", () => ({
      verifyCloudinaryNotification: verify,
    }));

    // € = 1 UTF-16 code unit, 3 UTF-8 bytes → length under cap, bytes over.
    const rawBody = "\u20ac".repeat(349_526);
    expect(rawBody.length).toBeLessThanOrEqual(1_048_576);
    expect(Buffer.byteLength(rawBody, "utf8")).toBeGreaterThan(1_048_576);

    const { POST } = await import("../src/app/api/cloudinary/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/cloudinary/webhook", {
        method: "POST",
        headers: {
          // Under-report so early Content-Length gate does not short-circuit.
          "content-length": String(rawBody.length),
          "x-cld-timestamp": "1",
          "x-cld-signature": "x",
        },
        body: rawBody,
      }),
    );
    expect(res.status).toBe(413);
    expect(verify).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    vi.doUnmock("../src/lib/cloudinary/webhook-verify");
  });
});

describe("IPI-1111 SQL state-machine contract (documented outcomes)", () => {
  /**
   * These mirror apply_cloudinary_asset_event rules. Full SQL fixtures live in
   * supabase/tests/cloudinary/apply-cloudinary-asset-events.sql.
   */
  type Mirror = { version: number; status: "ready" | "archived"; brandId: string };
  type Outcome =
    | "applied"
    | "archived"
    | "noop_duplicate"
    | "noop_duplicate_delete"
    | "noop_stale"
    | "noop_equal_version"
    | "noop_delete_unknown"
    | "noop_missing_provider_id"
    | "noop_unknown_brand"
    | "noop_missing_brand_id"
    | "noop_missing_schema_version"
    | "noop_missing_org_id";

  function applyUpload(args: {
    mirror: Mirror | null;
    seenRequestIds: Set<string>;
    requestId: string;
    version: number;
    brandId?: string;
    existingBrandId?: string;
    providerId: string | null;
  }): { outcome: Outcome; mirror: Mirror | null } {
    if (!args.providerId) return { outcome: "noop_missing_provider_id", mirror: args.mirror };
    if (args.mirror) {
      if (args.version < args.mirror.version) {
        return { outcome: "noop_stale", mirror: args.mirror };
      }
      if (args.version === args.mirror.version) {
        if (args.seenRequestIds.has(args.requestId)) {
          return { outcome: "noop_duplicate", mirror: args.mirror };
        }
        args.seenRequestIds.add(args.requestId);
        return { outcome: "noop_equal_version", mirror: args.mirror };
      }
      if (args.seenRequestIds.has(args.requestId)) {
        return { outcome: "noop_duplicate", mirror: args.mirror };
      }
      args.seenRequestIds.add(args.requestId);
      // Existing assets: brand cannot change via webhook.
      return {
        outcome: "applied",
        mirror: {
          version: args.version,
          status: "ready",
          brandId: args.mirror.brandId,
        },
      };
    }
    if (args.brandId && args.existingBrandId && args.brandId !== args.existingBrandId) {
      return { outcome: "noop_unknown_brand", mirror: null };
    }
    if (args.seenRequestIds.has(args.requestId)) {
      return { outcome: "noop_duplicate", mirror: null };
    }
    args.seenRequestIds.add(args.requestId);
    return {
      outcome: "applied",
      mirror: {
        version: args.version,
        status: "ready",
        brandId: args.brandId ?? BRAND,
      },
    };
  }

  function applyDelete(args: {
    mirror: Mirror | null;
    seenRequestIds: Set<string>;
    requestId: string;
    version: number | null;
    providerId: string | null;
    allowPublicIdFallback: boolean;
  }): { outcome: Outcome; mirror: Mirror | null } {
    if (!args.mirror) {
      // Provider id present + unknown → no public_id fallback.
      if (args.providerId && !args.allowPublicIdFallback) {
        return { outcome: "noop_delete_unknown", mirror: null };
      }
      return { outcome: "noop_delete_unknown", mirror: null };
    }
    if (
      args.version != null &&
      args.mirror.version != null &&
      args.version < args.mirror.version
    ) {
      return { outcome: "noop_stale", mirror: args.mirror };
    }
    if (args.seenRequestIds.has(args.requestId)) {
      return { outcome: "noop_duplicate_delete", mirror: args.mirror };
    }
    args.seenRequestIds.add(args.requestId);
    return {
      outcome: "archived",
      mirror: { ...args.mirror, status: "archived" },
    };
  }

  it("does not resurrect archived mirror on equal-version upload retry", () => {
    const seen = new Set<string>();
    let mirror: Mirror | null = null;
    let r = applyUpload({
      mirror,
      seenRequestIds: seen,
      requestId: "u-v8",
      version: 8,
      providerId: PROVIDER,
      brandId: BRAND,
    });
    mirror = r.mirror;
    expect(r.outcome).toBe("applied");

    r = applyDelete({
      mirror,
      seenRequestIds: seen,
      requestId: "d-v8",
      version: 8,
      providerId: PROVIDER,
      allowPublicIdFallback: false,
    });
    mirror = r.mirror;
    expect(r.outcome).toBe("archived");
    expect(mirror!.status).toBe("archived");

    r = applyUpload({
      mirror,
      seenRequestIds: seen,
      requestId: "u-v8",
      version: 8,
      providerId: PROVIDER,
    });
    expect(r.outcome).toBe("noop_duplicate");
    expect(r.mirror!.status).toBe("archived");
  });

  it("rejects stale deletes that would archive newer state", () => {
    const seen = new Set<string>();
    const mirror: Mirror = { version: 8, status: "ready", brandId: BRAND };
    const r = applyDelete({
      mirror,
      seenRequestIds: seen,
      requestId: "d-v7",
      version: 7,
      providerId: PROVIDER,
      allowPublicIdFallback: false,
    });
    expect(r.outcome).toBe("noop_stale");
    expect(r.mirror!.status).toBe("ready");
    expect(r.mirror!.version).toBe(8);
  });

  it("does not fall back to public_id when provider id is present but unknown", () => {
    const r = applyDelete({
      mirror: null,
      seenRequestIds: new Set(),
      requestId: "d-miss",
      version: 1,
      providerId: PROVIDER,
      allowPublicIdFallback: false,
    });
    expect(r.outcome).toBe("noop_delete_unknown");
  });

  it("keeps existing brand on foreign-brand overwrite", () => {
    const seen = new Set<string>();
    const mirror: Mirror = { version: 8, status: "ready", brandId: BRAND };
    const foreign = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const r = applyUpload({
      mirror,
      seenRequestIds: seen,
      requestId: "ow-9",
      version: 9,
      providerId: PROVIDER,
      brandId: foreign,
    });
    expect(r.outcome).toBe("applied");
    expect(r.mirror!.brandId).toBe(BRAND);
  });

  it("flags missing provider id for uploads", () => {
    const r = applyUpload({
      mirror: null,
      seenRequestIds: new Set(),
      requestId: "no-prov",
      version: 1,
      providerId: null,
      brandId: BRAND,
    });
    expect(r.outcome).toBe("noop_missing_provider_id");
  });
});
