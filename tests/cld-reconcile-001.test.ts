import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  reconcileInventories,
  reportExitCode,
  stringifyReport,
  type DbMirror,
  type ProviderAsset,
} from "../src/lib/cloudinary/reconcile";
import {
  buildDbMirrors,
  collectActiveV2Pages,
  collectAdminAssetIdBatches,
  collectSupabasePages,
  runReconciliation,
} from "../scripts/cloudinary/reconcile";

const provider = (overrides: Partial<ProviderAsset> = {}): ProviderAsset => ({
  assetId: "cld-1", version: 7, placeholder: false, bytes: 42, backup: false, ...overrides,
});
const db = (overrides: Partial<DbMirror> = {}): DbMirror => ({
  assetId: "db-1", cloudinaryAssetId: "cld-1", version: 7, status: "ready",
  trustedV2: true, hasMatchingDeleteEvent: false, ...overrides,
});
const classify = (providers: ProviderAsset[], mirrors: DbMirror[]) => reconcileInventories({ providerAssets: providers, dbMirrors: mirrors });

describe("IPI-1114 Cloudinary V2 reconciliation", () => {
  it("classifies an exact live immutable-id/version match as ok", () => {
    expect(classify([provider()], [db()]).records[0]?.classification).toBe("ok");
  });

  it("classifies an exact immutable ID with a different version as version_mismatch", () => {
    expect(classify([provider({ version: 8 })], [db()]).records[0]?.classification).toBe("version_mismatch");
  });

  it("classifies an active V2 provider asset without a mirror as provider_only_v2", () => {
    expect(classify([provider()], []).records[0]?.classification).toBe("provider_only_v2");
  });

  it("classifies a ready DB mirror without a provider record as db_ready_provider_missing", () => {
    expect(classify([], [db()]).records[0]?.classification).toBe("db_ready_provider_missing");
  });

  it("allows archived delete history backed by the known provider placeholder", () => {
    const report = classify([provider({ placeholder: true, bytes: 0, backup: true })], [db({ status: "archived", hasMatchingDeleteEvent: true })]);
    expect(report.records[0]?.classification).toBe("expected_archived_deleted");
  });

  it("excludes legacy incomplete processing rows rather than calling them V2 drift", () => {
    const report = classify([], [db({ status: "processing", cloudinaryAssetId: null, version: null, trustedV2: false })]);
    expect(report.records[0]?.classification).toBe("legacy_excluded");
  });

  it("fails closed when a trusted V2 mirror has malformed identity or version", () => {
    const report = classify([], [db({ cloudinaryAssetId: "trusted-bad", version: null, trustedV2: true })]);
    expect(report.records[0]?.classification).toBe("invalid_unclassifiable");
    expect(reportExitCode(report)).toBe(1);
  });

  it("fails closed for duplicate trusted DB immutable IDs", () => {
    const report = classify([provider()], [db(), db({ assetId: "db-2" })]);
    expect(report.records[0]?.classification).toBe("invalid_unclassifiable");
  });

  it("fails closed for duplicate provider immutable IDs", () => {
    const report = classify([provider(), provider()], [db()]);
    expect(report.records[0]?.classification).toBe("invalid_unclassifiable");
  });

  it("still performs the reverse provider lookup when active V2 Search is empty", async () => {
    const lookup = vi.fn(async () => [provider({ placeholder: true, bytes: 0, backup: true })]);
    const report = await runReconciliation({
      listActiveV2: async () => [],
      listDbMirrors: async () => [
        db({ status: "archived", hasMatchingDeleteEvent: true }),
        db({ assetId: "legacy", cloudinaryAssetId: "legacy-id", trustedV2: false }),
      ],
      lookupByAssetIds: lookup,
    });
    expect(lookup).toHaveBeenCalledWith(["cld-1"]);
    expect(report.records[0]?.classification).toBe("expected_archived_deleted");
  });

  it("does not begin a Cloudinary read when the DB preflight/read fails", async () => {
    const listActiveV2 = vi.fn(async () => []);
    await expect(runReconciliation({
      listDbMirrors: async () => { throw new Error("service_role_unavailable"); },
      listActiveV2,
      lookupByAssetIds: async () => [],
    })).rejects.toThrow("service_role_unavailable");
    expect(listActiveV2).not.toHaveBeenCalled();
  });

  it("consumes every provider Search page beyond the 500-resource boundary", async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({ asset_id: `cld-${index}`, version: 7, bytes: 1 }));
    const readPage = vi.fn(async (cursor?: string) => cursor ? { resources: [{ asset_id: "cld-500", version: 7, bytes: 1 }] } : { resources: firstPage, next_cursor: "page-2" });
    const resources = await collectActiveV2Pages(readPage);
    expect(resources).toHaveLength(501);
    expect(readPage.mock.calls).toEqual([[undefined], ["page-2"]]);
  });

  it("batches more than 10 DB IDs for the Admin API", async () => {
    const readBatch = vi.fn(async (ids: string[]) => ({ resources: ids.map((asset_id) => ({ asset_id, version: 7, bytes: 1 })) }));
    const ids = Array.from({ length: 11 }, (_, index) => `cld-${index}`);
    const sortedIds = [...ids].sort();
    const resources = await collectAdminAssetIdBatches(ids, readBatch);
    expect(resources).toHaveLength(11);
    expect(readBatch.mock.calls.map(([batch]) => batch)).toEqual([sortedIds.slice(0, 10), sortedIds.slice(10)]);
  });

  it("reads every Supabase page past the default 1,000-row boundary", async () => {
    const firstPage = Array.from({ length: 1_000 }, (_, index) => index);
    const readPage = vi.fn(async (from: number) => ({ data: from === 0 ? firstPage : [1_000], error: null }));
    await expect(collectSupabasePages(readPage, "read_failed")).resolves.toHaveLength(1_001);
    expect(readPage.mock.calls).toEqual([[0, 999], [1_000, 1_999]]);
  });

  it("does not qualify an upload event from a different provider version as V2 evidence", () => {
    const mirrors = buildDbMirrors(
      [{ asset_id: "db-1", cloudinary_asset_id: "cld-1", version: 7, status: "ready", metadata: { source: "cloudinary_webhook", org_id: "org-1" } }],
      [{ cloudinary_asset_id: "cld-1", version: 6, kind: "upload", metadata: { source: "cloudinary_webhook" } }],
    );
    expect(mirrors[0]?.trustedV2).toBe(false);
  });

  it("uses the Admin result for the same immutable ID/version despite endpoint-specific fields", async () => {
    const report = await runReconciliation({
      listActiveV2: async () => [provider({ bytes: 42, backup: false, placeholder: false })],
      listDbMirrors: async () => [db({ status: "archived", hasMatchingDeleteEvent: true })],
      lookupByAssetIds: async () => [provider({ bytes: 0, backup: true, placeholder: true })],
    });
    expect(report.summary.invalid_unclassifiable).toBe(0);
    expect(report.records[0]?.classification).toBe("expected_archived_deleted");
  });

  it("produces byte-identical normalized JSON for equivalent inventory permutations", () => {
    const providers = [
      provider({ assetId: "duplicate", version: 8, bytes: 80 }),
      provider({ assetId: "duplicate", version: 7, bytes: 70 }),
      provider({ assetId: "invalid", version: null }),
      provider({ assetId: "live", version: 3 }),
    ];
    const mirrors = [
      db({ assetId: "db-duplicate-b", cloudinaryAssetId: "duplicate", version: 8 }),
      db({ assetId: "db-duplicate-a", cloudinaryAssetId: "duplicate", version: 7 }),
      db({ assetId: "db-invalid", cloudinaryAssetId: "invalid", version: null, trustedV2: true }),
      db({ assetId: "db-live", cloudinaryAssetId: "live", version: 3 }),
    ];
    const first = reconcileInventories({ providerAssets: providers, dbMirrors: mirrors });
    const second = reconcileInventories({ providerAssets: [...providers].reverse(), dbMirrors: [...mirrors].reverse() });
    expect(stringifyReport(first)).toBe(stringifyReport(second));
  });

  it("fails closed for an unknown contradictory state", () => {
    const report = classify([provider()], [db({ status: "processing" })]);
    expect(report.records[0]?.classification).toBe("invalid_unclassifiable");
  });

  it("returns a non-zero exit policy for critical drift", () => {
    expect(reportExitCode(classify([provider()], []))).toBe(1);
  });

  it("returns zero when every classification is clean or expected", () => {
    const report = classify([provider({ placeholder: true, bytes: 0, backup: true })], [db({ status: "archived", hasMatchingDeleteEvent: true })]);
    expect(reportExitCode(report)).toBe(0);
  });
});
