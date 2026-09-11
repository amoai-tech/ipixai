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

function compareNullableString(a: string | null, b: string | null): number {
  return (a ?? "").localeCompare(b ?? "") || Number(a === null) - Number(b === null);
}

function compareNullableNumber(a: number | null, b: number | null): number {
  return (a ?? -1) - (b ?? -1) || Number(a === null) - Number(b === null);
}

function compareProvider(a: ProviderAsset, b: ProviderAsset): number {
  return compareNullableString(a.assetId, b.assetId) ||
    compareNullableNumber(a.version, b.version) ||
    Number(a.placeholder) - Number(b.placeholder) ||
    compareNullableNumber(a.bytes, b.bytes) ||
    Number(a.backup) - Number(b.backup);
}

function compareDbMirror(a: DbMirror, b: DbMirror): number {
  return compareNullableString(a.cloudinaryAssetId, b.cloudinaryAssetId) ||
    a.assetId.localeCompare(b.assetId) ||
    compareNullableNumber(a.version, b.version) ||
    a.status.localeCompare(b.status) ||
    Number(a.trustedV2) - Number(b.trustedV2) ||
    Number(a.hasMatchingDeleteEvent) - Number(b.hasMatchingDeleteEvent);
}

function addToGroup<T>(groups: Map<string, T[]>, id: string, value: T): void {
  const group = groups.get(id);
  if (group) group.push(value);
  else groups.set(id, [value]);
}

/** Classify inventories by immutable Cloudinary asset_id and exact version. */
export function reconcileInventories(input: {
  providerAssets: ProviderAsset[];
  dbMirrors: DbMirror[];
}): ReconcileReport {
  const records: ReconcileRecord[] = [];
  const providerGroups = new Map<string, ProviderAsset[]>();
  const dbGroups = new Map<string, DbMirror[]>();
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
    addToGroup(providerGroups, provider.assetId, provider);
  }

  for (const db of input.dbMirrors) {
    if (!db.trustedV2) {
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
    if (!validId(db.cloudinaryAssetId) || !validVersion(db.version)) {
      records.push({
        cloudinaryAssetId: db.cloudinaryAssetId ?? "",
        classification: "invalid_unclassifiable",
        dbAssetId: db.assetId,
        dbStatus: db.status,
        dbVersion: db.version,
        providerVersion: null,
      });
      continue;
    }
    addToGroup(dbGroups, db.cloudinaryAssetId, db);
  }

  for (const [id, group] of providerGroups) if (group.length > 1) invalidIds.add(id);
  for (const [id, group] of dbGroups) if (group.length > 1) invalidIds.add(id);

  for (const id of [...invalidIds].sort()) {
    const db = dbGroups.get(id)?.sort(compareDbMirror)[0];
    const provider = providerGroups.get(id)?.sort(compareProvider)[0];
    records.push({
      cloudinaryAssetId: id,
      classification: "invalid_unclassifiable",
      dbAssetId: db?.assetId ?? null,
      dbStatus: db?.status ?? null,
      dbVersion: db?.version ?? null,
      providerVersion: provider?.version ?? null,
    });
  }

  const ids = [...new Set([...providerGroups.keys(), ...dbGroups.keys()])]
    .filter((id) => !invalidIds.has(id))
    .sort();
  for (const id of ids) {
    const provider = providerGroups.get(id)?.[0];
    const db = dbGroups.get(id)?.[0];
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
    compareNullableString(a.dbAssetId, b.dbAssetId) ||
    compareNullableString(a.dbStatus, b.dbStatus) ||
    compareNullableNumber(a.dbVersion, b.dbVersion) ||
    compareNullableNumber(a.providerVersion, b.providerVersion),
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
