import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ALLOWED_CANDIDATE_FORMATS,
  MAX_CANDIDATE_BYTES,
  REFERENCE_CANDIDATE_SCHEMA_VERSION,
  REFERENCE_CANDIDATE_TAG,
  REFERENCE_LIBRARY_FOLDER,
  buildApprovedReferenceMapping,
  buildCandidateContext,
  buildCandidateTags,
  buildCandidateUploadParams,
  buildStatusReport,
  candidatePublicId,
  parseReferenceCandidateManifest,
  planCandidateUploads,
  resolveUploadedIdentity,
  type ReferenceCandidate,
  type UploadedReferenceAsset,
} from "../src/lib/shoot/reference-candidates";
import {
  normalizeProviderCandidate,
  normalizeUploadResponse,
  runCli,
  type ReferenceLibraryDeps,
} from "../scripts/reference-library/candidates";

const REFERENCE_KEY = "clothing_model_full_body_front";

function validCandidate(overrides: Partial<ReferenceCandidate> = {}): ReferenceCandidate {
  return {
    referenceKey: REFERENCE_KEY,
    file: `assets/reference-candidates/${REFERENCE_KEY}.jpg`,
    provenanceSource: "iPix-owned studio library",
    ...overrides,
  };
}

function validUploaded(overrides: Partial<UploadedReferenceAsset> = {}): UploadedReferenceAsset {
  return {
    assetId: "asset-123",
    publicId: `${REFERENCE_LIBRARY_FOLDER}/${REFERENCE_KEY}`,
    version: 17,
    format: "jpg",
    resourceType: "image",
    deliveryType: "authenticated",
    width: 1600,
    height: 2400,
    bytes: 1_500_000,
    ...overrides,
  };
}

function manifestWith(candidates: unknown[]): unknown {
  return { schemaVersion: REFERENCE_CANDIDATE_SCHEMA_VERSION, candidates };
}

