import { z } from "zod";
import { createGenerativeUI, standardUI } from "@copilotkit/react-core/v2/generative-ui";

import { onboardingBuildTypeSchema } from "@/lib/onboarding/schema";

/**
 * IPI-1461 · ONBOARD-PLAYGROUND-001 — host-only onboarding catalog.
 *
 * The onboarding page draws fixed A2UI screens itself; no agent receives this
 * catalog (the provider passes `agentIds: []`) and CopilotKit 1.88 refuses
 * agent-initiated renderer function calls. Only the form and layout
 * components the four screens need stay enabled. The Planner keeps its own
 * `ipix/planner@1` catalog unchanged.
 */
export const ONBOARDING_COMPONENTS = [
  "Card",
  "Column",
  "Row",
  "Title",
  "Caption",
  "Text",
  "Badge",
  "Spacer",
  "Divider",
  "List",
  "Form",
  "TextField",
  "RadioGroup",
  "ChoicePicker",
  "Button",
] as const;

type StandardName = Parameters<typeof standardUI.omit>[0][number];
type OmittedName = Exclude<StandardName, (typeof ONBOARDING_COMPONENTS)[number]>;

const allowed = new Set<string>(ONBOARDING_COMPONENTS);
const omitted = [...standardUI.components.keys()].filter(
  (name) => !allowed.has(name),
) as OmittedName[];

export const ipixOnboardingUI = createGenerativeUI({
  id: "ipix/onboarding@1",
  extends: [standardUI.omit(omitted)],
  components: {},
  functions: {
    // Browser-side shape check only, not a security boundary. Supabase RLS and
    // the materialize RPC enforce ownership; the IPI-1462 handler must still run
    // the existing brandName/validateUrl checks before saving. No length cap:
    // the draft schema has none, so a cap here would block a valid draft.
    onboardingContinue: {
      description: "Save the current onboarding step and move to the next one.",
      parameters: z.object({
        brandName: z.string().optional(),
        buildType: onboardingBuildTypeSchema.nullable().optional(),
      }),
    },
  },
});
