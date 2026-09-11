import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  reconcileInventories,
  reportExitCode,
  stringifyReport,
  type DbMirror,
  type ProviderAsset,
} from "../src/lib/cloudinary/reconcile";
import { collectActiveV2Pages, collectAdminAssetIdBatches, runReconciliation } from "../scripts/cloudinary/reconcile";

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

  it("produces byte-identical normalized JSON for identical input", () => {
    const input = { providerAssets: [provider({ assetId: "b" }), provider({ assetId: "a" })], dbMirrors: [db({ cloudinaryAssetId: "b" }), db({ cloudinaryAssetId: "a" })] };
    expect(stringifyReport(reconcileInventories(input))).toBe(stringifyReport(reconcileInventories(input)));
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
