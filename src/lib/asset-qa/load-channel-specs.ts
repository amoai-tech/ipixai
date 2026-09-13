import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ChannelSpecFull } from "./types";

export async function loadChannelSpecsForQA(
  channels: readonly string[],
): Promise<Map<string, ChannelSpecFull>> {
  const specs = new Map<string, ChannelSpecFull>();
  if (channels.length === 0) return specs;

  try {
    const supabase = await createClient();
    if (!supabase) return specs;

    const { data: rules, error: rulesError } = await supabase
      .from("recommendation_rules")
      .select("condition_value, platform_slugs, image_type_slugs")
      .eq("rule_type", "channel_required")
      .eq("condition_key", "channel")
      .in("condition_value", channels as string[]);

    if (rulesError || !rules?.length) return specs;

    const platformSlugs = [...new Set(rules.flatMap((r) => r.platform_slugs ?? []))];
    const imageTypeSlugs = [...new Set(rules.flatMap((r) => r.image_type_slugs ?? []))];
    if (!platformSlugs.length || !imageTypeSlugs.length) return specs;

    const [{ data: platforms, error: platformsError }, { data: imageTypes, error: imageTypesError }] =
      await Promise.all([
        supabase.from("platforms").select("id, slug, name").in("slug", platformSlugs),
        supabase.from("image_type_defs").select("id, slug, name").in("slug", imageTypeSlugs),
      ]);

    if (platformsError || imageTypesError || !platforms?.length || !imageTypes?.length) return specs;

    const platformBySlug = new Map(
      platforms.flatMap((p) => (p.slug && p.id ? [[p.slug, { id: p.id, name: p.name }] as const] : [])),
    );
    const imageTypeBySlug = new Map(
      imageTypes.flatMap((it) =>
        it.slug && it.id ? [[it.slug, { id: it.id, name: it.name }] as const] : [],
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

    if (specsError || !specRows?.length) return specs;

    const specByPair = new Map(
      specRows.map((row) => [`${row.platform_id}:${row.image_type_id}`, row]),
    );

    for (const rule of rules) {
      const channel = rule.condition_value as string;
      if ((rule.platform_slugs?.length ?? 0) > 1 || (rule.image_type_slugs?.length ?? 0) > 1) {
        console.warn(
          `[asset-qa] rule for "${channel}" has multiple platform/image-type candidates; using only the first`,
        );
      }
      const platformSlug = rule.platform_slugs?.[0];
      const imageTypeSlug = rule.image_type_slugs?.[0];
      if (!platformSlug || !imageTypeSlug) continue;

      const platform = platformBySlug.get(platformSlug);
      const imageType = imageTypeBySlug.get(imageTypeSlug);
      if (!platform || !imageType) continue;

      const spec = specByPair.get(`${platform.id}:${imageType.id}`);
      if (!spec) continue;

      specs.set(channel, {
        platformId: platform.id,
        platformSlug,
        platformName: platform.name,
        imageTypeId: imageType.id,
        imageTypeSlug,
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
        acceptedFormats: spec.accepted_formats ?? [],
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
      });
    }
  } catch (err) {
    console.warn("[asset-qa] loadChannelSpecsForQA failed:", err);
    return new Map();
  }

  return specs;
}

export function getShootDeliverableRequirements(
  shoot: { target_channels?: string[] | null; deliverable_aspect_ratio?: string | null; deliverable_format?: string | null },
): Map<string, { aspectRatio?: string; format?: string }> {
  const requirements = new Map<string, { aspectRatio?: string; format?: string }>();
  if (!shoot.target_channels?.length) return requirements;

  for (const channel of shoot.target_channels) {
    requirements.set(channel, {
      aspectRatio: shoot.deliverable_aspect_ratio ?? undefined,
      format: shoot.deliverable_format ?? undefined,
    });
  }
  return requirements;
}