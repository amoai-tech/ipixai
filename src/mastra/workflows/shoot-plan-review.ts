import type { RequestContext } from "@mastra/core/request-context";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import {
  PLAN_APPROVAL_DECISIONS,
  parseShootPlanApprovalSnapshot,
} from "@/lib/shoot/plan-approval";
import { createClient } from "@supabase/supabase-js";

import { authorizePlanReviewEditor } from "@/lib/shoot/plan-review-authorization";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { brandOrgLookupFromClient, rpcCallFromClient } from "@/lib/supabase/rpc-adapter";
import { stageShootPlanRevision } from "@/lib/shoot/stage-shoot-plan-revision";
import { resolveSupabaseUserAuthConfig } from "@/mastra/server-auth";
import { requireAuthenticatedWorkflowUser } from "@/mastra/workflow-identity";

/**
 * IPI-1084 · APPROVAL-001 — exact-revision review lifecycle.
 *
 * This workflow never composes a plan and never writes a Shoot. It stages the
 * canonical plan the caller already produced, suspends with a bounded identity
 * (approval id, brand id, revision, plan hash — never the plan body, org ids or
 * user ids), and on resume re-reads the durable approval row before continuing
 * so a stale, superseded or not-yet-recorded decision fails closed.
 *
 * The suspend payload stays id-free, but the run snapshot also persists the
 * start RequestContext (IPI-1326): the verified `{ id, orgId, resourceId }`
 * under `mastra__user` and `mastra__resourceId`. Mastra's snapshot
 * serialization drops the auth token, so no credential is stored.
 */

const MAX_PLAN_BYTES = 262_144;

const planInputSchema = z.record(z.string(), z.unknown());

export const shootPlanReviewInputSchema = z.object({
  brandId: z.string().uuid(),
  plan: planInputSchema,
  stagedBy: z.string().uuid().nullish(),
  agentThreadId: z.string().nullish(),
  expiresAt: z.string().nullish(),
});

const stagedRevisionSchema = z.object({
  approvalId: z.string(),
  brandId: z.string(),
  revision: z.number().int().positive(),
  planHash: z.string(),
});

const reviewResumeSchema = z.object({
  approvalId: z.string(),
  revision: z.number().int().positive(),
  planHash: z.string(),
  decision: z.enum(PLAN_APPROVAL_DECISIONS),
  note: z.string().nullish(),
});

const reviewSuspendSchema = z.object({
  approvalId: z.string(),
  brandId: z.string(),
  revision: z.number().int().positive(),
  planHash: z.string(),
});

const reviewOutcomeSchema = z.object({
  approvalId: z.string(),
  brandId: z.string(),
  revision: z.number().int().positive(),
  planHash: z.string(),
  decision: z.enum(PLAN_APPROVAL_DECISIONS),
  note: z.string().nullable(),
});

async function requireServiceRoleClient() {
  const sb = createServiceRoleClient();
  if (!sb) throw new Error("Service-role client unavailable");
  return sb;
}

/**
 * IPI-1326 — the run must carry an authenticated Mastra user (HTTP auth or a
 * trusted in-process RequestContext). Re-run the same editor/owner check as
 * `POST /api/plans/reviews` under that user's own session (RLS +
 * `is_org_editor_or_above`) before any service-role staging, and bind
 * `stagedBy` to that user. A missing identity or mismatching claim fails closed.
 */
