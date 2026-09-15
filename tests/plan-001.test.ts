import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetSupabaseMock, supabaseMock } from "./mocks/supabase";

/**
 * IPI-1081 · PLAN-001. The Supabase read surface is mocked through the shared
 * helper in tests/mocks/supabase.ts, so this suite and
 * tests/plan-001-planner-runtime.test.ts exercise the exact same contract
 * (rows/error/session-absence semantics plus the mutating-call recorder the
 * zero-write assertion depends on).
 */
vi.mock(
  "../src/lib/supabase/server",
  async () => (await import("./mocks/supabase")).supabaseMockModule(),
);
afterEach(() => {
  resetSupabaseMock();
  vi.restoreAllMocks();
});

import { loadTrustedShotReferences } from "../src/lib/shoot/shot-type-references";
import {
  pickReferencesForDeliverable,
  scoreReferenceCompatibility,
  type TrustedReferenceShotType,
} from "../src/lib/shoot/shot-list-from-references";
import { recommendShootType } from "../src/mastra/tools/planning";
import {
  composeShootPlan,
  composeShootPlanTool,
  ComposeShootPlanInputSchema,
  type ComposeShootPlanInput,
} from "../src/mastra/tools/compose-shoot-plan";
import { ShootPlanSchema } from "../src/mastra/tools/plan-schema";
import { productionPlannerAgent } from "../src/mastra/agents";

const REF_PDP_FLAT_LAY = {
  id: "ref-1",
  category: "clothing",
  subcategory: "flat_lay",
  angle: "Front flat lay",
  description: "Garment laid flat, front facing, white background",
  channel_fit: ["shopify_pdp", "amazon"],
  model_type: null,
  background: "white",
};
const REF_IG_LIFESTYLE = {
  id: "ref-2",
  category: "clothing",
  subcategory: "lifestyle",
  angle: "Model full body",
  description: "Model wearing garment, lifestyle setting",
  channel_fit: ["instagram_feed", "instagram_story"],
  model_type: "human",
  background: "lifestyle",
};
const MALFORMED_ROW = { id: "ref-bad", category: "x", subcategory: "y", angle: null, description: "no angle" };

function baseInput(overrides: Partial<ComposeShootPlanInput> = {}): ComposeShootPlanInput {
  return {
    channels: ["shopify"],
    brief: "ecommerce product listing",
    crewCount: 2,
    studioType: "owned",
    ...overrides,
  } as ComposeShootPlanInput;
}

// ---------------------------------------------------------------------------
// loadTrustedShotReferences — read-only, never fabricates
// ---------------------------------------------------------------------------

