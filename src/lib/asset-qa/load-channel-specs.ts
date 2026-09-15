import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ChannelSpecResolution } from "./types";

export async function loadChannelSpecsForQA(
  channels: readonly string[],
): Promise<Map<string, ChannelSpecResolution>> {
  const specs = new Map<string, ChannelSpecResolution>();
  if (channels.length === 0) return specs;

  try {
    const supabase = await createClient();
    if (!supabase) throw new Error("supabase_unavailable");

    const { data: rules, error: rulesError } = await supabase
      .from("recommendation_rules")
      .select("condition_value, platform_slugs, image_type_slugs")
      .eq("rule_type", "channel_required")
      .eq("condition_key", "channel")
      .in("condition_value", channels as string[]);

    if (rulesError) throw new Error(`recommendation_rules_query_failed: ${rulesError.message}`);
    if (!rules?.length) return specs;

    // Group all candidates by channel to detect ambiguity across ALL rules
    const channelCandidates = new Map<string, { platformSlug: string; imageTypeSlug: string }[]>();

    for (const rule of rules) {
      const channel = rule.condition_value as string;
      const platformSlugs = rule.platform_slugs ?? [];
      const imageTypeSlugs = rule.image_type_slugs ?? [];

      if (platformSlugs.length === 0 || imageTypeSlugs.length === 0) continue;

      // Cartesian product of platform_slugs × image_type_slugs for this rule
      for (const platformSlug of platformSlugs) {
        for (const imageTypeSlug of imageTypeSlugs) {
          const candidates = channelCandidates.get(channel) ?? [];
          candidates.push({ platformSlug, imageTypeSlug });
          channelCandidates.set(channel, candidates);
        }
      }
    }

    // Collect all unique platform/image-type slugs needed
    const allPlatformSlugs = new Set<string>();
    const allImageTypeSlugs = new Set<string>();
    for (const candidates of channelCandidates.values()) {
      for (const c of candidates) {
        allPlatformSlugs.add(c.platformSlug);
        allImageTypeSlugs.add(c.imageTypeSlug);
      }
    }

    if (!allPlatformSlugs.size || !allImageTypeSlugs.size) return specs;

    const [{ data: platforms, error: platformsError }, { data: imageTypes, error: imageTypesError }] =
      await Promise.all([
        supabase.from("platforms").select("id, slug, name").in("slug", [...allPlatformSlugs]),
        supabase.from("image_type_defs").select("id, slug, name").in("slug", [...allImageTypeSlugs]),
      ]);

    if (platformsError) throw new Error(`platforms_query_failed: ${platformsError.message}`);
    if (imageTypesError) throw new Error(`image_type_defs_query_failed: ${imageTypesError.message}`);
    if (!platforms?.length || !imageTypes?.length) return specs;

    const platformBySlug = new Map(
      platforms.flatMap((p) => (p.slug && p.id ? [[p.slug, { id: p.id, slug: p.slug, name: p.name }] as const] : [])),
    );
    const imageTypeBySlug = new Map(
      imageTypes.flatMap((it) =>
        it.slug && it.id ? [[it.slug, { id: it.id, slug: it.slug, name: it.name }] as const] : [],
      ),
    );

    const platformIds = [...platformBySlug.values()].map((p) => p.id);
    const imageTypeIds = [...imageTypeBySlug.values()].map((it) => it.id);

    const { data: specRows, error: specsError } = await supabase
      .from("image_specs")
      .select(
        "platform_id, image_type_id, width_px, height_px, min_width_px, min_height_px, max_width_px, max_height_px, aspect_ratio_w, aspect_ratio_h, aspect_ratio_label, accepted_formats, max_file_size_mb, recommended_color_mode, safe_zone_top_px, safe_zone_bottom_px, safe_zone_left_px, safe_zone_right_px, background_required, product_fill_min_pct, spec_confidence, organic, paid, shopping_support, mobile_notes, desktop_notes, crop_notes, best_use_cases, source_url, last_verified_at",
      )
      .in("platform_id", platformIds)
      .in("image_type_id", imageTypeIds);

    if (specsError) throw new Error(`image_specs_query_failed: ${specsError.message}`);
    if (!specRows?.length) return specs;

    const specByPair = new Map(
      specRows.map((row) => [`${row.platform_id}:${row.image_type_id}`, row]),
    );

    // Now resolve each channel: if exactly one candidate pair has a spec, use it; otherwise ambiguous
    for (const [channel, candidates] of channelCandidates.entries()) {
      type SpecRow = NonNullable<typeof specRows>[number];
      type PlatformRow = NonNullable<typeof platforms>[number];
      type ImageTypeRow = NonNullable<typeof imageTypes>[number];
      const validCandidates: Array<{
        platformSlug: string;
        imageTypeSlug: string;
        spec: SpecRow;
        platform: PlatformRow;
        imageType: ImageTypeRow;
      }> = [];

      for (const { platformSlug, imageTypeSlug } of candidates) {
        const platform = platformBySlug.get(platformSlug);
        const imageType = imageTypeBySlug.get(imageTypeSlug);
        if (!platform || !imageType) continue;

        const spec = specByPair.get(`${platform.id}:${imageType.id}`);
        if (!spec) continue;

        validCandidates.push({ platformSlug, imageTypeSlug, spec, platform, imageType });
      }

      if (validCandidates.length === 0) {
        // No valid spec found for any candidate
        continue;
      }

      if (validCandidates.length > 1) {
        specs.set(channel, {
          status: "ambiguous",
          candidates: validCandidates.map(({ platformSlug, imageTypeSlug }) => ({
            platformSlug,
            imageTypeSlug,
          })),
        });
        continue;
      }

      // Exactly one valid candidate
      const { spec, platform, imageType } = validCandidates[0];

      specs.set(channel, {
        status: "resolved",
        spec: {
          platformId: platform.id,
          platformSlug: platform.slug,
          platformName: platform.name,
          imageTypeId: imageType.id,
          imageTypeSlug: imageType.slug,
          imageTypeName: imageType.name,
          widthPx: spec.width_px,
          heightPx: spec.height_px,
          minWidthPx: spec.min_width_px ?? null,
          minHeightPx: spec.min_height_px ?? null,
          maxWidthPx: spec.max_width_px ?? null,
          maxHeightPx: spec.max_height_px ?? null,
          aspectRatioW: spec.aspect_ratio_w ?? null,
          aspectRatioH: spec.aspect_ratio_h ?? null,
          aspectRatioLabel: spec.aspect_ratio_label ?? null,
          acceptedFormats: spec.accepted_formats ?? null,
          maxFileSizeMb: spec.max_file_size_mb ?? null,
          recommendedColorMode: spec.recommended_color_mode ?? null,
          safeZoneTopPx: spec.safe_zone_top_px ?? null,
          safeZoneBottomPx: spec.safe_zone_bottom_px ?? null,
          safeZoneLeftPx: spec.safe_zone_left_px ?? null,
          safeZoneRightPx: spec.safe_zone_right_px ?? null,
          backgroundRequired: spec.background_required ?? null,
          productFillMinPct: spec.product_fill_min_pct ?? null,
          specConfidence: spec.spec_confidence ?? null,
          organic: spec.organic ?? false,
          paid: spec.paid ?? false,
          shoppingSupport: spec.shopping_support ?? false,
          mobileNotes: spec.mobile_notes ?? null,
          desktopNotes: spec.desktop_notes ?? null,
          cropNotes: spec.crop_notes ?? null,
          bestUseCases: spec.best_use_cases ?? null,
          sourceUrl: spec.source_url ?? null,
          lastVerifiedAt: spec.last_verified_at ?? null,
        },
      });
    }
  } catch (err) {
    console.error("[asset-qa] loadChannelSpecsForQA failed:", err);
    throw err;
  }

  return specs;
}
