import { createClient } from "@/lib/supabase/server";

/**
 * IPI-1049 · TOOL-001 follow-up (PR #76 review) — authenticated, read-only
 * reference lookup for planDeliverables' format strings.
 *
 * Supabase owns the canonical channel → platform/image-type → spec mapping
 * (global reference tables, RLS `authenticated` SELECT, no tenant scope —
 * confirmed live on project nvdlhrodvevgwdsneplk):
 *   - public.recommendation_rules (rule_type='channel_required' rows map
 *     this tool's `channel` strings 1:1 to platform_slugs/image_type_slugs)
 *   - public.platforms / public.image_type_defs (slug → id)
 *   - public.image_specs (platform_id + image_type_id → aspect ratio,
 *     accepted formats, background requirement)
 *
 * This module is the *only* place that touches Supabase for TOOL-001 — the
 * deterministic quantity/scoring logic in planning.ts stays pure and keeps
 * taking plain data in. Best-effort only: any failure (no session, RLS,
 * network, an unmapped channel like "website" which Supabase doesn't own)
 * returns an empty map rather than throwing, so callers fall back to their
 * own ipix_default spec — a reference-data outage must never break the
 * Planner's ability to produce a deliverables draft.
 */

export type ChannelSpec = {
  aspectRatioLabel: string;
  acceptedFormat: string;
  backgroundRequired: string | null;
};

export async function loadChannelSpecs(channels: readonly string[]): Promise<Map<string, ChannelSpec>> {
  const specs = new Map<string, ChannelSpec>();
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
        supabase.from("platforms").select("id, slug").in("slug", platformSlugs),
        supabase.from("image_type_defs").select("id, slug").in("slug", imageTypeSlugs),
      ]);
    if (platformsError || imageTypesError || !platforms?.length || !imageTypes?.length) return specs;

    const platformIdBySlug = new Map(
      platforms.flatMap((platform) =>
        platform.slug && platform.id ? [[platform.slug, platform.id] as const] : [],
      ),
    );
    const imageTypeIdBySlug = new Map(
      imageTypes.flatMap((imageType) =>
        imageType.slug && imageType.id ? [[imageType.slug, imageType.id] as const] : [],
      ),
    );

    const { data: specRows, error: specsError } = await supabase
      .from("image_specs")
      .select("platform_id, image_type_id, aspect_ratio_label, accepted_formats, background_required")
      .in("platform_id", [...platformIdBySlug.values()])
      .in("image_type_id", [...imageTypeIdBySlug.values()]);
    if (specsError || !specRows?.length) return specs;

    const specByPair = new Map(specRows.map((row) => [`${row.platform_id}:${row.image_type_id}`, row]));

    for (const rule of rules) {
      const channel = rule.condition_value as string;
      // Every live channel_required row maps to exactly one platform/image-type
      // pair today (confirmed 2026-09-05) — if a future row legitimately lists
      // more than one candidate, only the first is used; warn so a silent
      // narrowing shows up in logs instead of just producing a surprising format.
      if ((rule.platform_slugs?.length ?? 0) > 1 || (rule.image_type_slugs?.length ?? 0) > 1) {
        console.warn(
          `[channel-specs] rule for "${channel}" has multiple platform/image-type candidates; using only the first (platform_slugs=${JSON.stringify(rule.platform_slugs)}, image_type_slugs=${JSON.stringify(rule.image_type_slugs)})`,
        );
      }
      const platformSlug = rule.platform_slugs?.[0];
      const imageTypeSlug = rule.image_type_slugs?.[0];
      if (!platformSlug || !imageTypeSlug) continue;
      const platformId = platformIdBySlug.get(platformSlug);
      const imageTypeId = imageTypeIdBySlug.get(imageTypeSlug);
      if (!platformId || !imageTypeId) continue;
      const spec = specByPair.get(`${platformId}:${imageTypeId}`);
      const acceptedFormat = spec?.accepted_formats?.[0];
      if (!spec?.aspect_ratio_label || !acceptedFormat) continue;
      specs.set(channel, {
        aspectRatioLabel: spec.aspect_ratio_label,
        acceptedFormat,
        backgroundRequired: spec.background_required ?? null,
      });
    }
  } catch (err) {
    // Best-effort enrichment — any unexpected error (e.g. no request
    // context to resolve cookies from) falls back to the caller's default,
    // it never breaks the deliverables draft. Logged (not silent) so a real
    // regression here — a renamed table, a typo'd column — is visible.
    console.warn("[channel-specs] loadChannelSpecs failed, falling back to ipix_default:", err);
    return new Map();
  }

  return specs;
}
