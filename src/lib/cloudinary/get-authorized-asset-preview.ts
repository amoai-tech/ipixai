import "server-only";

import { isDatabaseUuid } from "@/lib/database-uuid";
import {
  listMembershipOrgIdsFromServerClient,
  resolveRuntimeTenant,
} from "@/lib/auth/runtime-org";
import type { VerifiedOperator } from "@/lib/auth/verified-operator";
import {
  AUTHENTICATED_DELIVERY_TYPE,
  MVP_RESOURCE_TYPE,
  isAssetPreviewKind,
  isAssetUrlIntent,
  namedTransformForPreview,
  type AssetPreviewKind,
  type AssetUrlIntent,
} from "@/lib/cloudinary/preview-contract";
import { signExactVersionPreviewUrl } from "@/lib/cloudinary/sign-delivery-url";

export const isUuid = isDatabaseUuid;

export type AuthorizedAssetPreviewOk = {
  ok: true;
  url: string;
  assetId: string;
  orgId: string;
  publicId: string;
  version: number;
  currentVersion: number;
  preview: AssetPreviewKind;
  intent: AssetUrlIntent;
  approved: boolean;
  namedTransform: string;
  cloudinaryAssetId: string | null;
};

export type AuthorizedAssetPreviewError = {
  ok: false;
  reason:
    | "invalid_asset_id"
    | "unsupported_preview"
    | "unsupported_intent"
    | "invalid_requested_version"
    | "version_not_approved"
    | "needs_onboarding"
    | "needs_org_selection"
    | "membership_lookup_failed"
    | "asset_not_found"
    | "foreign_org"
    | "missing_cloudinary_mirror"
    | "unsupported_resource_type"
    | "invalid_delivery_type"
    | "invalid_cloudinary_version"
    | "lookup_failed";
};

export type AuthorizedAssetPreviewResult =
  | AuthorizedAssetPreviewOk
  | AuthorizedAssetPreviewError;

type AssetOrgRow = {
  id: string;
  brands: { org_id: string } | { org_id: string }[] | null;
};

type CloudinaryMirrorRow = {
  public_id: string;
  version: number | string | null;
  delivery_type: string | null;
  resource_type: string | null;
  format: string | null;
  cloudinary_asset_id: string | null;
};

