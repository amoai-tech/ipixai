import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  buildShotListFromReferences,
  type SelectedDeliverable,
  type TrustedReferenceShotType,
} from "@/lib/shoot/shot-list-from-references";
import { loadChannelSpecs } from "@/lib/shoot/channel-specs";
import { CurrencySchema, emptyResult, planningResultFields, type Assumption } from "./planning-types";

/**
 * IPI-1049 · TOOL-001 — four compute-only Planner tools, adapted from Lumina
 * (amoai-tech/luminaai@main, app/src/mastra/tools/{recommendShootType,
 * planDeliverables, generateShotListDraft, estimateShootBudget}.ts).
 *
 * Deliberately NOT wired to Supabase: a task-verifier audit (2026-09-05) found
 * live reference tables (`platforms`, `image_specs`, `image_type_defs`,
 * `recommendation_rules`) that overlap conceptually with the channel/rule
 * data below, all safely authenticated-readable. Left as documented
 * `ipix_default_v1` constants per this task's explicit "no Supabase/network
 * imports for these four tools" contract — wiring them in is a follow-up
 * decision for whoever owns that reconciliation (see PR description), not a
 * silent scope change here. `platforms.slug` in the live schema is coarser
 * (e.g. "instagram") than the channel granularity below (instagram_feed vs
 * _story vs _reel) — reconciling that split is part of the same follow-up.
 */

const CHANNELS = [
  "instagram_feed",
  "instagram_story",
  "instagram_reel",
  "tiktok",
  "pinterest",
  "amazon",
  "shopify",
  "facebook",
  "youtube",
  "website",
] as const;
// Exported for IPI-1081 · PLAN-001's composeShootPlan input schema, which
// needs the identical channel/bounds contract — not a new taxonomy.
export const ChannelSchema = z.enum(CHANNELS);
// CHANNELS has only 10 distinct values, but nothing stops a caller from
// repeating one far past what dedupeChannels needs to see — bound the raw
// array so validation/dedup never iterates an arbitrarily large duplicate list.
export const MAX_CHANNELS_INPUT = 50;
// A schema-valid request can still carry pathologically long free-text
// (brief, description, ...) that gets copied into every generated shot or
// re-concatenated/lowercased on every scoring pass — bound string length
// alongside array length so both dimensions of "too much input" are closed.
export const MAX_TEXT_LENGTH = 2000;

/** De-dupes a validated channel array — a repeated channel is one target, not two. */
function dedupeChannels(channels: readonly string[]): string[] {
  return [...new Set(channels)];
}

const DEFAULT_SOURCE = "ipix_default_v1";
// Live Supabase platforms/image_specs/recommendation_rules reference data —
// see src/lib/shoot/channel-specs.ts for the exact read path/evidence.
const REFERENCE_SOURCE = "ipix_reference_v1";

// Shared with planDeliverables.shootType so an unrecognized/misspelled value
// fails Zod validation structurally instead of being silently ignored.
const SHOOT_TYPES = ["ecommerce_pdp", "editorial", "ugc_style", "lookbook", "campaign", "packshot"] as const;
export const ShootTypeSchema = z.enum(SHOOT_TYPES);

// ---------------------------------------------------------------------------
// 1. recommendShootType
// ---------------------------------------------------------------------------

// ipix_default_v1 taxonomy — not yet confirmed against a live canonical
// source (see file header). shoots.shoot_type in the live schema is a
// different, unrelated enum (photography/video/hybrid); do not conflate them.
const SHOOT_TYPE_CHANNEL_AFFINITY: Record<string, string[]> = {
  ecommerce_pdp: ["shopify", "amazon", "website"],
  editorial: ["instagram_feed", "pinterest", "facebook"],
  ugc_style: ["instagram_reel", "tiktok"],
  lookbook: ["instagram_feed", "pinterest", "instagram_story"],
  campaign: ["instagram_feed", "instagram_reel", "facebook", "youtube"],
  packshot: ["shopify", "amazon"],
};

const SHOOT_TYPE_BRIEF_BOOSTERS: Record<string, string[]> = {
  ecommerce_pdp: ["pdp", "product detail", "listing", "ecommerce", "e-commerce"],
  editorial: ["editorial", "story", "magazine", "fashion", "lifestyle"],
  ugc_style: ["ugc", "user generated", "authentic", "organic", "creator"],
  lookbook: ["lookbook", "collection", "seasonal", "catalog"],
  campaign: ["campaign", "brand awareness", "hero", "launch"],
  packshot: ["packshot", "pack shot", "packaging", "white background", "white bg"],
};

