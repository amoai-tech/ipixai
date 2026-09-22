import { createClient } from "@supabase/supabase-js";
import {
  MASTRA_AUTH_TOKEN_KEY,
  MASTRA_RESOURCE_ID_KEY,
  type RequestContext,
} from "@mastra/core/request-context";
import type { Middleware } from "@mastra/core/server";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import {
  listMembershipOrgIdsFromServerClient,
  resolveRuntimeTenant,
} from "@/lib/auth/runtime-org";
import { memoryResourceId } from "@/lib/auth/verified-operator";

export function bearerTokenFromHeader(value: string | null | undefined) {
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

export function applyMastraIdentity(
  requestContext: RequestContext,
  identity: { accessToken: string; resourceId: string },
) {
  requestContext.set(MASTRA_AUTH_TOKEN_KEY, identity.accessToken);
  requestContext.set(MASTRA_RESOURCE_ID_KEY, identity.resourceId);
}

export async function resolveMastraIdentity(accessToken: string) {
  const config = getPublicSupabaseConfig();
  if (!config?.url || !config.publishableKey) return undefined;

  const supabase = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  const userId = data?.user?.id;
  if (error || !userId) return undefined;

  const tenant = await resolveRuntimeTenant({
    listOrgIds: () =>
      listMembershipOrgIdsFromServerClient(supabase, userId),
  });
  if (tenant.status !== "ok") return undefined;

  return {
    accessToken,
    resourceId: memoryResourceId({ userId, orgId: tenant.orgId }),
  };
}

function isProtectedPlannerPath(path: string) {
  return (
    path.startsWith("/api/agents") ||
    path.startsWith("/api/memory") ||
    path.startsWith("/ipix/run-control")
  );
}

export const plannerMastraAuthMiddleware: Middleware = async (c, next) => {
  if (!isProtectedPlannerPath(c.req.path)) return next();

  const accessToken = bearerTokenFromHeader(c.req.header("authorization"));
  if (!accessToken) return c.json({ error: "unauthorized" }, 401);

  const identity = await resolveMastraIdentity(accessToken);
  if (!identity) return c.json({ error: "forbidden" }, 403);

  applyMastraIdentity(c.get("requestContext"), identity);
  return next();
};
