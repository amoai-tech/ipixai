"use server";

import { createClient } from "@/lib/supabase/server";
import {
  ComposeShootPlanInputSchema,
  composeShootPlan,
} from "@/mastra/tools/compose-shoot-plan";
import type { ShootPlan } from "@/mastra/tools/plan-schema";

export type ComposeWizardPlanResult =
  | { ok: true; plan: ShootPlan }
  | { ok: false; error: string };

/**
 * IPI-1085 · SHOOT-WIZARD-001 — authenticated, read-only Wizard bridge to
 * the existing canonical composeShootPlan owner. The browser supplies only
 * plan inputs; this action performs no Shoot/approval persistence.
 */
export async function composeShootPlanForWizard(input: unknown): Promise<ComposeWizardPlanResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not authenticated — please sign in and try again." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated — please sign in and try again." };

  const parsed = ComposeShootPlanInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some shoot inputs are invalid. Review the form and try again." };

  try {
    const plan = await composeShootPlan(parsed.data);
    return { ok: true, plan };
  } catch (error) {
    console.error("[shoot-wizard] composeShootPlan failed", error);
    return { ok: false, error: "The production plan could not be composed. Please try again." };
  }
}
