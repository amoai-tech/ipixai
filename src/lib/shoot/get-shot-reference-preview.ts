import "server-only";

import { isDatabaseUuid } from "@/lib/database-uuid";
import {
  AUTHENTICATED_DELIVERY_TYPE,
  MVP_RESOURCE_TYPE,
  isAssetPreviewKind,
  namedTransformForPreview,
  type AssetPreviewKind,
} from "@/lib/cloudinary/preview-contract";
import { signExactVersionPreviewUrl } from "@/lib/cloudinary/sign-delivery-url";

export const isReferenceUuid = isDatabaseUuid;

export type ShotReferencePreviewOk = {
  ok: true;
  url: string;
  referenceId: string;
  preview: AssetPreviewKind;
  version: number;
  publicId: string;
  format: string | null;
  namedTransform: string;
};

export type ShotReferencePreviewError = {
  ok: false;
  /**
   * Typed, fail-closed reasons. Every one of these means "no URL is returned";
   * the caller must never fall back to an unsigned/public URL or a "latest
   * version" guess.
   */
  reason:
    | "invalid_reference_id"
    | "unsupported_preview"
    | "reference_not_found"
    | "missing_approved_media"
    | "unsupported_resource_type"
    | "invalid_delivery_type"
    | "unapproved_mapping"
    | "invalid_mapping"
    | "signing_failed"
    | "lookup_failed";
};

export type ShotReferencePreviewResult =
  | ShotReferencePreviewOk
  | ShotReferencePreviewError;

/**
 * The exact approved mapping row returned by the server-only
 * `public.get_shot_reference_media(uuid)` SECURITY DEFINER function. Provider
 * identity/version never reaches the browser; this type is internal.
 */
export type ShotReferenceMediaRow = {
  reference_exists: boolean | null;
  has_approved_media: boolean | null;
  cloudinary_asset_id: string | null;
  public_id: string | null;
  version: number | string | null;
  format: string | null;
  resource_type: string | null;
  delivery_type: string | null;
  rights_status: string | null;
};

/** Narrow structural client so tests can pass a fake without the full type. */
export type ShotReferenceMediaClient = {
  rpc: (
    fn: "get_shot_reference_media",
    args: { p_reference_id: string },
  ) => PromiseLike<{ data: ShotReferenceMediaRow[] | null; error: unknown }>;
};

function nonBlank(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * IPI-644 · SHOOT-DATA-002C — reference-specific authenticated preview.
 *
 * Global curated references are NOT tenant `public.assets` rows, so the tenant
 * DAM helper (`getAuthorizedAssetPreview`) is deliberately not reused: faking
 * tenant asset rows to satisfy that authorization model would create a second,
 * wrong source of truth. This helper resolves the trusted curated mapping
 * server-side through `get_shot_reference_media` (role-gated to `service_role`
 * so the raw provider identity is never reachable by an authenticated browser)
 * and then reuses the existing exact-version named-transform signer.
 *
 * Security contract:
 *   * `referenceId` is a locator, never authority — the approved mapping is
 *     resolved server-side and every invariant is re-checked here.
 *   * image + authenticated + rights-approved + positive exact version only.
 *   * no "latest version" fallback, no unsigned/public fallback, no secret or
 *     signed URL persistence.
 *   * every failure returns a typed reason and no URL.
 */
export async function getShotReferencePreview(input: {
  referenceId: unknown;
  preview: unknown;
  supabase: ShotReferenceMediaClient;
}): Promise<ShotReferencePreviewResult> {
  if (typeof input.referenceId !== "string" || !isReferenceUuid(input.referenceId)) {
    return { ok: false, reason: "invalid_reference_id" };
  }
  const referenceId = input.referenceId;

  if (!isAssetPreviewKind(input.preview)) {
    return { ok: false, reason: "unsupported_preview" };
  }
  const preview = input.preview;

  let rows: ShotReferenceMediaRow[] | null;
  try {
    const { data, error } = await input.supabase.rpc("get_shot_reference_media", {
      p_reference_id: referenceId,
    });
    if (error) return { ok: false, reason: "lookup_failed" };
    rows = data;
  } catch {
    return { ok: false, reason: "lookup_failed" };
  }

  const row = rows?.[0];
  if (!row || row.reference_exists !== true) {
    // A reference that does not exist and a reference whose existence the read
    // cannot confirm are the same answer to the caller: not found. No leak.
    return { ok: false, reason: "reference_not_found" };
  }
  if (row.has_approved_media !== true) {
    return { ok: false, reason: "missing_approved_media" };
  }

  if (row.resource_type !== MVP_RESOURCE_TYPE) {
    return { ok: false, reason: "unsupported_resource_type" };
  }
  if (row.delivery_type !== AUTHENTICATED_DELIVERY_TYPE) {
    return { ok: false, reason: "invalid_delivery_type" };
  }
  if (row.rights_status !== "approved_for_reference") {
    return { ok: false, reason: "unapproved_mapping" };
  }

  const publicId = nonBlank(row.public_id);
  const cloudinaryAssetId = nonBlank(row.cloudinary_asset_id);
  if (!publicId || !cloudinaryAssetId) {
    return { ok: false, reason: "invalid_mapping" };
  }

  const version =
    typeof row.version === "string" ? Number(row.version) : row.version;
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version <= 0) {
    return { ok: false, reason: "invalid_mapping" };
  }

  let url: string;
  try {
    url = signExactVersionPreviewUrl({
      publicId,
      version,
      preview,
      format: row.format,
    });
  } catch {
    return { ok: false, reason: "signing_failed" };
  }

  return {
    ok: true,
    url,
    referenceId,
    preview,
    version,
    publicId,
    format: nonBlank(row.format),
    namedTransform: namedTransformForPreview(preview),
  };
}
