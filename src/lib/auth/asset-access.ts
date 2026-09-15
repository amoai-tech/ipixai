import type { SupabaseClient } from "@supabase/supabase-js";

import { membershipLookupFailedResponse } from "@/lib/auth/unauthorized";

export type AssetOrgAccess =
  | { ok: true; orgId: string }
  | { ok: false; response: Response };

function jsonError(status: number, error: string, reason: string): Response {
  return new Response(JSON.stringify({ error, reason }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Resolve an asset's owning organization and verify the caller is a member.
 *
 * Browser-supplied asset ids are locators only: the organization is derived
 * server-side via asset -> brand, never from a client value. This is a
 * cheap membership pre-check; the owning domain layer (e.g. the
 * decide_asset_version RPC) still performs its own authoritative role check.
 */
export async function resolveAssetOrgAccess(
  supabase: SupabaseClient,
  assetId: string,
  userId: string,
): Promise<AssetOrgAccess> {
  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, brands(org_id)")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError) return { ok: false, response: membershipLookupFailedResponse() };
  if (!asset) return { ok: false, response: jsonError(404, "not_found", "asset_not_found") };

  const brand = Array.isArray(asset.brands) ? asset.brands[0] : asset.brands;
  if (!brand?.org_id) {
    return { ok: false, response: jsonError(409, "conflict", "asset_missing_brand") };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", brand.org_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) return { ok: false, response: membershipLookupFailedResponse() };
  if (!membership) return { ok: false, response: jsonError(403, "forbidden", "foreign_org") };

  return { ok: true, orgId: brand.org_id };
}
