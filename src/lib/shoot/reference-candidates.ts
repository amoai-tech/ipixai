// IPI-644 · SHOOT-DATA-002C — reference-library candidate pipeline (pure helpers).
//
// Ownership boundary (see issue IPI-644):
//   * Cloudinary owns the media binary + provider identity (asset_id/version).
//   * Supabase owns the approved truth via shoot.shot_type_reference_media.
//   * This module is the pure, side-effect-free contract between them: manifest
//     parsing, upload/tag/context planning, exact-identity validation, and
//     mapping construction. It never touches secrets or the network.
//
// It is intentionally NOT `server-only` so the tsx CLI
// (scripts/reference-library/candidates.ts) and Vitest can both import it. The
// CLI holds the Cloudinary/Supabase credentials; this module only decides what
// is legal to upload/validate/approve.
//
// Human-in-the-loop rule: automation may create, upload, tag, validate, and
// rank candidates. It must NOT make one official. `buildApprovedReferenceMapping`
// only produces a mapping from an explicitly approved candidate + a fully valid
// exact provider identity, and the CLI records it through a human-approved,
// service_role-only Supabase function.

import { PREVIEW_NAMED_TRANSFORMS } from "@/lib/cloudinary/preview-contract";

export const REFERENCE_LIBRARY_FOLDER = "ipix/reference-library";
export const REFERENCE_CANDIDATE_SCHEMA_VERSION = "reference-candidate-v1";
export const REFERENCE_CANDIDATE_TAG = "ipi-reference-candidate";
export const REFERENCE_APPROVED_TAG = "ipi-reference-approved";
export const APPROVED_REFERENCE_RESOURCE_TYPE = "image";
export const APPROVED_REFERENCE_DELIVERY_TYPE = "authenticated";
export const ALLOWED_CANDIDATE_FORMATS = ["jpg", "jpeg", "png", "webp", "avif"] as const;
export const MIN_CANDIDATE_SHORT_EDGE_PX = 800;
export const MAX_CANDIDATE_BYTES = 12 * 1024 * 1024;

/** Canonical reference-key invariant — must match the DB CHECK constraint. */
export const REFERENCE_KEY_PATTERN = /^[a-z0-9_]+$/;

/**
 * IPI-644 · P0 — the named preview transforms an approved reference must expose.
 *
 * Derived from the single canonical definition (`PREVIEW_NAMED_TRANSFORMS`) so
 * the eager set can never drift from what the signed preview path requests.
 * `f_auto`/`q_auto`/`dpr_auto` must stay OUTSIDE named transforms, so they are
 * deliberately not part of this list.
 */
export const REFERENCE_PREVIEW_EAGER_TRANSFORMS = Object.values(PREVIEW_NAMED_TRANSFORMS);

export type ReferenceCandidate = {
  referenceKey: string;
  file: string;
  provenanceSource: string;
  credit?: string | null;
  tags?: string[] | null;
};

export type ReferenceCandidateManifest = {
  schemaVersion: string;
  candidates: ReferenceCandidate[];
};

/** Raw Cloudinary upload/search identity. Every field is defensive-nullable. */
export type UploadedReferenceAsset = {
  assetId: string | null;
  publicId: string | null;
  version: number | string | null;
  format: string | null;
  resourceType: string | null;
  deliveryType: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
};

export type ReferenceMediaIdentity = {
  assetId: string;
  publicId: string;
  version: number;
  format: string;
};

export type ReferenceApprovedMapping = {
  referenceKey: string;
  cloudinaryAssetId: string;
  publicId: string;
  version: number;
  format: string;
  resourceType: string;
  deliveryType: string;
  provenanceSource: string;
};

export type ReferenceCandidateFailureReason =
  | "invalid_manifest"
  | "invalid_candidate"
  | "duplicate_reference_key";