describe("parseReferenceCandidateManifest", () => {
  it("accepts an approved candidate and normalizes optional fields", () => {
    const result = parseReferenceCandidateManifest(manifestWith([validCandidate()]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.candidates[0]).toMatchObject({
      referenceKey: REFERENCE_KEY,
      credit: null,
      tags: null,
    });
  });

  it("rejects a wrong schema version and an empty candidate list", () => {
    expect(parseReferenceCandidateManifest({ schemaVersion: "nope", candidates: [validCandidate()] })).toMatchObject({
      ok: false,
      reason: "invalid_manifest",
    });
    expect(parseReferenceCandidateManifest(manifestWith([]))).toMatchObject({ ok: false, reason: "invalid_manifest" });
  });

  it("rejects a malformed candidate", () => {
    expect(parseReferenceCandidateManifest(manifestWith(["nope"]))).toMatchObject({
      ok: false,
      reason: "invalid_candidate",
    });
    expect(parseReferenceCandidateManifest(manifestWith([validCandidate({ referenceKey: "Not-Snake-Case" })]))).toMatchObject(
      { ok: false, reason: "invalid_candidate" },
    );
    expect(parseReferenceCandidateManifest(manifestWith([validCandidate({ file: "  " })]))).toMatchObject({
      ok: false,
      reason: "invalid_candidate",
    });
  });

  it("accepts the canonical snake_case key and rejects blank or non-canonical keys", () => {
    expect(
      parseReferenceCandidateManifest(manifestWith([validCandidate({ referenceKey: REFERENCE_KEY })])),
    ).toMatchObject({ ok: true });
    for (const referenceKey of ["", "   ", "Full Body", "foo/bar", "foo bar"]) {
      expect(parseReferenceCandidateManifest(manifestWith([validCandidate({ referenceKey })]))).toMatchObject({
        ok: false,
        reason: "invalid_candidate",
      });
    }
  });

  it("rejects duplicate reference keys", () => {
    expect(parseReferenceCandidateManifest(manifestWith([validCandidate(), validCandidate()]))).toMatchObject({
      ok: false,
      reason: "duplicate_reference_key",
    });
  });
});

describe("candidate identity + upload planning", () => {
  it("builds the deterministic library public id", () => {
    expect(candidatePublicId(validCandidate())).toBe(`${REFERENCE_LIBRARY_FOLDER}/${REFERENCE_KEY}`);
  });

  it("builds sanitized, de-duplicated tags and context", () => {
    const tags = buildCandidateTags(validCandidate({ tags: ["Hero Shot", "hero shot", "", "dup", "dup"] }));
    expect(tags).toContain(REFERENCE_CANDIDATE_TAG);
    expect(tags).toContain(`reference-key:${REFERENCE_KEY}`);
    expect(tags).toContain("Hero-Shot");
    expect(tags.filter((tag) => tag === "dup")).toHaveLength(1);

    const context = buildCandidateContext(validCandidate({ credit: "Studio|One" }));
    expect(context).toContain(`schema_version=${REFERENCE_CANDIDATE_SCHEMA_VERSION}`);
    expect(context).toContain(`reference_key=${REFERENCE_KEY}`);
    expect(context).toContain("credit=Studio One");
  });

  it("uploads as an authenticated image with eager named previews and without overwrite", () => {
    const params = buildCandidateUploadParams(validCandidate());
    expect(params.folder).toBe(REFERENCE_LIBRARY_FOLDER);
    expect(params.public_id).toBe(REFERENCE_KEY);
    expect(params.type).toBe("authenticated");
    expect(params.resource_type).toBe("image");
    expect(params.overwrite).toBe(false);
    // Authenticated assets cannot rely on lazy derivative generation, so the
    // named previews the signed preview path requests must be built at upload.
    expect(params.eager).toEqual([
      { transformation: "asset-masonry" },
      { transformation: "asset-review" },
      { transformation: "asset-detail" },
    ]);
  });

  it("plans upload, replace, and already-approved actions", () => {
    const plan = planCandidateUploads(
      [
        validCandidate(),
        validCandidate({ referenceKey: "beauty_product_45_hero" }),
        validCandidate({ referenceKey: "home_goods_product_45_studio" }),
      ],
      new Set(["beauty_product_45_hero", "home_goods_product_45_studio"]),
      new Set(["home_goods_product_45_studio"]),
    );
    expect(plan.find((entry) => entry.referenceKey === REFERENCE_KEY)?.action).toBe("upload");
    expect(plan.find((entry) => entry.referenceKey === "beauty_product_45_hero")?.action).toBe("replace_required");
    expect(plan.find((entry) => entry.referenceKey === "home_goods_product_45_studio")?.action).toBe("already_approved");
  });

  it("reports approved, pending, missing, and orphaned coverage", () => {
    const report = buildStatusReport(["a_one", "b_two", "c_three"], new Set(["b_two", "orphan_key"]), new Set(["a_one"]));
    expect(report).toMatchObject({ total: 3, approved: 1, pendingReview: 1, missing: 1, orphaned: ["orphan_key"] });
    expect(report.missingKeys).toEqual(["c_three"]);
  });
});

describe("resolveUploadedIdentity", () => {
  it("accepts a valid authenticated image identity (including a numeric string version)", () => {
    expect(resolveUploadedIdentity(validUploaded())).toMatchObject({
      ok: true,
      identity: { assetId: "asset-123", version: 17, format: "jpg" },
    });
    expect(resolveUploadedIdentity(validUploaded({ version: "42", format: "JPG" }))).toMatchObject({
      ok: true,
      identity: { version: 42, format: "jpg" },
    });
  });

  it.each([
    ["missing_identity", { assetId: "" }],
    ["missing_identity", { publicId: null }],
    ["unsupported_resource_type", { resourceType: "video" }],
    ["invalid_delivery_type", { deliveryType: "upload" }],
    ["unsupported_format", { format: "gif" }],
    ["unsupported_format", { format: null }],
    ["invalid_version", { version: 0 }],
    ["invalid_version", { version: 1.5 }],
    ["invalid_version", { version: null }],
    ["invalid_dimensions", { width: null }],
    ["image_too_small", { width: 799, height: 1200 }],
    ["image_too_large", { bytes: MAX_CANDIDATE_BYTES + 1 }],
  ])("fails closed with reason %s", (reason, overrides) => {
    expect(resolveUploadedIdentity(validUploaded(overrides as Partial<UploadedReferenceAsset>))).toMatchObject({
      ok: false,
      reason,
    });
  });

  it("allows every approved format and rejects bytes <= 0", () => {
    for (const format of ALLOWED_CANDIDATE_FORMATS) {
      expect(resolveUploadedIdentity(validUploaded({ format })).ok).toBe(true);
    }
    expect(resolveUploadedIdentity(validUploaded({ bytes: 0 }))).toMatchObject({ ok: false, reason: "image_too_large" });
  });
});

describe("buildApprovedReferenceMapping", () => {
  it("builds the exact approved mapping with hardcoded invariants", () => {
    expect(buildApprovedReferenceMapping(validCandidate(), validUploaded())).toMatchObject({
      ok: true,
      mapping: {
        referenceKey: REFERENCE_KEY,
        cloudinaryAssetId: "asset-123",
        version: 17,
        format: "jpg",
        resourceType: "image",
        deliveryType: "authenticated",
      },
    });
  });

  it("propagates invalid identities", () => {
    expect(buildApprovedReferenceMapping(validCandidate(), validUploaded({ version: 0 }))).toMatchObject({
      ok: false,
      reason: "invalid_version",
    });
  });

  it("rejects an uploaded asset that is not stored at the candidate's public id", () => {
    expect(
      buildApprovedReferenceMapping(
        validCandidate(),
        validUploaded({ publicId: "ipix/reference-library/some_other_key" }),
      ),
    ).toMatchObject({
      ok: false,
      reason: "mismatched_identity",
    });
  });
});

describe("provider normalization", () => {
  it("reads the reference key from context, custom context, or tags", () => {
    expect(normalizeProviderCandidate({ context: { reference_key: REFERENCE_KEY } })?.referenceKey).toBe(REFERENCE_KEY);
    expect(normalizeProviderCandidate({ context: { custom: { reference_key: REFERENCE_KEY } } })?.referenceKey).toBe(
      REFERENCE_KEY,
    );
    expect(normalizeProviderCandidate({ tags: ["other", `reference-key:${REFERENCE_KEY}`] })?.referenceKey).toBe(
      REFERENCE_KEY,
    );
    expect(normalizeProviderCandidate({ tags: ["other"] })).toBeNull();
  });

  it("normalizes an upload response defensively", () => {
    expect(
      normalizeUploadResponse({ asset_id: "a", version: "9", type: "authenticated", resource_type: "image" }),
    ).toMatchObject({ assetId: "a", version: 9, deliveryType: "authenticated", resourceType: "image" });
    expect(normalizeUploadResponse(null)).toMatchObject({ assetId: null, version: null });
  });
});

function makeDeps(overrides: Partial<ReferenceLibraryDeps> = {}): ReferenceLibraryDeps {
  return {
    log: vi.fn(),
    stderr: vi.fn(),
    readManifest: vi.fn(async () => manifestWith([validCandidate()])),
    fileExists: vi.fn(() => true),
    listDirectory: vi.fn(async () => []),
    readFileBytes: vi.fn(async () => null),
    listProviderCandidates: vi.fn(async () => []),
    uploadCandidate: vi.fn(async () => validUploaded()),
    destroyCandidate: vi.fn(async () => {}),
    loadCatalog: vi.fn(async () => [{ id: "ref-uuid-1", referenceKey: REFERENCE_KEY }]),
    loadApprovedMappings: vi.fn(async () => []),
    recordApprovedMapping: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("runCli", () => {
  it("prints usage and fails on an unknown or incomplete command", async () => {
    expect(await runCli([], makeDeps())).toBe(1);
    expect(await runCli(["frobnicate"], makeDeps())).toBe(1);
    expect(await runCli(["prepare"], makeDeps())).toBe(1);
  });

  it("prepare passes when files exist and fails closed when a file is missing", async () => {
    expect(await runCli(["prepare", "manifest.json"], makeDeps())).toBe(0);
    const deps = makeDeps({ fileExists: vi.fn(() => false) });
    expect(await runCli(["prepare", "manifest.json"], deps)).toBe(1);
    expect(deps.stderr).toHaveBeenCalled();
  });

  it("upload uploads candidates but NEVER records an approval", async () => {
    const deps = makeDeps();
    expect(await runCli(["upload", "manifest.json"], deps)).toBe(0);
    expect(deps.uploadCandidate).toHaveBeenCalledTimes(1);
    expect(deps.recordApprovedMapping).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Candidates are NOT approved"));
  });

  it("upload skips an existing candidate unless --replace destroys it first", async () => {
    const provider = [{ ...validUploaded(), referenceKey: REFERENCE_KEY }];
    const skip = makeDeps({ listProviderCandidates: vi.fn(async () => provider) });
    expect(await runCli(["upload", "manifest.json"], skip)).toBe(0);
    expect(skip.uploadCandidate).not.toHaveBeenCalled();
    expect(skip.destroyCandidate).not.toHaveBeenCalled();

    const replace = makeDeps({ listProviderCandidates: vi.fn(async () => provider) });
    expect(await runCli(["upload", "manifest.json", "--replace"], replace)).toBe(0);
    expect(replace.destroyCandidate).toHaveBeenCalledWith(`${REFERENCE_LIBRARY_FOLDER}/${REFERENCE_KEY}`);
    expect(replace.uploadCandidate).toHaveBeenCalledTimes(1);
  });

  it("upload skips an already-approved reference", async () => {
    const deps = makeDeps({
      loadApprovedMappings: vi.fn(async () => [{ referenceId: "ref-uuid-1", hasApprovedMedia: true }]),
    });
    expect(await runCli(["upload", "manifest.json"], deps)).toBe(0);
    expect(deps.uploadCandidate).not.toHaveBeenCalled();
  });

  it("validate returns 1 when any uploaded identity is invalid", async () => {
    const valid = makeDeps({
      listProviderCandidates: vi.fn(async () => [{ ...validUploaded(), referenceKey: REFERENCE_KEY }]),
    });
    expect(await runCli(["validate"], valid)).toBe(0);

    const invalid = makeDeps({
      listProviderCandidates: vi.fn(async () => [{ ...validUploaded({ format: "gif" }), referenceKey: REFERENCE_KEY }]),
    });
    expect(await runCli(["validate"], invalid)).toBe(1);
  });

  it("approve requires an explicit approver, manifest, candidate, and catalog row", async () => {
    expect(await runCli(["approve", REFERENCE_KEY], makeDeps())).toBe(1);
    expect(await runCli(["approve", REFERENCE_KEY, "--approved-by", "approver-uuid"], makeDeps())).toBe(1);

    const unknownKey = makeDeps();
    expect(
      await runCli(["approve", "unknown_key", "--approved-by", "approver-uuid", "--manifest", "m.json"], unknownKey),
    ).toBe(1);
    expect(unknownKey.recordApprovedMapping).not.toHaveBeenCalled();

    const noCandidate = makeDeps();
    expect(
      await runCli(["approve", REFERENCE_KEY, "--approved-by", "approver-uuid", "--manifest", "m.json"], noCandidate),
    ).toBe(1);
    expect(noCandidate.recordApprovedMapping).not.toHaveBeenCalled();

    const noCatalogRow = makeDeps({
      listProviderCandidates: vi.fn(async () => [{ ...validUploaded(), referenceKey: REFERENCE_KEY }]),
      loadCatalog: vi.fn(async () => []),
    });
    expect(
      await runCli(["approve", REFERENCE_KEY, "--approved-by", "approver-uuid", "--manifest", "m.json"], noCatalogRow),
    ).toBe(1);
    expect(noCatalogRow.recordApprovedMapping).not.toHaveBeenCalled();
  });

  it("approve records the exact binding only for a human-approved valid candidate", async () => {
    const deps = makeDeps({
      listProviderCandidates: vi.fn(async () => [{ ...validUploaded(), referenceKey: REFERENCE_KEY }]),
    });
    expect(await runCli(["approve", REFERENCE_KEY, "--approved-by", "approver-uuid", "--manifest", "m.json"], deps)).toBe(
      0,
    );
    expect(deps.recordApprovedMapping).toHaveBeenCalledWith({
      referenceId: "ref-uuid-1",
      cloudinaryAssetId: "asset-123",
      publicId: `${REFERENCE_LIBRARY_FOLDER}/${REFERENCE_KEY}`,
      version: 17,
      format: "jpg",
      provenanceSource: "iPix-owned studio library",
      approvedBy: "approver-uuid",
    });
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining(`approved ${REFERENCE_KEY}`));
  });

  it("approve refuses an invalid uploaded identity", async () => {
    const deps = makeDeps({
      listProviderCandidates: vi.fn(async () => [{ ...validUploaded({ version: 0 }), referenceKey: REFERENCE_KEY }]),
    });
    expect(await runCli(["approve", REFERENCE_KEY, "--approved-by", "approver-uuid", "--manifest", "m.json"], deps)).toBe(
      1,
    );
    expect(deps.recordApprovedMapping).not.toHaveBeenCalled();
  });

  it("reject never writes a mapping", async () => {
    const deps = makeDeps();
    expect(await runCli(["reject", REFERENCE_KEY], deps)).toBe(0);
    expect(deps.recordApprovedMapping).not.toHaveBeenCalled();
  });

  it("status reports coverage without writing", async () => {
    const deps = makeDeps({
      listProviderCandidates: vi.fn(async () => [{ ...validUploaded(), referenceKey: "orphan_key" }]),
    });
    expect(await runCli(["status"], deps)).toBe(0);
    expect(deps.recordApprovedMapping).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("orphaned provider candidates: orphan_key"));
  });
});

describe("IPI-644 candidate tooling ships its migration and ACL suite", () => {
  it("ships the recording migration with the human-approval invariants", async () => {
    const migrationPath = join(
      process.cwd(),
      "supabase/migrations/20260915130000_ipi644_reference_candidate_recording.sql",
    );
    await access(migrationPath);
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/record_shot_reference_media/);
    expect(sql).toMatch(/p_approved_by is null/);
    expect(sql).toMatch(/grant execute on function public\.record_shot_reference_media/);
    expect(sql).toMatch(/grant select on table public\.shot_type_references_view to service_role/);
  });

  it("extends the ACL suite with the recorder assertions", async () => {
    const aclPath = join(process.cwd(), "supabase/tests/security/ipi644-reference-media-grants.sql");
    await access(aclPath);
    const sql = await readFile(aclPath, "utf8");
    expect(sql).toMatch(/only human-approved mappings may be recorded/);
    expect(sql).toMatch(/service_role owns the reference media recorder/);
    expect(sql).toMatch(/only service_role may EXECUTE the reference media recorder/);
    expect(sql).toMatch(/recorder must require a human approver/);
    expect(sql).toMatch(/reference_key must reject blank or non-canonical keys/);
    expect(sql).toMatch(/reference media functions must stay SECURITY DEFINER/);
  });
});
