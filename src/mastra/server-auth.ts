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
  const hosted = isMastraHostedRuntime(env);
  const url =
    env.SUPABASE_URL?.trim() || (hosted ? "" : env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "");
  const publishableKey =
    env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    (hosted ? "" : env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "");

  if (!url) {
    throw new Error(
      hosted
        ? "SUPABASE_URL is required when IPIX_MASTRA_HOSTED=1"
        : "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL for local dev) is required",
    );
  }
  if (!publishableKey) {
    throw new Error(
      hosted
        ? "SUPABASE_PUBLISHABLE_KEY is required when IPIX_MASTRA_HOSTED=1"
        : "SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for local dev) is required",
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
): Promise<PlannerMastraUser | null> {
  let config: MastraSupabaseAuthConfig;
  try {
    config = resolveMastraSupabaseAuthConfig();
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
 * IPI-1326 — Mastra's built-in `/api/workflows/*` routes start, resume and list
 * runs from caller-controlled input. The privileged iPix workflows are only
 * driven in-process (Planner tools, Next routes) after server-side
 * authorization, so the raw HTTP workflow surface is denied to every caller.
 */
export function isDeniedMastraRoute(path: string): boolean {
  return path === "/api/workflows" || path.startsWith("/api/workflows/");
}

export const plannerMastraAuth = defineAuth<PlannerMastraUser>({
  protected: ["/ipix/*"],
  authenticateToken: async (accessToken) => {
    const user = await resolveMastraIdentity(accessToken);
    if (!user) throw new Error("Invalid or unauthorized Supabase token");
    return user;
  },
  authorize: async (path) => !isDeniedMastraRoute(path),
  mapUserToResourceId: (user) => user.resourceId,
});
