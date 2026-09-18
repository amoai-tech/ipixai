import { z } from "zod";

import { getVerifiedOperatorForRequest } from "@/lib/auth/operator-auth";
import { badRequestResponse, unauthorizedResponse } from "@/lib/auth/unauthorized";
import { jsonError } from "@/lib/http/json-response";
import { authorizePlanReviewEditor } from "@/lib/shoot/plan-review-authorization";
import {
  loadShootPlanApproval,
  stageShootPlanRevision,
} from "@/lib/shoot/stage-shoot-plan-revision";
import { createClientFromRequest } from "@/lib/supabase/server";
import { brandOrgLookupFromClient, rpcCallFromClient } from "@/lib/supabase/rpc-adapter";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * IPI-1084 · APPROVAL-001 — stage an edited plan as a NEW revision.
 *
 * An edit never mutates the row the operator already reviewed. It stages
 * `max(revision) + 1` under the same workflow run, which makes the previous
 * revision superseded and forces a fresh human decision on the exact new
 * artifact. Editing after a final decision fails closed: that requires a new
 * review run, which is out of scope for this increment. No Shoot is written.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  plan: z.record(z.string(), z.unknown()),
});

function statusForCode(code: string): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "ALREADY_DECIDED":
    case "SUPERSEDED_REVISION":
    case "EXPIRED":
    case "REVISION_CONFLICT":
      return 409;
    case "INVALID_INPUT":
      return 400;
    case "LOOKUP_FAILED":
      return 503;
    default:
      return 502;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ approvalId: string }> },
): Promise<Response> {
  const operator = await getVerifiedOperatorForRequest(request);
  if (!operator) return unauthorizedResponse();

  const supabase = createClientFromRequest(request);
  if (!supabase) return unauthorizedResponse();

  const { approvalId } = await context.params;
  if (!z.string().uuid().safeParse(approvalId).success) {
    return badRequestResponse("invalid_approval_id");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequestResponse("invalid_body");
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return badRequestResponse("invalid_body");

  const loaded = await loadShootPlanApproval(approvalId, {
    supabase: { rpc: rpcCallFromClient(supabase) },
  });
  if (!loaded.ok) {
    return jsonError(statusForCode(loaded.code), "error", loaded.code.toLowerCase());
  }

  const authorization = await authorizePlanReviewEditor(
    { brandId: loaded.snapshot.brandId, operatorId: operator.id },
    {
      brands: { selectOrgId: brandOrgLookupFromClient(supabase) },
      rpc: rpcCallFromClient(supabase),
    },
  );
  if (!authorization.ok) {
    return jsonError(
      authorization.code === "FORBIDDEN" ? 403 : authorization.code === "NOT_FOUND" ? 404 : 503,
      "error",
      authorization.code.toLowerCase(),
    );
  }

  if (loaded.snapshot.status !== "pending") {
    return jsonError(409, "error", "already_decided");
  }
  if (!loaded.snapshot.isCurrent) {
    return jsonError(409, "error", "superseded_revision");
  }

  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    return jsonError(503, "error", "staging_unavailable");
  }

  const staged = await stageShootPlanRevision(
    {
      brandId: loaded.snapshot.brandId,
      workflowRunId: loaded.snapshot.workflowRunId,
      plan: parsed.data.plan,
      stagedBy: operator.id,
      // Review metadata is inherited from the durable row the operator is
      // editing, never accepted from the browser.
      agentThreadId: loaded.snapshot.agentThreadId,
      expiresAt: loaded.snapshot.expiresAt,
    },
    { supabase: { rpc: rpcCallFromClient(serviceRole) } },
  );

  if (!staged.ok) {
    // A typed staging failure keeps its own HTTP meaning; REVISION_CONFLICT in
    // particular must stay a 409 so the caller can retry the revision.
    return jsonError(statusForCode(staged.code), "error", staged.code.toLowerCase());
  }

  return Response.json(
    {
      approvalId: staged.approvalId,
      brandId: loaded.snapshot.brandId,
      revision: staged.revision,
      planHash: staged.planHash,
      supersededRevision: loaded.snapshot.revision,
    },
    { status: 201, headers: { "content-type": "application/json" } },
  );
}
