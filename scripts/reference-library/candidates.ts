import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@supabase/supabase-js";
import {
  REFERENCE_CANDIDATE_TAG,
  buildApprovedReferenceMapping,
  buildCandidateUploadParams,
  buildStatusReport,
  parseReferenceCandidateManifest,
  planCandidateUploads,
  resolveUploadedIdentity,
  type ReferenceCandidate,
  type ReferenceCandidateManifest,
  type UploadedReferenceAsset,
} from "@/lib/shoot/reference-candidates";
import type { Database } from "@/lib/supabase/database.types";
import { commandPreflight, createLocalFileDeps } from "./preflight";

// IPI-644 · SHOOT-DATA-002C — curated shot-reference candidate pipeline.
//
// This CLI runs the automation boundary from the IPI-644 plan: prepare, upload
// (authenticated), tag, validate, and preview candidate media; and record the
// exact approved mapping only after a human approver is supplied. It NEVER
// approves on its own. Cloudinary stores the bytes; Supabase stores the truth.
//
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

const SEARCH_PAGE_SIZE = 500;
const DEFAULT_MANIFEST_PATH = "scripts/reference-library/manifest.json";
const DEFAULT_CANDIDATE_DIR = "assets/reference-candidates";

type UploadCandidateParams = ReturnType<typeof buildCandidateUploadParams>;

// The intersection is intentional; Codacy's hosted analyzer cannot resolve the `@/` path-alias
// import of UploadedReferenceAsset and wrongly assumes the constituent is `any`.
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type ProviderReferenceCandidate = UploadedReferenceAsset & { referenceKey: string };
export type ReferenceCatalogRow = { id: string; referenceKey: string };
export type ReferenceMediaAvailability = { referenceId: string; hasApprovedMedia: boolean };

export type RecordApprovedMappingInput = {
  referenceId: string;
  cloudinaryAssetId: string;
  publicId: string;
  version: number;
  format: string;
  provenanceSource: string;
  approvedBy: string;
};

// TypeScript requires an explicit parameter name in interface method signatures, and these names
// document the contract for each implementation below; the base `no-unused-vars` rule (which Codacy
// runs) cannot see that, so the whole contract is exempted here rather than suppressing 8 lines.
/* eslint-disable no-unused-vars -- interface method parameter names document the contract */
export interface ReferenceLibraryDeps {
  log(message: string): void;
  stderr(message: string): void;
  readManifest(path: string): Promise<unknown>;
  fileExists(path: string): boolean;
  listDirectory(directory: string): Promise<string[]>;
  readFileBytes(path: string): Promise<Uint8Array | null>;
  listProviderCandidates(): Promise<ProviderReferenceCandidate[]>;
  uploadCandidate(file: string, params: UploadCandidateParams): Promise<UploadedReferenceAsset>;
  destroyCandidate(publicId: string): Promise<void>;
  loadCatalog(): Promise<ReferenceCatalogRow[]>;
  loadApprovedMappings(referenceIds: string[]): Promise<ReferenceMediaAvailability[]>;
  recordApprovedMapping(input: RecordApprovedMappingInput): Promise<void>;
}
/* eslint-enable no-unused-vars */

type ParsedArgs = {
  command: string;
  positional: string[];
  flags: Map<string, string | true>;
};

type RuntimeConfig = {
  cloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  supabaseUrl: string;
  serviceRoleKey: string;
};

function runtimeConfig(): RuntimeConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
  const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cloudName || !cloudinaryApiKey || !cloudinaryApiSecret || !supabaseUrl || !serviceRoleKey) return null;
  return { cloudName, cloudinaryApiKey, cloudinaryApiSecret, supabaseUrl, serviceRoleKey };
}

function requireRuntimeConfig(): RuntimeConfig {
  const config = runtimeConfig();
  if (!config) throw new Error("reference_library_runtime_config_unavailable");
  return config;
}

function createServiceRoleClient() {
  const config = runtimeConfig();
  if (!config) return null;
  return createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "", ...rest] = argv;
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  const queue = [...rest];
  while (queue.length > 0) {
    const token = queue.shift() ?? "";
    if (token.startsWith("--")) {
      const name = token.slice(2);
      if (queue.length > 0 && !queue[0].startsWith("--")) {
        flags.set(name, queue.shift() ?? "");
      } else {
        flags.set(name, true);
      }
    } else {
      positional.push(token);
    }
  }
  return { command, positional, flags };
}

