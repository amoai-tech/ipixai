/**
 * IPI-1114 read-only Cloudinary V2 reconciliation primitives.
 *
 * This module deliberately contains no SDK or database imports.  The production
 * adapters inject read-only dependencies; this keeps the classification logic
 * deterministic and makes write paths impossible to introduce accidentally.
 */

export const RECONCILE_CLASSIFICATIONS = [
  "ok",
  "expected_archived_deleted",
  "provider_only_v2",
  "db_ready_provider_missing",
  "version_mismatch",
  "legacy_excluded",
  "invalid_unclassifiable",
] as const;

export type ReconcileClassification = (typeof RECONCILE_CLASSIFICATIONS)[number];

export type ProviderAsset = {
  assetId: string | null;
  version: number | null;
  /** A deleted Cloudinary backup placeholder has placeholder=true and bytes=0. */
  placeholder: boolean;
  bytes: number | null;
  backup: boolean;
};

export type DbMirror = {
  assetId: string;
  cloudinaryAssetId: string | null;
  version: number | null;
  status: string;
  trustedV2: boolean;
  hasMatchingDeleteEvent: boolean;
};

export type ReconcileRecord = {
  cloudinaryAssetId: string;
  classification: ReconcileClassification;
  dbAssetId: string | null;
  dbStatus: string | null;
  dbVersion: number | null;
  providerVersion: number | null;
};

export type ReconcileReport = {
  records: ReconcileRecord[];
  summary: Record<ReconcileClassification, number>;
  inventory?: {
    activeProviderV2: number;
    dbV2Candidates: number;
  };
};

const critical = new Set<ReconcileClassification>([
  "provider_only_v2",
  "db_ready_provider_missing",
  "version_mismatch",
  "invalid_unclassifiable",
]);

export function isCriticalClassification(value: ReconcileClassification): boolean {
  return critical.has(value);
}

function validId(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}

function validVersion(value: number | null): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isLiveProvider(provider: ProviderAsset | undefined): boolean {
  return Boolean(provider && validId(provider.assetId) && validVersion(provider.version) && !provider.placeholder);
}

function emptySummary(): ReconcileReport["summary"] {
  return Object.fromEntries(RECONCILE_CLASSIFICATIONS.map((key) => [key, 0])) as ReconcileReport["summary"];
}

/** Classify inventories by immutable Cloudinary asset_id and exact version. */
export function reconcileInventories(input: {
  providerAssets: ProviderAsset[];
  dbMirrors: DbMirror[];
}): ReconcileReport {
  const records: ReconcileRecord[] = [];
  const providerById = new Map<string, ProviderAsset>();
  const dbById = new Map<string, DbMirror>();
  const invalidIds = new Set<string>();

  for (const provider of input.providerAssets) {
    if (!validId(provider.assetId) || !validVersion(provider.version)) {
      records.push({
        cloudinaryAssetId: provider.assetId ?? "",
        classification: "invalid_unclassifiable",
        dbAssetId: null,
        dbStatus: null,
        dbVersion: null,
        providerVersion: provider.version,
      });
      continue;
    }
    if (providerById.has(provider.assetId)) invalidIds.add(provider.assetId);
    providerById.set(provider.assetId, provider);
  }

  for (const db of input.dbMirrors) {
    if (!validId(db.cloudinaryAssetId) || !validVersion(db.version) || !db.trustedV2) {
      records.push({
        cloudinaryAssetId: db.cloudinaryAssetId ?? "",
        classification: "legacy_excluded",
        dbAssetId: db.assetId,
        dbStatus: db.status,
        dbVersion: db.version,
        providerVersion: null,
      });
      continue;
    }
    if (dbById.has(db.cloudinaryAssetId)) invalidIds.add(db.cloudinaryAssetId);
    dbById.set(db.cloudinaryAssetId, db);
  }

  for (const id of [...invalidIds].sort()) {
    const db = dbById.get(id);
    const provider = providerById.get(id);
    records.push({
      cloudinaryAssetId: id,
      classification: "invalid_unclassifiable",
      dbAssetId: db?.assetId ?? null,
      dbStatus: db?.status ?? null,
      dbVersion: db?.version ?? null,
      providerVersion: provider?.version ?? null,
    });
  }

  const ids = [...new Set([...providerById.keys(), ...dbById.keys()])]
    .filter((id) => !invalidIds.has(id))
    .sort();
  for (const id of ids) {
    const provider = providerById.get(id);
    const db = dbById.get(id);
    let classification: ReconcileClassification;
    if (!db) {
      classification = "provider_only_v2";
    } else if (!provider) {
      classification = db.status === "archived" && db.hasMatchingDeleteEvent
        ? "expected_archived_deleted"
        : db.status === "ready" ? "db_ready_provider_missing" : "invalid_unclassifiable";
    } else if (provider.version !== db.version) {
      classification = "version_mismatch";
    } else if (db.status === "archived" && db.hasMatchingDeleteEvent && provider.placeholder && provider.bytes === 0 && provider.backup) {
      classification = "expected_archived_deleted";
    } else if (db.status === "ready" && isLiveProvider(provider)) {
      classification = "ok";
    } else if (db.status === "ready") {
      classification = "db_ready_provider_missing";
    } else {
      classification = "invalid_unclassifiable";
    }
    records.push({
      cloudinaryAssetId: id,
      classification,
      dbAssetId: db?.assetId ?? null,
      dbStatus: db?.status ?? null,
      dbVersion: db?.version ?? null,
      providerVersion: provider?.version ?? null,
    });
  }

  records.sort((a, b) =>
    a.cloudinaryAssetId.localeCompare(b.cloudinaryAssetId) ||
    a.classification.localeCompare(b.classification) ||
    (a.dbAssetId ?? "").localeCompare(b.dbAssetId ?? ""),
  );
  const summary = emptySummary();
  for (const record of records) summary[record.classification] += 1;
  return { records, summary };
}

export function reportExitCode(report: ReconcileReport): number {
  return report.records.some((record) => isCriticalClassification(record.classification)) ? 1 : 0;
}

/** Stable JSON payload: no execution time, random IDs, or provider response ordering. */
export function stringifyReport(report: ReconcileReport): string {
  return `${JSON.stringify(report)}\n`;
}
