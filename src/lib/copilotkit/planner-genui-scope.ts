import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTrustedBrandIds } from "@/lib/dashboard/command-center";
import { preauthorizeShootForOrg } from "@/lib/shoot/get-shoot-detail";

const SCOPE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The browser supplies a scope locator, never an authorization decision.
 * Its organization component must match the server-verified tenant. */
export function plannerScopeForOrg(value: unknown, trustedOrgId: string): string | null {
  if (value === "workspace") return "workspace";
  if (typeof value !== "string") return null;
  const match = /^(brand|shoot):([^:]+):([^:]+)$/.exec(value);
  if (!match || match[2] !== trustedOrgId || !SCOPE_UUID.test(match[3]!)) return null;
  return value;
}

/** Validate the browser-provided scope locator against real, authorized
 * Supabase rows before writing or returning a persisted GenUI card. A matching
 * org id in a string is NOT proof that a Brand/Shoot belongs to that org.
 * This is an additional scoped resource check, not a replacement for the
 * request's verified operator/organization and thread-owner checks. */
export async function authorizePlannerGenUIScope(
  client: SupabaseClient,
  rawScope: unknown,
  trustedOrgId: string,
): Promise<boolean> {
  const scope = plannerScopeForOrg(rawScope, trustedOrgId);
  if (!scope) return false;
  if (scope === "workspace") return true;
  const [kind, , resourceId] = scope.split(":");
  if (!resourceId) return false;
  try {
    if (kind === "brand") {
      const { data, error } = await client
        .from("brands")
        .select("id")
        .eq("id", resourceId)
        .eq("org_id", trustedOrgId)
        .maybeSingle();
      return !error && data?.id === resourceId;
    }
    if (kind === "shoot") {
      const scopedBrands = await loadTrustedBrandIds(client, trustedOrgId);
      if (!scopedBrands.ok) return false;
      const preauth = await preauthorizeShootForOrg(client, resourceId, scopedBrands.brandIds);
      return preauth.ok;
    }
    return false;
  } catch {
    return false;
  }
}

export function plannerRunScope(
  input: unknown,
  trustedOrgId: string,
): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const context = (input as { context?: unknown }).context;
  if (!Array.isArray(context)) return null;
  let selectedScope: string | null = null;
  for (const row of context) {
    if (!row || typeof row !== "object") continue;
    let value = (row as { value?: unknown }).value;
    if (typeof value === "string") {
      try { value = JSON.parse(value); } catch { continue; }
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    if (!Object.prototype.hasOwnProperty.call(value, "scopeKey")) continue;
    // Every explicit locator must be valid and agree with earlier locators.
    // A conflicting/malformed entry fails closed regardless of its position.
    const current = plannerScopeForOrg((value as { scopeKey?: unknown }).scopeKey, trustedOrgId);
    if (!current || (selectedScope !== null && current !== selectedScope)) return null;
    selectedScope = current;
  }
  return selectedScope;
}