function stringFlag(flags: Map<string, string | true>, name: string): string | null {
  const value = flags.get(name);
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
    const nested = (error as { error?: { message?: unknown } }).error?.message;
    if (typeof nested === "string" && nested) return nested;
  }
  return "reference_library_failed";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readReferenceKeyFromContext(context: unknown): string | null {
  const record = asRecord(context);
  if (!record) return null;
  const direct = stringOrNull(record.reference_key);
  if (direct) return direct;
  const custom = asRecord(record.custom);
  return custom ? stringOrNull(custom.reference_key) : null;
}

function readTagReferenceKey(tags: unknown): string | null {
  if (!Array.isArray(tags)) return null;
  const prefix = "reference-key:";
  for (const tag of tags) {
    if (typeof tag === "string" && tag.startsWith(prefix)) return tag.slice(prefix.length);
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- see note on ProviderReferenceCandidate
export function normalizeProviderCandidate(resource: unknown): ProviderReferenceCandidate | null {
  const value = asRecord(resource);
  if (!value) return null;
  const referenceKey = readReferenceKeyFromContext(value.context) ?? readTagReferenceKey(value.tags);
  if (!referenceKey) return null;
  return {
    referenceKey,
    assetId: stringOrNull(value.asset_id),
    publicId: stringOrNull(value.public_id),
    version: numberOrNull(value.version),
    format: stringOrNull(value.format),
    resourceType: stringOrNull(value.resource_type),
    deliveryType: stringOrNull(value.type),
    width: numberOrNull(value.width),
    height: numberOrNull(value.height),
    bytes: numberOrNull(value.bytes),
  };
}

export function normalizeUploadResponse(response: unknown): UploadedReferenceAsset {
  const value = asRecord(response) ?? {};
  return {
    assetId: stringOrNull(value.asset_id),
    publicId: stringOrNull(value.public_id),
    version: numberOrNull(value.version),
    format: stringOrNull(value.format),
    resourceType: stringOrNull(value.resource_type),
    deliveryType: stringOrNull(value.type),
    width: numberOrNull(value.width),
    height: numberOrNull(value.height),
    bytes: numberOrNull(value.bytes),
  };
}

async function listProviderCandidatesFromCloudinary(): Promise<ProviderReferenceCandidate[]> {
  const response = await cloudinary.search
    .expression(`tags=${REFERENCE_CANDIDATE_TAG}`)
    .max_results(SEARCH_PAGE_SIZE)
    .with_field("context")
    .execute();
  const resources: unknown[] = Array.isArray(response.resources) ? response.resources : [];
  return resources
    .map(normalizeProviderCandidate)
    .filter((candidate): candidate is ProviderReferenceCandidate => candidate !== null);
}

async function uploadCandidateToCloudinary(file: string, params: UploadCandidateParams): Promise<UploadedReferenceAsset> {
  return normalizeUploadResponse(await cloudinary.uploader.upload(file, params));
}

async function destroyCandidateInCloudinary(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    type: "authenticated",
    invalidate: true,
  });
}

async function loadCatalogFromSupabase(): Promise<ReferenceCatalogRow[]> {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("service_role_unavailable");
  const { data, error } = await supabase.from("shot_type_references_view").select("id, reference_key");
  if (error || !data) throw new Error(`catalog_read_failed:${error?.message ?? "empty"}`);
  return data
    .map((row) => ({ id: stringOrNull(row.id), referenceKey: stringOrNull(row.reference_key) }))
    .filter((row): row is ReferenceCatalogRow => row.id !== null && row.referenceKey !== null);
}