export const RecommendShootTypeInputSchema = z.object({
  channels: z.array(ChannelSchema).min(1).max(MAX_CHANNELS_INPUT),
  brief: z.string().max(MAX_TEXT_LENGTH).optional(),
  productCategory: z.string().max(MAX_TEXT_LENGTH).optional(),
  brandDnaSummary: z.string().max(MAX_TEXT_LENGTH).optional(),
});
export const RecommendShootTypeOutputSchema = z.object({
  ...planningResultFields,
  shootType: z.string().optional(),
  candidates: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  rationale: z.string().optional(),
});
export type RecommendShootTypeOutput = z.infer<typeof RecommendShootTypeOutputSchema>;

export const recommendShootType = createTool({
  id: "recommendShootType",
  description:
    "Recommend a shoot type (ecommerce_pdp, editorial, ugc_style, lookbook, campaign, packshot) from " +
    "channels, brief, and brand context. Returns needs_input with candidates when signal is tied or absent " +
    "— never silently defaults to ecommerce.",
  inputSchema: RecommendShootTypeInputSchema,
  outputSchema: RecommendShootTypeOutputSchema,
  execute: async (input) => {
    const { brief = "", productCategory = "", brandDnaSummary = "" } = input;
    const channels = dedupeChannels(input.channels);
    const contextText = `${brief} ${productCategory} ${brandDnaSummary}`.toLowerCase();

    const scores: Record<string, number> = {};
    for (const [type, matchChannels] of Object.entries(SHOOT_TYPE_CHANNEL_AFFINITY)) {
      scores[type] = channels.filter((c) => matchChannels.includes(c)).length;
      const boosters = SHOOT_TYPE_BRIEF_BOOSTERS[type] ?? [];
      if (boosters.some((kw) => contextText.includes(kw))) scores[type] += 1;
    }

    const maxScore = Math.max(...Object.values(scores));
    const topTypes = Object.entries(scores)
      .filter(([, score]) => score === maxScore)
      .map(([type]) => type);

    if (maxScore === 0) {
      return {
        ...emptyResult("needs_input", [
          "No channel or brief/brand signal matched any shoot type — provide channels or a brief describing the shoot's purpose (e.g. ecommerce, editorial, campaign).",
        ]),
        candidates: Object.keys(SHOOT_TYPE_CHANNEL_AFFINITY),
      };
    }
    if (topTypes.length > 1) {
      return {
        ...emptyResult("needs_input", [
          `Tied signal between ${topTypes.join(", ")} — provide a brief or narrow the channel list to disambiguate.`,
        ]),
        candidates: topTypes,
      };
    }

    const shootType = topTypes[0];
    const confidence: "high" | "medium" | "low" = maxScore >= 2 ? "high" : "medium";
    return {
      ...emptyResult("ok"),
      shootType,
      candidates: [shootType],
      confidence,
      rationale: `Best match for channels [${channels.join(", ")}]${brief ? " and brief context" : ""} based on channel-type affinity and brand context.`,
    };
  },
});

// ---------------------------------------------------------------------------
// 2. planDeliverables
// ---------------------------------------------------------------------------

// ipix_default_v1 — see file header; not yet reconciled with the live
// platforms/image_specs/image_type_defs reference tables.
const CHANNEL_DELIVERABLE_DEFAULTS: Record<string, { format: string; quantity: number }[]> = {
  instagram_feed: [{ format: "1:1 JPG", quantity: 10 }],
  instagram_story: [{ format: "9:16 JPG", quantity: 8 }],
  instagram_reel: [{ format: "9:16 MP4 :15s", quantity: 5 }],
  tiktok: [{ format: "9:16 MP4 :30s", quantity: 5 }],
  pinterest: [{ format: "2:3 JPG", quantity: 6 }],
  amazon: [
    { format: "1:1 JPG white-bg", quantity: 8 },
    { format: "lifestyle JPG", quantity: 4 },
  ],
  shopify: [
    { format: "1:1 JPG white-bg", quantity: 6 },
    { format: "lifestyle JPG", quantity: 4 },
  ],
  facebook: [{ format: "4:5 JPG", quantity: 5 }],
  youtube: [{ format: "16:9 MP4 :60s", quantity: 2 }],
  website: [
    { format: "16:9 JPG hero", quantity: 3 },
    { format: "1:1 JPG card", quantity: 6 },
  ],
};

