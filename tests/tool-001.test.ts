import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

// Fixture-driven fake for the read-only Supabase reference reader
// (src/lib/shoot/channel-specs.ts). `available: false` simulates
// createClient() returning null (no request/session context — the reader's
// documented best-effort fallback); `tables` supplies rows per table name
// for the recommendation_rules -> platforms/image_type_defs -> image_specs
// chain the reader queries.
const supabaseMock = vi.hoisted(() => ({
  available: true,
  tables: {} as Record<string, unknown[]>,
}));
vi.mock("../src/lib/supabase/server", () => ({
  createClient: async () => {
    if (!supabaseMock.available) return null;
    return {
      from: (table: string) => {
        const result = { data: supabaseMock.tables[table] ?? [], error: null };
        const chain = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
        };
        return chain;
      },
    };
  },
}));
afterEach(() => {
  supabaseMock.available = true;
  supabaseMock.tables = {};
});

import { productionPlannerAgent } from "../src/mastra/agents";
import { loadChannelSpecs } from "../src/lib/shoot/channel-specs";
import {
  EstimateShootBudgetInputSchema,
  GenerateShotListDraftInputSchema,
  PlanDeliverablesInputSchema,
  RecommendShootTypeInputSchema,
  estimateShootBudget,
  generateShotListDraft,
  planDeliverables,
  recommendShootType,
  type EstimateShootBudgetOutput,
  type GenerateShotListDraftOutput,
  type PlanDeliverablesOutput,
  type RecommendShootTypeOutput,
} from "../src/mastra/tools/planning";

// IPI-1049 · TOOL-001 — four compute-only planning tools. Schema validation
// (structurally invalid input) is tested via the exported Zod input schemas
// directly; business logic (valid input → typed output, needs_input,
// determinism) is tested via .execute(). The installed createTool().execute
// return type is `T | void | ValidationError` (Mastra can short-circuit on
// its own internal validation); these tools never return void/throw for
// valid parsed input, so results are cast to the tool's own output type.
// See src/mastra/tools/planning.ts for the exact Lumina source → adaptation
// mapping.

async function run<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

describe("recommendShootType", () => {
  it("returns a single confident recommendation for an unambiguous channel", async () => {
    const result = await run<RecommendShootTypeOutput>(
      recommendShootType.execute!({ channels: ["youtube"] } as never, {} as never),
    );
    expect(result.status).toBe("ok");
    expect(result.shootType).toBe("campaign");
    expect(result.candidates).toEqual(["campaign"]);
    expect(result.missingInputs).toEqual([]);
  });

  it("returns needs_input with all tied candidates when channels equally favor multiple types", async () => {
    const result = await run<RecommendShootTypeOutput>(
      recommendShootType.execute!({ channels: ["shopify", "amazon"] } as never, {} as never),
    );
    expect(result.status).toBe("needs_input");
    expect([...result.candidates].sort()).toEqual(["ecommerce_pdp", "packshot"]);
    expect(result.missingInputs.length).toBeGreaterThan(0);
    expect(result.shootType).toBeUndefined();
  });

  it("a brief keyword can break a channel tie", async () => {
    const result = await run<RecommendShootTypeOutput>(
      recommendShootType.execute!(
        { channels: ["shopify", "amazon"], brief: "packshot on white background" } as never,
        {} as never,
      ),
    );
    expect(result.status).toBe("ok");
    expect(result.shootType).toBe("packshot");
  });

  it("is deterministic for the same validated input", async () => {
    const input = { channels: ["instagram_feed"], brief: "editorial story" } as never;
    const a = await run<RecommendShootTypeOutput>(recommendShootType.execute!(input, {} as never));
    const b = await run<RecommendShootTypeOutput>(recommendShootType.execute!(input, {} as never));
    expect(a).toEqual(b);
  });

  it("rejects an empty channel list structurally", () => {
    expect(RecommendShootTypeInputSchema.safeParse({ channels: [] }).success).toBe(false);
  });

  it("rejects an unknown channel enum value structurally", () => {
    expect(RecommendShootTypeInputSchema.safeParse({ channels: ["carrier_pigeon"] }).success).toBe(false);
  });

  it("accepts channels at the max bound and rejects one over it", () => {
    const validChannel = "instagram_feed";
    expect(
      RecommendShootTypeInputSchema.safeParse({ channels: Array(50).fill(validChannel) }).success,
    ).toBe(true);
    expect(
      RecommendShootTypeInputSchema.safeParse({ channels: Array(51).fill(validChannel) }).success,
    ).toBe(false);
  });

  it("de-duplicates a repeated channel instead of inflating its affinity score", async () => {
    // youtube alone scores 1 for "campaign" (unique winner, see the first
    // test above); duplicating it must not turn that into a false score of 2.
    const result = await run<RecommendShootTypeOutput>(
      recommendShootType.execute!({ channels: ["youtube", "youtube"] } as never, {} as never),
    );
    expect(result.confidence).toBe("medium"); // stays a score-1 match, not score-2 "high"
  });
});

