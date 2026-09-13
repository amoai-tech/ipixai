import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * IPI-1081 · PLAN-001. Same mock shape as tests/tool-001.test.ts's
 * channel-specs mock, extended with `.limit()` for the trusted-reference
 * reader's query chain (src/lib/shoot/shot-type-references.ts).
 */
const supabaseMock = vi.hoisted(() => ({
  available: true,
  rows: [] as unknown[],
  error: null as null | { message: string },
}));
vi.mock("../src/lib/supabase/server", () => ({
  createClient: async () => {
    if (!supabaseMock.available) return null;
    return {
      from: () => {
        const result = { data: supabaseMock.error ? null : supabaseMock.rows, error: supabaseMock.error };
        const chain = {
          select: () => chain,
          limit: () => chain,
          then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
        };
        return chain;
      },
    };
  },
}));
afterEach(() => {
  supabaseMock.available = true;
  supabaseMock.rows = [];
  supabaseMock.error = null;
});

import { loadTrustedShotReferences } from "../src/lib/shoot/shot-type-references";
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

  it("silently drops a malformed row instead of passing a broken reference downstream", async () => {
    supabaseMock.rows = [REF_PDP_FLAT_LAY, MALFORMED_ROW];
    const refs = await loadTrustedShotReferences();
    expect(refs).toHaveLength(1);
    expect(refs[0]?.id).toBe("ref-1");
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
    // still never supplied -> still needs_input, not silently defaulted
    expect(plan.talent.status).toBe("needs_input");
    expect(plan.talent.value).toBeUndefined();
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
