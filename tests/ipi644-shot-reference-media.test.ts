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
  cloudinary: { url: urlMock, config: vi.fn() },
}));

const supaMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createClientFromRequest: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

vi.mock("../src/lib/supabase/server", () => ({
  createClient: supaMocks.createClient,
  createClientFromRequest: supaMocks.createClientFromRequest,
}));

vi.mock("../src/lib/supabase/service-role", () => ({
  createServiceRoleClient: supaMocks.createServiceRoleClient,
}));

const authMocks = vi.hoisted(() => ({
  getVerifiedOperatorForRequest: vi.fn(),
}));

vi.mock("../src/lib/auth/copilot-hooks", () => ({
  getVerifiedOperatorForRequest: authMocks.getVerifiedOperatorForRequest,
}));

import { GET } from "../src/app/api/references/[referenceId]/preview/route";
import {
  getShotReferencePreview,
  type ShotReferenceMediaRow,
} from "../src/lib/shoot/get-shot-reference-preview";
import { loadShotReferenceCatalog } from "../src/lib/shoot/shot-type-references";

const REFERENCE_ID = "c5901612-7aae-4752-a536-b31eb0674220";
const VERSION = 1789262790;

afterEach(() => {
  urlMock.mockClear();
  urlMock.mockReset();
  urlMock.mockImplementation(
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
  );
  supaMocks.createClient.mockReset();
  supaMocks.createClientFromRequest.mockReset();
  supaMocks.createServiceRoleClient.mockReset();
  authMocks.getVerifiedOperatorForRequest.mockReset();
});

function approvedRow(
  overrides: Partial<ShotReferenceMediaRow> = {},
): ShotReferenceMediaRow {
  return {
    reference_exists: true,
    has_approved_media: true,
    cloudinary_asset_id: "6fe8132caaeec0dcf43fd1560235df42",
    public_id: "ipix/reference-library/clothing-model-front",
    version: VERSION,
    format: "webp",
    resource_type: "image",
    delivery_type: "authenticated",
    rights_status: "approved_for_reference",
    ...overrides,
  };
}

function rpcClient(result: {
  data: ShotReferenceMediaRow[] | null;
  error?: unknown;
}) {
  return {
    rpc: vi.fn(async () => ({ data: result.data, error: result.error ?? null })),
  };
}