describe("planDeliverables", () => {
  it("returns default quantities with explicit provenance", async () => {
    const result = await run<PlanDeliverablesOutput>(
      planDeliverables.execute!({ channels: ["instagram_feed"] } as never, {} as never),
    );
    expect(result.status).toBe("ok");
    expect(result.deliverables).toEqual([
      {
        channel: "instagram_feed",
        format: "1:1 JPG",
        formatSource: "ipix_default_v1",
        quantity: 10,
        source: "ipix_default_v1",
        assumed: true,
      },
    ]);
    expect(result.totalAssets).toBe(10);
  });

  it("boosts white-bg quantities for a packshot/ecommerce shoot type", async () => {
    const result = await run<PlanDeliverablesOutput>(
      planDeliverables.execute!({ channels: ["shopify"], shootType: "packshot" } as never, {} as never),
    );
    const whiteBg = result.deliverables.find((d) => d.format.includes("white-bg"));
    const lifestyle = result.deliverables.find((d) => !d.format.includes("white-bg"));
    expect(whiteBg?.quantity).toBe(8); // 6 + 2
    expect(lifestyle?.quantity).toBe(4); // unchanged
  });

  it("boosts video quantities when brand style keywords indicate video-heavy", async () => {
    const result = await run<PlanDeliverablesOutput>(
      planDeliverables.execute!(
        { channels: ["instagram_reel"], brandDna: { styleKeywords: ["motion-forward"] } } as never,
        {} as never,
      ),
    );
    expect(result.deliverables[0].quantity).toBe(6); // 5 + 1
  });

  it("is deterministic and arithmetically correct against an independently-derived total", async () => {
    const input = { channels: ["amazon", "youtube"] } as never;
    const a = await run<PlanDeliverablesOutput>(planDeliverables.execute!(input, {} as never));
    const b = await run<PlanDeliverablesOutput>(planDeliverables.execute!(input, {} as never));
    expect(a).toEqual(b);
    // amazon defaults 8 + 4, youtube default 2 — a literal from the spec's
    // own CHANNEL_DELIVERABLE_DEFAULTS, not recomputed from the result.
    expect(a.totalAssets).toBe(14);
  });

  it("de-duplicates a repeated channel instead of doubling its deliverables", async () => {
    const result = await run<PlanDeliverablesOutput>(
      planDeliverables.execute!({ channels: ["shopify", "shopify"] } as never, {} as never),
    );
    expect(result.deliverables).toHaveLength(2); // shopify's own 2 formats, not 4
    expect(result.totalAssets).toBe(10); // 6 + 4, not 20
  });

  it("rejects an empty channel list structurally", () => {
    expect(PlanDeliverablesInputSchema.safeParse({ channels: [] }).success).toBe(false);
  });

  it("rejects a misspelled/unrecognized shootType structurally instead of silently ignoring it", () => {
    expect(
      PlanDeliverablesInputSchema.safeParse({ channels: ["shopify"], shootType: "packshott" }).success,
    ).toBe(false);
  });

  it("accepts channels at the max bound and rejects one over it", () => {
    const validChannel = "shopify";
    expect(PlanDeliverablesInputSchema.safeParse({ channels: Array(50).fill(validChannel) }).success).toBe(true);
    expect(PlanDeliverablesInputSchema.safeParse({ channels: Array(51).fill(validChannel) }).success).toBe(false);
  });

  it("accepts brandDna.styleKeywords at the max bound and rejects one over it", () => {
    expect(
      PlanDeliverablesInputSchema.safeParse({
        channels: ["shopify"],
        brandDna: { styleKeywords: Array(50).fill("minimal") },
      }).success,
    ).toBe(true);
    expect(
      PlanDeliverablesInputSchema.safeParse({
        channels: ["shopify"],
        brandDna: { styleKeywords: Array(51).fill("minimal") },
      }).success,
    ).toBe(false);
    expect(
      PlanDeliverablesInputSchema.safeParse({
        channels: ["shopify"],
        brandDna: { styleKeywords: ["k".repeat(100)] },
      }).success,
    ).toBe(true);
    expect(
      PlanDeliverablesInputSchema.safeParse({
        channels: ["shopify"],
        brandDna: { styleKeywords: ["k".repeat(101)] },
      }).success,
    ).toBe(false);
  });

  it("uses the live Supabase spec (real aspect ratio/format) for a channel it covers, with reference provenance", async () => {
    supabaseMock.tables = {
      recommendation_rules: [{ condition_value: "instagram_feed", platform_slugs: ["instagram"], image_type_slugs: ["feed_post"] }],
      platforms: [{ id: "p-ig", slug: "instagram" }],
      image_type_defs: [{ id: "t-feed", slug: "feed_post" }],
      image_specs: [
        { platform_id: "p-ig", image_type_id: "t-feed", aspect_ratio_label: "4:5", accepted_formats: ["JPG"], background_required: null },
      ],
    };
    const result = await run<PlanDeliverablesOutput>(
      planDeliverables.execute!({ channels: ["instagram_feed"] } as never, {} as never),
    );
    // Real reference data (4:5) — not the pre-fix hardcoded guess (1:1).
    expect(result.deliverables[0].format).toBe("4:5 JPG");
    expect(result.deliverables[0].formatSource).toBe("ipix_reference_v1");
    expect(result.deliverables[0].source).toBe("ipix_default_v1"); // quantity provenance is unchanged
  });

  it("applies the packshot white-bg quantity boost from the live spec's real background_required, not string-matching", async () => {
    supabaseMock.tables = {
      recommendation_rules: [{ condition_value: "amazon", platform_slugs: ["amazon"], image_type_slugs: ["main_image"] }],
      platforms: [{ id: "p-az", slug: "amazon" }],
      image_type_defs: [{ id: "t-main", slug: "main_image" }],
      image_specs: [
        { platform_id: "p-az", image_type_id: "t-main", aspect_ratio_label: "1:1", accepted_formats: ["JPEG"], background_required: "pure_white" },
      ],
    };
    const result = await run<PlanDeliverablesOutput>(
      planDeliverables.execute!({ channels: ["amazon"], shootType: "packshot" } as never, {} as never),
    );
    const primary = result.deliverables[0];
    expect(primary.format).toBe("1:1 JPEG white-bg");
    expect(primary.formatSource).toBe("ipix_reference_v1");
    expect(primary.quantity).toBe(10); // amazon default 8 + 2 packshot boost
  });

  it("falls back to the ipix_default format/provenance when Supabase has no session (createClient returns null)", async () => {
    supabaseMock.available = false;
    const result = await run<PlanDeliverablesOutput>(
      planDeliverables.execute!({ channels: ["instagram_feed"] } as never, {} as never),
    );
    expect(result.deliverables[0].format).toBe("1:1 JPG");
    expect(result.deliverables[0].formatSource).toBe("ipix_default_v1");
  });

  it("falls back to the ipix_default format for a channel Supabase doesn't cover (e.g. website)", async () => {
    supabaseMock.tables = { recommendation_rules: [] }; // no channel_required row for "website"
    const result = await run<PlanDeliverablesOutput>(
      planDeliverables.execute!({ channels: ["website"] } as never, {} as never),
    );
    expect(result.deliverables[0].formatSource).toBe("ipix_default_v1");
  });
});