async function resolveStager(
  requestContext: Pick<RequestContext, "get"> | undefined,
  brandId: string,
  claimedStagedBy: string | null | undefined,
): Promise<string> {
  const user = requireAuthenticatedWorkflowUser(requestContext, claimedStagedBy);
  if (!user.accessToken) throw new Error("Authenticated workflow session unavailable");

  const config = resolveSupabaseUserAuthConfig();
  const userClient = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${user.accessToken}` } },
  });
  const authorization = await authorizePlanReviewEditor(
    { brandId, operatorId: user.userId },
    {
      brands: { selectOrgId: brandOrgLookupFromClient(userClient) },
      rpc: rpcCallFromClient(userClient),
    },
  );
  if (!authorization.ok) throw new Error(`Plan review not authorized: ${authorization.code}`);
  if (authorization.orgId !== user.orgId) {
    throw new Error("Brand is outside the authenticated organization");
  }
  return user.userId;
}

const stageRevision = createStep({
  id: "stageRevision",
  inputSchema: shootPlanReviewInputSchema,
  outputSchema: stagedRevisionSchema,
  execute: async ({ inputData, runId, requestContext }) => {
    const serialized = JSON.stringify(inputData.plan);
    if (serialized.length > MAX_PLAN_BYTES) {
      throw new Error("Plan exceeds the maximum reviewable size");
    }

    const stagedBy = await resolveStager(requestContext, inputData.brandId, inputData.stagedBy);
    const sb = await requireServiceRoleClient();
    const outcome = await stageShootPlanRevision(
      {
        brandId: inputData.brandId,
        workflowRunId: runId,
        plan: inputData.plan,
        stagedBy,
        agentThreadId: inputData.agentThreadId ?? null,
        expiresAt: inputData.expiresAt ?? null,
      },
      { supabase: { rpc: rpcCallFromClient(sb) } },
    );

    if (!outcome.ok) {
      throw new Error(`Plan revision staging failed: ${outcome.code}`);
    }

    return {
      approvalId: outcome.approvalId,
      brandId: inputData.brandId,
      revision: outcome.revision,
      planHash: outcome.planHash,
    };
  },
});

const awaitDecision = createStep({
  id: "awaitDecision",
  inputSchema: stagedRevisionSchema,
  outputSchema: reviewOutcomeSchema,
  resumeSchema: reviewResumeSchema,
  suspendSchema: reviewSuspendSchema,
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return suspend(
        {
          approvalId: inputData.approvalId,
          brandId: inputData.brandId,
          revision: inputData.revision,
          planHash: inputData.planHash,
        },
        { resumeLabel: "operator-review" },
      );
    }

    // resumeData is transport only. Re-read the durable row so a decision that
    // was never recorded, or one spent on a superseded revision, cannot advance
    // the run.
    //
    // The workflow runs with service-side authority and has no session, so it
    // uses the service-side proof read. The operator-scoped
    // `get_shoot_plan_approval` would fail closed with UNAUTHENTICATED here.
    const sb = await requireServiceRoleClient();
    const { data, error } = await sb.rpc("get_shoot_plan_approval_proof", {
      p_approval_id: resumeData.approvalId,
    });
    if (error) throw new Error("Could not re-read the durable approval state");

    const snapshot = parseShootPlanApprovalSnapshot(data);
    if (!snapshot) throw new Error("Durable approval state is unreadable");
    if (snapshot.status === "pending") {
      throw new Error("No decision has been recorded for this revision");
    }
    if (!snapshot.hashMatches) {
      throw new Error("The reviewed revision no longer matches the staged plan");
    }
    if (!snapshot.isCurrent) {
      throw new Error("A newer revision superseded the decision that was sent");
    }
    if (
      snapshot.revision !== resumeData.revision ||
      snapshot.planHash !== resumeData.planHash ||
      snapshot.status !== resumeData.decision
    ) {
      throw new Error("The decision that was sent does not match the durable record");
    }

    return {
      approvalId: snapshot.approvalId,
      brandId: snapshot.brandId,
      revision: snapshot.revision,
      planHash: snapshot.planHash,
      decision: resumeData.decision,
      // The proof read is deliberately plan- and note-free; the durable note
      // stays readable through the authenticated path.
      note: null,
    };
  },
});

export const shootPlanReviewWorkflow = createWorkflow({
  id: "shoot-plan-review",
  inputSchema: shootPlanReviewInputSchema,
  outputSchema: reviewOutcomeSchema,
})
  .then(stageRevision)
  .then(awaitDecision)
  .commit();
