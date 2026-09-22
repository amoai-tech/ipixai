import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { isAuthFailure, resolveAuth } from "./auth.ts";
import { getEdgeEnv } from "./env.ts";
import { createServiceClient, createUserClient } from "./supabase-client.ts";

export type CallerResult = { client: SupabaseClient; userId: string | null } | { response: Response };

export function isCallerFailure(result: CallerResult): result is { response: Response } {
  return "response" in result;
}

function configuredServiceApiKeys(): string[] {
  const keys = new Set<string>();
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) keys.add(legacy);

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const value of Object.values(parsed)) {
        if (typeof value === "string" && value.trim()) keys.add(value.trim());
      }
    } catch {
      // Invalid injected config is not authentication; fall through to user auth.
    }
  }

  return [...keys];
}

/**
 * Trusted internal callers authenticate with a backend Supabase API key. Modern
 * sb_secret_* keys arrive on `apikey`; legacy service_role Bearer support remains
 * temporarily for callers that have not migrated yet. User JWTs still flow through
 * resolveAuth and are subject to the handler's normal authorization rules.
 */
export async function resolveCaller(req: Request): Promise<CallerResult> {
  const apiKey = req.headers.get("apikey")?.trim() ?? "";
  if (apiKey && configuredServiceApiKeys().includes(apiKey)) {
    return { client: createServiceClient(), userId: null };
  }

  const header = req.headers.get("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token && token === getEdgeEnv().serviceRoleKey) {
    return { client: createServiceClient(), userId: null };
  }

  const auth = await resolveAuth(req, { required: true });
  if (isAuthFailure(auth)) return auth;
  return { client: createUserClient(auth.accessToken), userId: auth.user.id };
}
