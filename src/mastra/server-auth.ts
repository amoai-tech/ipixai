import { createClient } from "@supabase/supabase-js";
import { defineAuth } from "@mastra/core/server";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import {
  listMembershipOrgIdsFromServerClient,
  resolveRuntimeTenant,
} from "@/lib/auth/runtime-org";
import { memoryResourceId } from "@/lib/auth/verified-operator";

type PlannerMastraUser = {
  id: string;
  resourceId: string;
};

export async function resolveMastraIdentity(
  accessToken: string,
): Promise<PlannerMastraUser | null> {
  const config = getPublicSupabaseConfig();
  if (!config?.url || !config.publishableKey) return null;

  const supabase = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  const userId = data?.user?.id;
  if (error || !userId) return null;

  const tenant = await resolveRuntimeTenant({
    listOrgIds: () => listMembershipOrgIdsFromServerClient(supabase, userId),
  });
  if (tenant.status !== "ok") return null;

  return {
    id: userId,
    resourceId: memoryResourceId({ userId, orgId: tenant.orgId }),
  };
}

export const plannerMastraAuth = defineAuth<PlannerMastraUser>({
  protected: ["/ipix/*"],
  authenticateToken: async (accessToken) => {
    const user = await resolveMastraIdentity(accessToken);
    if (!user) throw new Error("Invalid or unauthorized Supabase token");
    return user;
  },
  mapUserToResourceId: (user) => user.resourceId,
});
