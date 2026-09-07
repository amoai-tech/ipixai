import { redirect } from "next/navigation";

import { ShootsListWorkspace } from "@/components/shoot/shoots-list-workspace";
import { ErrorState } from "@/components/ui/error-state";
import {
  appWorkspaceDependencies,
  requireResolvedAppWorkspace,
} from "@/lib/auth/app-shell";
import { resolveRuntimeTenant } from "@/lib/auth/runtime-org";
import { countOrgShoots, loadTrustedBrandIds } from "@/lib/dashboard/command-center";
import {
  decodeShootListCursor,
  listShootsForOrg,
} from "@/lib/shoot/get-shoot-detail";

/**
 * IPI-1067 · SHOOT-001 — `/app/shoots` browse page.
 *
 * Tenant boundary (AUTH-002): the trusted org is resolved server-side from
 * membership rows only; the shoot list is scoped by the trusted org's
 * brand ids via `shoot_portfolio_view` (the only PostgREST-exposed shoot
 * surface). The `?after=` cursor is opaque and fail-closed — a malformed
 * cursor falls back to page 1.
 */
export default async function AppShootsPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string }>;
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

  const trustedBrandIdsResult = await loadTrustedBrandIds(supabase, tenant.orgId);
  if (!trustedBrandIdsResult.ok) {
    return (
      <div className="p-8">
        <ShootsListWorkspace result={{ ok: false }} count={null} nextCursor={null} />
      </div>
    );
  }

  const { after } = await searchParams;
  const cursor = decodeShootListCursor(after);

  const [listResult, countResult] = await Promise.all([
    listShootsForOrg(supabase, trustedBrandIdsResult.brandIds, { after: cursor }),
    countOrgShoots(supabase, trustedBrandIdsResult.brandIds),
  ]);

  return (
    <div className="p-8">
      <ShootsListWorkspace
        result={listResult}
        count={countResult.ok ? countResult.count : null}
        nextCursor={listResult.ok ? listResult.nextCursor : null}
      />
    </div>
  );
}