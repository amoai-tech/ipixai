import { notFound, redirect } from "next/navigation";

import { ReportPlannerContext } from "@/components/operator-panel/planner-context";
import { ShootDetailWorkspace } from "@/components/shoot/shoot-detail-workspace";
import { ErrorState } from "@/components/ui/error-state";
import {
  appWorkspaceDependencies,
  requireResolvedAppWorkspace,
} from "@/lib/auth/app-shell";
import { resolveRuntimeTenant } from "@/lib/auth/runtime-org";
import { loadTrustedBrandIds } from "@/lib/dashboard/command-center";
import { isDatabaseUuid } from "@/lib/database-uuid";
import { loadShootDetailForOrg } from "@/lib/shoot/get-shoot-detail";
import type { PlannerContext } from "@/lib/planner/planner-context";

/**
 * IPI-1067 · SHOOT-001 — `/app/shoots/[shootId]` detail page.
 *
 * Public-contract-first: the trusted org's brand ids preauthorize the
 * shoot via `shoot_portfolio_view` (the FINAL authorization); only then is
 * `public.get_shoot_detail` used as a hydrated read-only payload loader.
 * A foreign-org shoot, a deleted shoot, and a malformed id all render the
 * same 404 — existence is never leaked.
 */
export default async function AppShootDetailPage({
  params,
}: {
  params: Promise<{ shootId: string }>;
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
  if (tenant.status === "membership_conflict" || tenant.status === "lookup_failed") redirect("/login");

  const { shootId } = await params;
  if (!isDatabaseUuid(shootId)) notFound();

  const trustedBrandIdsResult = await loadTrustedBrandIds(supabase, tenant.orgId);
  if (!trustedBrandIdsResult.ok) {
    return (
      <div className="p-8">
        <ErrorState message="The workspace is temporarily unavailable. Please try again shortly." />
      </div>
    );
  }

  const detailLoad = await loadShootDetailForOrg(
    supabase,
    shootId,
    trustedBrandIdsResult.brandIds,
  );

  if (detailLoad.status === "not_found") notFound();
  if (detailLoad.status !== "found") {
    return (
      <div className="p-8">
        <ErrorState message="Couldn't load this shoot. Please try again shortly." />
      </div>
    );
  }

  // IPI-1087 · PLANNER-CONTEXT-001 — `loadShootDetailForOrg` above is
  // already the sole authorization boundary (shoot_portfolio_view preauth
  // against the trusted org's brand ids; a foreign/missing shoot already
  // 404'd and this line was never reached), so this reuses that
  // already-authorized payload rather than re-deriving ownership a second
  // time. `get_shoot_detail`'s own `brand` object is used verbatim, not the
  // `shoot_intake_drafts`-sourced `approvals` field (that is intake-draft
  // state, never IPI-1084's exact-revision ShootPlan approval truth).
  //
  // brief/targetChannels/budget/deliverables are the acceptance-required
  // "brief" fields (IPI-1087: "reduce the budget and keep the same
  // deliverables" without repeating either) — reused verbatim from the same
  // already-authorized `get_shoot_detail` payload, zero new queries.
  const plannerContext: PlannerContext = {
    scopeKey: `shoot:${detailLoad.data.shoot.id}`,
    brand: { id: detailLoad.data.brand.id, name: detailLoad.data.brand.name },
    shoot: {
      id: detailLoad.data.shoot.id,
      name: detailLoad.data.shoot.name,
      status: detailLoad.data.shoot.status,
      brandId: detailLoad.data.shoot.brand_id,
      brief: detailLoad.data.shoot.brief,
      targetChannels: detailLoad.data.shoot.target_channels,
      estimatedBudget: detailLoad.data.shoot.estimated_budget,
      actualCost: detailLoad.data.shoot.actual_cost,
      currency: detailLoad.data.shoot.currency,
      deliverables: detailLoad.data.deliverables.map((deliverable) => ({
        channel: deliverable.channel,
        format: deliverable.format,
        quantity: deliverable.quantity,
        status: deliverable.status,
      })),
    },
  };

  return (
    <div className="p-8">
      <ReportPlannerContext context={plannerContext} />
      <ShootDetailWorkspace detail={detailLoad.data} />
    </div>
  );
}