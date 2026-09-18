import { redirect } from "next/navigation";
import { cache } from "react";

import { getVerifiedOperatorFromCookies } from "./operator-auth";
import { postAuthDestinationFor } from "./post-auth-destination";
import { listMembershipOrgIdsFromServerClient } from "./runtime-org";
import { plannerSurfaceFor } from "./verified-operator";
import { createClient } from "@/lib/supabase/server";

type MembershipOrgIds = Awaited<ReturnType<typeof listMembershipOrgIdsFromServerClient>>;
type AppServerClient = Awaited<ReturnType<typeof createClient>>;

export type AppWorkspaceDependencies = {
  getServerClient: () => Promise<AppServerClient>;
  listOrgIds: (userId: string) => Promise<MembershipOrgIds>;
};

export const getAppServerClient = cache(createClient);

export const listAppMembershipOrgIds = cache(async (userId: string) => {
  const supabase = await getAppServerClient();
  if (!supabase) return { ok: false } as const;
  return listMembershipOrgIdsFromServerClient(supabase, userId);
});

export const appWorkspaceDependencies: AppWorkspaceDependencies = {
  getServerClient: getAppServerClient,
  listOrgIds: listAppMembershipOrgIds,
};

/**
 * APP-001 workspace chrome gate.
 *
 * Layout may redirect signed-out users, but that is shell access only.
 * Brand / Shoot / Asset data paths must still authorize at their server/DAL.
 * Next.js layouts persist across navigation and must not be the sole auth boundary:
 * https://nextjs.org/docs/app/guides/authentication
 */
export async function requireAppWorkspace() {
  const operator = await getVerifiedOperatorFromCookies();
  if (!operator || plannerSurfaceFor(operator) === "login") {
    redirect("/login");
  }
  return operator;
}

/** Resolve the server-owned organization boundary before mounting `/app`. */
export async function requireResolvedAppWorkspace(
  dependencies: AppWorkspaceDependencies = appWorkspaceDependencies,
) {
  const operator = await requireAppWorkspace();
  const supabase = await dependencies.getServerClient();
  if (!supabase) redirect("/login");

  const destination = await postAuthDestinationFor({
    operator,
    listOrgIds: () => dependencies.listOrgIds(operator.id),
  });
  if (destination !== "/app") redirect(destination);
  return operator;
}