async function loadApprovedMappingsFromSupabase(referenceIds: string[]): Promise<ReferenceMediaAvailability[]> {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("service_role_unavailable");
  // Single query over the least-privilege catalog view's computed `has_preview`
  // flag. The media table itself is deny-all (service_role included), so a direct
  // read is not possible; this view column is the sanctioned read path and avoids
  // one get_shot_reference_media RPC per reference id.
  const { data, error } = await supabase
    .from("shot_type_references_view")
    .select("id, has_preview")
    .in("id", referenceIds);
  if (error || !data) throw new Error(`reference_media_read_failed:${error?.message ?? "empty"}`);
  return data.map((row) => ({
    referenceId: String(row.id),
    hasApprovedMedia: row.has_preview === true,
  }));
}

async function recordApprovedMappingInSupabase(input: RecordApprovedMappingInput): Promise<void> {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("service_role_unavailable");
  const { error } = await supabase.rpc("record_shot_reference_media", {
    p_reference_id: input.referenceId,
    p_cloudinary_asset_id: input.cloudinaryAssetId,
    p_public_id: input.publicId,
    p_version: input.version,
    p_format: input.format,
    p_provenance_source: input.provenanceSource,
    p_approved_by: input.approvedBy,
  });
  if (error) throw new Error(`record_approved_mapping_failed:${error.message}`);
}

async function loadValidManifest(
  path: string,
  deps: ReferenceLibraryDeps,
): Promise<{ ok: true; manifest: ReferenceCandidateManifest } | { ok: false; detail: string }> {
  let raw: unknown;
  try {
    raw = await deps.readManifest(path);
  } catch {
    return { ok: false, detail: `could not read manifest ${path}` };
  }
  const parsed = parseReferenceCandidateManifest(raw);
  return parsed.ok ? { ok: true, manifest: parsed.manifest } : { ok: false, detail: parsed.detail };
}

async function loadApprovedKeySet(
  deps: ReferenceLibraryDeps,
  catalog?: ReferenceCatalogRow[],
): Promise<Set<string>> {
  const rows = catalog ?? (await deps.loadCatalog());
  if (rows.length === 0) return new Set<string>();
  const availability = await deps.loadApprovedMappings(rows.map((row) => row.id));
  const keyById = new Map(rows.map((row) => [row.id, row.referenceKey]));
  const keys = new Set<string>();
  for (const row of availability) {
    if (!row.hasApprovedMedia) continue;
    const key = keyById.get(row.referenceId);
    if (key) keys.add(key);
  }
  return keys;
}

function usage(deps: ReferenceLibraryDeps): number {
  deps.log(
    [
      "usage: reference-library [command]",
      "  preflight [manifest] [--keys k1,k2] [--dir dir]      READ-ONLY gate: verify every candidate before upload",
      "  prepare [manifest]                                  validate + confirm candidate files exist",
      "  upload [manifest] [--replace]                       upload authenticated candidates (never approves)",
      "  validate                                            verify uploaded candidate identities",
      "  approve [referenceKey] --approved-by [uuid] --manifest [manifest]   record the exact approved mapping",
      "  reject [referenceKey]                               record a rejection (no Supabase write)",
      "  status                                              approved/pending/missing/orphaned coverage",
    ].join("\n"),
  );
  return 1;
}

async function commandPrepare(path: string, deps: ReferenceLibraryDeps): Promise<number> {
  const loaded = await loadValidManifest(path, deps);
  if (!loaded.ok) {
    deps.stderr(`prepare failed: ${loaded.detail}`);
    return 1;
  }
  const missing = loaded.manifest.candidates.filter((candidate) => !deps.fileExists(resolve(candidate.file)));
  if (missing.length > 0) {
    for (const candidate of missing) deps.stderr(`missing file for ${candidate.referenceKey}: ${candidate.file}`);
    return 1;
  }
  deps.log(`prepare ok: ${loaded.manifest.candidates.length} candidate(s) ready to upload`);
  return 0;
}

