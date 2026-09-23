import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { isAuthFailure, resolveAuth } from "./auth.ts";
import { createServiceClient, createUserClient } from "./supabase-client.ts";

export type CallerResult = { client: SupabaseClient; userId: string | null } | { response: Response };

export function isCallerFailure(result: CallerResult): result is { response: Response } {
  return "response" in result;
}

function logSecretKeyConfigError(reason: string): void {
  // Never include the raw environment value: it contains privileged API keys.
  console.error(`[resolveCaller] Invalid SUPABASE_SECRET_KEYS: ${reason}`);
}

function configuredServiceApiKeys(): string[] {
  const keys = new Set<string>();
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) keys.add(legacy);

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        logSecretKeyConfigError("expected a JSON object of named secret keys");
        return [...keys];
      }

      const modernDefault = (parsed as Record<string, unknown>).default;
      if (typeof modernDefault === "string" && modernDefault.trim()) {
        keys.add(modernDefault.trim());
      } else {
        logSecretKeyConfigError("default key is unavailable");
      }
    } catch {
      logSecretKeyConfigError("value is not valid JSON");
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
  const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (token && legacyServiceRoleKey && token === legacyServiceRoleKey) {
    return { client: createServiceClient(), userId: null };
  }

  const auth = await resolveAuth(req, { required: true });
  if (isAuthFailure(auth)) return auth;
  return { client: createUserClient(auth.accessToken), userId: auth.user.id };
}
