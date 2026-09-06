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
  namedTransformForPreview,
  type AssetPreviewKind,
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
  preview: AssetPreviewKind;
  namedTransform: string;
  cloudinaryAssetId: string | null;
};

export type AuthorizedAssetPreviewError = {
  ok: false;
  reason:
    | "invalid_asset_id"
    | "unsupported_preview"
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

type NarrowQuery = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      maybeSingle: () => PromiseLike<{
        data: AssetOrgRow | CloudinaryMirrorRow | null;
        error: unknown;
      }>;
    };
  };
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

  const version =
    typeof mirror.version === "string"
      ? Number(mirror.version)
      : mirror.version;
  if (!Number.isFinite(version) || !version || version <= 0) {
    return { ok: false, reason: "invalid_cloudinary_version" };
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
    preview,
    namedTransform: namedTransformForPreview(preview),
    cloudinaryAssetId: mirror.cloudinary_asset_id,
  };
}
