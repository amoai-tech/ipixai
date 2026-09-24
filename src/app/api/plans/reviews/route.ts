import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";

import { getVerifiedOperatorForRequest } from "@/lib/auth/operator-auth";
import { badRequestResponse, unauthorizedResponse } from "@/lib/auth/unauthorized";
import { jsonError } from "@/lib/http/json-response";
import { SHOOT_PLAN_REVIEW_WORKFLOW_ID } from "@/lib/shoot/decide-shoot-plan-revision";
import { readSuspendedPlanReview } from "@/lib/shoot/plan-approval";
import { authorizePlanReviewEditor } from "@/lib/shoot/plan-review-authorization";
import { createClientFromRequest } from "@/lib/supabase/server";
import { brandOrgLookupFromClient, rpcCallFromClient } from "@/lib/supabase/rpc-adapter";
import {
  createTrustedWorkflowRequestContext,
  readAuthenticatedWorkflowUser,
} from "@/mastra/workflow-identity";

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
});

/**
 * The installed Mastra contract. `createRun()` is asynchronous, and `start()`
 * is the only run method that resolves with the suspended result:
 *
 *   createRun(options?): Promise<Run<...>>
 *   run.start(args):     Promise<WorkflowResult<...>>   // status: 'suspended'
 *   run.startAsync(args): Promise<{ runId: string }>    // fire-and-forget
 *
 * `startAsync` resolves immediately with only the run id, so it can never carry
 * the suspend payload this route must return. Awaiting `createRun` and then
 * `start` is what actually reaches the suspended state.
 */
type ReviewStarter = {
  createRun: () => Promise<{
    runId: string;
    start: (args: {
      inputData: Record<string, unknown>;
      requestContext: RequestContext;
    }) => Promise<unknown>;
  }>;
};

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

  // IPI-1326: the workflow re-authorizes from an authenticated RequestContext,
  // never from `stagedBy`. Build it from this request's verified session and
  // require it to name the same operator and org that were just authorized.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const requestContext = session?.access_token
    ? await createTrustedWorkflowRequestContext(session.access_token)
    : null;
  const trusted = readAuthenticatedWorkflowUser(requestContext);
  if (!requestContext || !trusted) return unauthorizedResponse();
  if (trusted.userId !== operator.id || trusted.orgId !== authorization.orgId) {
    return jsonError(403, "error", "forbidden");
  }

  try {
    const { getMastra } = await import("@/mastra/runtime");
    const workflow = getMastra().getWorkflow(
      SHOOT_PLAN_REVIEW_WORKFLOW_ID,
    ) as unknown as ReviewStarter;
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: {
        brandId: parsed.data.brandId,
        plan: parsed.data.plan,
        stagedBy: operator.id,
      },
      requestContext,
    });
    const suspended = readSuspendedPlanReview(result);
    if (!suspended) {
      return jsonError(502, "error", "review_start_failed");
    }
    // `runId` is returned as a non-authority trace id proving a real Mastra run
    // suspended. The decision path re-reads the run id from the approval row, so
    // the browser can never use it to reach a decision.
    return Response.json(
      { runId: run.runId, ...suspended },
      { status: 201, headers: { "content-type": "application/json" } },
    );
  } catch {
    return jsonError(502, "error", "review_start_failed");
  }
}
