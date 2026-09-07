import { redirect } from "next/navigation";

import { CommandCenter } from "@/components/dashboard/command-center";
import { ReportWorkspaceStats } from "@/components/operator-panel/workspace-stats";
import { ErrorState } from "@/components/ui/error-state";
import {
  appWorkspaceDependencies,
  requireResolvedAppWorkspace,
} from "@/lib/auth/app-shell";
import {
  resolveRuntimeTenant,
} from "@/lib/auth/runtime-org";
import {
  countOrgShoots,
  loadLatestShootForBrand,
  loadOrgBrands,
  loadOrgShoots,
  loadTrustedBrandIds,
} from "@/lib/dashboard/command-center";
import { loadRecentWorkPreviews } from "@/lib/dashboard/recent-work-media";
import { loadChannelSpecs } from "@/lib/shoot/channel-specs";
import type { ChannelSpec } from "@/lib/shoot/channel-specs";

/**
 * DASH-MAIN-001 — the authenticated `/app` Command Center.
 *
 * Trusted org is resolved server-side from AUTH-002 membership rows only
 * (never a client-supplied org id). Brands and Shoots are independent live
 * reads — see command-center.ts for why Shoots goes through
 * shoot_portfolio_view (not raw shoot.shoots). Planner/approvals stay
 * deferred per the accepted scope (honest empty, not a live read).
 *
 * A failed brand or shoot read degrades only its own section, not the
 * whole page — the hero and quick links are static and don't depend on
 * either query, and the two reads don't depend on each other's success.
 *
 * /app is the default post-login destination (IPI-1058 · MARKETING-LOGIN-001),
 * so it enforces the same tenant boundaries as the dedicated routes: a
 * zero-org user goes to /onboarding, a multi-org user to /org-selection, and
 * a membership lookup failure fails closed to /login.
 */
export default async function AppHomePage() {
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

  if (tenant.status === "needs_onboarding") {
    redirect("/onboarding");
  }

  if (tenant.status === "needs_org_selection") {
    redirect("/org-selection");
  }

  if (tenant.status === "lookup_failed") {
    redirect("/login");
  }

  // Independent reads: brands and the trusted brand-id scope for shoots
  // don't depend on each other, so run them together rather than in series.
  const [brandsResult, trustedBrandIdsResult] = await Promise.all([
    loadOrgBrands(supabase, tenant.orgId),
    loadTrustedBrandIds(supabase, tenant.orgId),
  ]);
  // Real, hero-brand-scoped "recent production" — deliberately NOT
  // resolveHeroContext's old array-scan over the (org-wide, capped)
  // shoots list below: that could miss the hero brand's own latest shoot
  // whenever other brands' shoots crowd it out of the global top
  // SHOOT_LIMIT. See loadLatestShootForBrand's own doc comment.
  const heroBrand = brandsResult.ok ? brandsResult.brands[0] : undefined;

  const [shootsResult, shootCountResult, latestBrandShootResult] = await Promise.all([
    trustedBrandIdsResult.ok
      ? loadOrgShoots(supabase, trustedBrandIdsResult.brandIds)
      : Promise.resolve({ ok: false } as const),
    trustedBrandIdsResult.ok
      ? countOrgShoots(supabase, trustedBrandIdsResult.brandIds)
      : Promise.resolve({ ok: false } as const),
    heroBrand
      ? loadLatestShootForBrand(supabase, heroBrand.id)
      : Promise.resolve({ ok: true, shoot: null } as const),
  ]);

  // Both depend on shootsResult, so neither can join the Promise.all above —
  // but they're independent of each other (one signs preview images, the
  // other resolves channel -> real aspect-ratio spec), so they run together
  // here instead of in series.
  const [recentWorkPreviews, channelSpecs] = shootsResult.ok
    ? await Promise.all([
        loadRecentWorkPreviews(
          supabase,
          operator,
          shootsResult.shoots.map((shoot) => shoot.id),
        ),
        loadChannelSpecs([
          ...new Set(
            shootsResult.shoots
              .map((shoot) => shoot.channel)
              .filter((channel): channel is string => channel !== null),
          ),
        ]),
      ])
    : ([new Map<string, string>(), new Map<string, ChannelSpec>()] as const);

  const recentShoot = latestBrandShootResult.ok ? (latestBrandShootResult.shoot ?? undefined) : undefined;

  return (
    <div className="p-8">
      {/* Intelligence rail's derived workspace state — real, uncapped
          counts (trustedBrandIdsResult already has every trusted brand id,
          not just the display-capped BRAND_LIMIT list; shootCountResult is
          a dedicated count query for the same reason). Gated on all four
          reads, not just the two the counts come from: if brandsResult or
          shootsResult failed, CommandCenter renders an ErrorState for that
          section below — the rail showing a confident total right next to
          it would be misleading, not just technically "not fabricated". */}
      {brandsResult.ok && shootsResult.ok && trustedBrandIdsResult.ok && shootCountResult.ok && (
        <ReportWorkspaceStats
          brandCount={trustedBrandIdsResult.brandIds.length}
          shootCount={shootCountResult.count}
          brandName={heroBrand?.name}
          recentShootName={recentShoot?.name}
          recentShootStatus={recentShoot?.status ?? undefined}
        />
      )}
      <CommandCenter
        brandsResult={brandsResult}
        shootsResult={shootsResult}
        recentWorkPreviews={recentWorkPreviews}
        channelSpecs={channelSpecs}
      />
    </div>
  );
}
