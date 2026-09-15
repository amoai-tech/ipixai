import { z } from "zod";

import { resolveAssetOrgAccess } from "@/lib/auth/asset-access";
import { getVerifiedOperatorForRequest } from "@/lib/auth/copilot-hooks";
import { unauthorizedResponse } from "@/lib/auth/unauthorized";
import { jsonError } from "@/lib/http/json-response";
import { createClientFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

const decisionBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  expectedCloudinaryAssetId: z.string().min(1),
  expectedVersion: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
  reason: z.string().max(2000).optional(),
  requestId: z.string().min(1).max(200),
});

const STATUS_BY_CODE: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  // All 409: the request conflicts with the server's current state. NO_MIRROR,
  // STALE_VERSION, DECISION_FINALIZED and REQUEST_CONFLICT are state conflicts
  // (not malformed requests), so 409 is the correct class for each.
  NO_MIRROR: 409,
  STALE_VERSION: 409,
  DECISION_FINALIZED: 409,
  REQUEST_CONFLICT: 409,
  INVALID_DECISION: 400,
  INVALID_REQUEST: 400,
};

/**
 * IPI-1119 · MEDIA-APPROVAL-001 — Approve/Reject the exact Cloudinary asset version.
 * POST /api/assets/[assetId]/decision
 * Body: { decision, expectedCloudinaryAssetId, expectedVersion, reason?, requestId }
 *
 * The browser's provider id/version are optimistic assertions only. The
 * decide_asset_version RPC re-resolves tenant authority and the exact current
 * version server-side, and performs no Cloudinary ACL/type mutation.
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError(400, "invalid_request", "invalid_json");
  }

  const parsed = decisionBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(400, "invalid_request", "invalid_body");
  }
  const { decision, expectedCloudinaryAssetId, expectedVersion, reason, requestId } =
    parsed.data;

  const expectedVersionNumber = Number(expectedVersion);
  if (!Number.isSafeInteger(expectedVersionNumber) || expectedVersionNumber < 0) {
    return jsonError(400, "invalid_request", "invalid_version");
  }

  const access = await resolveAssetOrgAccess(supabase, assetId, operator.id);
  if (!access.ok) return access.response;

  const { data, error } = await supabase.rpc("decide_asset_version", {
    p_asset_id: assetId,
    p_expected_cloudinary_asset_id: expectedCloudinaryAssetId,
    p_expected_version: expectedVersionNumber,
    p_decision: decision,
    p_reason: reason ?? "",
    p_request_id: requestId,
  });

  if (error) {
    console.error("asset.decision: rpc failed", { assetId, error });
    return jsonError(500, "error", "decision_failed");
  }

  const result = data as { ok: boolean; code: string } | null;
  if (!result) {
    console.error("asset.decision: rpc returned empty payload", { assetId });
    return jsonError(500, "error", "decision_failed");
  }

  if (result.ok) {
    return Response.json(result);
  }

  const status = STATUS_BY_CODE[result.code] ?? 400;
  return jsonError(status, "error", result.code.toLowerCase());
}
