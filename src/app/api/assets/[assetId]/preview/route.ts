import { getVerifiedOperatorForRequest } from "@/lib/auth/copilot-hooks";
import {
  forbiddenResponse,
  membershipLookupFailedResponse,
  unauthorizedResponse,
} from "@/lib/auth/unauthorized";
import { getAuthorizedAssetPreview } from "@/lib/cloudinary/get-authorized-asset-preview";
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
 * IPI-1112 · CLD-DELIVERY-001 — org-safe signed preview URL.
 * IPI-1120 · MEDIA-DELIVERY-001 — `?intent=delivery` additionally requires a
 * durable `asset_events(kind='approved')` row for the exact provider version.
 *
 * Query: ?preview=masonry|review|detail[&intent=preview|delivery][&version=N]
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
): Promise<Response> {
  const operator = await getVerifiedOperatorForRequest(request);
  if (!operator) return unauthorizedResponse();

  const supabase = createClientFromRequest(request);
  if (!supabase) return unauthorizedResponse();

  const { assetId } = await context.params;
  const searchParams = new URL(request.url).searchParams;
  const preview = searchParams.get("preview");
  const intent = searchParams.get("intent");
  const version = searchParams.get("version");

  const result = await getAuthorizedAssetPreview({
    assetId,
    preview,
    intent,
    version,
    operator,
    supabase: supabase as never,
  });

  if (!result.ok) {
    switch (result.reason) {
      case "unsupported_preview":
      case "unsupported_intent":
      case "invalid_requested_version":
      case "invalid_asset_id":
        return jsonError(400, "bad_request", result.reason);
      case "membership_lookup_failed":
      case "lookup_failed":
        return membershipLookupFailedResponse();
      case "needs_onboarding":
      case "needs_org_selection":
        return forbiddenResponse(result.reason);
      case "foreign_org":
      case "version_not_approved":
        return jsonError(403, "forbidden", result.reason);
      case "asset_not_found":
      case "missing_cloudinary_mirror":
        return jsonError(404, "not_found", result.reason);
      case "invalid_delivery_type":
      case "invalid_cloudinary_version":
      case "missing_cloudinary_asset_id":
      case "unsupported_resource_type":
        // Data-integrity / MVP mismatch — not a client validation error.
        return jsonError(409, "conflict", result.reason);
      default: {
        const _exhaustive: never = result.reason;
        return jsonError(500, "internal", String(_exhaustive));
      }
    }
  }

  return Response.json({
    url: result.url,
    assetId: result.assetId,
    preview: result.preview,
    intent: result.intent,
    approved: result.approved,
    namedTransform: result.namedTransform,
    version: result.version,
    currentVersion: result.currentVersion,
    publicId: result.publicId,
  });
}