async function commandUpload(path: string, replace: boolean, deps: ReferenceLibraryDeps): Promise<number> {
  const loaded = await loadValidManifest(path, deps);
  if (!loaded.ok) {
    deps.stderr(`upload failed: ${loaded.detail}`);
    return 1;
  }
  const provider = await deps.listProviderCandidates();
  const providerKeys = new Set(provider.map((candidate) => candidate.referenceKey));
  const approvedKeys = await loadApprovedKeySet(deps);
  const plan = planCandidateUploads(loaded.manifest.candidates, providerKeys, approvedKeys);

  let uploaded = 0;
  for (const entry of plan) {
    if (entry.action === "already_approved") {
      deps.log(`skip ${entry.referenceKey}: already approved`);
      continue;
    }
    if (entry.action === "replace_required" && !replace) {
      deps.log(`skip ${entry.referenceKey}: candidate exists; re-run with --replace to replace it`);
      continue;
    }
    const candidate = loaded.manifest.candidates.find((item) => item.referenceKey === entry.referenceKey);
    if (!candidate) continue;
    if (entry.action === "replace_required") await deps.destroyCandidate(entry.publicId);
    const uploadedAsset = await deps.uploadCandidate(resolve(candidate.file), buildCandidateUploadParams(candidate));
    const resolved = resolveUploadedIdentity(uploadedAsset);
    if (!resolved.ok) {
      deps.stderr(`uploaded ${entry.referenceKey} but its identity is invalid: ${resolved.detail}`);
      return 1;
    }
    deps.log(
      `uploaded ${entry.referenceKey} -> asset_id ${resolved.identity.assetId} v${resolved.identity.version} (${resolved.identity.format})`,
    );
    uploaded += 1;
  }
  deps.log(`upload complete: ${uploaded} uploaded, ${plan.length - uploaded} skipped. Candidates are NOT approved.`);
  return 0;
}

async function commandValidate(deps: ReferenceLibraryDeps): Promise<number> {
  const provider = await deps.listProviderCandidates();
  let failures = 0;
  for (const candidate of provider) {
    const resolved = resolveUploadedIdentity(candidate);
    if (!resolved.ok) {
      deps.stderr(`invalid ${candidate.referenceKey}: ${resolved.detail}`);
      failures += 1;
    }
  }
  deps.log(`validate: ${provider.length - failures}/${provider.length} candidate(s) valid`);
  return failures === 0 ? 0 : 1;
}

async function resolveApprovalContext(
  referenceKey: string,
  manifestPath: string,
  deps: ReferenceLibraryDeps,
): Promise<
  { ok: true; candidate: ReferenceCandidate; uploaded: ProviderReferenceCandidate; catalogId: string } | { ok: false; detail: string }
> {
  const loaded = await loadValidManifest(manifestPath, deps);
  if (!loaded.ok) return { ok: false, detail: loaded.detail };
  const candidate = loaded.manifest.candidates.find((item) => item.referenceKey === referenceKey);
  if (!candidate) return { ok: false, detail: `reference ${referenceKey} is not in the manifest` };
  const provider = await deps.listProviderCandidates();
  const uploaded = provider.find((item) => item.referenceKey === referenceKey);
  if (!uploaded) return { ok: false, detail: `reference ${referenceKey} has no uploaded candidate; run upload first` };
  const catalog = await deps.loadCatalog();
  const catalogRow = catalog.find((row) => row.referenceKey === referenceKey);
  if (!catalogRow) return { ok: false, detail: `reference ${referenceKey} is not a canonical catalog reference` };
  return { ok: true, candidate, uploaded, catalogId: catalogRow.id };
}

async function commandApprove(
  referenceKey: string,
  approvedBy: string | null,
  manifestPath: string | null,
  deps: ReferenceLibraryDeps,
): Promise<number> {
  if (!approvedBy) {
    deps.stderr("approve requires --approved-by [uuid] (the human approver)");
    return 1;
  }
  if (!manifestPath) {
    deps.stderr("approve requires --manifest [manifest] to bind provenance");
    return 1;
  }
  const resolved = await resolveApprovalContext(referenceKey, manifestPath, deps);
  if (!resolved.ok) {
    deps.stderr(`approve failed: ${resolved.detail}`);
    return 1;
  }
  const mapping = buildApprovedReferenceMapping(resolved.candidate, resolved.uploaded);
  if (!mapping.ok) {
    deps.stderr(`cannot approve ${referenceKey}: ${mapping.detail}`);
    return 1;
  }
  deps.log(
    `binding ${referenceKey} -> asset_id ${mapping.mapping.cloudinaryAssetId} public_id ${mapping.mapping.publicId} ` +
      `v${mapping.mapping.version} (${mapping.mapping.format}) provenance=${mapping.mapping.provenanceSource} ` +
      `approved_by=${approvedBy}`,
  );
  await deps.recordApprovedMapping({
    referenceId: resolved.catalogId,
    cloudinaryAssetId: mapping.mapping.cloudinaryAssetId,
    publicId: mapping.mapping.publicId,
    version: mapping.mapping.version,
    format: mapping.mapping.format,
    provenanceSource: mapping.mapping.provenanceSource,
    approvedBy,
  });
  deps.log(`approved ${referenceKey}`);
  return 0;
}