export type ReferenceMediaFailureReason =
  | "missing_identity"
  | "unsupported_resource_type"
  | "invalid_delivery_type"
  | "unsupported_format"
  | "invalid_version"
  | "invalid_dimensions"
  | "image_too_small"
  | "image_too_large";

export type ReferenceMappingFailureReason =
  | ReferenceCandidateFailureReason
  | ReferenceMediaFailureReason
  | "mismatched_identity";

export type ManifestParseResult =
  | { ok: true; manifest: ReferenceCandidateManifest }
  | { ok: false; reason: ReferenceCandidateFailureReason; detail: string };

export type ReferenceIdentityResult =
  | { ok: true; identity: ReferenceMediaIdentity }
  | { ok: false; reason: ReferenceMediaFailureReason; detail: string };

export type ReferenceMappingResult =
  | { ok: true; mapping: ReferenceApprovedMapping }
  | { ok: false; reason: ReferenceMappingFailureReason; detail: string };

export type CandidateUploadAction = "upload" | "replace_required" | "already_approved";

export type CandidateUploadPlanEntry = {
  referenceKey: string;
  action: CandidateUploadAction;
  publicId: string;
};

export type ReferenceStatusReport = {
  total: number;
  approved: number;
  pendingReview: number;
  missing: number;
  orphaned: string[];
  approvedKeys: string[];
  pendingReviewKeys: string[];
  missingKeys: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonBlank(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function optionalTags(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const tags = value.map((tag) => nonBlank(tag)).filter((tag): tag is string => tag !== null);
  return tags.length > 0 ? tags : null;
}

function positiveVersion(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(parsed) || !Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function isPositiveInteger(value: number | null): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function normalizeFormat(value: unknown): string | null {
  const format = nonBlank(value)?.toLowerCase() ?? null;
  if (!format) return null;
  return (ALLOWED_CANDIDATE_FORMATS as readonly string[]).includes(format) ? format : null;
}

function parseCandidate(
  value: unknown,
  index: number,
): { ok: true; candidate: ReferenceCandidate } | { ok: false; reason: ReferenceCandidateFailureReason; detail: string } {
  const record = asRecord(value);
  if (!record) return { ok: false, reason: "invalid_candidate", detail: `candidate[${index}] must be an object` };

  const referenceKey = nonBlank(record.referenceKey);
  if (!referenceKey || !REFERENCE_KEY_PATTERN.test(referenceKey)) {
    return { ok: false, reason: "invalid_candidate", detail: `candidate[${index}] needs a snake_case referenceKey` };
  }

  const file = nonBlank(record.file);
  const provenanceSource = nonBlank(record.provenanceSource);
  if (!file || !provenanceSource) {
    return {
      ok: false,
      reason: "invalid_candidate",
      detail: `candidate[${index}] (${referenceKey}) needs file and provenanceSource`,
    };
  }

  return {
    ok: true,
    candidate: {
      referenceKey,
      file,
      provenanceSource,
      credit: nonBlank(record.credit),
      tags: optionalTags(record.tags),
    },
  };
}

export function parseReferenceCandidateManifest(value: unknown): ManifestParseResult {
  const record = asRecord(value);
  if (!record || record.schemaVersion !== REFERENCE_CANDIDATE_SCHEMA_VERSION) {
    return { ok: false, reason: "invalid_manifest", detail: `schemaVersion must be ${REFERENCE_CANDIDATE_SCHEMA_VERSION}` };
  }
  if (!Array.isArray(record.candidates) || record.candidates.length === 0) {
    return { ok: false, reason: "invalid_manifest", detail: "candidates must be a non-empty array" };
  }

  const candidates: ReferenceCandidate[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < record.candidates.length; index += 1) {
    const parsed = parseCandidate(record.candidates[index], index);
    if (!parsed.ok) return parsed;
    if (seen.has(parsed.candidate.referenceKey)) {
      return { ok: false, reason: "duplicate_reference_key", detail: `duplicate referenceKey ${parsed.candidate.referenceKey}` };
    }
    seen.add(parsed.candidate.referenceKey);
    candidates.push(parsed.candidate);
  }

  return { ok: true, manifest: { schemaVersion: REFERENCE_CANDIDATE_SCHEMA_VERSION, candidates } };
}

export function candidatePublicId(candidate: ReferenceCandidate): string {
  return `${REFERENCE_LIBRARY_FOLDER}/${candidate.referenceKey}`;
}

function sanitizeTag(value: string): string {
  return value.replace(/[^a-zA-Z0-9_:.-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function buildCandidateTags(candidate: ReferenceCandidate): string[] {
  const tags = [REFERENCE_CANDIDATE_TAG, `reference-key:${candidate.referenceKey}`, ...(candidate.tags ?? [])];
  const sanitized = tags.map(sanitizeTag).filter((tag) => tag.length > 0);
  return [...new Set(sanitized)];
}

function sanitizeContextValue(value: string): string {
  return value.replace(/[|=]+/g, " ").replace(/\s+/g, " ").trim();
}

export function buildCandidateContext(candidate: ReferenceCandidate): string {
  const fields = [
    ["schema_version", REFERENCE_CANDIDATE_SCHEMA_VERSION],
    ["reference_key", candidate.referenceKey],
    ["provenance_source", candidate.provenanceSource],
  ];
  if (candidate.credit) fields.push(["credit", candidate.credit]);
  return fields
    .map(([key, value]) => `${key}=${sanitizeContextValue(String(value))}`)
    .join("|");
}

export function buildCandidateUploadParams(candidate: ReferenceCandidate): {
  folder: string;
  public_id: string;
  type: typeof APPROVED_REFERENCE_DELIVERY_TYPE;
  resource_type: typeof APPROVED_REFERENCE_RESOURCE_TYPE;
  tags: string[];
  context: string;
  eager: Array<{ transformation: string }>;
  overwrite: boolean;
} {
  return {
    folder: REFERENCE_LIBRARY_FOLDER,
    public_id: candidate.referenceKey,
    type: APPROVED_REFERENCE_DELIVERY_TYPE,
    resource_type: APPROVED_REFERENCE_RESOURCE_TYPE,
    tags: buildCandidateTags(candidate),
    context: buildCandidateContext(candidate),
    // Authenticated assets cannot rely on lazy derivative generation, and the
    // preview API signs these exact named transforms, so create them eagerly at
    // upload time from the one canonical transform definition.
    eager: REFERENCE_PREVIEW_EAGER_TRANSFORMS.map((transformation) => ({ transformation })),
    overwrite: false,
  };
}

export function resolveUploadedIdentity(uploaded: UploadedReferenceAsset): ReferenceIdentityResult {
  const assetId = nonBlank(uploaded.assetId);
  const publicId = nonBlank(uploaded.publicId);
  if (!assetId || !publicId) {
    return { ok: false, reason: "missing_identity", detail: "uploaded asset needs a non-blank asset_id and public_id" };
  }

  if (uploaded.resourceType !== APPROVED_REFERENCE_RESOURCE_TYPE) {
    return { ok: false, reason: "unsupported_resource_type", detail: `resource_type must be ${APPROVED_REFERENCE_RESOURCE_TYPE}` };
  }
  if (uploaded.deliveryType !== APPROVED_REFERENCE_DELIVERY_TYPE) {
    return { ok: false, reason: "invalid_delivery_type", detail: `delivery type must be ${APPROVED_REFERENCE_DELIVERY_TYPE}` };
  }

  const format = normalizeFormat(uploaded.format);
  if (!format) {
    return { ok: false, reason: "unsupported_format", detail: `format must be one of ${ALLOWED_CANDIDATE_FORMATS.join(", ")}` };
  }

  const version = positiveVersion(uploaded.version);
  if (version === null) {
    return { ok: false, reason: "invalid_version", detail: "version must be a positive integer" };
  }

  if (!isPositiveInteger(uploaded.width) || !isPositiveInteger(uploaded.height)) {
    return { ok: false, reason: "invalid_dimensions", detail: "width and height must be positive integers" };
  }
  if (Math.min(uploaded.width, uploaded.height) < MIN_CANDIDATE_SHORT_EDGE_PX) {
    return {
      ok: false,
      reason: "image_too_small",
      detail: `short edge must be at least ${MIN_CANDIDATE_SHORT_EDGE_PX}px`,
    };
  }
  if (!isPositiveInteger(uploaded.bytes) || uploaded.bytes > MAX_CANDIDATE_BYTES) {
    return { ok: false, reason: "image_too_large", detail: `bytes must be between 1 and ${MAX_CANDIDATE_BYTES}` };
  }

  return { ok: true, identity: { assetId, publicId, version, format } };
}

export function buildApprovedReferenceMapping(
  candidate: ReferenceCandidate,
  uploaded: UploadedReferenceAsset,
): ReferenceMappingResult {
  const resolved = resolveUploadedIdentity(uploaded);
  if (!resolved.ok) return resolved;

  // Shape-validating the uploaded asset is not enough: a stale or mis-tagged
  // Cloudinary resource at a different public_id would otherwise become the
  // approved mapping. Bind the approved asset to this candidate's exact
  // location before recording anything durable.
  const expectedPublicId = candidatePublicId(candidate);
  if (resolved.identity.publicId !== expectedPublicId) {
    return {
      ok: false,
      reason: "mismatched_identity",
      detail: `uploaded public_id ${resolved.identity.publicId} does not match the candidate location ${expectedPublicId}`,
    };
  }

  return {
    ok: true,
    mapping: {
      referenceKey: candidate.referenceKey,
      cloudinaryAssetId: resolved.identity.assetId,
      publicId: resolved.identity.publicId,
      version: resolved.identity.version,
      format: resolved.identity.format,
      resourceType: APPROVED_REFERENCE_RESOURCE_TYPE,
      deliveryType: APPROVED_REFERENCE_DELIVERY_TYPE,
      provenanceSource: candidate.provenanceSource,
    },
  };
}

export function planCandidateUploads(
  candidates: ReferenceCandidate[],
  providerReferenceKeys: ReadonlySet<string>,
  approvedReferenceKeys: ReadonlySet<string>,
): CandidateUploadPlanEntry[] {
  return candidates.map((candidate) => {
    const publicId = candidatePublicId(candidate);
    if (approvedReferenceKeys.has(candidate.referenceKey)) {
      return { referenceKey: candidate.referenceKey, action: "already_approved" as const, publicId };
    }
    if (providerReferenceKeys.has(candidate.referenceKey)) {
      return { referenceKey: candidate.referenceKey, action: "replace_required" as const, publicId };
    }
    return { referenceKey: candidate.referenceKey, action: "upload" as const, publicId };
  });
}

export function buildStatusReport(
  catalogReferenceKeys: readonly string[],
  providerReferenceKeys: ReadonlySet<string>,
  approvedReferenceKeys: ReadonlySet<string>,
): ReferenceStatusReport {
  const catalog = [...catalogReferenceKeys].sort();
  const approvedKeys = catalog.filter((key) => approvedReferenceKeys.has(key));
  const pendingReviewKeys = catalog.filter((key) => !approvedReferenceKeys.has(key) && providerReferenceKeys.has(key));
  const missingKeys = catalog.filter((key) => !approvedReferenceKeys.has(key) && !providerReferenceKeys.has(key));
  const orphaned = [...providerReferenceKeys].filter((key) => !catalog.includes(key)).sort();

  return {
    total: catalog.length,
    approved: approvedKeys.length,
    pendingReview: pendingReviewKeys.length,
    missing: missingKeys.length,
    orphaned,
    approvedKeys,
    pendingReviewKeys,
    missingKeys,
  };
}