describe("loadChannelSpecs (Supabase reference reader)", () => {
  it("returns an empty map when there are no channels to look up", async () => {
    const specs = await loadChannelSpecs([]);
    expect(specs.size).toBe(0);
  });

  it("returns an empty map (not a throw) when createClient has no session", async () => {
    supabaseMock.available = false;
    const specs = await loadChannelSpecs(["instagram_feed"]);
    expect(specs.size).toBe(0);
  });

  it("returns an empty map when the rule exists but no matching image_specs row exists", async () => {
    supabaseMock.tables = {
      recommendation_rules: [{ condition_value: "instagram_feed", platform_slugs: ["instagram"], image_type_slugs: ["feed_post"] }],
      platforms: [{ id: "p-ig", slug: "instagram" }],
      image_type_defs: [{ id: "t-feed", slug: "feed_post" }],
      image_specs: [], // no spec row for this platform/image-type pair
    };
    const specs = await loadChannelSpecs(["instagram_feed"]);
    expect(specs.size).toBe(0);
  });

  it("normalizes a full chain into a plain ChannelSpec keyed by channel", async () => {
    supabaseMock.tables = {
      recommendation_rules: [{ condition_value: "pinterest", platform_slugs: ["pinterest"], image_type_slugs: ["pin"] }],
      platforms: [{ id: "p-pin", slug: "pinterest" }],
      image_type_defs: [{ id: "t-pin", slug: "pin" }],
      image_specs: [
        { platform_id: "p-pin", image_type_id: "t-pin", aspect_ratio_label: "2:3", accepted_formats: ["JPG", "PNG"], background_required: null },
      ],
    };
    const specs = await loadChannelSpecs(["pinterest"]);
    expect(specs.get("pinterest")).toEqual({ aspectRatioLabel: "2:3", acceptedFormat: "JPG", backgroundRequired: null });
  });
});