function commandReject(referenceKey: string, deps: ReferenceLibraryDeps): number {
  deps.log(
    `rejected review for ${referenceKey}. No mapping was written; replace the candidate with 'upload --replace' and review again.`,
  );
  return 0;
}

async function commandStatus(deps: ReferenceLibraryDeps): Promise<number> {
  const catalog = await deps.loadCatalog();
  const approvedKeys = await loadApprovedKeySet(deps, catalog);
  const provider = await deps.listProviderCandidates();
  const providerKeys = new Set(provider.map((candidate) => candidate.referenceKey));
  const report = buildStatusReport(catalog.map((row) => row.referenceKey), providerKeys, approvedKeys);
  deps.log(
    `reference library status: ${report.approved}/${report.total} approved, ` +
      `${report.pendingReview} pending review, ${report.missing} missing, ${report.orphaned.length} orphaned`,
  );
  if (report.orphaned.length > 0) deps.log(`orphaned provider candidates: ${report.orphaned.join(", ")}`);
  return 0;
}

export async function runCli(argv: string[], deps: ReferenceLibraryDeps): Promise<number> {
  const { command, positional, flags } = parseArgs(argv);
  const first = positional[0] ?? "";
  try {
    switch (command) {
      case "preflight": {
        const keys = stringFlag(flags, "keys");
        return commandPreflight(
          first || DEFAULT_MANIFEST_PATH,
          keys ? keys.split(",").map((key) => key.trim()).filter(Boolean) : null,
          stringFlag(flags, "dir") ?? DEFAULT_CANDIDATE_DIR,
          deps,
        );
      }
      case "prepare":
        return first ? commandPrepare(first, deps) : usage(deps);
      case "upload":
        return first ? commandUpload(first, flags.has("replace"), deps) : usage(deps);
      case "validate":
        return commandValidate(deps);
      case "approve":
        return first
          ? commandApprove(first, stringFlag(flags, "approved-by"), stringFlag(flags, "manifest"), deps)
          : usage(deps);
      case "reject":
        return first ? commandReject(first, deps) : usage(deps);
      case "status":
        return commandStatus(deps);
      default:
        return usage(deps);
    }
  } catch (error) {
    deps.stderr(`reference library command failed: ${safeErrorMessage(error)}`);
    return 1;
  }
}

export function createRuntimeDeps(): ReferenceLibraryDeps {
  requireRuntimeConfig();
  return {
    log: (message) => process.stdout.write(`${message}\n`),
    stderr: (message) => process.stderr.write(`${message}\n`),
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- operator-supplied manifest path
    readManifest: async (path) => JSON.parse(await readFile(resolve(path), "utf8")) as unknown,
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- operator-supplied manifest path
    fileExists: (path) => existsSync(resolve(path)),
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- operator-supplied candidate directory
    ...createLocalFileDeps(),
    listProviderCandidates: listProviderCandidatesFromCloudinary,
    uploadCandidate: uploadCandidateToCloudinary,
    destroyCandidate: destroyCandidateInCloudinary,
    loadCatalog: loadCatalogFromSupabase,
    loadApprovedMappings: loadApprovedMappingsFromSupabase,
    recordApprovedMapping: recordApprovedMappingInSupabase,
  };
}

export async function main(deps?: ReferenceLibraryDeps): Promise<number> {
  const resolvedDeps = deps ?? createRuntimeDeps();
  return runCli(process.argv.slice(2), resolvedDeps);
}

if (process.argv[1]?.endsWith("candidates.ts")) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${safeErrorMessage(error)}\n`);
      process.exitCode = 1;
    });
}
