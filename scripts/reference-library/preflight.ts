/**
 * IPI-1228 · SHOOT-REF-CONTENT-001 — durable reference-candidate preflight.
 *
 * Read-only. Never uploads, never approves, never writes to Cloudinary or Supabase.
 * Every candidate must pass this gate before `prepare`/`upload` may run, so the
 * thresholds live here in the repository instead of an operator's scratch directory.
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { sniffCandidateImageHeader } from "@/lib/shoot/reference-candidate-image";
import {
  REFERENCE_LIBRARY_FOLDER,
  buildCandidateUploadParams,
  candidatePublicId,
  parseReferenceCandidateManifest,
  resolveUploadedIdentity,
  type ReferenceCandidate,
  type ReferenceCandidateManifest,
  type UploadedReferenceAsset,
} from "@/lib/shoot/reference-candidates";

export type PreflightCatalogRow = { id: string; referenceKey: string };
export type PreflightMediaAvailability = { referenceId: string; hasApprovedMedia: boolean };

// TypeScript requires an explicit parameter name in type method signatures and those names document
// the contract for each implementation; the base `no-unused-vars` rule Codacy runs cannot see that.
/* eslint-disable no-unused-vars -- method parameter names document the contract */
export type PreflightDeps = {
  log(message: string): void;
  stderr(message: string): void;
  readManifest(path: string): Promise<unknown>;
  listDirectory(dir: string): Promise<string[]>;
  readFileBytes(path: string): Promise<Uint8Array | null>;
  loadCatalog(): Promise<PreflightCatalogRow[]>;
  loadApprovedMappings(referenceIds: string[]): Promise<PreflightMediaAvailability[]>;
};
/* eslint-enable no-unused-vars */

const CANDIDATE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"] as const;
const PREFLIGHT_IDENTITY_SENTINEL = "preflight-local-candidate";

/** Local filesystem access, kept out of the CLI entry point so that file stays small. */
export function createLocalFileDeps(): Pick<PreflightDeps, "listDirectory" | "readFileBytes"> {
  return {
    listDirectory: async (directory) => {
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- operator-supplied candidate directory
        const entries = await readdir(resolve(directory), { withFileTypes: true });
        return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
      } catch {
        return [];
      }
    },
    readFileBytes: async (path) => {
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- operator-supplied candidate path
        return new Uint8Array(await readFile(resolve(path)));
      } catch {
        return null;
      }
    },
  };
}

function normalizeExtension(extension: string): string {
  return extension.toLowerCase() === "jpeg" ? "jpg" : extension.toLowerCase();
}

function matchesKey(fileName: string, key: string): boolean {
  const separator = fileName.lastIndexOf(".");
  if (separator <= 0) return false;
  if (fileName.slice(0, separator) !== key) return false;
  const extension = fileName.slice(separator + 1).toLowerCase();
  return (CANDIDATE_EXTENSIONS as readonly string[]).includes(extension);
}

async function candidateFilesFor(key: string, directory: string, deps: PreflightDeps): Promise<string[]> {
  const entries = await deps.listDirectory(directory);
  return entries.filter((entry) => matchesKey(entry, key)).sort();
}

function uploadContractReasons(candidate: ReferenceCandidate): string[] {
  const reasons: string[] = [];
  const params = buildCandidateUploadParams(candidate);
  if (params.type !== "authenticated") reasons.push("upload delivery type must be authenticated");
  if (params.resource_type !== "image") reasons.push("upload resource type must be image");
  if (params.folder !== REFERENCE_LIBRARY_FOLDER) reasons.push(`upload folder must be ${REFERENCE_LIBRARY_FOLDER}`);
  if (params.overwrite !== false) reasons.push("upload must not overwrite");
  return reasons;
}

function identityReasons(
  candidate: ReferenceCandidate,
  header: { format: string; width: number; height: number },
  bytes: Uint8Array,
): string[] {
  const synthesized: UploadedReferenceAsset = {
    assetId: PREFLIGHT_IDENTITY_SENTINEL,
    publicId: candidatePublicId(candidate),
    version: 1,
    format: header.format,
    resourceType: "image",
    deliveryType: "authenticated",
    width: header.width,
    height: header.height,
    bytes: bytes.length,
  };
  const identity = resolveUploadedIdentity(synthesized);
  return identity.ok ? [] : [identity.detail];
}

