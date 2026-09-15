import { afterEach, describe, expect, it, vi } from "vitest";

import { resetSupabaseMock, supabaseMock } from "./mocks/supabase";

/**
 * IPI-1081 · PLAN-001 — Step 2 runtime certification.
 *
 * Proves the REAL registered Production Planner — the agent the `/app`
 * operator chat resolves through `agentId="default"` — turns one
 * natural-language shoot brief into ONE schema-valid ShootPlan by actually
 * executing `composeShootPlan`, and that the same planning turn cannot
 * expose the consequential brand-write tools (`approveDraft`,
 * `startBrandAnalysis`).
 *
 * The paid model is swapped for a deterministic mock model so the proof is
 * about the runtime wiring (agent -> tool gate -> real tool execution ->
 * structured artifact), not model luck. CopilotKit/AG-UI browser delivery of
 * the same path is covered by the `e2e/planner-journey` smoke.
 *
 * Same Supabase mock as tests/plan-001.test.ts — both suites share it through
 * tests/mocks/supabase.ts so the runtime proof and the unit proof can never
 * drift apart on what the read surface returns.
 */
vi.mock(
  "../src/lib/supabase/server",
  async () => (await import("./mocks/supabase")).supabaseMockModule(),
);

import { MastraLanguageModelV2Mock, simulateReadableStream } from "@mastra/core/test-utils/llm-mock";
import { productionPlannerAgent } from "../src/mastra/agents";
import { PLANNING_ONLY_TOOLS, resolveActiveTools } from "../src/mastra/planner-tool-gate";
import type { ComposeShootPlanInput } from "../src/mastra/tools/compose-shoot-plan";
import { ShootPlanSchema } from "../src/mastra/tools/plan-schema";

const PLAN_001_BRIEF =
  "Plan a Shopify + Instagram shoot for our new linen dress collection. Photos only, launching next month.";

const CHANNEL_SPEC_TABLES = {
  recommendation_rules: [
    { condition_value: "shopify", platform_slugs: ["shopify"], image_type_slugs: ["product"] },
    { condition_value: "instagram_feed", platform_slugs: ["instagram"], image_type_slugs: ["feed"] },
  ],
  platforms: [
    { id: "p-shopify", slug: "shopify" },
    { id: "p-instagram", slug: "instagram" },
  ],
  image_type_defs: [
    { id: "i-product", slug: "product" },
    { id: "i-feed", slug: "feed" },
  ],
  image_specs: [
    { platform_id: "p-shopify", image_type_id: "i-product", aspect_ratio_label: "1:1", accepted_formats: ["JPG"], background_required: "pure_white" },
    { platform_id: "p-instagram", image_type_id: "i-feed", aspect_ratio_label: "4:5", accepted_formats: ["JPG"], background_required: null },
  ],
};

const TRUSTED_ROWS = [
  {
    id: "ref-clothing-pdp",
    category: "clothing",
    subcategory: "flat_lay",
    angle: "Front flat lay",
    description: "Garment laid flat, front facing, white background",
    channel_fit: ["shopify_pdp"],
    model_type: null,
    background: "white",
    tags: ["catalog"],
  },
  {
    id: "ref-clothing-ig",
    category: "clothing",
    subcategory: "lifestyle",
    angle: "Model full body",
    description: "Model wearing garment, lifestyle setting",
    channel_fit: ["instagram_feed"],
    model_type: "human",
    background: "lifestyle",
    tags: ["editorial"],
  },
];

const COMPOSE_ARGS: ComposeShootPlanInput = {
  channels: ["shopify", "instagram_feed"],
  brief: PLAN_001_BRIEF,
  productCategory: "clothing",
  objective: "Launch the linen dress collection",
};

const USAGE = { inputTokens: 12, outputTokens: 8, totalTokens: 20 };

function toolCallTurn(input: unknown): StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    {
      type: "tool-call",
      toolCallId: "call-plan-1",
      toolName: "composeShootPlan",
      input: JSON.stringify(input),
    },
    { type: "finish", finishReason: "tool-calls", usage: USAGE },
  ];
}

// Explicit element type instead of an inferred tuple: the two helpers build
// structurally different turns, and letting TS infer the union from whichever
// call site came first made `simulateReadableStream` reject the other branch.
type StreamPart =
  | { type: "stream-start"; warnings: never[] }
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: string }
  | { type: "finish"; finishReason: string; usage: typeof USAGE };

function textTurn(text: string): StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
    { type: "finish", finishReason: "stop", usage: USAGE },
  ];
}

type MockStreamResult = Awaited<ReturnType<MastraLanguageModelV2Mock["doStream"]>>;

