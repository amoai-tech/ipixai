import { redirect } from "next/navigation";

import { BrandsListWorkspace } from "@/components/brands/brands-list-workspace";
import { ErrorState } from "@/components/ui/error-state";
import {
  appWorkspaceDependencies,
  requireResolvedAppWorkspace,
} from "@/lib/auth/app-shell";
import { resolveRuntimeTenant } from "@/lib/auth/runtime-org";
import { countOrgBrands, listBrandsForOrg } from "@/lib/brand/get-brands";

/**
 * IPI-1068 · BRAND-001 — `/app/brands` browse page.
 *
 * Same tenant boundary as `/app/shoots` (AUTH-002): the trusted org is
 * resolved server-side from membership rows only, and the brand list is
 * explicitly scoped by `.eq("org_id", trustedOrgId)` — RLS is defense in
 * depth here, not the sole authorization boundary.
 */
export default async function AppBrandsPage() {
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

  const [listResult, countResult] = await Promise.all([
    listBrandsForOrg(supabase, tenant.orgId),
    countOrgBrands(supabase, tenant.orgId),
  ]);

  return (
    <div className="p-8">
      <BrandsListWorkspace
        result={listResult}
        count={countResult.ok ? countResult.count : null}
      />
    </div>
  );
}
