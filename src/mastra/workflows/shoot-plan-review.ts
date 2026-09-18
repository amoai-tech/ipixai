import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import {
  PLAN_APPROVAL_DECISIONS,
  parseShootPlanApprovalSnapshot,
} from "@/lib/shoot/plan-approval";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { rpcCallFromClient } from "@/lib/supabase/rpc-adapter";
import { stageShootPlanRevision } from "@/lib/shoot/stage-shoot-plan-revision";

/**
 * IPI-1084 · APPROVAL-001 — exact-revision review lifecycle.
 *
 * This workflow never composes a plan and never writes a Shoot. It stages the
 * canonical plan the caller already produced, suspends with a bounded identity
 * (approval id, brand id, revision, plan hash — never the plan body, org ids or
 * user ids), and on resume re-reads the durable approval row before continuing
 * so a stale, superseded or not-yet-recorded decision fails closed.
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

const stageRevision = createStep({
  id: "stageRevision",
  inputSchema: shootPlanReviewInputSchema,
  outputSchema: stagedRevisionSchema,
  execute: async ({ inputData, runId }) => {
    const serialized = JSON.stringify(inputData.plan);
    if (serialized.length > MAX_PLAN_BYTES) {
      throw new Error("Plan exceeds the maximum reviewable size");
    }

    const sb = await requireServiceRoleClient();
    const outcome = await stageShootPlanRevision(
      {
        brandId: inputData.brandId,
        workflowRunId: runId,
        plan: inputData.plan,
        stagedBy: inputData.stagedBy ?? null,
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
    const sb = await requireServiceRoleClient();
    const { data, error } = await sb.rpc("get_shoot_plan_approval", {
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
      note: snapshot.decisionNote,
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