describe("IPI-644 getShotReferencePreview — authenticated exact-version mapping", () => {
  it("signs the exact approved version with the named transform", async () => {
    const result = await getShotReferencePreview({
      referenceId: REFERENCE_ID,
      preview: "review",
      supabase: rpcClient({ data: [approvedRow()] }) as never,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toContain(`/v${VERSION}/`);
    expect(result.url).toContain("/authenticated/");
    expect(result.url).toContain("s--TESTSIG--");
    expect(result.url).toContain("t_asset-review");
    expect(result.version).toBe(VERSION);
    expect(result.namedTransform).toBe("asset-review");
  });

  it("accepts a numeric-string provider version", async () => {
    const result = await getShotReferencePreview({
      referenceId: REFERENCE_ID,
      preview: "masonry",
      supabase: rpcClient({
        data: [approvedRow({ version: String(VERSION) })],
      }) as never,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toContain(`/v${VERSION}/`);
  });

  it("rejects a malformed reference id without touching the provider", async () => {
    const result = await getShotReferencePreview({
      referenceId: "not-a-uuid",
      preview: "review",
      supabase: rpcClient({ data: [approvedRow()] }) as never,
    });
    expect(result).toEqual({ ok: false, reason: "invalid_reference_id" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("rejects an unsupported preview kind without touching the provider", async () => {
    const result = await getShotReferencePreview({
      referenceId: REFERENCE_ID,
      preview: "huge",
      supabase: rpcClient({ data: [approvedRow()] }) as never,
    });
    expect(result).toEqual({ ok: false, reason: "unsupported_preview" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("fails closed when the reference does not exist", async () => {
    const result = await getShotReferencePreview({
      referenceId: REFERENCE_ID,
      preview: "review",
      supabase: rpcClient({
        data: [approvedRow({ reference_exists: false })],
      }) as never,
    });
    expect(result).toEqual({ ok: false, reason: "reference_not_found" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("fails closed when no rows are returned", async () => {
    const result = await getShotReferencePreview({
      referenceId: REFERENCE_ID,
      preview: "review",
      supabase: rpcClient({ data: [] }) as never,
    });
    expect(result).toEqual({ ok: false, reason: "reference_not_found" });
  });

  it("fails closed when the reference has no approved mapping", async () => {
    const result = await getShotReferencePreview({
      referenceId: REFERENCE_ID,
      preview: "review",
      supabase: rpcClient({
        data: [approvedRow({ has_approved_media: false, public_id: null })],
      }) as never,
    });
    expect(result).toEqual({ ok: false, reason: "missing_approved_media" });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it.each([
    ["unsupported_resource_type", { resource_type: "video" }],
    ["invalid_delivery_type", { delivery_type: "upload" }],
    ["unapproved_mapping", { rights_status: "pending" }],
    ["invalid_mapping", { public_id: "  " }],
    ["invalid_mapping", { cloudinary_asset_id: null }],
    ["invalid_mapping", { version: 0 }],
    ["invalid_mapping", { version: 1.5 }],
  ] as const)("fails closed (%s) for %o", async (reason, overrides) => {
    const result = await getShotReferencePreview({
      referenceId: REFERENCE_ID,
      preview: "review",
      supabase: rpcClient({ data: [approvedRow(overrides)] }) as never,
    });
    expect(result).toEqual({ ok: false, reason });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("returns lookup_failed when the server read errors", async () => {
    const result = await getShotReferencePreview({
      referenceId: REFERENCE_ID,
      preview: "review",
      supabase: rpcClient({ data: null, error: { message: "boom" } }) as never,
    });
    expect(result).toEqual({ ok: false, reason: "lookup_failed" });
  });

  it("returns signing_failed when the provider signer throws", async () => {
    urlMock.mockImplementationOnce(() => {
      throw new Error("provider down");
    });
    const result = await getShotReferencePreview({
      referenceId: REFERENCE_ID,
      preview: "review",
      supabase: rpcClient({ data: [approvedRow()] }) as never,
    });
    expect(result).toEqual({ ok: false, reason: "signing_failed" });
  });
});

describe("IPI-644 reference preview route", () => {
  const params = Promise.resolve({ referenceId: REFERENCE_ID });

  function request(query = "?preview=review") {
    return new Request(`https://app.example.com/api/references/${REFERENCE_ID}/preview${query}`);
  }

  it("returns 401 for an anonymous caller", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue(null);
    const response = await GET(request(), { params });
    expect(response.status).toBe(401);
    expect(supaMocks.createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("returns 503 when the verified server client is unavailable", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue({ id: "op" });
    supaMocks.createServiceRoleClient.mockReturnValue(null);
    const response = await GET(request(), { params });
    expect(response.status).toBe(503);
  });

  it("returns a signed preview for an authenticated caller without leaking provider identity", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue({ id: "op" });
    supaMocks.createServiceRoleClient.mockReturnValue(
      rpcClient({ data: [approvedRow()] }),
    );
    const response = await GET(request(), { params });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.url).toContain(`/v${VERSION}/`);
    expect(body.referenceId).toBe(REFERENCE_ID);
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("cloudinary_asset_id");
    expect(body).not.toHaveProperty("public_id");
  });

  it("maps an unsupported preview to 400", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue({ id: "op" });
    supaMocks.createServiceRoleClient.mockReturnValue(
      rpcClient({ data: [approvedRow()] }),
    );
    const response = await GET(request("?preview=nope"), { params });
    expect(response.status).toBe(400);
  });

  it("maps a missing mapping to 409 (no URL)", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue({ id: "op" });
    supaMocks.createServiceRoleClient.mockReturnValue(
      rpcClient({ data: [approvedRow({ has_approved_media: false, public_id: null })] }),
    );
    const response = await GET(request(), { params });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).not.toHaveProperty("url");
  });

  it("maps an unknown reference to 404", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue({ id: "op" });
    supaMocks.createServiceRoleClient.mockReturnValue(rpcClient({ data: [] }));
    const response = await GET(request(), { params });
    expect(response.status).toBe(404);
  });

  it("maps a server read failure to 503", async () => {
    authMocks.getVerifiedOperatorForRequest.mockResolvedValue({ id: "op" });
    supaMocks.createServiceRoleClient.mockReturnValue(
      rpcClient({ data: null, error: { message: "boom" } }),
    );
    const response = await GET(request(), { params });
    expect(response.status).toBe(503);
  });
});

describe("IPI-644 loadShotReferenceCatalog", () => {
  function catalogClient(result: { data: unknown[] | null; error?: unknown }) {
    const chain = {
      select: () => chain,
      order: () => chain,
      limit: async () => ({ data: result.data, error: result.error ?? null }),
    };
    return { from: () => chain };
  }

  const row = {
    id: REFERENCE_ID,
    reference_key: "clothing_model_full_body_front",
    category: "CLOTHING",
    subcategory: "model",
    angle: "full body front",
    description: "full body front studio",
    channel_fit: ["shopify_pdp"],
    model_type: "female",
    background: "studio",
    tags: ["studio"],
    has_preview: true,
  };

  it("returns catalog entries with referenceKey + hasPreview", async () => {
    supaMocks.createClient.mockResolvedValue(catalogClient({ data: [row] }));
    const entries = await loadShotReferenceCatalog();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: REFERENCE_ID,
      referenceKey: "clothing_model_full_body_front",
      hasPreview: true,
      channelFit: ["shopify_pdp"],
    });
  });

  it("fails closed when a row is malformed (null reference_key)", async () => {
    supaMocks.createClient.mockResolvedValue(
      catalogClient({ data: [{ ...row, reference_key: null }] }),
    );
    expect(await loadShotReferenceCatalog()).toEqual([]);
  });

  it("fails closed when has_preview is not a boolean", async () => {
    supaMocks.createClient.mockResolvedValue(
      catalogClient({ data: [{ ...row, has_preview: "yes" }] }),
    );
    expect(await loadShotReferenceCatalog()).toEqual([]);
  });

  it("returns [] on read error and on no session", async () => {
    supaMocks.createClient.mockResolvedValue(
      catalogClient({ data: null, error: { message: "boom" } }),
    );
    expect(await loadShotReferenceCatalog()).toEqual([]);

    supaMocks.createClient.mockResolvedValue(null);
    expect(await loadShotReferenceCatalog()).toEqual([]);
  });
});

describe("IPI-644 ships the migration + isolated SQL security suite", () => {
  it("has the migration and the ACL suite with the required markers", async () => {
    const { access, readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");

    const migrationPath = join(
      process.cwd(),
      "supabase/migrations/20260915120000_ipi644_shoot_reference_media.sql",
    );
    const aclPath = join(
      process.cwd(),
      "supabase/tests/security/ipi644-reference-media-grants.sql",
    );

    await access(migrationPath);
    await access(aclPath);

    const migration = await readFile(migrationPath, "utf8");
    expect(migration).toMatch(/anon must not read or write the reference view/);
    expect(migration).toMatch(/authenticated may only SELECT it/);
    expect(migration).toMatch(/No policies on purpose/);
    expect(migration).toMatch(/rights_status = 'approved_for_reference'/);
    expect(migration).toMatch(/security_invoker = true/);
    expect(migration).toMatch(/reference_key is immutable/);
    expect(migration).toMatch(/shot_type_references_reference_key_format/);
    expect(migration).toMatch(/lower_snake_case form with a permanent CHECK/);
    expect(migration).toMatch(/service_role only/);

    const acl = await readFile(aclPath, "utf8");
    expect(acl).toMatch(/global reference media must not be client-readable/);
    expect(acl).toMatch(/anon must not read or write the reference view/);
    expect(acl).toMatch(/authenticated may only SELECT the reference view/);
    expect(acl).toMatch(/provider identity\/version must not be exposed/);
    expect(acl).toMatch(/reference_key must be immutable/);
    expect(acl).toMatch(/reference_key must reject blank or non-canonical keys/);
    expect(acl).toMatch(/reference media functions must stay SECURITY DEFINER/);
    expect(acl).toMatch(/anon must not EXECUTE the reference media functions/);
    expect(acl).toMatch(/authenticated must not EXECUTE the reference media resolver/);
    expect(acl).toMatch(/only human-approved mappings may be recorded/);
    expect(acl).toMatch(/service_role owns the reference media recorder/);
  });
});
