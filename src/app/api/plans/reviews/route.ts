import { z } from "zod";

import { getVerifiedOperatorForRequest } from "@/lib/auth/copilot-hooks";
import { badRequestResponse, unauthorizedResponse } from "@/lib/auth/unauthorized";
import { jsonError } from "@/lib/http/json-response";
import {
  SHOOT_PLAN_REVIEW_WORKFLOW_ID,
  type ShootPlanReviewWorkflowRunner,
} from "@/lib/shoot/decide-shoot-plan-revision";
import { readSuspendedPlanReview } from "@/lib/shoot/plan-approval";
import { authorizePlanReviewEditor } from "@/lib/shoot/plan-review-authorization";
import { createClientFromRequest } from "@/lib/supabase/server";
import { brandOrgLookupFromClient, rpcCallFromClient } from "@/lib/supabase/rpc-adapter";

/**
 * IPI-1084 · APPROVAL-001 — start a ShootPlan review.
 *
 * The operator, their org and the editor/owner authority are all resolved
 * server-side from the session; the body carries only the brand locator and the
 * canonical plan. Staging runs with service-side authority, so the browser can
 * never write an approval directly. The response returns the bounded identity
 * the run published when it suspended — the operator approves that exact
 * revision, and nothing is saved to a Shoot here.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  brandId: z.string().uuid(),
  plan: z.record(z.string(), z.unknown()),
  agentThreadId: z.string().min(1).max(200).nullish(),
  expiresAt: z.string().min(1).max(64).nullish(),
});

export async function POST(request: Request): Promise<Response> {
  const operator = await getVerifiedOperatorForRequest(request);
  if (!operator) return unauthorizedResponse();

  const supabase = createClientFromRequest(request);
  if (!supabase) return unauthorizedResponse();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequestResponse("invalid_body");
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return badRequestResponse("invalid_body");

  const authorization = await authorizePlanReviewEditor(
    { brandId: parsed.data.brandId, operatorId: operator.id },
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

  try {
    const { mastra } = await import("@/mastra");
    const workflow = mastra.getWorkflow(
      SHOOT_PLAN_REVIEW_WORKFLOW_ID,
    ) as unknown as ShootPlanReviewWorkflowRunner & { createRun: () => { startAsync: (input: unknown) => Promise<unknown> } };
    const run = workflow.createRun();
    const result = await run.startAsync({
      inputData: {
        brandId: parsed.data.brandId,
        plan: parsed.data.plan,
        stagedBy: operator.id,
        agentThreadId: parsed.data.agentThreadId ?? null,
        expiresAt: parsed.data.expiresAt ?? null,
      },
    });
    const suspended = readSuspendedPlanReview(result);
    if (!suspended) {
      return jsonError(502, "error", "review_start_failed");
    }
    return Response.json(
      { ...suspended },
      { status: 201, headers: { "content-type": "application/json" } },
    );
  } catch {
    return jsonError(502, "error", "review_start_failed");
  }
}
