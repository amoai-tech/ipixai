import { onboardingResumeStepSchema, type OnboardingResumeStep } from "./schema";

/**
 * IPI-1263 · ONBOARD-COMPAT-001 — legacy/lean onboarding resume mapping.
 *
 * Pure compatibility adapter only: no React, DOM, router, network, or
 * Supabase client, and no writes. Given the minimum durable inputs
 * (`status`, `current_screen`, `brand_id`, `organization_id`, parsed
 * `draft_answers`), returns the semantic step a resuming session should land
 * on. This intentionally does NOT define IPI-1260's final lean answer schema
 * or IPI-1264's channel contract — `SemanticOnboardingStep` names *where to
 * resume*, not the shape of any answer.
 *
 * Historical screen meaning (adapted from amo-tech-ai/lumina-studio
 * app/src/lib/onboarding/navigation.ts — QUESTION_SCREENS/MARKETING_SCREENS/
 * ANALYSIS_SCREEN/PAYOFF_SCREEN; copied as facts about the old 1..13 flow,
 * not as the nextScreen/canBack/canSkip navigation behavior itself):
 *
 *   1        marketing/interstitial (before Build Type)
 *   2        Build Type                      (QUESTION_SCREENS[0])
 *   3        marketing/interstitial (before Brand)
 *   4        Brand Name + Website             (QUESTION_SCREENS[1])
 *   5        Channels                         (QUESTION_SCREENS[2])
 *   6        marketing/interstitial (before Growth)
 *   7        Growth Preference                (QUESTION_SCREENS[3])
 *   8-11     marketing/interstitial (before Analysis)
 *   12       Analysis                         (ANALYSIS_SCREEN)
 *   13       Brand DNA payoff/review          (PAYOFF_SCREEN)
 *
 * IMPORTANT: `current_screen` is a hint, never proof. IPI-903's
 * materialize_onboarding_session heals any materialized row below screen 12
 * up to 12, so `current_screen === 12` never certifies that analysis/Brand
 * DNA actually ran — durable `status`/`brand_id`/`organization_id` outrank
 * it. A `draft` row above screen 1 can only be a pre-IPI-1089 multi-screen
 * session, because current code always inserts `current_screen: 1` and never
 * advances it while `status` stays `draft` (only the materialize RPC ever
 * changes it, to 12). That fact — not the screen number by itself — is what
 * lets brandName's presence stand in for "the old linear, validated flow
 * actually reached this far."
 */
export type SemanticOnboardingStep =
  | "materialized"
  | "brand-details"
  | "channels"
  | "growth-preference"
  | "analysis"
  | "review";

export interface StepMappingInput {
  /** Tolerates an unexpected string defensively; never throws on it. */
  status: string;
  currentScreen: number;
  brandId: string | null;
  organizationId: string | null;
  /** Parsed draft_answers — accepts a loosely-typed/partial object so a
   * malformed row can be checked without pre-validating it first. */
  draft: { brandName?: unknown } & Record<string, unknown>;
}

/** Non-finite/out-of-range input (NaN, negative, decimals, >13) normalizes
 * to historical screen 1 rather than propagating garbage into the mapping.
 * With a valid brand name, screen 1 then resolves to `channels`, which is the
 * mapper's safe semantic default for a resumable draft. */
function clampScreen(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const whole = Math.trunc(value);
  if (whole < 1) return 1;
  if (whole > 13) return 1;
  return whole;
}

/**
 * Resolve the semantic lean step a resuming session should land on.
 *
 * Durable state outranks the historical screen: a materialized session (by
 * status, or by durable brand_id + organization_id already present as a
 * defensive belt) always resolves to "materialized" regardless of screen.
 * Everything else falls back to the safest step it can prove is unanswered.
 */
export function resolveSemanticStep(input: StepMappingInput): SemanticOnboardingStep {
  if (input.status === "materialized" || (input.brandId != null && input.organizationId != null)) {
    return "materialized";
  }

  const brandName = typeof input.draft?.brandName === "string" ? input.draft.brandName.trim() : "";
  if (!brandName) return "brand-details";

  const screen = clampScreen(input.currentScreen);
  if (screen <= 5) return "channels";
  if (screen <= 7) return "growth-preference";
  if (screen <= 12) return "analysis";
  return "review";
}

/** IPI-1260 · ONBOARD-LEAN-001 — pure V2 semantic resolver. */
export function resolveLeanStep(input: { flowVersion?: unknown; resumeStep?: unknown }): OnboardingResumeStep {
  if (input.flowVersion !== 2) return "build-type";
  const parsed = onboardingResumeStepSchema.safeParse(input.resumeStep);
  return parsed.success ? parsed.data : "build-type";
}