const DeliverableSchema = z.object({
  channel: z.string(),
  format: z.string(),
  // formatSource: which provenance the `format` string itself came from —
  // "ipix_reference_v1" (live Supabase platforms/image_specs data) for the
  // one primary format line per channel Supabase covers, "ipix_default_v1"
  // for every other line (multi-format channels' secondary lines, and any
  // channel Supabase doesn't own, e.g. "website"). Independent of
  // source/assumed below, which describe the *quantity* — the format and
  // the quantity can have different provenance on the same line.
  formatSource: z.string(),
  quantity: z.number().int().positive(),
  source: z.string(),
  assumed: z.literal(true),
});

export const PlanDeliverablesInputSchema = z.object({
  channels: z.array(ChannelSchema).min(1).max(MAX_CHANNELS_INPUT),
  shootType: ShootTypeSchema.optional(),
  brandDna: z
    .object({
      productCategory: z.string().max(MAX_TEXT_LENGTH).optional(),
      styleKeywords: z.array(z.string().max(100)).max(50).optional(),
    })
    .optional(),
});
export const PlanDeliverablesOutputSchema = z.object({
  ...planningResultFields,
  deliverables: z.array(DeliverableSchema),
  totalAssets: z.number(),
});
export type PlanDeliverablesOutput = z.infer<typeof PlanDeliverablesOutputSchema>;

export const planDeliverables = createTool({
  id: "planDeliverables",
  description:
    "Derive a reviewable deliverable set (format + quantity per channel) from target channels and " +
    "optional shoot type / brand context. Every quantity is an explicit ipix_default assumption, not " +
    "confirmed business truth.",
  inputSchema: PlanDeliverablesInputSchema,
  outputSchema: PlanDeliverablesOutputSchema,
  execute: async (input) => {
    const { brandDna, shootType } = input;
    const channels = dedupeChannels(input.channels);
    const isPackshot = shootType === "packshot" || shootType === "ecommerce_pdp";
    const isVideoHeavy = brandDna?.styleKeywords?.some((k) => /video|motion|reel/i.test(k)) ?? false;

    // Authenticated, read-only reference lookup (channel -> canonical
    // platform/image-type spec) — best-effort; an empty map here just means
    // every channel falls back to its own hardcoded default below.
    const channelSpecs = await loadChannelSpecs(channels);

    const deliverables = channels.flatMap((channel) => {
      const defaults = CHANNEL_DELIVERABLE_DEFAULTS[channel];
      const spec = channelSpecs.get(channel);
      return defaults.map((d, lineIndex) => {
        // Supabase's image_specs covers one canonical image type per
        // channel — only the first (primary) line of a multi-line channel
        // (e.g. amazon's "lifestyle" second shot) has live reference data;
        // every other line keeps the ipix_default format string.
        const useReference = lineIndex === 0 && spec !== undefined;
        const format = useReference
          ? `${spec.aspectRatioLabel} ${spec.acceptedFormat}${spec.backgroundRequired === "pure_white" ? " white-bg" : ""}`
          : d.format;
        const isWhiteBg = useReference ? spec.backgroundRequired === "pure_white" : d.format.includes("white-bg");
        return {
          channel,
          format,
          formatSource: useReference ? REFERENCE_SOURCE : DEFAULT_SOURCE,
          quantity:
            isPackshot && isWhiteBg
              ? d.quantity + 2
              : isVideoHeavy && d.format.includes("MP4")
                ? d.quantity + 1
                : d.quantity,
          source: DEFAULT_SOURCE,
          assumed: true as const,
        };
      });
    });

    return {
      ...emptyResult("ok"),
      deliverables,
      totalAssets: deliverables.reduce((sum, d) => sum + d.quantity, 0),
    };
  },
});

// ---------------------------------------------------------------------------
// 3. generateShotListDraft
// ---------------------------------------------------------------------------

// Bounds below are generous for a real commercial shoot, not tight product
// limits — the point is rejecting pathological/malformed input (a typo'd
// extra zero, a runaway loop) before it reaches array-building code, not
// constraining legitimate production sizes.
const MAX_DELIVERABLE_QUANTITY = 500;
const MAX_SELECTED_DELIVERABLES = 200;
export const MAX_TRUSTED_REFERENCES = 200;
const MAX_CHANNEL_FIT = 50;
export const MAX_PRODUCT_NAMES = 50;

