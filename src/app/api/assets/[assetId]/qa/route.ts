import { resolveAssetOrgAccess } from "@/lib/auth/asset-access";
import { getVerifiedOperatorForRequest } from "@/lib/auth/operator-auth";
import { unauthorizedResponse } from "@/lib/auth/unauthorized";
import { runAssetQA } from "@/lib/asset-qa/service";
import { jsonError } from "@/lib/http/json-response";
import { createClientFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

  const access = await resolveAssetOrgAccess(supabase, assetId, operator.id);
  if (!access.ok) return access.response;

  const result = await runAssetQA({
    assetId,
    orgId: access.orgId,
    authClient: supabase,
  });

  if (!result.ok) {
    return jsonError(result.status, "error", result.reason);
  }

  return Response.json(result.result);
}