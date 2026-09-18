import { redirect } from "next/navigation";

import { getVerifiedOperatorFromCookies } from "@/lib/auth/operator-auth";
import {
  listMembershipOrgIdsFromServerClient,
  resolveRuntimeTenant,
} from "@/lib/auth/runtime-org";
import { plannerSurfaceFor } from "@/lib/auth/verified-operator";
import { createClient } from "@/lib/supabase/server";

import { PlannerApp } from "../planner-app";

export default async function Page() {
  const operator = await getVerifiedOperatorFromCookies();
  if (!operator || plannerSurfaceFor(operator) === "login") {
    redirect("/login");
  }
  // Planner route authorization is independent of the post-login destination
  // policy (IPI-1058 · MARKETING-LOGIN-001): /app is the default workspace,
  // but /planner stays a valid intentional deep link for a single-org member.
  // Zero-org → onboarding, multi-org → org selection, lookup failure → login.
  const supabase = await createClient();
  if (supabase) {
    const tenant = await resolveRuntimeTenant({
      listOrgIds: () =>
        listMembershipOrgIdsFromServerClient(supabase, operator.id),
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
  }
  return <PlannerApp />;
}