function scriptedModel(turnOneArgs: unknown, finalText: string) {
  let turn = 0;
  const model = new MastraLanguageModelV2Mock({
    provider: "mock",
    modelId: "mock-planner",
    // A FUNCTION, never an array: the vendored mock's array branch indexes
    // with doStreamCalls.length AFTER pushing, so the first scripted result
    // would be skipped. doStreamCalls still records every call.
    doStream: async () => {
      turn += 1;
      const chunks = turn === 1 ? toolCallTurn(turnOneArgs) : textTurn(finalText);
      return { stream: simulateReadableStream({ chunks }) } as unknown as MockStreamResult;
    },
  });
  return model;
}

function toolNamesFor(model: MastraLanguageModelV2Mock): string[] {
  const tools = (model.doStreamCalls[0]?.tools ?? []) as Array<{ name?: string }>;
  return tools.map((tool) => tool.name ?? "");
}

afterEach(() => {
  resetSupabaseMock();
  productionPlannerAgent.__resetToOriginalModel();
  vi.restoreAllMocks();
});

describe("Planner turn gate — the real PLAN-001 shoot brief stays planning-only", () => {
  it("keeps one NL shoot brief on PLANNING_ONLY_TOOLS and never exposes the brand write tools", () => {
    const active = resolveActiveTools([{ role: "user", content: PLAN_001_BRIEF }]);
    expect(active).toEqual([...PLANNING_ONLY_TOOLS]);
    expect(active).toContain("composeShootPlan");
    expect(active).not.toContain("approveDraft");
    expect(active).not.toContain("startBrandAnalysis");
  });
});

describe("Production Planner runtime — one NL brief executes composeShootPlan", () => {
  it("runs composeShootPlan for the real Shopify + Instagram linen dress brief and returns a schema-valid ShootPlan", async () => {
    supabaseMock.rows = TRUSTED_ROWS;
    supabaseMock.tables = CHANNEL_SPEC_TABLES;
    const model = scriptedModel(COMPOSE_ARGS, "Here is your shoot plan.");
    productionPlannerAgent.__updateModel({ model });

    let captured: { toolName: string; result: unknown; isError?: boolean } | null = null;

    const stream = await productionPlannerAgent.stream([{ role: "user", content: PLAN_001_BRIEF }], {
      maxSteps: 3,
    });
    for await (const chunk of stream.fullStream) {
      if (chunk.type === "tool-result" && chunk.payload.toolName === "composeShootPlan") {
        captured = chunk.payload as unknown as { toolName: string; result: unknown; isError?: boolean };
      }
    }

    expect(captured).not.toBeNull();
    if (!captured) throw new Error("composeShootPlan never executed");
    expect(captured.isError).toBeFalsy();

    const plan = ShootPlanSchema.parse(captured.result);
    expect(plan.channels).toEqual(expect.arrayContaining(["shopify", "instagram_feed"]));
    expect(plan.deliverablesResult.deliverables.length).toBeGreaterThan(0);
    expect(plan.deliverablesResult.deliverables.some((d) => d.formatSource === "ipix_reference_v1")).toBe(true);
    expect(plan.shotListResult?.shots.length ?? 0).toBeGreaterThan(0);
    expect(plan.referencesUsed.length).toBeGreaterThan(0);
    expect(["complete", "needs_input"]).toContain(plan.status);
    expect(plan.budgetResult).toBeTruthy();

    // The real tool gate narrowed this planning turn: no consequential writes.
    const exposed = toolNamesFor(model);
    expect(exposed).toContain("composeShootPlan");
    expect(exposed).not.toContain("approveDraft");
    expect(exposed).not.toContain("startBrandAnalysis");

    // Planning never writes Shoot/brand-domain truth.
    expect(supabaseMock.mutatingCalls).toEqual([]);
  });

  it("fails closed to needs_input with no trusted references instead of inventing shots", async () => {
    supabaseMock.rows = [];
    supabaseMock.tables = CHANNEL_SPEC_TABLES;
    const model = scriptedModel(COMPOSE_ARGS, "I need more inputs.");
    productionPlannerAgent.__updateModel({ model });

    let captured: { result: unknown } | null = null;
    const stream = await productionPlannerAgent.stream([{ role: "user", content: PLAN_001_BRIEF }], {
      maxSteps: 3,
    });
    for await (const chunk of stream.fullStream) {
      if (chunk.type === "tool-result" && chunk.payload.toolName === "composeShootPlan") {
        captured = chunk.payload as unknown as { result: unknown };
      }
    }

    expect(captured).not.toBeNull();
    if (!captured) throw new Error("composeShootPlan never executed");
    const plan = ShootPlanSchema.parse(captured.result);
    expect(plan.shotListResult?.shots ?? []).toEqual([]);
    expect(plan.referencesUsed).toEqual([]);
    expect(plan.status).toBe("needs_input");
    expect(plan.missingInputs.length).toBeGreaterThan(0);
  });
});
