import { z } from "zod";

import { getVerifiedOperatorForRequest } from "@/lib/auth/copilot-hooks";
import {
  membershipLookupFailedResponse,
  unauthorizedResponse,
} from "@/lib/auth/unauthorized";
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
  NO_MIRROR: 409,
  STALE_VERSION: 409,
  DECISION_FINALIZED: 409,
  REQUEST_CONFLICT: 409,
  INVALID_DECISION: 400,
  INVALID_REQUEST: 400,
};

function jsonError(status: number, error: string, reason: string): Response {
  return new Response(JSON.stringify({ error, reason }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type SupabaseServerClient = NonNullable<ReturnType<typeof createClientFromRequest>>;

/**
 * Defense-in-depth membership pre-check. The decide_asset_version RPC
 * independently re-resolves asset -> brand -> org and requires editor/owner
 * authority, so this only produces a clean early error.
 */
async function authorizeAssetAccess(
  supabase: SupabaseServerClient,
  assetId: string,
  userId: string,
): Promise<{ orgId: string } | { response: Response }> {
  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, brands(org_id)")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError) return { response: membershipLookupFailedResponse() };
  if (!asset) return { response: jsonError(404, "not_found", "asset_not_found") };

  const brand = Array.isArray(asset.brands) ? asset.brands[0] : asset.brands;
  if (!brand?.org_id) {
    return { response: jsonError(409, "conflict", "asset_missing_brand") };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", brand.org_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) return { response: membershipLookupFailedResponse() };
  if (!membership) return { response: jsonError(403, "forbidden", "foreign_org") };

  return { orgId: brand.org_id };
}

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

  const access = await authorizeAssetAccess(supabase, assetId, operator.id);
  if ("response" in access) return access.response;

  const { data, error } = await supabase.rpc("decide_asset_version", {
    p_asset_id: assetId,
    p_expected_cloudinary_asset_id: expectedCloudinaryAssetId,
    p_expected_version: Number(expectedVersion),
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