const SelectedDeliverableSchema = z.object({
  id: z.string().optional(),
  channel: z.string(),
  format: z.string().optional(),
  quantity: z.number().int().positive().max(MAX_DELIVERABLE_QUANTITY),
});

export const TrustedReferenceShotTypeSchema = z.object({
  id: z.string(),
  angle: z.string(),
  description: z.string().max(MAX_TEXT_LENGTH),
  channelFit: z.array(z.string()).max(MAX_CHANNEL_FIT),
  background: z.string().nullable().optional(),
  // Compatibility metadata for deterministic IPI-1081 · PLAN-001 reference
  // selection (see src/lib/shoot/shot-list-from-references.ts). All optional:
  // the public.shot_type_references_view projection is nullable and a
  // missing value means "unknown", which must never filter a reference out
  // (that would fabricate a gap) or manufacture a match (that would
  // fabricate compatibility).
  category: z.string().nullable().optional(),
  subcategory: z.string().nullable().optional(),
  modelType: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

const ShotSchema = z.object({
  shotNumber: z.number(),
  description: z.string(),
  angle: z.string(),
  lighting: z.string(),
  deliverableIds: z.array(z.string()),
  notes: z.string().optional(),
  referenceId: z.string(),
});

export const GenerateShotListDraftInputSchema = z.object({
  selectedDeliverables: z
    .array(SelectedDeliverableSchema)
    .min(1, "At least one selected deliverable is required before generating a shot list")
    .max(MAX_SELECTED_DELIVERABLES),
  trustedReferenceShotTypes: z
    .array(TrustedReferenceShotTypeSchema)
    .min(1, "trustedReferenceShotTypes is required — the real trusted-reference provider is a separate upstream task; pass known reference rows explicitly until then")
    .max(MAX_TRUSTED_REFERENCES),
  shootType: z.string().optional(),
  brandDnaSummary: z.string().max(MAX_TEXT_LENGTH).optional(),
  productNames: z.array(z.string().max(MAX_TEXT_LENGTH)).max(MAX_PRODUCT_NAMES).optional(),
  // Optional operator-known context used to rank trusted references by
  // semantic compatibility, not channel alone. Absent means unknown, which
  // never filters a reference out and never invents a match.
  productCategory: z.string().max(MAX_TEXT_LENGTH).optional(),
  modelType: z.string().max(MAX_TEXT_LENGTH).optional(),
  styleKeywords: z.array(z.string().max(MAX_TEXT_LENGTH)).max(MAX_PRODUCT_NAMES).optional(),
});
export const GenerateShotListDraftOutputSchema = z.object({
  ...planningResultFields,
  shots: z.array(ShotSchema),
  totalShots: z.number(),
});
export type GenerateShotListDraftOutput = z.infer<typeof GenerateShotListDraftOutputSchema>;

export const generateShotListDraft = createTool({
  id: "generateShotListDraft",
  description:
    "Generate a shot list draft from selected deliverables and trusted reference shot types. Requires " +
    "selectedDeliverables (reviewed, not yet formally approved) and trustedReferenceShotTypes as explicit " +
    "input — the real trusted-reference provider is owned by IPI-1081 · PLAN-001, not this tool. Never " +
    "invents a shot angle; every shot keeps its source referenceId.",
  inputSchema: GenerateShotListDraftInputSchema,
  outputSchema: GenerateShotListDraftOutputSchema,
  execute: async (input) => {
    const {
      selectedDeliverables,
      trustedReferenceShotTypes,
      productNames = [],
      productCategory,
      modelType,
      styleKeywords,
    } = input;

    const { shots, uncoveredDeliverableWarnings } = buildShotListFromReferences(
      selectedDeliverables as SelectedDeliverable[],
      trustedReferenceShotTypes as TrustedReferenceShotType[],
      productNames,
      { productCategory, modelType, styleKeywords },
    );

    // An uncovered deliverable means no trusted reference fits that channel —
    // that's missing business input (a reference gap), not a successful
    // draft; report needs_input with the partial shots still attached rather
    // than status: "ok" hiding the gap inside warnings.
    if (uncoveredDeliverableWarnings.length > 0) {
      return {
        ...emptyResult("needs_input", [
          ...uncoveredDeliverableWarnings,
          "Provide a compatible trustedReferenceShotTypes entry for the channel(s) above, or drop them from selectedDeliverables.",
        ]),
        shots,
        totalShots: shots.length,
      };
    }

    return {
      ...emptyResult("ok"),
      shots,
      totalShots: shots.length,
    };
  },
});

// ---------------------------------------------------------------------------
// 4. estimateShootBudget
// ---------------------------------------------------------------------------

// ipix_default_v1 — reference values only, not durable business truth (Correction 3).
const DEFAULT_STUDIO_DAY_RATE: Record<string, number> = {
  rental: 1200,
  owned: 0,
  location: 800,
  outdoor: 200,
};
const DEFAULT_CREW_DAY_RATE = 650;
const DEFAULT_EQUIPMENT_DAY_RATE_PER_CREW = 180;
const DEFAULT_POST_PER_ASSET = 45;
const DEFAULT_SHOOT_DAYS = 1;
const DEFAULT_CURRENCY: z.infer<typeof CurrencySchema> = "USD";
const DEFAULT_ASSETS_PER_SHOT = 3;

// Generous production-scale ceilings, not tight limits — `.nonnegative()`
// alone still accepts Infinity (Infinity >= 0), which would silently
// propagate into every downstream total; `.finite()` (implies not-NaN too)
// plus a bounded `.max()` closes that off structurally.
const MAX_DAY_RATE = 1_000_000;
const MAX_POST_PER_ASSET = 100_000;
const MAX_CREW_COUNT = 200;
const MAX_SHOOT_DAYS = 365;
const MAX_SHOT_COUNT = 5_000;
const MAX_TOTAL_ASSETS = 20_000;

const RatesSchema = z.object({
  crewDayRate: z.number().finite().nonnegative().max(MAX_DAY_RATE).optional(),
  studioDayRate: z.number().finite().nonnegative().max(MAX_DAY_RATE).optional(),
  equipmentDayRate: z.number().finite().nonnegative().max(MAX_DAY_RATE).optional(),
  postPerAsset: z.number().finite().nonnegative().max(MAX_POST_PER_ASSET).optional(),
});

export const EstimateShootBudgetInputSchema = z.object({
  crewCount: z.number().int().min(1).max(MAX_CREW_COUNT).optional(),
  studioType: z.enum(["rental", "owned", "location", "outdoor"]).optional(),
  shotCount: z.number().int().min(1).max(MAX_SHOT_COUNT).optional(),
  // No .default() on shootDays/currency: a schema default is applied before
  // execute() runs, so execute could never tell "operator supplied 1" from
  // "operator supplied nothing" — and every silently-defaulted value here
  // materially changes the total, so it needs its own Assumption entry too.
  shootDays: z.number().int().min(1).max(MAX_SHOOT_DAYS).optional(),
  totalAssets: z.number().int().min(1).max(MAX_TOTAL_ASSETS).optional(),
  currency: CurrencySchema.optional(),
  rates: RatesSchema.optional(),
});
export const EstimateShootBudgetOutputSchema = z.object({
  ...planningResultFields,
  crew: z.number().optional(),
  studio: z.number().optional(),
  equipment: z.number().optional(),
  post: z.number().optional(),
  total: z.number().optional(),
  currency: z.string().optional(),
  disclaimer: z.string().optional(),
});
export type EstimateShootBudgetOutput = z.infer<typeof EstimateShootBudgetOutputSchema>;

export const estimateShootBudget = createTool({
  id: "estimateShootBudget",
  description:
    "Calculate a transparent line-item budget estimate (crew/studio/equipment/post/total) from validated " +
    "inputs. Returns needs_input when crewCount, studioType, or shotCount aren't decided yet. Any rate not " +
    "explicitly supplied is an ipix_default assumption, returned with provenance. Never presents the total " +
    "as confirmed production cost.",
  inputSchema: EstimateShootBudgetInputSchema,
  outputSchema: EstimateShootBudgetOutputSchema,
  execute: async (input) => {
    const { crewCount, studioType, shotCount, shootDays, totalAssets, currency, rates } = input;

    const missingInputs: string[] = [];
    if (crewCount === undefined) missingInputs.push("crewCount");
    if (studioType === undefined) missingInputs.push("studioType");
    if (shotCount === undefined) missingInputs.push("shotCount");
    if (missingInputs.length > 0) {
      return emptyResult("needs_input", missingInputs);
    }

    // Every value below that wasn't explicitly supplied gets its own
    // Assumption entry — shootDays/currency/the totalAssets heuristic
    // materially change the total exactly like a defaulted rate does, so
    // they get the same provenance treatment (Correction 3/4).
    const assumptions: Assumption[] = [];
    const effectiveCurrency = currency ?? DEFAULT_CURRENCY;
    if (currency === undefined) {
      assumptions.push({ key: "currency", value: effectiveCurrency, source: DEFAULT_SOURCE, assumed: true });
    }
    const effectiveShootDays = shootDays ?? DEFAULT_SHOOT_DAYS;
    if (shootDays === undefined) {
      assumptions.push({ key: "shootDays", value: effectiveShootDays, source: DEFAULT_SOURCE, assumed: true });
    }

    // Each `effective*Rate` is resolved to its final number right here (not
    // left undefined for a later `?? DEFAULT` at the point of use) — the
    // variable name means what it says by the time execute() uses it below.
    let effectiveCrewDayRate = rates?.crewDayRate;
    if (effectiveCrewDayRate === undefined) {
      effectiveCrewDayRate = DEFAULT_CREW_DAY_RATE;
      assumptions.push({ key: "crewDayRate", value: effectiveCrewDayRate, currency: effectiveCurrency, source: DEFAULT_SOURCE, assumed: true });
    }
    let effectiveStudioDayRate = rates?.studioDayRate;
    if (effectiveStudioDayRate === undefined) {
      effectiveStudioDayRate = DEFAULT_STUDIO_DAY_RATE[studioType as string] ?? DEFAULT_STUDIO_DAY_RATE.location;
      assumptions.push({
        key: "studioDayRate",
        value: effectiveStudioDayRate,
        currency: effectiveCurrency,
        source: DEFAULT_SOURCE,
        assumed: true,
      });
    }
    let effectiveEquipmentDayRate = rates?.equipmentDayRate;
    if (effectiveEquipmentDayRate === undefined) {
      effectiveEquipmentDayRate = DEFAULT_EQUIPMENT_DAY_RATE_PER_CREW;
      assumptions.push({ key: "equipmentDayRate", value: effectiveEquipmentDayRate, currency: effectiveCurrency, source: DEFAULT_SOURCE, assumed: true });
    }
    let effectivePostPerAsset = rates?.postPerAsset;
    if (effectivePostPerAsset === undefined) {
      effectivePostPerAsset = DEFAULT_POST_PER_ASSET;
      assumptions.push({ key: "postPerAsset", value: effectivePostPerAsset, currency: effectiveCurrency, source: DEFAULT_SOURCE, assumed: true });
    }
    let assets = totalAssets;
    if (assets === undefined) {
      assets = (shotCount as number) * DEFAULT_ASSETS_PER_SHOT;
      assumptions.push({
        key: "totalAssets",
        value: assets,
        source: DEFAULT_SOURCE,
        assumed: true,
      });
    }

    const crew = (crewCount as number) * effectiveCrewDayRate * effectiveShootDays;
    const studio = effectiveStudioDayRate * effectiveShootDays;
    const equipment = Math.round((crewCount as number) * effectiveEquipmentDayRate * effectiveShootDays);
    const post = assets * effectivePostPerAsset;
    const total = crew + studio + equipment + post;

    // Defense-in-depth: every input above is now bounded/finite by schema,
    // so this should be unreachable — but a corrupted money total must fail
    // loudly, never silently clamp or return NaN/Infinity to the operator.
    if (![crew, studio, equipment, post, total].every(Number.isFinite)) {
      throw new Error("estimateShootBudget produced a non-finite total — refusing to return a corrupted estimate");
    }

    return {
      ...emptyResult("ok"),
      assumptions,
      crew,
      studio,
      equipment,
      post,
      total,
      currency: effectiveCurrency,
      disclaimer: `Estimate only, based on ${assumptions.length > 0 ? "supplied and ipix_default" : "supplied"} assumptions — not a confirmed production cost. Rates and durations vary by market.`,
    };
  },
});

export const planningTools = {
  recommendShootType,
  planDeliverables,
  generateShotListDraft,
  estimateShootBudget,
};
