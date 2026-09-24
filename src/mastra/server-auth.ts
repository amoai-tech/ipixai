import { createClient } from "@supabase/supabase-js";
import { defineAuth } from "@mastra/core/server";

import {
  listMembershipOrgIdsFromServerClient,
  resolveRuntimeTenant,
} from "@/lib/auth/runtime-org";
import { memoryResourceId } from "@/lib/auth/verified-operator";

import { isMastraHostedRuntime } from "./pg-store";

export type PlannerMastraUser = {
  id: string;
  orgId: string;
  resourceId: string;
};

export type MastraSupabaseAuthConfig = {
  url: string;
  publishableKey: string;
};

/**
 * True for credentials that bypass RLS: `sb_secret_*` keys and legacy JWT keys
 * whose `role` claim is `service_role`. Such a key must never verify end users.
 */
function isPrivilegedSupabaseKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return claims?.role === "service_role";
  } catch {
    return false;
  }
}

/**
 * IPI-1308 · MASTRA-AUTH-ENV-001 — the standalone Mastra server owns its
 * Supabase Auth config: `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`.
 *
 * Hosted (`IPIX_MASTRA_HOSTED=1`) accepts only those server names over HTTPS.
 * Local `mastra dev` may fall back to the `NEXT_PUBLIC_*` pair so the two-process
 * dev loop keeps working. Errors name the variable, never its value.
 */
export function resolveMastraSupabaseAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): MastraSupabaseAuthConfig {
  return resolveSupabaseAuthConfig(env, !isMastraHostedRuntime(env));
}

/**
 * Same validation, but always accepts the `NEXT_PUBLIC_*` pair as a fallback.
 * For in-process callers (Next routes/server actions, workflow steps) that
 * already hold a verified user session: Next.js owns that pair, and the
 * standalone server's stricter contract is enforced at its own startup.
 */
export function resolveSupabaseUserAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): MastraSupabaseAuthConfig {
  return resolveSupabaseAuthConfig(env, true);
}

function resolveSupabaseAuthConfig(
  env: NodeJS.ProcessEnv,
  allowPublicFallback: boolean,
): MastraSupabaseAuthConfig {
  const hosted = isMastraHostedRuntime(env);
  const url =
    env.SUPABASE_URL?.trim() ||
    (allowPublicFallback ? env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "" : "");
  const publishableKey =
    env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    (allowPublicFallback ? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "" : "");

  if (!url) {
    throw new Error(
      allowPublicFallback
        ? "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL for local dev) is required"
        : "SUPABASE_URL is required when IPIX_MASTRA_HOSTED=1",
    );
  }
  if (!publishableKey) {
    throw new Error(
      allowPublicFallback
        ? "SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for local dev) is required"
        : "SUPABASE_PUBLISHABLE_KEY is required when IPIX_MASTRA_HOSTED=1",
    );
  }

  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new Error("SUPABASE_URL is not a valid URL");
  }
  if (protocol !== "https:" && (hosted || protocol !== "http:")) {
    throw new Error(
      hosted ? "SUPABASE_URL must use https when IPIX_MASTRA_HOSTED=1" : "SUPABASE_URL must use http(s)",
    );
  }
  if (isPrivilegedSupabaseKey(publishableKey)) {
    throw new Error(
      "SUPABASE_PUBLISHABLE_KEY must be a publishable key, not a secret or service-role key",
    );
  }

  return { url, publishableKey };
}

export async function resolveMastraIdentity(
  accessToken: string,
  resolveConfig: () => MastraSupabaseAuthConfig = resolveMastraSupabaseAuthConfig,
): Promise<PlannerMastraUser | null> {
  let config: MastraSupabaseAuthConfig;
  try {
    config = resolveConfig();
  } catch {
    return null;
  }

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
    orgId: tenant.orgId,
    resourceId: memoryResourceId({ userId, orgId: tenant.orgId }),
  };
}

/**
 * IPI-1326 — deny-by-default HTTP surface. An authenticated tenant may call
 * only the exact METHOD + path the Planner's remote client uses:
 * `@ag-ui/mastra` `getRemoteAgents()` (list agents), the Planner stream, and
 * iPix run control (Stop). Every other built-in Mastra route (workflows,
 * datasets, stored agents/workflows, schedules, tools, MCP, memory, …) is 403.
 * Matching is exact: Hono supplies `c.req.path` (no query) and the uppercase
 * method, so encoded, trailing-slash or lowercase variants fail closed.
 * tests/mastra-route-allowlist-contract.test.ts fails if an upgraded client
 * starts calling a route that is not listed here.
 */
const ALLOWED_MASTRA_ROUTES: ReadonlySet<string> = new Set([
  "GET /api/agents",
  "POST /api/agents/production-planner/stream",
  "POST /ipix/run-control/active",
  "POST /ipix/run-control/abort",
]);

export function isAllowedMastraRoute(method: string, path: string): boolean {
  return ALLOWED_MASTRA_ROUTES.has(`${method} ${path}`);
}

export const plannerMastraAuth = defineAuth<PlannerMastraUser>({
  protected: ["/ipix/*"],
  authenticateToken: async (accessToken) => {
    const user = await resolveMastraIdentity(accessToken);
    if (!user) throw new Error("Invalid or unauthorized Supabase token");
    return user;
  },
  authorize: async (path, method) => isAllowedMastraRoute(method, path),
  mapUserToResourceId: (user) => user.resourceId,
});
