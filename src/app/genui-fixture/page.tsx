import { notFound } from "next/navigation";

import { GenUIFixtureHarness } from "@/components/operator-panel/genui-fixture-harness";
import { plannerSeedRoutesEnabled } from "@/lib/planner/seed-routes";

export const dynamic = "force-dynamic";

/**
 * Test-only browser route for the GenUI Surface lifecycle.
 *
 * Gated exactly like the existing Planner seed route: available in `next dev`,
 * or in the guarded Playwright production job, and never in production/Vercel.
 */
export default function GenUIFixturePage() {
  if (!plannerSeedRoutesEnabled()) notFound();
  return <GenUIFixtureHarness />;
}