describe("generateShotListDraft", () => {
  const oneReference = [
    { id: "ref-1", angle: "front", description: "front-facing product shot", channelFit: ["instagram_feed"] },
  ];

  it("builds shots only from trusted references, keeping referenceId provenance", async () => {
    const result = await run<GenerateShotListDraftOutput>(
      generateShotListDraft.execute!(
        {
          selectedDeliverables: [{ channel: "instagram_feed", format: "1:1", quantity: 3 }],
          trustedReferenceShotTypes: oneReference,
        } as never,
        {} as never,
      ),
    );
    expect(result.status).toBe("ok");
    expect(result.totalShots).toBe(1);
    expect(result.shots[0].referenceId).toBe("ref-1");
    expect(result.shots[0].angle).toBe("front"); // exact reference angle, never invented
    expect(result.warnings).toEqual([]);
  });

  it("returns needs_input (not ok) for a deliverable with no matching trusted reference, keeping partial shots", async () => {
    const result = await run<GenerateShotListDraftOutput>(
      generateShotListDraft.execute!(
        {
          selectedDeliverables: [
            { channel: "instagram_feed", quantity: 3 },
            { channel: "tiktok", quantity: 2 }, // only fits instagram_feed in oneReference
          ],
          trustedReferenceShotTypes: oneReference,
        } as never,
        {} as never,
      ),
    );
    expect(result.status).toBe("needs_input");
    expect(result.missingInputs.some((m) => m.includes("tiktok"))).toBe(true);
    // the covered deliverable's shots are still returned, not discarded
    expect(result.shots.length).toBe(1);
    expect(result.totalShots).toBe(1);
  });

  it("is deterministic for the same validated input", async () => {
    const input = {
      selectedDeliverables: [{ channel: "instagram_feed", quantity: 6 }],
      trustedReferenceShotTypes: oneReference,
    } as never;
    const a = await run<GenerateShotListDraftOutput>(generateShotListDraft.execute!(input, {} as never));
    const b = await run<GenerateShotListDraftOutput>(generateShotListDraft.execute!(input, {} as never));
    expect(a).toEqual(b);
  });

  it("rejects empty selectedDeliverables structurally (fails safe, not silently)", () => {
    expect(
      GenerateShotListDraftInputSchema.safeParse({
        selectedDeliverables: [],
        trustedReferenceShotTypes: oneReference,
      }).success,
    ).toBe(false);
  });

  it("rejects empty trustedReferenceShotTypes structurally (fails safe, not silently)", () => {
    expect(
      GenerateShotListDraftInputSchema.safeParse({
        selectedDeliverables: [{ channel: "instagram_feed", quantity: 3 }],
        trustedReferenceShotTypes: [],
      }).success,
    ).toBe(false);
  });

  it("does not let a duplicate/colliding id hide an uncovered deliverable (coverage tracked by position, not id)", async () => {
    const result = await run<GenerateShotListDraftOutput>(
      generateShotListDraft.execute!(
        {
          // Same explicit id on a covered and an uncovered deliverable —
          // covering the first must not mark the second as covered too.
          selectedDeliverables: [
            { id: "dup", channel: "instagram_feed", quantity: 3 },
            { id: "dup", channel: "tiktok", quantity: 2 },
          ],
          trustedReferenceShotTypes: oneReference, // only fits instagram_feed
        } as never,
        {} as never,
      ),
    );
    expect(result.status).toBe("needs_input");
    expect(result.missingInputs.some((m) => m.includes("tiktok"))).toBe(true);
  });

  it("distributes multiple product names across deliverables instead of using only the first", async () => {
    const twoDeliverables = [
      { channel: "instagram_feed", quantity: 3 },
      { channel: "instagram_feed", quantity: 3 },
    ];
    const result = await run<GenerateShotListDraftOutput>(
      generateShotListDraft.execute!(
        {
          selectedDeliverables: twoDeliverables,
          trustedReferenceShotTypes: oneReference,
          productNames: ["Product A", "Product B"],
        } as never,
        {} as never,
      ),
    );
    const notes = result.shots.map((s) => s.notes);
    expect(notes).toContain("Product: Product A");
    expect(notes).toContain("Product: Product B");
  });
});

