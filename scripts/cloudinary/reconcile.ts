import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@supabase/supabase-js";
import {
  reconcileInventories,
  reportExitCode,
  stringifyReport,
  type DbMirror,
  type ProviderAsset,
  type ReconcileReport,
} from "@/lib/cloudinary/reconcile";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";

const SEARCH_PAGE_SIZE = 500;
const ADMIN_ASSET_ID_BATCH_SIZE = 10;

// A CLI is not loaded through Next's react-server condition, so importing the
// app modules marked `server-only` would make `tsx` fail before it can run.
// This is the same server-only configuration as those modules, confined here
// to a Node script and never exported to browser code.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function createReadOnlyServiceRoleClient() {
  const config = getPublicSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !serviceRoleKey) return null;
  return createClient<Database>(config.url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type DbRow = {
  asset_id: string;
  cloudinary_asset_id: string | null;
  version: number | null;
  status: string;
  metadata: unknown;
};
type EventRow = {
  cloudinary_asset_id: string | null;
  version: number | null;
  kind: string;
  metadata: unknown;
};

export type ReconcileDependencies = {
  listActiveV2: () => Promise<ProviderAsset[]>;
  listDbMirrors: () => Promise<DbMirror[]>;
  lookupByAssetIds: (assetIds: string[]) => Promise<ProviderAsset[]>;
};

function metadataValue(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeProviderResource(resource: unknown): ProviderAsset {
  const value = resource && typeof resource === "object" ? resource as Record<string, unknown> : {};
  return {
    assetId: typeof value.asset_id === "string" ? value.asset_id : null,
    version: typeof value.version === "number" ? value.version : null,
    placeholder: value.placeholder === true,
    bytes: typeof value.bytes === "number" ? value.bytes : null,
    backup: value.backup === true,
  };
}

function sameProviderAsset(a: ProviderAsset, b: ProviderAsset): boolean {
  return a.assetId === b.assetId && a.version === b.version && a.placeholder === b.placeholder && a.bytes === b.bytes && a.backup === b.backup;
}

function batches<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export async function collectActiveV2Pages(
  readPage: (cursor?: string) => Promise<{ resources?: unknown[]; next_cursor?: unknown }>,
): Promise<ProviderAsset[]> {
  const resources: ProviderAsset[] = [];
  let nextCursor: string | undefined;
  do {
    const page = await readPage(nextCursor);
    if (!Array.isArray(page.resources)) throw new Error("cloudinary_search_malformed_resources");
    resources.push(...page.resources.map(normalizeProviderResource));
    nextCursor = typeof page.next_cursor === "string" && page.next_cursor.length > 0 ? page.next_cursor : undefined;
  } while (nextCursor);
  return resources;
}

export async function listActiveV2FromCloudinary(): Promise<ProviderAsset[]> {
  return collectActiveV2Pages(async (cursor) => {
    let search = cloudinary.search
      .expression("context.schema_version:1")
      .max_results(SEARCH_PAGE_SIZE)
      .with_field("context");
    if (cursor) search = search.next_cursor(cursor);
    return search.execute() as Promise<{ resources?: unknown[]; next_cursor?: unknown }>;
  });
}

export async function listDbMirrorsFromSupabase(): Promise<DbMirror[]> {
  const supabase = createReadOnlyServiceRoleClient();
  if (!supabase) throw new Error("service_role_unavailable");
  const { data: rows, error: rowError } = await supabase
    .from("cloudinary_assets")
    .select("asset_id, cloudinary_asset_id, version, status, metadata");
  if (rowError || !rows) throw new Error(`cloudinary_assets_read_failed:${rowError?.message ?? "empty"}`);

  const candidateIds = rows
    .map((row) => row.cloudinary_asset_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .sort();
  const events: EventRow[] = [];
  for (const assetIds of batches(candidateIds, 100)) {
    const { data, error } = await supabase
      .from("asset_events")
      .select("cloudinary_asset_id, version, kind, metadata")
      .in("cloudinary_asset_id", assetIds);
    if (error || !data) throw new Error(`asset_events_read_failed:${error?.message ?? "empty"}`);
    events.push(...data);
  }

  return (rows as DbRow[]).map((row) => {
    const isWebhookMirror = metadataValue(row.metadata, "source") === "cloudinary_webhook" && metadataValue(row.metadata, "org_id") !== null;
    const sameIdEvents = events.filter((event) => event.cloudinary_asset_id === row.cloudinary_asset_id);
    const hasWebhookUpload = sameIdEvents.some((event) => event.kind === "upload" && metadataValue(event.metadata, "source") === "cloudinary_webhook");
    const hasMatchingDeleteEvent = sameIdEvents.some((event) =>
      event.kind === "deleted" && event.version === row.version && metadataValue(event.metadata, "source") === "cloudinary_webhook",
    );
    return {
      assetId: row.asset_id,
      cloudinaryAssetId: row.cloudinary_asset_id,
      version: row.version,
      status: row.status,
      trustedV2: isWebhookMirror && hasWebhookUpload,
      hasMatchingDeleteEvent,
    };
  });
}

export async function collectAdminAssetIdBatches(
  assetIds: string[],
  readBatch: (batch: string[]) => Promise<{ resources?: unknown[] }>,
): Promise<ProviderAsset[]> {
  const resources: ProviderAsset[] = [];
  for (const batch of batches([...assetIds].sort(), ADMIN_ASSET_ID_BATCH_SIZE)) {
    const response = await readBatch(batch);
    if (!Array.isArray(response.resources)) throw new Error("cloudinary_asset_lookup_malformed_resources");
    resources.push(...response.resources.map(normalizeProviderResource));
  }
  return resources;
}

export async function lookupByAssetIdsFromCloudinary(assetIds: string[]): Promise<ProviderAsset[]> {
  return collectAdminAssetIdBatches(assetIds, async (batch) =>
    cloudinary.api.resources_by_asset_ids(batch) as Promise<{ resources?: unknown[] }>,
  );
}

/** Runs both required directions. DB-to-provider lookup never depends on Search results. */
export async function runReconciliation(deps: ReconcileDependencies): Promise<ReconcileReport> {
  const [activeProviderAssets, dbMirrors] = await Promise.all([deps.listActiveV2(), deps.listDbMirrors()]);
  const assetIds = dbMirrors
    .filter((mirror) => mirror.trustedV2)
    .map((mirror) => mirror.cloudinaryAssetId)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .sort();
  const lookedUpProviderAssets = await deps.lookupByAssetIds(assetIds);

  // Search inventory owns duplicate detection. Equivalent reverse-lookup records
  // are the same provider object observed through the mandatory second direction.
  const providerAssets = [...activeProviderAssets];
  for (const lookup of lookedUpProviderAssets) {
    const matches = activeProviderAssets.filter((active) => active.assetId === lookup.assetId);
    if (matches.length === 1 && sameProviderAsset(matches[0]!, lookup)) continue;
    providerAssets.push(lookup);
  }
  return {
    ...reconcileInventories({ providerAssets, dbMirrors }),
    inventory: {
      activeProviderV2: activeProviderAssets.length,
      dbV2Candidates: dbMirrors.filter((mirror) => mirror.trustedV2).length,
    },
  };
}

export async function main(deps: ReconcileDependencies = {
  listActiveV2: listActiveV2FromCloudinary,
  listDbMirrors: listDbMirrorsFromSupabase,
  lookupByAssetIds: lookupByAssetIdsFromCloudinary,
}): Promise<number> {
  const report = await runReconciliation(deps);
  process.stdout.write(stringifyReport(report));
  return reportExitCode(report);
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
    const nested = (error as { error?: { message?: unknown } }).error?.message;
    if (typeof nested === "string" && nested) return nested;
  }
  return "reconciliation_failed";
}

if (process.argv[1]?.endsWith("reconcile.ts")) {
  main().then((code) => { process.exitCode = code; }).catch((error: unknown) => {
    process.stderr.write(`${safeErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
