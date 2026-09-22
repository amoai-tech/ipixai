import { z } from "zod";
import { MAX_PRODUCT_REFS, ProductRefSchema } from "@/lib/commerce/product-ref";
import {
  RecommendShootTypeOutputSchema,
  PlanDeliverablesOutputSchema,
  GenerateShotListDraftOutputSchema,
  EstimateShootBudgetOutputSchema,
  ChannelSchema,
  MAX_CHANNELS_INPUT,
  MAX_TEXT_LENGTH,
} from "./planning";
import { AssumptionSchema } from "./planning-types";

/**
 * IPI-1081 · PLAN-001 — the canonical ShootPlan contract.
 *
 * Design: embed each IPI-1049 · TOOL-001 tool's *full* output object as-is
 * (zero remapping — every tool already carries its own status/assumptions/
 * warnings/missingInputs). For the handful of sections none of the four
 * tools compute (objective, media type, location, lighting, set/background,
 * talent, crew, studio, equipment, schedule, campaign context), use one
 * small `PlanField<T>` wrapper so "confirmed | assumed | needs_input" is a
 * real typed distinction everywhere, not just prose — per this task's
 * explicit requirement that unknown production facts can never silently
 * become confirmed facts.
 */
export const PlanFieldStatusSchema = z.enum(["confirmed", "assumed", "needs_input"]);
export type PlanFieldStatus = z.infer<typeof PlanFieldStatusSchema>;

function planField<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.discriminatedUnion("status", [
    z.object({ status: z.literal("confirmed"), value: valueSchema, source: z.string() }),
    z.object({ status: z.literal("assumed"), value: valueSchema, source: z.string() }),
    z.object({ status: z.literal("needs_input") }).strict(),
  ]);
}
export type PlanField<T> =
  | { status: "confirmed"; value: T; source: string }
  | { status: "assumed"; value: T; source: string }
  | { status: "needs_input" };

export function confirmedField<T>(value: T, source = "operator"): PlanField<T> {
  return { status: "confirmed", value, source };
}
export function assumedField<T>(value: T, source: string): PlanField<T> {
  return { status: "assumed", value, source };
}
export function needsInputField<T>(): PlanField<T> {
  return { status: "needs_input" };
}

const ScheduleSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().max(MAX_TEXT_LENGTH).optional(),
});

// A *confirmed* schedule specifically must carry both dates — notes alone
// (or one date) is a real partial input, not a confirmed schedule. This is
// enforced here, at the schema itself, as a second, independent layer on
// top of compose-shoot-plan.ts's own call-site check (which already never
// constructs a confirmed schedule without both dates) — so the invariant
// holds even if a schedule is ever constructed a different way in future.
const ConfirmedScheduleSchema = ScheduleSchema.refine(
  (schedule) => Boolean(schedule.startDate && schedule.endDate),
  { message: "A confirmed schedule requires both startDate and endDate" },
);

export const ShootPlanSchema = z.object({
  // Verified, always-known inputs to the plan (required to call
  // composeShootPlan at all — never a fabrication risk).
  channels: z.array(ChannelSchema).min(1).max(MAX_CHANNELS_INPUT),
  productRefs: z.array(ProductRefSchema).max(MAX_PRODUCT_REFS),

  // Sections owned by IPI-1049 · TOOL-001 — embedded whole, unmodified.
  shootTypeResult: RecommendShootTypeOutputSchema,
  deliverablesResult: PlanDeliverablesOutputSchema,
  // null only when there was no trusted reference / no deliverable to build
  // shots from yet — an explicit reference gap, never a fabricated shot list.
  shotListResult: GenerateShotListDraftOutputSchema.nullable(),
  budgetResult: EstimateShootBudgetOutputSchema,

  // Sections no TOOL-001 tool computes. Each is confirmed only when the
  // operator's own request explicitly supplied it (via composeShootPlan's
  // input schema) — otherwise needs_input. Never assumed/invented.
  objective: planField(z.string().max(MAX_TEXT_LENGTH)),
  mediaType: planField(z.enum(["photo", "video", "both"])),
  location: planField(z.string().max(MAX_TEXT_LENGTH)),
  lighting: planField(z.string().max(MAX_TEXT_LENGTH)),
  setBackground: planField(z.string().max(MAX_TEXT_LENGTH)),
  talent: planField(z.string().max(MAX_TEXT_LENGTH)),
  crew: planField(z.string().max(MAX_TEXT_LENGTH)),
  studio: planField(z.string().max(MAX_TEXT_LENGTH)),
  equipment: planField(z.string().max(MAX_TEXT_LENGTH)),
  schedule: planField(ConfirmedScheduleSchema),
  campaignContext: planField(z.string().max(MAX_TEXT_LENGTH)),

  // Roll-ups across every section above — one place to check "is this plan
  // actually complete", instead of a caller re-deriving it from five sources.
  risks: z.array(z.string()),
  assumptions: z.array(AssumptionSchema),
  missingInputs: z.array(z.string()),
  warnings: z.array(z.string()),
  referencesUsed: z.array(z.object({ id: z.string(), angle: z.string() })),
  status: z.enum(["complete", "needs_input"]),
});
export type ShootPlan = z.infer<typeof ShootPlanSchema>;