describe("estimateShootBudget", () => {
  it("returns needs_input listing every undecided field, with no budget computed", async () => {
    const result = await run<EstimateShootBudgetOutput>(
      estimateShootBudget.execute!({ shootDays: 1, currency: "USD" } as never, {} as never),
    );
    expect(result.status).toBe("needs_input");
    expect([...result.missingInputs].sort()).toEqual(["crewCount", "shotCount", "studioType"]);
    expect(result.total).toBeUndefined();
    expect(result.assumptions).toEqual([]);
  });

  it("computes a transparent line-item estimate using ipix_default rates, each with provenance", async () => {
    const result = await run<EstimateShootBudgetOutput>(
      estimateShootBudget.execute!(
        { crewCount: 2, studioType: "location", shotCount: 10, shootDays: 1, currency: "USD" } as never,
        {} as never,
      ),
    );
    expect(result.status).toBe("ok");
    // Independent literals (spec-derived), not recomputed from the result —
    // crew: 2 crew * $650/day * 1 day; studio: location default $800 * 1 day;
    // equipment: 2 crew * $180/day * 1 day; post: (10 shots * 3 assets) * $45.
    expect(result.crew).toBe(1300);
    expect(result.studio).toBe(800);
    expect(result.equipment).toBe(360);
    expect(result.post).toBe(1350);
    expect(result.total).toBe(3810);
    // currency and shootDays were both explicit here, so only the 4 rates
    // plus the derived totalAssets are assumptions (6 fields checked, 2 explicit).
    expect(result.assumptions).toHaveLength(5);
    expect(result.assumptions.every((a) => a.source === "ipix_default_v1" && a.assumed === true)).toBe(true);
    expect(result.disclaimer).toMatch(/estimate/i);
    expect(result.disclaimer).not.toMatch(/confirmed production cost is/i);
  });

  it("assumes shootDays, currency, and the totalAssets heuristic with provenance when they aren't supplied", async () => {
    const result = await run<EstimateShootBudgetOutput>(
      estimateShootBudget.execute!({ crewCount: 1, studioType: "owned", shotCount: 4 } as never, {} as never),
    );
    const assumedKeys = result.assumptions.map((a) => a.key).sort();
    expect(assumedKeys).toEqual(
      ["crewDayRate", "currency", "equipmentDayRate", "postPerAsset", "shootDays", "studioDayRate", "totalAssets"].sort(),
    );
    expect(result.currency).toBe("USD");
    // shootDays defaulted to 1, totalAssets defaulted to shotCount * 3 = 12
    expect(result.crew).toBe(1 * 650 * 1);
    expect(result.post).toBe(12 * 45);
  });

  it("uses explicit operator-supplied rates/shootDays/currency/totalAssets instead of defaults, with no assumption entries at all", async () => {
    const result = await run<EstimateShootBudgetOutput>(
      estimateShootBudget.execute!(
        {
          crewCount: 1,
          studioType: "owned",
          shotCount: 5,
          shootDays: 1,
          currency: "EUR",
          totalAssets: 15,
          rates: { crewDayRate: 500, studioDayRate: 0, equipmentDayRate: 100, postPerAsset: 20 },
        } as never,
        {} as never,
      ),
    );
    expect(result.assumptions).toEqual([]);
    expect(result.currency).toBe("EUR");
    expect(result.crew).toBe(500);
    expect(result.equipment).toBe(100);
    expect(result.post).toBe(15 * 20);
  });

  it("never produces NaN, Infinity, or a negative total for valid input", async () => {
    const result = await run<EstimateShootBudgetOutput>(
      estimateShootBudget.execute!(
        { crewCount: 1, studioType: "outdoor", shotCount: 1, shootDays: 1, currency: "USD" } as never,
        {} as never,
      ),
    );
    expect(Number.isFinite(result.total)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic for the same validated input", async () => {
    const input = { crewCount: 3, studioType: "rental", shotCount: 8, shootDays: 2, currency: "USD" } as never;
    const a = await run<EstimateShootBudgetOutput>(estimateShootBudget.execute!(input, {} as never));
    const b = await run<EstimateShootBudgetOutput>(estimateShootBudget.execute!(input, {} as never));
    expect(a).toEqual(b);
  });

  it("rejects crewCount: 0 and negative shotCount structurally", () => {
    expect(
      EstimateShootBudgetInputSchema.safeParse({ crewCount: 0, studioType: "owned", shotCount: 5 }).success,
    ).toBe(false);
    expect(
      EstimateShootBudgetInputSchema.safeParse({ crewCount: 1, studioType: "owned", shotCount: -1 }).success,
    ).toBe(false);
  });
});

// Domain bounds + finite guards (CodeRabbit review, PR #76). Assertions here
// are on Zod's parse result only — no oversized array is ever actually
// constructed or passed to .execute(), so these tests can't themselves
// allocate anything large.
describe("domain bounds and finite guards", () => {
  const oneReference = [
    { id: "ref-1", angle: "front", description: "front-facing product shot", channelFit: ["instagram_feed"] },
  ];

  it("accepts a deliverable quantity at the max bound and rejects one over it", () => {
    expect(
      GenerateShotListDraftInputSchema.safeParse({
        selectedDeliverables: [{ channel: "instagram_feed", quantity: 500 }],
        trustedReferenceShotTypes: oneReference,
      }).success,
    ).toBe(true);
    expect(
      GenerateShotListDraftInputSchema.safeParse({
        selectedDeliverables: [{ channel: "instagram_feed", quantity: 501 }],
        trustedReferenceShotTypes: oneReference,
      }).success,
    ).toBe(false);
  });

  it("accepts a trustedReferenceShotType description at the max length and rejects one over it", () => {
    const okRef = [{ id: "ref-1", angle: "front", description: "x".repeat(2000), channelFit: ["instagram_feed"] }];
    const tooLongRef = [{ id: "ref-1", angle: "front", description: "x".repeat(2001), channelFit: ["instagram_feed"] }];
    expect(
      GenerateShotListDraftInputSchema.safeParse({
        selectedDeliverables: [{ channel: "instagram_feed", quantity: 1 }],
        trustedReferenceShotTypes: okRef,
      }).success,
    ).toBe(true);
    expect(
      GenerateShotListDraftInputSchema.safeParse({
        selectedDeliverables: [{ channel: "instagram_feed", quantity: 1 }],
        trustedReferenceShotTypes: tooLongRef,
      }).success,
    ).toBe(false);
  });

  it("rejects a brief over the max text length structurally", () => {
    expect(
      RecommendShootTypeInputSchema.safeParse({ channels: ["shopify"], brief: "x".repeat(2001) }).success,
    ).toBe(false);
  });

  it("rejects an oversized selectedDeliverables array without constructing it", () => {
    // Array.from with a length is metadata-only until .map runs — the
    // schema rejects the shape before any Playwright-sized array of shots
    // could ever be built from it.
    const tooMany = Array.from({ length: 201 }, (_, i) => ({ channel: "instagram_feed", quantity: 1, id: `d${i}` }));
    expect(
      GenerateShotListDraftInputSchema.safeParse({
        selectedDeliverables: tooMany,
        trustedReferenceShotTypes: oneReference,
      }).success,
    ).toBe(false);
  });

  it("rejects an oversized trustedReferenceShotTypes array", () => {
    const tooMany = Array.from({ length: 201 }, (_, i) => ({
      id: `ref-${i}`,
      angle: "front",
      description: "x",
      channelFit: ["instagram_feed"],
    }));
    expect(
      GenerateShotListDraftInputSchema.safeParse({
        selectedDeliverables: [{ channel: "instagram_feed", quantity: 1 }],
        trustedReferenceShotTypes: tooMany,
      }).success,
    ).toBe(false);
  });

  it("accepts max-bounded budget values and keeps the total finite", async () => {
    const result = await run<EstimateShootBudgetOutput>(
      estimateShootBudget.execute!(
        { crewCount: 200, studioType: "rental", shotCount: 5000, shootDays: 365, totalAssets: 20000, currency: "USD" } as never,
        {} as never,
      ),
    );
    expect(result.status).toBe("ok");
    expect(Number.isFinite(result.total)).toBe(true);
  });

  it("rejects Infinity/NaN and over-max rates structurally instead of letting them reach the math", () => {
    expect(
      EstimateShootBudgetInputSchema.safeParse({
        crewCount: 1,
        studioType: "owned",
        shotCount: 1,
        rates: { crewDayRate: Infinity },
      }).success,
    ).toBe(false);
    expect(
      EstimateShootBudgetInputSchema.safeParse({
        crewCount: 1,
        studioType: "owned",
        shotCount: 1,
        rates: { crewDayRate: NaN },
      }).success,
    ).toBe(false);
    expect(
      EstimateShootBudgetInputSchema.safeParse({
        crewCount: 1,
        studioType: "owned",
        shotCount: 1,
        rates: { crewDayRate: 1_000_001 },
      }).success,
    ).toBe(false);
  });

  it("rejects over-max crewCount/shootDays/shotCount/totalAssets", () => {
    expect(EstimateShootBudgetInputSchema.safeParse({ crewCount: 201, studioType: "owned", shotCount: 1 }).success).toBe(false);
    expect(EstimateShootBudgetInputSchema.safeParse({ crewCount: 1, studioType: "owned", shotCount: 1, shootDays: 366 }).success).toBe(false);
    expect(EstimateShootBudgetInputSchema.safeParse({ crewCount: 1, studioType: "owned", shotCount: 5001 }).success).toBe(false);
    expect(
      EstimateShootBudgetInputSchema.safeParse({ crewCount: 1, studioType: "owned", shotCount: 1, totalAssets: 20001 }).success,
    ).toBe(false);
  });
});

function importLines(src: string): string {
  return src
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
}

describe("no forbidden imports in the four planning tools", () => {
  it("planning.ts imports no Supabase/Postgres/service-role/Cloudinary/payment client", () => {
    const imports = importLines(
      readFileSync(new URL("../src/mastra/tools/planning.ts", import.meta.url), "utf8"),
    );
    expect(imports).not.toMatch(/supabase|postgres|service[-_]?role|cloudinary|stripe|^\s*from ["']pg["']/i);
  });
  it("planning.ts calls no network fetch", () => {
    const src = readFileSync(new URL("../src/mastra/tools/planning.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/\bfetch\(/);
  });

  it("shot-list-from-references.ts (the shared pure helper) imports no forbidden client and calls no fetch", () => {
    const src = readFileSync(new URL("../src/lib/shoot/shot-list-from-references.ts", import.meta.url), "utf8");
    expect(importLines(src)).not.toMatch(/supabase|postgres|service[-_]?role|cloudinary|stripe/i);
    expect(src).not.toMatch(/\bfetch\(/);
  });
});

describe("Planner integration", () => {
  it("the canonical Production Planner exposes the four planning tools plus the two brand-intelligence tools (IPI-1093)", async () => {
    const tools = await productionPlannerAgent.listTools();
    expect(Object.keys(tools).sort()).toEqual(
      [
        "approveDraft",
        "estimateShootBudget",
        "generateShotListDraft",
        "planDeliverables",
        "recommendShootType",
        "startBrandAnalysis",
      ].sort(),
    );
  });
});
