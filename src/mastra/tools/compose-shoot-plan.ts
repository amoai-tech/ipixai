import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadTrustedShotReferences } from "@/lib/shoot/shot-type-references";
import type { SelectedDeliverable } from "@/lib/shoot/shot-list-from-references";
import {
  recommendShootType,
  planDeliverables,
  generateShotListDraft,
  estimateShootBudget,
  ChannelSchema,
  ShootTypeSchema,
  MAX_CHANNELS_INPUT,
  MAX_TEXT_LENGTH,
  MAX_PRODUCT_NAMES,
  type RecommendShootTypeOutput,
  type PlanDeliverablesOutput,
  type GenerateShotListDraftOutput,
  type EstimateShootBudgetOutput,
} from "./planning";
import { CurrencySchema } from "./planning-types";
import { ShootPlanSchema, confirmedField, needsInputField, type ShootPlan } from "./plan-schema";

/**
 * IPI-1081 · PLAN-001 — composes one complete, schema-valid ShootPlan from a
 * single deterministic pass over IPI-1049 · TOOL-001's four existing tools
 * plus a read-only trusted-reference load. No second Planner, no new
 * persistence, no LLM call inside execute() — the model's only job is
 * extracting whatever the operator already said into this tool's typed
 * input; everything it didn't say comes back needs_input, never invented.
 *
 * This is also the PLAN-only write boundary this task requires: execute()
 * below has zero reachability to approveDraft/startBrandAnalysis (the two
 * brand-intelligence tools registered on the same Production Planner agent
 * for its unrelated conversational use) or to any shoot-save path — it only
 * ever calls the four pure TOOL-001 .execute() functions directly and one
 * read-only Supabase reference load. That is a real code-level guarantee for
 * the plan-composition path itself; it is not a claim that the agent has no
 * other tools registered for other, unrelated turns of the same
 * conversation (Mastra's current agent API has no per-call tool-subset
 * override — see IPI-1081's own Linear "Freeze dependencies" checkpoint
 * evidence).
 */

const ComposeShootPlanInputSchema = z.object({
  channels: z.array(ChannelSchema).min(1).max(MAX_CHANNELS_INPUT),
  objective: z.string().max(MAX_TEXT_LENGTH).optional(),
  brief: z.string().max(MAX_TEXT_LENGTH).optional(),
  productCategory: z.string().max(MAX_TEXT_LENGTH).optional(),
  brandDnaSummary: z.string().max(MAX_TEXT_LENGTH).optional(),
  styleKeywords: z.array(z.string().max(100)).max(50).optional(),
  productNames: z.array(z.string().max(MAX_TEXT_LENGTH)).max(MAX_PRODUCT_NAMES).optional(),
  shootType: ShootTypeSchema.optional(),
  mediaType: z.enum(["photo", "video", "both"]).optional(),
  crewCount: z.number().int().min(1).max(200).optional(),
  studioType: z.enum(["rental", "owned", "location", "outdoor"]).optional(),
  shootDays: z.number().int().min(1).max(365).optional(),
  currency: CurrencySchema.optional(),
  location: z.string().max(MAX_TEXT_LENGTH).optional(),
  lighting: z.string().max(MAX_TEXT_LENGTH).optional(),
  setBackground: z.string().max(MAX_TEXT_LENGTH).optional(),
  talent: z.string().max(MAX_TEXT_LENGTH).optional(),
  crew: z.string().max(MAX_TEXT_LENGTH).optional(),
  studio: z.string().max(MAX_TEXT_LENGTH).optional(),
  equipment: z.string().max(MAX_TEXT_LENGTH).optional(),
  scheduleStartDate: z.string().optional(),
  scheduleEndDate: z.string().optional(),
  scheduleNotes: z.string().max(MAX_TEXT_LENGTH).optional(),
  campaignContext: z.string().max(MAX_TEXT_LENGTH).optional(),
  risks: z.array(z.string().max(MAX_TEXT_LENGTH)).max(50).optional(),
});
export type ComposeShootPlanInput = z.infer<typeof ComposeShootPlanInputSchema>;