describe("loadTrustedShotReferences", () => {
  it("maps populated rows to the TrustedReferenceShotType shape generateShotListDraft requires", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY, REF_IG_LIFESTYLE];
    const refs = await loadTrustedShotReferences();
    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual({
      id: "ref-1",
      angle: "Front flat lay",
      description: "Garment laid flat, front facing, white background",
      channelFit: ["shopify_pdp", "amazon"],
      background: "white",
      category: "clothing",
      subcategory: "flat_lay",
      modelType: null,
      tags: null,
    });
  });

  it("returns an explicit empty array — never a fabricated reference — when the table has no rows", async () => {
    supabaseMock.rows = [];
    expect(await loadTrustedShotReferences()).toEqual([]);
  });

  it("returns an empty array, not a throw, when Supabase returns an error", async () => {
    supabaseMock.error = { message: "RLS denied" };
    expect(await loadTrustedShotReferences()).toEqual([]);
  });

  it("returns an empty array when createClient() has no session context (best-effort, matches loadChannelSpecs)", async () => {
    supabaseMock.available = false;
    expect(await loadTrustedShotReferences()).toEqual([]);
  });

  it("fails closed — returns an empty array, not partial data — when even one row is malformed", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY, MALFORMED_ROW];
    const refs = await loadTrustedShotReferences();
    expect(refs).toEqual([]);
  });

  it("fails closed on a wrong-typed field, not just a missing one — non-string id", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY, { ...REF_IG_LIFESTYLE, id: 42 }];
    expect(await loadTrustedShotReferences()).toEqual([]);
  });

  it("fails closed on a wrong-typed field — a non-string entry inside channel_fit", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY, { ...REF_IG_LIFESTYLE, channel_fit: ["instagram_feed", 7] }];
    expect(await loadTrustedShotReferences()).toEqual([]);
  });

  it("fails closed on a wrong-typed field — a non-string, non-null background", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY, { ...REF_IG_LIFESTYLE, background: {} }];
    expect(await loadTrustedShotReferences()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// composeShootPlan — deterministic composition
// ---------------------------------------------------------------------------

describe("composeShootPlan", () => {
  it("produces a complete, schema-valid plan when channels, references, and budget inputs are all known", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY];
    const plan = await composeShootPlan(baseInput());

    expect(() => ShootPlanSchema.parse(plan)).not.toThrow();
    expect(plan.channels).toEqual(["shopify"]);
    expect(plan.shootTypeResult.status).toBe("ok");
    expect(plan.deliverablesResult.status).toBe("ok");
    expect(plan.shotListResult?.status).toBe("ok");
    expect(plan.shotListResult?.shots.length).toBeGreaterThan(0);
    expect(plan.budgetResult.status).toBe("ok");
    expect(plan.status).toBe("needs_input"); // objective/location/etc. were never supplied
    expect(plan.missingInputs).toContain("objective");
  });

  it("an operator-supplied shootType is authoritative — it overrides a disagreeing recommendation instead of the plan carrying two conflicting shoot types", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY];
    // channels + default "ecommerce product listing" brief clearly recommend
    // ecommerce_pdp; the operator explicitly asks for something else.
    const plan = await composeShootPlan(baseInput({ channels: ["shopify"], shootType: "packshot" }));
    expect(plan.shootTypeResult.status).toBe("ok");
    expect(plan.shootTypeResult.shootType).toBe("packshot");
    expect(plan.shootTypeResult.warnings.join(" ")).toMatch(
      /operator-specified shootType "packshot" overrides the recommender's independent suggestion "ecommerce_pdp"/i,
    );
  });

  it("every shot in the composed plan keeps a referenceId that traces to an actually-loaded trusted reference — never invented", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY];
    const plan = await composeShootPlan(baseInput());
    const referenceIds = new Set(["ref-1"]);
    for (const shot of plan.shotListResult?.shots ?? []) {
      expect(referenceIds.has(shot.referenceId)).toBe(true);
    }
    expect(plan.referencesUsed.every((r) => referenceIds.has(r.id))).toBe(true);
  });

  it("marks a section confirmed, with source, only when the operator actually supplied it", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY];
    const plan = await composeShootPlan(
      baseInput({ objective: "Launch the SS27 dress line on Shopify", location: "Studio A, downtown" }),
    );
    expect(plan.objective).toEqual({ status: "confirmed", value: "Launch the SS27 dress line on Shopify", source: "operator" });
    expect(plan.location.status).toBe("confirmed");
    // still never supplied -> still needs_input, not silently defaulted, and
    // the strict discriminated union carries no stray value/source at all.
    expect(plan.talent).toEqual({ status: "needs_input" });
  });

  it("a notes-only schedule (no dates) stays needs_input, not confirmed", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY];
    const plan = await composeShootPlan(baseInput({ scheduleNotes: "Sometime next quarter" }));
    expect(plan.schedule).toEqual({ status: "needs_input" });
    expect(plan.missingInputs).toContain("schedule");
  });

  it("a single-date schedule (missing the other date) stays needs_input, not confirmed", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY];
    const plan = await composeShootPlan(baseInput({ scheduleStartDate: "2027-03-01" }));
    expect(plan.schedule).toEqual({ status: "needs_input" });
  });

  it("the canonical ShootPlanSchema itself — not just the compose-shoot-plan.ts call site — rejects a confirmed schedule missing a date", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY];
    const validPlan = await composeShootPlan(baseInput());
    const planWithBadSchedule = {
      ...validPlan,
      schedule: { status: "confirmed" as const, value: { notes: "TBD" }, source: "operator" },
    };
    const result = ShootPlanSchema.safeParse(planWithBadSchedule);
    expect(result.success).toBe(false);
  });

  it("empty trusted-reference data produces an explicit gap, never a fabricated shot list", async () => {
    supabaseMock.rows = [];
    const plan = await composeShootPlan(baseInput());
    expect(plan.shotListResult).toBeNull();
    expect(plan.missingInputs.join(" ")).toMatch(/trusted shot references are currently available/i);
    expect(plan.status).toBe("needs_input");
  });

  it("an uncovered channel (no matching reference) surfaces as needs_input, not a wrong/invented shot", async () => {
    // Only an Instagram reference exists; request a channel none of them cover.
    supabaseMock.rows = [REF_IG_LIFESTYLE];
    const plan = await composeShootPlan(baseInput({ channels: ["youtube"] }));
    expect(plan.shotListResult?.status).toBe("needs_input");
    expect(plan.shotListResult?.shots).toEqual([]);
    expect(plan.status).toBe("needs_input");
  });

  it("propagates recommendShootType's own needs_input (tied/no signal) up to the plan's overall status", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY];
    // No channels+brief combination that favors any single shoot type ->
    // recommendShootType itself returns needs_input with tied candidates.
    const plan = await composeShootPlan(baseInput({ channels: ["shopify", "amazon"], brief: undefined }));
    expect(plan.shootTypeResult.status).toBe("needs_input");
    expect(plan.status).toBe("needs_input");
    expect(plan.missingInputs.length).toBeGreaterThan(0);
  });

  it("estimateShootBudget's own needs_input (crew/studio/shots undecided) surfaces in the composed plan", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY];
    const plan = await composeShootPlan(baseInput({ crewCount: undefined, studioType: undefined }));
    expect(plan.budgetResult.status).toBe("needs_input");
    expect(plan.budgetResult.missingInputs).toEqual(expect.arrayContaining(["crewCount", "studioType"]));
    expect(plan.status).toBe("needs_input");
  });

  it("propagates a rejected nested tool execute() as a rejection, not a swallowed or invented plan", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY];
    vi.spyOn(recommendShootType, "execute").mockRejectedValueOnce(new Error("boom"));
    await expect(composeShootPlan(baseInput())).rejects.toThrow("boom");
  });

  it("performs zero insert/update/upsert/delete/rpc calls on the mocked Supabase client for a full composition — including through reachable helpers like loadChannelSpecs/loadTrustedShotReferences", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY];
    await composeShootPlan(baseInput());
    expect(supabaseMock.mutatingCalls).toEqual([]);
  });

  it("never produces an application-domain write — the compose module never imports or calls a write tool/mutating Supabase method", () => {
    const source = readFileSync(new URL("../src/mastra/tools/compose-shoot-plan.ts", import.meta.url), "utf8");
    // Real invocation/import patterns only — the file's own doc comment
    // legitimately *mentions* approveDraft/startBrandAnalysis by name to
    // explain why they're unreachable from this module, which a bare
    // substring match would wrongly flag.
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
    expect(source).not.toMatch(/\bapproveDraft\s*[(.]|\bsaveApprovedShootDraft\b|\bcommit_shoot_draft\b/);
    expect(source).not.toMatch(/^\s*import\s*\{[^}]*\b(approveDraft|startBrandAnalysis)\b/m);
  });

  it("rejects an oversized channels array at the schema boundary instead of silently truncating", () => {
    const tooMany = Array.from({ length: 51 }, () => "shopify");
    const result = ComposeShootPlanInputSchema.safeParse({ channels: tooMany });
    expect(result.success).toBe(false);
  });

  it("rejects an empty channels array — channels is the one truly required input", () => {
    const result = ComposeShootPlanInputSchema.safeParse({ channels: [] });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Registration — the fifth tool joins the allowlist, output stays typed
// ---------------------------------------------------------------------------

describe("composeShootPlan tool registration", () => {
  it("is registered on the Production Planner with input/output schemas enforced", async () => {
    const tools = await productionPlannerAgent.listTools();
    const tool = tools.composeShootPlan as { inputSchema?: unknown; outputSchema?: unknown };
    expect(tool).toBeDefined();
    expect(tool.inputSchema).toBeTruthy();
    expect(tool.outputSchema).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AG-UI/CopilotKit handoff — the exact ShootPlan survives the wire boundary
// ---------------------------------------------------------------------------
//
// The installed @ag-ui/mastra adapter (node_modules/@ag-ui/mastra) emits a
// tool's result as a TOOL_CALL_RESULT event whose `content` field is
// `JSON.stringify(result)` (see its onToolResultPart handler) — there is no
// custom encoding, binary framing, or lossy remapping in between. That JSON
// round-trip is therefore the actual wire boundary this task's "no lossy
// reconstruction" requirement is about. This test exercises it directly with
// a maximally-populated ShootPlan (every PlanField confirmed, real shots,
// budget, assumptions) rather than relying only on the separate, generic
// "every tool has schemas" proof in mastra-registry-contract.test.ts.
describe("composeShootPlan AG-UI/CopilotKit wire handoff", () => {
  it("survives the exact JSON.stringify/parse round-trip @ag-ui/mastra performs on a tool result, unchanged and still schema-valid", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY, REF_IG_LIFESTYLE];
    const plan = await composeShootPlan(
      baseInput({
        channels: ["shopify", "instagram_feed"],
        objective: "Launch the SS27 dress line",
        mediaType: "photo",
        location: "Studio A, downtown",
        lighting: "Softbox, 5600K",
        setBackground: "Seamless white",
        talent: "In-house model roster",
        crew: "2 photographers, 1 stylist",
        studio: "iPix Studio A",
        equipment: "Canon R5, 85mm prime",
        scheduleStartDate: "2027-03-01",
        scheduleEndDate: "2027-03-03",
        scheduleNotes: "Golden hour exteriors on day 2",
        campaignContext: "SS27 launch campaign, approved creative direction v3",
      }),
    );

    // The exact operation @ag-ui/mastra's onToolResultPart performs:
    // `content: JSON.stringify(e.result)` — decoded back on the client side.
    const wireContent = JSON.stringify(plan);
    const received = JSON.parse(wireContent);

    expect(received).toEqual(plan);
    // Every provenance/identity detail this task requires to survive:
    expect(received.objective).toEqual({ status: "confirmed", value: "Launch the SS27 dress line", source: "operator" });
    expect(received.schedule).toEqual({
      status: "confirmed",
      value: { startDate: "2027-03-01", endDate: "2027-03-03", notes: "Golden hour exteriors on day 2" },
      source: "operator",
    });
    expect(received.referencesUsed.length).toBeGreaterThan(0);
    for (const ref of received.referencesUsed) {
      expect(typeof ref.id).toBe("string");
      expect(typeof ref.angle).toBe("string");
    }
    // The round-tripped object must still validate against the exact same
    // schema the tool's outputSchema is bound to — proving no field silently
    // became schema-invalid (e.g. an undefined dropped by JSON.stringify)
    // across the boundary.
    expect(() => ShootPlanSchema.parse(received)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Deterministic, compatibility-aware reference selection (PLAN-001 Step 1)
// ---------------------------------------------------------------------------

const REF_CLOTHING_PDP: TrustedReferenceShotType = {
  id: "ref-clothing-pdp",
  angle: "Model front, full body",
  description: "Model wearing the garment on seamless white",
  channelFit: ["shopify_pdp"],
  background: "white",
  category: "clothing",
  subcategory: "on_model",
  modelType: "human",
  tags: ["studio", "editorial"],
};

const REF_BEAUTY_PDP: TrustedReferenceShotType = {
  id: "ref-beauty-pdp",
  angle: "Product macro",
  description: "Beauty product macro on gradient",
  channelFit: ["shopify_pdp"],
  background: "studio_gradient",
  category: "beauty",
  subcategory: "macro",
  modelType: "product",
  tags: ["gradient", "glossy"],
};

const REF_CLOTHING_FLAT: TrustedReferenceShotType = {
  id: "ref-clothing-flat",
  angle: "Front flat lay",
  description: "Garment laid flat, front facing, white background",
  channelFit: ["shopify_pdp"],
  background: "white",
  category: "clothing",
  subcategory: "flat_lay",
  modelType: "product",
  tags: ["catalog", "clean"],
};

const REF_UNKNOWN_METADATA: TrustedReferenceShotType = {
  id: "ref-unknown",
  angle: "Three quarter",
  description: "Reference row without compatibility metadata",
  channelFit: ["shopify_pdp"],
  background: "white",
  category: null,
  subcategory: null,
  modelType: null,
  tags: null,
};

describe("pickReferencesForDeliverable — deterministic, compatibility-aware selection", () => {
  it("returns the same selection for the same input and catalog", () => {
    const catalog = [REF_BEAUTY_PDP, REF_CLOTHING_FLAT, REF_CLOTHING_PDP, REF_UNKNOWN_METADATA];
    const context = { productCategory: "clothing", styleKeywords: ["catalog"] };
    const first = pickReferencesForDeliverable("shopify", catalog, 3, context).map((r) => r.id);
    const second = pickReferencesForDeliverable("shopify", catalog, 3, context).map((r) => r.id);
    expect(first).toEqual(second);
  });

  it("does not depend on database/input row order — a reversed catalog selects the same references", () => {
    const catalog = [REF_BEAUTY_PDP, REF_CLOTHING_FLAT, REF_CLOTHING_PDP, REF_UNKNOWN_METADATA];
    const context = { productCategory: "clothing", styleKeywords: ["catalog"] };
    const forward = pickReferencesForDeliverable("shopify", catalog, 4, context).map((r) => r.id);
    const reversed = pickReferencesForDeliverable("shopify", [...catalog].reverse(), 4, context).map(
      (r) => r.id,
    );
    expect(reversed).toEqual(forward);
  });

  it("excludes a channel-matching reference whose known product category disagrees — no silent substitution", () => {
    // Both references match channel "shopify" → "shopify_pdp"; only the
    // category distinguishes them.
    expect(scoreReferenceCompatibility(REF_BEAUTY_PDP, "shopify", { productCategory: "clothing" })).toBe(0);
    const picked = pickReferencesForDeliverable(
      "shopify",
      [REF_BEAUTY_PDP, REF_CLOTHING_PDP],
      5,
      { productCategory: "clothing" },
    );
    // Count is filled by cycling the compatible set, so 5 picks repeat the one
    // compatible reference — the point is that the incompatible one never appears.
    expect(new Set(picked.map((r) => r.id))).toEqual(new Set(["ref-clothing-pdp"]));
  });

  it("excludes a reference whose known model/talent class disagrees and ranks the matching class first", () => {
    expect(scoreReferenceCompatibility(REF_CLOTHING_PDP, "shopify", { modelType: "product" })).toBe(0);
    const picked = pickReferencesForDeliverable(
      "shopify",
      [REF_CLOTHING_FLAT, REF_CLOTHING_PDP],
      1,
      { modelType: "product" },
    );
    expect(picked.map((r) => r.id)).toEqual(["ref-clothing-flat"]);
  });

  it("ranks a style/tag match above a merely channel-compatible reference", () => {
    const picked = pickReferencesForDeliverable(
      "shopify",
      [REF_UNKNOWN_METADATA, REF_CLOTHING_FLAT],
      1,
      { productCategory: "clothing", styleKeywords: ["catalog", "clean"] },
    );
    expect(picked.map((r) => r.id)).toEqual(["ref-clothing-flat"]);
  });

  it("keeps an unknown-metadata reference eligible rather than inventing a gap from missing data", () => {
    const score = scoreReferenceCompatibility(REF_UNKNOWN_METADATA, "shopify", {
      productCategory: "clothing",
      modelType: "human",
    });
    expect(score).toBeGreaterThan(0);
    const picked = pickReferencesForDeliverable("shopify", [REF_UNKNOWN_METADATA], 2, {
      productCategory: "clothing",
    });
    expect(picked.map((r) => r.id)).toEqual(["ref-unknown", "ref-unknown"]);
  });

  it("returns an explicit empty selection when nothing is compatible — never a wrong reference", () => {
    const picked = pickReferencesForDeliverable("shopify", [REF_BEAUTY_PDP], 2, {
      productCategory: "clothing",
    });
    expect(picked).toEqual([]);
  });

  it("fails the composed plan closed to needs_input when no reference is compatible, with no invented referenceId", async () => {
    // A beauty reference that matches the channel but not the known category.
    supabaseMock.rows = [
      {
        id: "ref-beauty-pdp",
        category: "beauty",
        subcategory: "macro",
        angle: "Product macro",
        description: "Beauty product macro on gradient",
        channel_fit: ["shopify_pdp"],
        model_type: "product",
        background: "studio_gradient",
      },
    ];
    const plan = await composeShootPlan(baseInput({ channels: ["shopify"], productCategory: "clothing" }));
    expect(plan.shotListResult?.status).toBe("needs_input");
    expect(plan.shotListResult?.shots).toEqual([]);
    expect(plan.referencesUsed).toEqual([]);
    expect(plan.status).toBe("needs_input");
  });

  it("keeps every composed shot's referenceId inside the loaded trusted set even after category filtering", async () => {
    supabaseMock.rows = [
      {
        id: "ref-clothing-pdp",
        category: "clothing",
        subcategory: "on_model",
        angle: "Model front, full body",
        description: "Model wearing the garment on seamless white",
        channel_fit: ["shopify_pdp"],
        model_type: "human",
        background: "white",
      },
      {
        id: "ref-beauty-pdp",
        category: "beauty",
        subcategory: "macro",
        angle: "Product macro",
        description: "Beauty product macro on gradient",
        channel_fit: ["shopify_pdp"],
        model_type: "product",
        background: "studio_gradient",
      },
    ];
    const plan = await composeShootPlan(baseInput({ channels: ["shopify"], productCategory: "clothing" }));
    const allowed = new Set(["ref-clothing-pdp"]);
    for (const shot of plan.shotListResult?.shots ?? []) {
      expect(allowed.has(shot.referenceId)).toBe(true);
      expect(shot.referenceId).not.toBe("ref-beauty-pdp");
    }
    expect(plan.shotListResult?.shots.length).toBeGreaterThan(0);
  });
});
