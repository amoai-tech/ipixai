import { redirect } from "next/navigation";

import { ShootWizardShell } from "@/components/shoot/shoot-wizard-shell";
import { ErrorState } from "@/components/ui/error-state";
import { appWorkspaceDependencies, requireResolvedAppWorkspace } from "@/lib/auth/app-shell";
import { resolveRuntimeTenant } from "@/lib/auth/runtime-org";
import { listBrandsForOrg } from "@/lib/brand/get-brands";

export default async function NewShootPage() {
  const operator = await requireResolvedAppWorkspace(appWorkspaceDependencies);
  const supabase = await appWorkspaceDependencies.getServerClient();
  if (!supabase) return <div className="p-8"><ErrorState message="The workspace is temporarily unavailable. Please try again shortly." /></div>;

  const tenant = await resolveRuntimeTenant({ listOrgIds: () => appWorkspaceDependencies.listOrgIds(operator.id) });
  if (tenant.status === "needs_onboarding") redirect("/onboarding");
  if (tenant.status === "needs_org_selection") redirect("/org-selection");
  if (tenant.status === "lookup_failed") redirect("/login");

  const brands = await listBrandsForOrg(supabase, tenant.orgId);
  if (!brands.ok) return <div className="p-8"><ErrorState message="We couldn't load your brands. Please try again shortly." /></div>;

  return <ShootWizardShell brands={brands.brands.map(({ id, name }) => ({ id, name }))} />;
}
