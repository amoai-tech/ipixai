import { getVerifiedOperatorForRequest } from "@/lib/auth/copilot-hooks";
import {
  forbiddenResponse,
  membershipLookupFailedResponse,
  unauthorizedResponse,
} from "@/lib/auth/unauthorized";
import { runAssetQA } from "@/lib/asset-qa/service";
import { createClientFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(
  status: number,
  error: string,
  reason: string,
): Response {
  return new Response(JSON.stringify({ error, reason }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * IPI-1138 · ASSET-QA-001 — Asset Quality & Channel Readiness Check
 * POST /api/assets/[assetId]/qa
 * Body: {} (empty - shootId and channels are derived from asset/shoot)
 * Returns structured QA findings for the exact asset version.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
): Promise<Response> {
  const operator = await getVerifiedOperatorForRequest(request);
  if (!operator) return unauthorizedResponse();

  const supabase = createClientFromRequest(request);
  if (!supabase) return unauthorizedResponse();

  const { assetId } = await context.params;

  // Verify operator has access to this asset's org
  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, brands(org_id)")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError) {
    return membershipLookupFailedResponse();
  }

  if (!asset) {
    return jsonError(404, "not_found", "asset_not_found");
  }

  const brand = Array.isArray(asset.brands) ? asset.brands[0] : asset.brands;
  if (!brand?.org_id) {
    return jsonError(409, "conflict", "asset_missing_brand");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", brand.org_id)
    .eq("user_id", operator.id)
    .maybeSingle();

  if (membershipError) {
    return membershipLookupFailedResponse();
  }

  if (!membership) {
    return jsonError(403, "forbidden", "foreign_org");
  }

  const result = await runAssetQA({
    assetId,
    orgId: brand.org_id,
  });

  if (!result.ok) {
    return jsonError(result.status, "error", result.reason);
  }

  return Response.json(result.result);
}