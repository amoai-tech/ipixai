import { isDatabaseUuid } from "@/lib/database-uuid";

/**
 * Shared signed-upload context contract (schema_version=1) for:
 * - IPI-1110 · CLD-SIGN-001 (writes these into Cloudinary context on sign)
 * - IPI-1111 · CLD-WEBHOOK-001 (reads them from verified notification payloads)
 *
 * Cloudinary stores them under `context.custom.<key>` (and may also echo them
 * in structured metadata). Never infer tenant/org from `public_id`.
 *
 * Frozen field names (must match IPI-1110):
 *   org_id | brand_id | asset_id | optional v2_shoot_id
 *
 * Disambiguation: Cloudinary notification root `asset_id` = provider identity.
 * Signed context `asset_id` = internal iPix `public.assets.id` UUID.
 */
export const IPIX_UPLOAD_CONTEXT_KEYS = {
  /** Server-minted iPix `public.assets.id` (UUID). Required for upload mirror. */
  assetId: "asset_id",
  /** Trusted org UUID resolved server-side at sign time (audit/metadata only). */
  orgId: "org_id",
  /** Brand UUID owned by that org. Required for creating/updating `assets`. */
  brandId: "brand_id",
  /** Optional canonical V2 shoot (`shoot.shoots.id`). */
  v2ShootId: "v2_shoot_id",
} as const;

export type IpixUploadContext = {
  assetId: string | null;
  orgId: string | null;
  brandId: string | null;
  v2ShootId: string | null;
  schemaVersion: string | null;
};

export const isUuid = isDatabaseUuid;

/**
 * Flatten Cloudinary context / metadata bags into a string map.
 * Signed `context.custom` wins over top-level context and structured metadata.
 */
export function flattenContextBag(
  context: unknown,
  metadata?: unknown,
): Record<string, string> {
  const out: Record<string, string> = {};

  const absorb = (value: unknown, opts?: { skipCustom?: boolean }) => {
    if (value == null) return;
    if (typeof value === "string") {
      for (const part of value.split("|")) {
        const eq = part.indexOf("=");
        if (eq <= 0) continue;
        const k = part.slice(0, eq).trim();
        const v = part.slice(eq + 1).trim();
        if (k && v) out[k] = v;
      }
      return;
    }
    if (typeof value !== "object") return;
    const obj = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (k === "custom") continue;
      if (v == null) continue;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        out[k] = String(v);
      }
    }
    if (!opts?.skipCustom && obj.custom && typeof obj.custom === "object") {
      absorb(obj.custom, { skipCustom: true });
    }
  };

  // Lowest trust first → signed custom last (authoritative).
  absorb(metadata);
  if (context != null && typeof context === "object" && !Array.isArray(context)) {
    const obj = context as Record<string, unknown>;
    absorb(obj, { skipCustom: true });
    if (obj.custom && typeof obj.custom === "object") {
      absorb(obj.custom, { skipCustom: true });
    }
  } else {
    absorb(context);
  }
  return out;
}

export function readIpixUploadContext(
  context: unknown,
  metadata?: unknown,
): IpixUploadContext {
  const flat = flattenContextBag(context, metadata);
  const pick = (key: string): string | null => {
    const raw = flat[key];
    return isUuid(raw) ? raw : null;
  };
  // Prefer frozen `asset_id`; accept deprecated `ipix_asset_id` only as fallback.
  const assetId =
    pick(IPIX_UPLOAD_CONTEXT_KEYS.assetId) ?? pick("ipix_asset_id");
  // Enforce V2 signed-context contract: schema_version must be "1".
  // If schema_version is missing or incorrect, null out org/brand/v2_shoot_id
  // so the RPC returns a terminal noop outcome instead of creating a business
  // asset without trusted context.
  const schemaVersion = flat.schema_version ?? null;
  const isTrusted = schemaVersion === "1";
  const orgId = isTrusted ? pick(IPIX_UPLOAD_CONTEXT_KEYS.orgId) : null;
  const brandId = isTrusted ? pick(IPIX_UPLOAD_CONTEXT_KEYS.brandId) : null;
  const v2ShootId = isTrusted ? pick(IPIX_UPLOAD_CONTEXT_KEYS.v2ShootId) : null;
  return {
    assetId,
    orgId,
    brandId,
    v2ShootId,
    schemaVersion,
  };
}
