import { notFound, redirect } from "next/navigation";

import { PlanWorkspace } from "@/components/plans/plan-workspace";
import { ErrorState } from "@/components/ui/error-state";
import {
  appWorkspaceDependencies,
  requireResolvedAppWorkspace,
} from "@/lib/auth/app-shell";
import { resolveRuntimeTenant } from "@/lib/auth/runtime-org";
import { isDatabaseUuid } from "@/lib/database-uuid";
import { loadPlanDetailForOrg } from "@/lib/plans/get-plan-detail";

/**
 * IPI-1074 · PLANS-001 — `/app/plans/[instanceId]` workspace.
 *
 * Authorization is the RPC's own gate: `planner_get_instance_detail` raises
 * P0002 for a foreign/non-visible instance, so a foreign-org plan, a deleted
 * plan, and a malformed id all render the same 404 — existence is never
 * leaked.
 */
export default async function AppPlanDetailPage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
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

  const { instanceId } = await params;
  if (!isDatabaseUuid(instanceId)) notFound();

  const result = await loadPlanDetailForOrg(supabase, instanceId);

  if (!result.ok) {
    if (result.reason === "not_found") notFound();
    return (
      <div className="p-8">
        <ErrorState message="Couldn't load this plan. Please try again shortly." />
      </div>
    );
  }

  return (
    <div className="p-8">
      <PlanWorkspace detail={result.detail} />
    </div>
  );
}