/**
 * IPI-1228 · SHOOT-REF-CONTENT-001 — durable reference-candidate preflight.
 *
 * Read-only. Never uploads, never approves, never writes to Cloudinary or Supabase.
 * Every candidate must pass this gate before `prepare`/`upload` may run, so the
 * thresholds live here in the repository instead of an operator's scratch directory.
 */
import { basename, join } from "node:path";

import { sniffCandidateImageHeader } from "@/lib/shoot/reference-candidate-image";
import {
  REFERENCE_LIBRARY_FOLDER,
  buildCandidateUploadParams,
  candidatePublicId,
  parseReferenceCandidateManifest,
  resolveUploadedIdentity,
  type ReferenceCandidate,
  type UploadedReferenceAsset,
} from "@/lib/shoot/reference-candidates";

export type PreflightCatalogRow = { id: string; referenceKey: string };
export type PreflightMediaAvailability = { referenceId: string; hasApprovedMedia: boolean };

/**
 * The subset of the reference-library runtime the preflight needs. Declared
 * structurally so the shared `ReferenceLibraryDeps` satisfies it without this
 * module importing the CLI entry point (which would create a cycle).
 */
export type PreflightDeps = {
  log(message: string): void;
  stderr(message: string): void;
  readManifest(path: string): Promise<unknown>;
  listDirectory(dir: string): string[];
  readFileBytes(path: string): Uint8Array | null;
  loadCatalog(): Promise<PreflightCatalogRow[]>;
  loadApprovedMappings(referenceIds: string[]): Promise<PreflightMediaAvailability[]>;
};

const CANDIDATE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"] as const;
const PREFLIGHT_IDENTITY_SENTINEL = "preflight-local-candidate";

function normalizeExtension(extension: string): string {
  return extension.toLowerCase() === "jpeg" ? "jpg" : extension.toLowerCase();
}

function candidatesFor(key: string, directory: string, deps: PreflightDeps): string[] {
  const expected = new RegExp(`^${key}\\.(${CANDIDATE_EXTENSIONS.join("|")})$`, "i");
  return deps
    .listDirectory(directory)
    .filter((entry) => expected.test(entry))
    .sort();
}

export async function commandPreflight(
  manifestPath: string,
  keys: string[] | null,
  directory: string,
  deps: PreflightDeps,
): Promise<number> {
  let rawManifest: unknown;
  try {
    rawManifest = await deps.readManifest(manifestPath);
  } catch {
    deps.stderr(`preflight: manifest not readable at ${manifestPath}`);
    return 1;
  }

  const parsed = parseReferenceCandidateManifest(rawManifest);
  if (!parsed.ok) {
    deps.stderr(`preflight: manifest invalid (${parsed.reason}): ${parsed.detail}`);
    return 1;
  }

  const manifest = parsed.manifest;
  const byKey = new Map<string, ReferenceCandidate>();
  for (const candidate of manifest.candidates) byKey.set(candidate.referenceKey, candidate);

  const failures: string[] = [];
  let selected: ReferenceCandidate[] = manifest.candidates;
  if (keys && keys.length > 0) {
    selected = [];
    for (const key of keys) {
      const candidate = byKey.get(key);
      if (!candidate) {
        failures.push(`FAIL ${key} — requested key is not in the manifest`);
        continue;
      }
      selected.push(candidate);
    }
  }

  const catalog = await deps.loadCatalog();
  const catalogKeys = new Set(catalog.map((row) => row.referenceKey));
  const availability = await deps.loadApprovedMappings(catalog.map((row) => row.id));
  const approvedKeys = new Set(
    availability
      .filter((row) => row.hasApprovedMedia)
      .map((row) => catalog.find((entry) => entry.id === row.referenceId)?.referenceKey)
      .filter((key): key is string => typeof key === "string"),
  );

  let passed = 0;
  for (const candidate of selected) {
    const reasons: string[] = [];
    const key = candidate.referenceKey;

    if (!catalogKeys.has(key)) reasons.push("reference key is not in the canonical catalog");
    if (approvedKeys.has(key)) reasons.push("reference already has an approved mapping");

    const matches = candidatesFor(key, directory, deps);
    if (matches.length === 0) {
      reasons.push(`no candidate file found in ${directory}`);
    } else if (matches.length > 1) {
      reasons.push(`ambiguous — ${matches.length} candidate files (${matches.join(", ")})`);
    }

    let summary = `${key}`;
    const provenance = candidate.provenanceSource;
    if (matches.length === 1) {
      const fileName = matches[0];
      const declared = basename(candidate.file);
      if (declared !== fileName) {
        reasons.push(`manifest file ${declared} does not match ${fileName}`);
      }

      const bytes = deps.readFileBytes(join(directory, fileName));
      const header = bytes ? sniffCandidateImageHeader(bytes) : null;
      if (!bytes) {
        reasons.push("candidate file is not readable");
      } else if (!header) {
        reasons.push("not a valid jpg/png/webp/avif image");
      } else {
        const declaredExtension = normalizeExtension(fileName.split(".").pop() ?? "");
        if (declaredExtension !== header.format) {
          reasons.push(`extension .${declaredExtension} does not match detected format ${header.format}`);
        }

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
        if (!identity.ok) reasons.push(identity.detail);

        summary = `${key} ${fileName} ${header.width}x${header.height} ${bytes.length}B ${header.format}`;
      }
    }

    const uploadParams = buildCandidateUploadParams(candidate);
    if (uploadParams.type !== "authenticated") reasons.push("upload delivery type must be authenticated");
    if (uploadParams.resource_type !== "image") reasons.push("upload resource type must be image");
    if (uploadParams.folder !== REFERENCE_LIBRARY_FOLDER) {
      reasons.push(`upload folder must be ${REFERENCE_LIBRARY_FOLDER}`);
    }
    if (uploadParams.overwrite !== false) reasons.push("upload must not overwrite");

    if (reasons.length === 0) {
      passed += 1;
      deps.log(`PASS ${summary}`);
      deps.log(`  provenance: ${provenance}`);
    } else {
      failures.push(`FAIL ${key} — ${reasons.join("; ")}`);
    }
  }

  for (const failure of failures) deps.stderr(failure);

  deps.log(`preflight: ${manifestPath} — ${selected.length} candidate(s) checked in ${directory}`);
  deps.log(`catalog: ${catalog.length} reference(s), ${approvedKeys.size} already approved`);
  deps.log(`No upload and no approval was performed by this command.`);

  if (failures.length > 0) {
    deps.stderr(`PREFLIGHT FAILED — ${failures.length} problem(s) across ${selected.length} candidate(s).`);
    deps.stderr("STOP: do not upload.");
    return 1;
  }

  deps.log(`PREFLIGHT PASSED — ${passed} candidate(s) validated.`);
  return 0;
}
