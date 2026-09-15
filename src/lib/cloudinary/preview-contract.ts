/**
 * IPI-1112 · CLD-DELIVERY-001 — named-transform preview contract.
 * Dashboard already owns `t_asset-*` + eager on `ipix-signed-upload` — do not recreate.
 *
 * Node SDK `transformation: [{ transformation }]` takes the name WITHOUT `t_`.
 * Delivery URLs still use `/t_asset-masonry/` (lock: TRANSFORMS).
 */
export const ASSET_PREVIEW_KINDS = ["masonry", "review", "detail"] as const;

export type AssetPreviewKind = (typeof ASSET_PREVIEW_KINDS)[number];

/** SDK named-transform ids (no `t_`). URL form is `t_<name>`. */
export const PREVIEW_NAMED_TRANSFORMS = {
  masonry: "asset-masonry",
  review: "asset-review",
  detail: "asset-detail",
} as const satisfies Record<AssetPreviewKind, string>;

export const SIGNED_UPLOAD_PRESET = "ipix-signed-upload" as const;
export const AUTHENTICATED_DELIVERY_TYPE = "authenticated" as const;
export const MVP_RESOURCE_TYPE = "image" as const;

/**
 * IPI-1120 · MEDIA-DELIVERY-001 — what a signed authenticated URL is for.
 *
 * `preview` = org-internal review of an exact provider version (IPI-1112).
 * Deliberately stays available before a decision so an operator can actually
 * see the asset they are approving. It is not a delivery authorization.
 *
 * `delivery` = hand bytes to a downstream consumer. Only an exact
 * `(cloudinary_asset_id, version)` with a durable
 * `asset_events(kind='approved')` row may be signed. Never inferred from
 * `cloudinary_assets.approval`.
 */
export const ASSET_URL_INTENTS = ["preview", "delivery"] as const;

export type AssetUrlIntent = (typeof ASSET_URL_INTENTS)[number];

export function isAssetUrlIntent(value: unknown): value is AssetUrlIntent {
  return (
    typeof value === "string" &&
    (ASSET_URL_INTENTS as readonly string[]).includes(value)
  );
}

export function isAssetPreviewKind(value: unknown): value is AssetPreviewKind {
  return (
    typeof value === "string" &&
    (ASSET_PREVIEW_KINDS as readonly string[]).includes(value)
  );
}

export function namedTransformForPreview(
  preview: AssetPreviewKind,
): (typeof PREVIEW_NAMED_TRANSFORMS)[AssetPreviewKind] {
  return PREVIEW_NAMED_TRANSFORMS[preview];
}
