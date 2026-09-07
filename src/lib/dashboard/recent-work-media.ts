import type { SupabaseClient } from "@supabase/supabase-js";

import type { VerifiedOperator } from "@/lib/auth/verified-operator";
import { getAuthorizedAssetPreview } from "@/lib/cloudinary/get-authorized-asset-preview";

/**
 * DASH-MAIN-002: representative recent-work image per shoot, through the
 * one proven secure-delivery contract (IPI-1112 · CLD-DELIVERY-001) — never
 * a raw `mood_board_urls`/`cover_url` render (see command-center.ts's
 * loadOrgShoots comment on why that column isn't even selected).
 *
 * Kept out of command-center.ts deliberately: get-authorized-asset-preview.ts
 * imports "server-only", and command-center.ts is a shared util imported by
 * unrelated code (e.g. lib/shoot/get-shoot-detail.ts's runBrandIdBatches) —
 * folding this in there would have made every one of those consumers (and
 * their tests) transitively depend on "server-only" too.
 *
 * `assets.v2_shoot_id` is the only link from a V2 shoot to an asset, and not
 * every shoot has one yet — most tiles are expected to still fall back to
 * the honest placeholder, that's real state, not a bug here.
 *
 * Only the most-recently-created candidate asset per shoot is tried, not
 * every asset the shoot has: `getAuthorizedAssetPreview` is the actual
 * authorization + signing boundary (org ownership, Cloudinary mirror,
 * resource/delivery type, version), so a candidate that fails it just
 * falls back to the placeholder for that shoot — same "one deterministic
 * representative asset" contract the task asked for, without re-deriving
 * getAuthorizedAssetPreview's own validity checks here.
 *
 * Never throws / never fails the page: a candidate-query failure or an
 * individual preview failure both just omit that shoot's entry, exactly
 * like "no authorized image exists yet" — CommandCenter already renders
 * the neutral placeholder for any shoot missing from the returned map.
 */
export async function loadRecentWorkPreviews(
  supabase: SupabaseClient,
  operator: VerifiedOperator,
  shootIds: string[],
): Promise<Map<string, string>> {
  const previews = new Map<string, string>();
  if (shootIds.length === 0) return previews;

  let candidates: { id: string; v2_shoot_id: string | null }[];
  try {
    const { data, error } = await supabase
      .from("assets")
      .select("id, v2_shoot_id")
      .in("v2_shoot_id", shootIds)
      .order("created_at", { ascending: false });
    if (error || !data) {
      console.error("dashboard.loadRecentWorkPreviews: candidate query failed", { error });
      return previews;
    }
    candidates = data as { id: string; v2_shoot_id: string | null }[];
  } catch (err) {
    console.error("dashboard.loadRecentWorkPreviews: candidate query threw", { err });
    return previews;
  }

  // First (most-recent, per the query's own order) candidate wins per shoot.
  const assetIdByShootId = new Map<string, string>();
  for (const row of candidates) {
    if (row.v2_shoot_id && !assetIdByShootId.has(row.v2_shoot_id)) {
      assetIdByShootId.set(row.v2_shoot_id, row.id);
    }
  }

  await Promise.all(
    [...assetIdByShootId.entries()].map(async ([shootId, assetId]) => {
      const result = await getAuthorizedAssetPreview({
        assetId,
        preview: "masonry",
        operator,
        // Same narrow-interface cast the existing /api/assets/[assetId]/preview
        // route uses — the real SupabaseClient is a structural superset.
        supabase: supabase as never,
      });
      if (result.ok) {
        previews.set(shootId, result.url);
      }
    }),
  );

  return previews;
}
