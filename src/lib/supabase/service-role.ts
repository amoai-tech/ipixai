import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";

function logSecretKeysConfigError(reason: string): void {
  // Never include the raw value: it is a privileged API key.
  console.error(`[service-role] Invalid SUPABASE_SECRET_KEYS: ${reason}; ignoring it`);
}

function readSecretKeysMap(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  // A bare key pasted into the JSON-map variable is still the key.
  if (value.startsWith("sb_secret_")) return value;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    logSecretKeysConfigError("value is not valid JSON");
    return undefined;
  }
  const key =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).default
      : undefined;
  if (typeof key !== "string" || !key.trim()) {
    logSecretKeysConfigError("no default key");
    return undefined;
  }
  return key.trim();
}

/**
 * IPI-1348: the server-only Supabase backend key for Vercel/Next.js code.
 * Prefers the modern `SUPABASE_SECRET_KEY` (kept in sync by the Supabase ↔
 * Vercel integration), then the hand-set `SUPABASE_SECRET_KEYS` map, then
 * the legacy `SUPABASE_SERVICE_ROLE_KEY`. Send it to Edge Functions on the
 * `apikey` header, never as `Authorization: Bearer`.
 */
export function getBackendSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    readSecretKeysMap(process.env.SUPABASE_SECRET_KEYS) ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    undefined
  );
}

/**
 * Service-role Supabase client for verified server paths (Cloudinary webhook).
 * Never import from Client Components.
 */
export function createServiceRoleClient() {
  const config = getPublicSupabaseConfig();
  const serviceRoleKey = getBackendSecretKey();
  if (!config || !serviceRoleKey) return null;

  return createClient<Database>(config.url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
