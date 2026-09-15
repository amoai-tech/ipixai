import { getVerifiedOperatorForRequest } from "@/lib/auth/copilot-hooks";
import { unauthorizedResponse } from "@/lib/auth/unauthorized";
import {
  getShotReferencePreview,
  type ShotReferenceMediaClient,
} from "@/lib/shoot/get-shot-reference-preview";
import { createClientFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(status: number, error: string, reason: string): Response {
  return new Response(JSON.stringify({ error, reason }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * IPI-644 · SHOOT-DATA-002C — global trusted-reference signed preview.
 *
 * Query: ?preview=masonry|review|detail
 *
 * Auth is server-derived; the browser supplies only a reference locator. This
 * is the reference-specific boundary the tenant DAM route intentionally is not:
 * curated references are not org-owned `public.assets` rows. Every failure
 * returns a typed reason and NO URL (fail closed).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ referenceId: string }> },
): Promise<Response> {
  const operator = await getVerifiedOperatorForRequest(request);
  if (!operator) return unauthorizedResponse();

  const supabase = createClientFromRequest(request);
  if (!supabase) return unauthorizedResponse();

  const { referenceId } = await context.params;
  const preview = new URL(request.url).searchParams.get("preview");

  const result = await getShotReferencePreview({
    referenceId,
    preview,
    supabase: supabase as unknown as ShotReferenceMediaClient,
  });

  if (!result.ok) {
    switch (result.reason) {
      case "invalid_reference_id":
      case "unsupported_preview":
        return jsonError(400, "bad_request", result.reason);
      case "lookup_failed":
        return jsonError(503, "unavailable", result.reason);
      case "reference_not_found":
        return jsonError(404, "not_found", result.reason);
      case "missing_approved_media":
      case "unsupported_resource_type":
      case "invalid_delivery_type":
      case "unapproved_mapping":
      case "invalid_mapping":
        // The reference exists but its approved media contract is not usable.
        // This is a data-integrity/no-media state, not a client validation error.
        return jsonError(409, "conflict", result.reason);
      case "signing_failed":
        return jsonError(502, "provider_error", result.reason);
      default: {
        const _exhaustive: never = result.reason;
        return jsonError(500, "internal", String(_exhaustive));
      }
    }
  }

  return Response.json({
    url: result.url,
    referenceId: result.referenceId,
    preview: result.preview,
    namedTransform: result.namedTransform,
    version: result.version,
    publicId: result.publicId,
  });
}
