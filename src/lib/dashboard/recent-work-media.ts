import type { SupabaseClient } from "@supabase/supabase-js";

import type { VerifiedOperator } from "@/lib/auth/verified-operator";
import { getAuthorizedAssetPreview } from "@/lib/cloudinary/get-authorized-asset-preview";

/**
 * IPI-1149 · DASH-MAIN-002 — Finish and Certify the Portfolio-First Command
 * Center in iPix V2: representative recent-work image per shoot, through
 * the one proven secure-delivery contract from
 * IPI-1112 · CLD-DELIVERY-001 — Serve Org-Safe Cloudinary Previews with
 * Named Transforms. Never a raw `mood_board_urls`/`cover_url` render (see
 * command-center.ts's loadOrgShoots comment on why that column isn't even
 * selected).
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
 * Each shoot is queried and resolved independently — its own bounded
 * candidate query, its own candidate loop, its own try/catch:
 * - independent queries (not one `.in("v2_shoot_id", shootIds)` read) so one
 *   shoot with many assets can never crowd another displayed shoot's
 *   candidates out of a capped response;
 * - independent try/catch (not one shared `Promise.all`) so an unexpected
 *   throw from one shoot's lookup can't reject the whole batch and blank
 *   every other shoot's already-succeeding preview.
 *
 * Up to CANDIDATE_LIMIT most-recently-created assets per shoot are tried,
 * newest first, stopping at the first one `getAuthorizedAssetPreview`
 * accepts — not just the single newest: a newer asset can be genuinely
 * unusable (upload still processing, wrong resource type, no Cloudinary
 * mirror yet) while an older linked asset is already a valid authenticated
 * image, and that older one should still render rather than falling back
 * to the placeholder. `getAuthorizedAssetPreview` stays the actual
 * authorization + signing boundary (org ownership, Cloudinary mirror,
 * resource/delivery type, version) for every candidate tried — this file
 * never re-derives its validity checks, only which candidate to try next.
 *
 * Never throws / never fails the page: a candidate-query failure or every
 * candidate failing its preview check both just omit that shoot's entry,
 * exactly like "no authorized image exists yet" — CommandCenter already
 * renders the neutral placeholder for any shoot missing from the returned
 * map.
 */
const CANDIDATE_LIMIT = 5;

export async function loadRecentWorkPreviews(
  supabase: SupabaseClient,
  operator: VerifiedOperator,
  shootIds: string[],
): Promise<Map<string, string>> {
  const previews = new Map<string, string>();

  await Promise.all(
    shootIds.map(async (shootId) => {
      let candidates: { id: string }[];
      try {
        const { data, error } = await supabase
          .from("assets")
          .select("id")
          .eq("v2_shoot_id", shootId)
          .order("created_at", { ascending: false })
          .limit(CANDIDATE_LIMIT);
        if (error || !data) {
          if (error) {
            console.error("dashboard.loadRecentWorkPreviews: candidate query failed", {
              shootId,
              error,
            });
          }
          return;
        }
        candidates = data;
      } catch (err) {
        console.error("dashboard.loadRecentWorkPreviews: candidate query threw", {
          shootId,
          err,
        });
        return;
      }

      // Sequential, not parallel: stop at the first candidate that passes,
      // newest first — trying every candidate concurrently would fire
      // needless auth/signing calls for older assets once a newer one
      // already succeeds (the common case).
      for (const candidate of candidates) {
        try {
          const result = await getAuthorizedAssetPreview({
            assetId: candidate.id,
            preview: "masonry",
            operator,
            // Same narrow-interface cast the existing /api/assets/[assetId]/preview
            // route uses — the real SupabaseClient is a structural superset.
            supabase: supabase as never,
          });
          if (result.ok) {
            previews.set(shootId, result.url);
            return;
          }
        } catch (err) {
          // A thrown (not {ok:false}) failure is unexpected — getAuthorizedAssetPreview
          // is designed to return ok:false, never throw, for a bad candidate.
          // Continuing to the next candidate assumes the failure is specific
          // to this asset, not the auth/signing path itself; if that ever
          // proves wrong (e.g. every candidate throws the same systemic
          // error), the loop still ends after CANDIDATE_LIMIT tries and
          // falls back to the honest placeholder, not a crash.
          console.error("dashboard.loadRecentWorkPreviews: candidate preview threw", {
            shootId,
            assetId: candidate.id,
            err,
          });
        }
      }
    }),
  );

  return previews;
}