type NarrowSelect = {
  eq: (column: string, value: string | number) => NarrowSelect;
  maybeSingle: () => PromiseLike<{
    data: AssetOrgRow | CloudinaryMirrorRow | null;
    error: unknown;
  }>;
  limit: (
    count: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
};

type NarrowQuery = {
  select: (columns: string) => NarrowSelect;
};

type AssetLookupClient = {
  from: (table: string) => NarrowQuery;
};

function oneBrand(
  value: AssetOrgRow["brands"],
): { org_id: string } | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Server-authorized DAM preview URL (IPI-1112).
 * Trusted org → asset+brand org → mirror by asset_id UNIQUE →
 * ownership + version + image-only → signed named transform.
 * Never uses stored secure_url as the auth boundary.
 */
export async function getAuthorizedAssetPreview(input: {
  assetId: string;
  preview: unknown;
  /** `preview` (default, IPI-1112) or `delivery` (IPI-1120 approval-gated). */
  intent?: unknown;
  /** Optional exact provider version; defaults to the mirror's current version. */
  version?: unknown;
  operator: VerifiedOperator;
  supabase: AssetLookupClient;
  listOrgIds?: () => Promise<{ ok: true; orgIds: string[] } | { ok: false }>;
}): Promise<AuthorizedAssetPreviewResult> {
  if (!isUuid(input.assetId)) {
    return { ok: false, reason: "invalid_asset_id" };
  }
  if (!isAssetPreviewKind(input.preview)) {
    return { ok: false, reason: "unsupported_preview" };
  }
  const preview = input.preview;

  const intentValue = input.intent ?? "preview";
  if (!isAssetUrlIntent(intentValue)) {
    return { ok: false, reason: "unsupported_intent" };
  }
  const intent = intentValue;

  let requestedVersion: number | null = null;
  if (input.version !== undefined && input.version !== null && input.version !== "") {
    const raw =
      typeof input.version === "number"
        ? input.version
        : typeof input.version === "string"
          ? Number(input.version)
          : Number.NaN;
    if (!Number.isInteger(raw) || raw <= 0) {
      return { ok: false, reason: "invalid_requested_version" };
    }
    requestedVersion = raw;
  }

  const listOrgIds =
    input.listOrgIds ??
    (() =>
      listMembershipOrgIdsFromServerClient(
        input.supabase,
        input.operator.id,
      ));

  const tenant = await resolveRuntimeTenant({ listOrgIds });
  if (tenant.status === "lookup_failed") {
    return { ok: false, reason: "membership_lookup_failed" };
  }
  if (tenant.status !== "ok") {
    return { ok: false, reason: tenant.status };
  }

  let asset: AssetOrgRow | null;
  try {
    const { data, error } = await input.supabase
      .from("assets")
      .select("id, brands(org_id)")
      .eq("id", input.assetId)
      .maybeSingle();
    if (error) return { ok: false, reason: "lookup_failed" };
    asset = data as AssetOrgRow | null;
  } catch {
    return { ok: false, reason: "lookup_failed" };
  }

  if (!asset) return { ok: false, reason: "asset_not_found" };

  const brand = oneBrand(asset.brands);
  if (!brand?.org_id) return { ok: false, reason: "lookup_failed" };
  if (brand.org_id !== tenant.orgId) {
    return { ok: false, reason: "foreign_org" };
  }

  let mirror: CloudinaryMirrorRow | null;
  try {
    const { data, error } = await input.supabase
      .from("cloudinary_assets")
      .select(
        "public_id, version, delivery_type, resource_type, format, cloudinary_asset_id",
      )
      .eq("asset_id", input.assetId)
      .maybeSingle();
    if (error) return { ok: false, reason: "lookup_failed" };
    mirror = data as CloudinaryMirrorRow | null;
  } catch {
    return { ok: false, reason: "lookup_failed" };
  }

  if (!mirror?.public_id) {
    return { ok: false, reason: "missing_cloudinary_mirror" };
  }
  if (mirror.resource_type !== MVP_RESOURCE_TYPE) {
    return { ok: false, reason: "unsupported_resource_type" };
  }
  if (mirror.delivery_type !== AUTHENTICATED_DELIVERY_TYPE) {
    return { ok: false, reason: "invalid_delivery_type" };
  }

  const currentVersion =
    typeof mirror.version === "string"
      ? Number(mirror.version)
      : mirror.version;
  if (!Number.isFinite(currentVersion) || !currentVersion || currentVersion <= 0) {
    return { ok: false, reason: "invalid_cloudinary_version" };
  }

  // A specific historical version may be requested (e.g. the approved vN while
  // a newer vN+1 is pending), but never a version the mirror has not seen.
  if (requestedVersion !== null && requestedVersion > currentVersion) {
    return { ok: false, reason: "invalid_requested_version" };
  }
  const version = requestedVersion ?? currentVersion;

  // IPI-1120 · MEDIA-DELIVERY-001 — exact-version human approval guard.
  // Delivery authorization is the durable provider-identity approval event,
  // never `cloudinary_assets.approval` (convenience UI state). RLS on
  // asset_events already scopes this read to the caller's own org, and the
  // asset/brand org check above ran first, so a foreign or anonymous caller
  // can never observe a matching row. No matching row -> fail closed.
  let approved = false;
  if (intent === "delivery") {
    if (!mirror.cloudinary_asset_id) {
      return { ok: false, reason: "version_not_approved" };
    }
    let approvalRows: unknown[] | null;
    try {
      const { data, error } = await input.supabase
        .from("asset_events")
        .select("id")
        .eq("asset_id", asset.id)
        .eq("cloudinary_asset_id", mirror.cloudinary_asset_id)
        .eq("version", version)
        .eq("kind", "approved")
        .limit(1);
      if (error) return { ok: false, reason: "lookup_failed" };
      approvalRows = data;
    } catch {
      return { ok: false, reason: "lookup_failed" };
    }
    if (!approvalRows || approvalRows.length === 0) {
      return { ok: false, reason: "version_not_approved" };
    }
    approved = true;
  }

  const url = signExactVersionPreviewUrl({
    publicId: mirror.public_id,
    version,
    preview,
    format: mirror.format,
  });

  return {
    ok: true,
    url,
    assetId: asset.id,
    orgId: tenant.orgId,
    publicId: mirror.public_id,
    version,
    currentVersion,
    preview,
    intent,
    approved,
    namedTransform: namedTransformForPreview(preview),
    cloudinaryAssetId: mirror.cloudinary_asset_id,
  };
}
