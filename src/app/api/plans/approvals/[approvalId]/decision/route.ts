import { z } from "zod";

import { getVerifiedOperatorForRequest } from "@/lib/auth/copilot-hooks";
import { badRequestResponse, unauthorizedResponse } from "@/lib/auth/unauthorized";
import { jsonError } from "@/lib/http/json-response";
import {
  PLAN_APPROVAL_DECISIONS,
  planApprovalMessage,
} from "@/lib/shoot/plan-approval";
import { authorizePlanReviewEditor } from "@/lib/shoot/plan-review-authorization";
import {
  SHOOT_PLAN_REVIEW_WORKFLOW_ID,
  type ShootPlanReviewWorkflowRunner,
  decideShootPlanRevision,
} from "@/lib/shoot/decide-shoot-plan-revision";
import { loadShootPlanApproval } from "@/lib/shoot/stage-shoot-plan-revision";
import { createClientFromRequest } from "@/lib/supabase/server";
import { brandOrgLookupFromClient, rpcCallFromClient } from "@/lib/supabase/rpc-adapter";

/**
 * IPI-1084 · APPROVAL-001 — record the operator's decision on one exact revision.
 *
 * Authorization uses the caller's own session (the deciding RPC re-checks
 * editor/owner as well). The browser never reaches service-role here, and the
 * plan body/org/user fields are never accepted as approval authority — only
 * the reviewed revision, its hash and the decision vocabulary.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  revision: z.number().int().positive(),
  planHash: z.string().min(1),
  decision: z.enum(PLAN_APPROVAL_DECISIONS),
  note: z.string().max(2000).nullish(),
  idempotencyKey: z.string().min(1).max(200).nullish(),
});

function statusForCode(code: string): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "STALE_REVISION":
    case "SUPERSEDED_REVISION":
    case "IDEMPOTENCY_CONFLICT":
    case "ALREADY_DECIDED":
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

  const { mastra } = await import("@/mastra");
  const workflow = mastra.getWorkflow(
    SHOOT_PLAN_REVIEW_WORKFLOW_ID,
  ) as unknown as ShootPlanReviewWorkflowRunner;

  const outcome = await decideShootPlanRevision(
    {
      approvalId,
      revision: parsed.data.revision,
      planHash: parsed.data.planHash,
      decision: parsed.data.decision,
      note: parsed.data.note ?? null,
      idempotencyKey: parsed.data.idempotencyKey ?? null,
    },
    { supabase: { rpc: rpcCallFromClient(supabase) }, workflow },
  );

  if (!outcome.ok) {
    return jsonError(statusForCode(outcome.code), "error", outcome.code.toLowerCase());
  }

  return Response.json(
    {
      ok: true,
      identity: outcome.identity,
      replayed: outcome.replayed,
      resumeState: outcome.resumeState,
      message: outcome.message,
    },
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