/** Structurally required for createTool but never used as authority — every
 *  execute() below is a plain synchronous-composition function; `{} as never`
 *  matches the exact pattern the existing TOOL-001 test suite already uses
 *  (tests/tool-001.test.ts) to call these same tools' execute() directly. */
const NO_CONTEXT = {} as never;

/** Every TOOL-001 tool's own .execute() type includes `void`/`ValidationError`
 *  in its return union for cases that can't occur when we've already passed
 *  Zod-valid input built from ComposeShootPlanInputSchema — narrowing here
 *  matches the exact `run<T>()` helper tests/tool-001.test.ts already uses to
 *  call these same four tools directly. */
async function run<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function composeShootPlan(input: ComposeShootPlanInput): Promise<ShootPlan> {
  const channels = input.channels;

  const shootTypeResult = await run<RecommendShootTypeOutput>(
    recommendShootType.execute!(
      {
        channels,
        brief: input.brief,
        productCategory: input.productCategory,
        brandDnaSummary: input.brandDnaSummary,
      },
      NO_CONTEXT,
    ),
  );

  const effectiveShootType = input.shootType ?? (shootTypeResult.status === "ok" ? shootTypeResult.shootType : undefined);

  const deliverablesResult = await run<PlanDeliverablesOutput>(
    planDeliverables.execute!(
      {
        channels,
        shootType: effectiveShootType as z.infer<typeof ShootTypeSchema> | undefined,
        brandDna:
          input.productCategory || input.styleKeywords
            ? { productCategory: input.productCategory, styleKeywords: input.styleKeywords }
            : undefined,
      },
      NO_CONTEXT,
    ),
  );

  // Trusted references: read-only, live table. Empty is a real reference
  // gap — surfaced as a missing input below, never invented shots.
  const references = await loadTrustedShotReferences();
  const referenceGapWarnings: string[] = [];
  let shotListResult: GenerateShotListDraftOutput | null = null;

  if (deliverablesResult.status === "ok" && deliverablesResult.deliverables.length > 0) {
    if (references.length === 0) {
      referenceGapWarnings.push(
        "No trusted shot references are currently available — the shot list cannot be generated yet.",
      );
    } else {
      const selectedDeliverables: SelectedDeliverable[] = deliverablesResult.deliverables.map((d, i) => ({
        id: `d-${i}`,
        channel: d.channel,
        format: d.format,
        quantity: d.quantity,
      }));
      shotListResult = await run<GenerateShotListDraftOutput>(
        generateShotListDraft.execute!(
          {
            selectedDeliverables,
            trustedReferenceShotTypes: references,
            shootType: effectiveShootType,
            brandDnaSummary: input.brandDnaSummary,
            productNames: input.productNames,
          },
          NO_CONTEXT,
        ),
      );
    }
  }

  const budgetResult = await run<EstimateShootBudgetOutput>(
    estimateShootBudget.execute!(
      {
        crewCount: input.crewCount,
        studioType: input.studioType,
        shotCount: shotListResult?.totalShots || undefined,
        shootDays: input.shootDays,
        currency: input.currency,
      },
      NO_CONTEXT,
    ),
  );

  const objective = input.objective ? confirmedField(input.objective) : needsInputField<string>();
  const mediaType = input.mediaType ? confirmedField(input.mediaType) : needsInputField<"photo" | "video" | "both">();
  const location = input.location ? confirmedField(input.location) : needsInputField<string>();
  const lighting = input.lighting ? confirmedField(input.lighting) : needsInputField<string>();
  const setBackground = input.setBackground ? confirmedField(input.setBackground) : needsInputField<string>();
  const talent = input.talent ? confirmedField(input.talent) : needsInputField<string>();
  const crew = input.crew ? confirmedField(input.crew) : needsInputField<string>();
  const studio = input.studio ? confirmedField(input.studio) : needsInputField<string>();
  const equipment = input.equipment ? confirmedField(input.equipment) : needsInputField<string>();
  const schedule =
    input.scheduleStartDate || input.scheduleEndDate || input.scheduleNotes
      ? confirmedField({
          startDate: input.scheduleStartDate,
          endDate: input.scheduleEndDate,
          notes: input.scheduleNotes,
        })
      : needsInputField<{ startDate?: string; endDate?: string; notes?: string }>();
  const campaignContext = input.campaignContext ? confirmedField(input.campaignContext) : needsInputField<string>();

  const localMissingInputs = ([
    ["objective", objective],
    ["mediaType", mediaType],
    ["location", location],
    ["lighting", lighting],
    ["setBackground", setBackground],
    ["talent", talent],
    ["crew", crew],
    ["studio", studio],
    ["equipment", equipment],
    ["schedule", schedule],
  ] as const)
    .filter(([, field]) => field.status === "needs_input")
    .map(([name]) => name);
  // campaignContext is optional context (approved campaign/creative-direction
  // info "when already available") — its absence is not a plan gap, so it's
  // excluded from missingInputs/completeness even though it's still a
  // typed needs_input PlanField like everything else above.

  const missingInputs = [
    ...shootTypeResult.missingInputs,
    ...deliverablesResult.missingInputs,
    ...(shotListResult?.missingInputs ?? []),
    ...referenceGapWarnings,
    ...budgetResult.missingInputs,
    ...localMissingInputs,
  ];
  const warnings = [
    ...shootTypeResult.warnings,
    ...deliverablesResult.warnings,
    ...(shotListResult?.warnings ?? []),
    ...budgetResult.warnings,
  ];
  const assumptions = [
    ...shootTypeResult.assumptions,
    ...deliverablesResult.assumptions,
    ...(shotListResult?.assumptions ?? []),
    ...budgetResult.assumptions,
  ];

  const toolsComplete =
    shootTypeResult.status === "ok" &&
    deliverablesResult.status === "ok" &&
    (shotListResult === null || shotListResult.status === "ok") &&
    referenceGapWarnings.length === 0 &&
    budgetResult.status === "ok";
  const status = toolsComplete && localMissingInputs.length === 0 ? "complete" : "needs_input";

  const plan: ShootPlan = {
    channels,
    shootTypeResult,
    deliverablesResult,
    shotListResult,
    budgetResult,
    objective,
    mediaType,
    location,
    lighting,
    setBackground,
    talent,
    crew,
    studio,
    equipment,
    schedule,
    campaignContext,
    risks: input.risks ?? [],
    assumptions,
    missingInputs,
    warnings,
    referencesUsed: shotListResult?.shots.map((s) => ({ id: s.referenceId, angle: s.angle })) ?? [],
    status,
  };

  // Re-validate the fully composed object against the same schema the
  // Planner's tool call is bound to — a defense-in-depth check that this
  // function's own output can never silently drift from ShootPlanSchema.
  return ShootPlanSchema.parse(plan);
}

export const composeShootPlanTool = createTool({
  id: "composeShootPlan",
  description:
    "Compose one complete ShootPlan (deliverables, trusted shot references, shots, budget, and every other " +
    "required planning section) from a natural-language shoot request. Call this once enough is known to " +
    "attempt a full plan, not for a single isolated calculation — use recommendShootType/planDeliverables/" +
    "generateShotListDraft/estimateShootBudget directly for that. Every section the operator did not " +
    "explicitly state comes back needs_input, never invented. This tool performs zero application-domain " +
    "writes and never saves, approves, or books anything.",
  inputSchema: ComposeShootPlanInputSchema,
  outputSchema: ShootPlanSchema,
  execute: async (input) => composeShootPlan(input as ComposeShootPlanInput),
});
