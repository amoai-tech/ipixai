import { notFound, redirect } from "next/navigation";

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
  if (tenant.status === "needs_org_selection") redirect("/org-selection");
  if (tenant.status === "lookup_failed") redirect("/login");

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

  return (
    <div className="p-8">
      <ShootDetailWorkspace detail={detailLoad.data} />
    </div>
  );
}