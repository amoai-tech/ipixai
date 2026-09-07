import { redirect } from "next/navigation";

import { PlanHub } from "@/components/plans/plan-hub";
import { ErrorState } from "@/components/ui/error-state";
import {
  appWorkspaceDependencies,
  requireResolvedAppWorkspace,
} from "@/lib/auth/app-shell";
import { resolveRuntimeTenant } from "@/lib/auth/runtime-org";
import { todayUtcIso } from "@/lib/plans/plan-display";
import { listPlansForOrg, type PlanListFilters } from "@/lib/plans/get-plans";
import {
  planEntityTypeSchema,
  planInstanceStatusSchema,
} from "@/lib/plans/plan-types";

type PlansSearchParams = {
  q?: string | string[];
  type?: string | string[];
  status?: string | string[];
  archived?: string | string[];
  after?: string | string[];
};

function firstValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
    return value[0];
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * IPI-1074 · PLANS-001 — `/app/plans` Hub.
 *
 * Tenant boundary (AUTH-002): the trusted org is resolved server-side from
 * membership rows only; the plan list is read through the org-scoped
 * `public.planner_list_instances` RPC (the only exposed planner read
 * surface). Filters come from the awaited GET searchParams; the `?after=`
 * cursor is opaque and fail-closed — an unparseable filter falls back to its
 * default rather than crashing the page.
 */
export default async function AppPlansPage({
  searchParams,
}: {
  searchParams: Promise<PlansSearchParams>;
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

  const sp = await searchParams;
  const search = firstValue(sp.q);
  const entityTypeRaw = firstValue(sp.type);
  const statusRaw = firstValue(sp.status);
  const afterRaw = firstValue(sp.after);
  const archived = firstValue(sp.archived) === "1";

  const entityType = planEntityTypeSchema.safeParse(entityTypeRaw).success
    ? (entityTypeRaw as "shoot" | "campaign" | "crm_deal")
    : null;
  const status = planInstanceStatusSchema.safeParse(statusRaw).success ? statusRaw : null;
  // The cursor is opaque and fail-closed: a non-UUID value is dropped so the
  // page falls back to page 1 instead of surfacing a DB coercion error.
  const after = afterRaw && UUID_RE.test(afterRaw) ? afterRaw : null;

  const filters: PlanListFilters = {
    search,
    entityType,
    status,
    includeArchived: archived,
    limit: 20,
    after,
  };

  const result = await listPlansForOrg(supabase, tenant.orgId, filters);

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
      <PlanHub result={result} filters={filters} todayIso={todayUtcIso()} />
    </div>
  );
}