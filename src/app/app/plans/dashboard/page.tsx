import { redirect } from "next/navigation";

import { PlanDashboard } from "@/components/plans/plan-dashboard";
import { ErrorState } from "@/components/ui/error-state";
import {
  appWorkspaceDependencies,
  requireResolvedAppWorkspace,
} from "@/lib/auth/app-shell";
import { resolveRuntimeTenant } from "@/lib/auth/runtime-org";
import { todayUtcIso } from "@/lib/plans/plan-display";
import { listPlansForOrg } from "@/lib/plans/get-plans";

/**
 * IPI-1074 · PLANS-001 — `/app/plans/dashboard`.
 *
 * Same tenant boundary as the Hub; loads up to 100 plans from the list RPC
 * and derives only honest metrics (see PlanDashboard).
 */
export default async function AppPlansDashboardPage() {
  const operator = await requireResolvedAppWorkspace(appWorkspaceDependencies);

  const supabase = await appWorkspaceDependencies.getServerClient();
  if (!supabase) {
    return (
      <div className="p-8">
        <ErrorState message="The workspace is temporarily unavailable. Please try again shortly." />
      </div>
    );
  }

  const tenant = await resolveRuntimeTenant({
    listOrgIds: () => appWorkspaceDependencies.listOrgIds(operator.id),
  });

  if (tenant.status === "needs_onboarding") redirect("/onboarding");
  if (tenant.status === "needs_org_selection") redirect("/org-selection");
  if (tenant.status === "lookup_failed") redirect("/login");

  const result = await listPlansForOrg(supabase, tenant.orgId, { limit: 100 });

  if (!result.ok) {
    const message =
      result.reason === "forbidden"
        ? "You don't have access to plans for this organization."
        : "Couldn't load plans. Please try again shortly.";
    return (
      <div className="p-8">
        <ErrorState message={message} />
      </div>
    );
  }

  return (
    <div className="p-8">
      <PlanDashboard result={result} todayIso={todayUtcIso()} />
    </div>
  );
}