/** Verifies the on-disk candidate for one manifest entry and returns its reasons + PASS summary. */
async function checkCandidateFile(
  candidate: ReferenceCandidate,
  directory: string,
  deps: PreflightDeps,
): Promise<{ reasons: string[]; summary: string }> {
  const key = candidate.referenceKey;
  const matches = await candidateFilesFor(key, directory, deps);
  if (matches.length === 0) return { reasons: [`no candidate file found in ${directory}`], summary: key };
  if (matches.length > 1) {
    return { reasons: [`ambiguous — ${matches.length} candidate files (${matches.join(", ")})`], summary: key };
  }

  const fileName = matches[0];
  const reasons: string[] = [];
  if (basename(candidate.file) !== fileName) {
    reasons.push(`manifest file ${basename(candidate.file)} does not match ${fileName}`);
  }

  const bytes = await deps.readFileBytes(join(directory, fileName));
  if (!bytes) return { reasons: [...reasons, "candidate file is not readable"], summary: key };

  const header = sniffCandidateImageHeader(bytes);
  if (!header) return { reasons: [...reasons, "not a valid jpg/png/webp/avif image"], summary: key };

  const declaredExtension = normalizeExtension(fileName.split(".").pop() ?? "");
  if (declaredExtension !== header.format) {
    reasons.push(`extension .${declaredExtension} does not match detected format ${header.format}`);
  }
  reasons.push(...identityReasons(candidate, header, bytes));

  const summary = `${key} ${fileName} ${header.width}x${header.height} ${bytes.length}B ${header.format}`;
  return { reasons, summary };
}

type ManifestRead = { ok: true; manifest: ReferenceCandidateManifest } | { ok: false };

async function readManifestOrReport(manifestPath: string, deps: PreflightDeps): Promise<ManifestRead> {
  let raw: unknown;
  try {
    raw = await deps.readManifest(manifestPath);
  } catch {
    deps.stderr(`preflight: manifest not readable at ${manifestPath}`);
    return { ok: false };
  }
  const parsed = parseReferenceCandidateManifest(raw);
  if (!parsed.ok) {
    deps.stderr(`preflight: manifest invalid (${parsed.reason}): ${parsed.detail}`);
    return { ok: false };
  }
  return { ok: true, manifest: parsed.manifest };
}

function selectCandidates(
  manifest: ReferenceCandidateManifest,
  keys: string[] | null,
): { selected: ReferenceCandidate[]; failures: string[] } {
  if (!keys || keys.length === 0) return { selected: manifest.candidates, failures: [] };
  const byKey = new Map(manifest.candidates.map((candidate) => [candidate.referenceKey, candidate]));
  const selected: ReferenceCandidate[] = [];
  const failures: string[] = [];
  for (const key of keys) {
    const candidate = byKey.get(key);
    if (candidate) selected.push(candidate);
    else failures.push(`FAIL ${key} — requested key is not in the manifest`);
  }
  return { selected, failures };
}

async function loadKeySets(
  deps: PreflightDeps,
): Promise<{ catalogKeys: Set<string>; approvedKeys: Set<string>; catalogSize: number }> {
  const catalog = await deps.loadCatalog();
  const byId = new Map(catalog.map((row) => [row.id, row.referenceKey]));
  const availability = await deps.loadApprovedMappings(catalog.map((row) => row.id));
  const approvedKeys = new Set<string>();
  for (const row of availability) {
    const key = row.hasApprovedMedia ? byId.get(row.referenceId) : undefined;
    if (key) approvedKeys.add(key);
  }
  return { catalogKeys: new Set(byId.values()), approvedKeys, catalogSize: catalog.length };
}

export async function commandPreflight(
  manifestPath: string,
  keys: string[] | null,
  directory: string,
  deps: PreflightDeps,
): Promise<number> {
  const manifestRead = await readManifestOrReport(manifestPath, deps);
  if (!manifestRead.ok) return 1;

  const { selected, failures } = selectCandidates(manifestRead.manifest, keys);
  const { catalogKeys, approvedKeys, catalogSize } = await loadKeySets(deps);

  let passed = 0;
  for (const candidate of selected) {
    const reasons: string[] = [];
    if (!catalogKeys.has(candidate.referenceKey)) reasons.push("reference key is not in the canonical catalog");
    if (approvedKeys.has(candidate.referenceKey)) reasons.push("reference already has an approved mapping");
    reasons.push(...uploadContractReasons(candidate));

    const checked = await checkCandidateFile(candidate, directory, deps);
    reasons.push(...checked.reasons);

    if (reasons.length === 0) {
      passed += 1;
      deps.log(`PASS ${checked.summary}`);
      deps.log(`  provenance: ${candidate.provenanceSource}`);
    } else {
      failures.push(`FAIL ${candidate.referenceKey} — ${reasons.join("; ")}`);
    }
  }

  for (const failure of failures) deps.stderr(failure);
  deps.log(`preflight: ${manifestPath} — ${selected.length} candidate(s) checked in ${directory}`);
  deps.log(`catalog: ${catalogSize} reference(s), ${approvedKeys.size} already approved`);
  deps.log("No upload and no approval was performed by this command.");

  if (failures.length > 0) {
    deps.stderr(`PREFLIGHT FAILED — ${failures.length} problem(s) across ${selected.length} candidate(s).`);
    deps.stderr("STOP: do not upload.");
    return 1;
  }

  deps.log(`PREFLIGHT PASSED — ${passed} candidate(s) validated.`);
  return 0;
}
