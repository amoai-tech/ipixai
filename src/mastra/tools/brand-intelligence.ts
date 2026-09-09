import { createTool } from "@mastra/core/tools";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requestToken } from "@/lib/request-token";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";

/**
 * IPI-1093 · BRAND-INTEL-001 — operator tools for the brand-intelligence
 * workflow. Adapted from Lumina's brand-intelligence-tools.ts, reimplemented
 * on the current iPix stack:
 *
 * - startBrandAnalysis: starts the brand-intelligence workflow (crawl →
 *   extraction → draft → operator review). The workflow's validateBrand step
 *   performs the real authorization (org editor/owner or brand owner) using
 *   the actorId resolved from the verified session JWT — never a
 *   browser-supplied actor.
 * - approveDraft: the operator's approve/reject decision. Uses a
 *   user-scoped Supabase client (the session JWT) so the
 *   approve/reject_brand_intelligence_draft SECURITY DEFINER RPCs see the
 *   real auth.uid() and enforce org editor/owner + exact draft-hash binding.
 *   Only on RPC success does it resume the workflow at saveDraftAndWait.
 *
 * The access token is request-scoped via the requestToken AsyncLocalStorage,
 * populated in the CopilotKit route. Tools never accept a token or actorId
 * from the model.
 *
 * Exact-artifact rule (IPI-1093 review fix): `draftHash` is an opaque
 * optimistic-concurrency token the UI captured when it rendered the draft
 * the operator is reviewing (via get_brand_draft_hash at render time). This
 * tool must NEVER recompute the hash itself and submit that instead — doing
 * so would silently approve whatever draft is live at click time, not the
 * one the operator saw. The RPC is the authority: it recomputes the current
 * server-side hash and compares it to the caller-supplied token, returning
 * STALE_DRAFT on any mismatch.
 */

const APPROVAL_MESSAGES: Record<string, string> = {
  STALE_DRAFT: "Draft changed since review — please re-review before deciding.",
  FORBIDDEN: "You do not have permission to approve this brand's draft.",
  UNAUTHENTICATED: "Not authenticated — please sign in and try again.",
  NO_DRAFT: "No draft is waiting for review.",
  ALREADY_APPROVED: "This draft was already approved.",
  ALREADY_REJECTED: "This draft was already rejected.",
  INVALID_DRAFT: "Draft is invalid — please re-run the analysis.",
  NOT_FOUND: "Brand not found.",
};

function requireAccessToken(): string {
  const token = requestToken.getStore();
  if (!token) {
    throw new Error("Access token not available in request context");
  }
  return token;
}

function requireSupabaseConfig() {
  const config = getPublicSupabaseConfig();
  if (!config?.url || !config.publishableKey) {
    throw new Error("Supabase configuration unavailable");
  }
  return config;
}

async function resolveOperatorId(accessToken: string): Promise<string> {
  const config = requireSupabaseConfig();
  const sb = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await sb.auth.getUser(accessToken);
  if (error || !data?.user?.id) {
    throw new Error("Access token not available in request context");
  }
  return data.user.id;
}

export const StartBrandAnalysisInputSchema = z.object({
  brandId: z.string().uuid(),
});
export const StartBrandAnalysisOutputSchema = z.object({
  runId: z.string(),
  message: z.string(),
});

export const startBrandAnalysis = createTool({
  id: "startBrandAnalysis",
  description:
    "Start a full brand-intelligence analysis for a brand: crawl its website, extract a brand DNA profile draft, and leave it for operator review. Returns the workflow run id. The operator must be an editor/owner of the brand's organization (or the brand owner).",
  inputSchema: StartBrandAnalysisInputSchema,
  outputSchema: StartBrandAnalysisOutputSchema,
  // Explicit return type breaks a circular type-inference chain: this file's
  // tool types feed agents/index.ts -> mastra/index.ts, and the dynamic
  // `import("@/mastra")` below type-depends on mastra/index.ts in turn.
  // Without an annotation here, tsc reports every symbol in the cycle as
  // implicit `any` (TS7022).
  execute: async (
    inputData,
  ): Promise<{ runId: string; message: string }> => {
    const accessToken = requireAccessToken();
    const operatorId = await resolveOperatorId(accessToken);

    const { mastra } = await import("@/mastra");
    const workflow = mastra.getWorkflow("brand-intelligence");
    const run = await workflow.createRun();
    const { runId } = await run.startAsync({
      inputData: { brandId: inputData.brandId, actorId: operatorId },
    });

    return {
      runId,
      message:
        "Brand analysis started. The crawl typically takes 2–5 minutes. A draft will appear on the brand page when ready for your review.",
    };
  },
});

export const ApproveDraftInputSchema = z.object({
  brandId: z.string().uuid(),
  // Opaque optimistic-concurrency token from get_brand_draft_hash, captured
  // by the UI when the operator reviewed the draft. Never recomputed here.
  draftHash: z.string().min(1),
  approved: z.boolean(),
});
export const ApproveDraftOutputSchema = z.object({
  ok: z.boolean(),
  approved: z.boolean(),
  message: z.string(),
});

export const approveDraft = createTool({
  id: "approveDraft",
  description:
    "Approve or reject a brand-intelligence draft. Pass the draftHash the operator's UI captured when it rendered the draft under review — approval promotes exactly that reviewed artifact, never a newer one. Approval replaces the brand's approved profile and DNA scores; rejection clears the draft. If the draft changed since review, the decision fails with STALE_DRAFT rather than silently approving unseen content. The workflow resumes only after the server-side RPC succeeds.",
  inputSchema: ApproveDraftInputSchema,
  outputSchema: ApproveDraftOutputSchema,
  // See startBrandAnalysis above — explicit return type breaks the same
  // circular-inference chain through the dynamic `import("@/mastra")` below.
  execute: async (
    inputData,
  ): Promise<{ ok: boolean; approved: boolean; message: string }> => {
    const { brandId, draftHash, approved } = inputData;
    const accessToken = requireAccessToken();
    const config = requireSupabaseConfig();

    const sb = createClient(config.url, config.publishableKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: brand, error: brandError } = await sb
      .from("brands")
      .select("ai_profile_draft")
      .eq("id", brandId)
      .single();
    if (brandError) throw brandError;
    if (!brand?.ai_profile_draft) {
      return { ok: false, approved, message: APPROVAL_MESSAGES.NO_DRAFT };
    }

    const runId = (brand.ai_profile_draft as Record<string, unknown>)?._workflow_run_id;
    if (typeof runId !== "string" || !runId) {
      throw new Error("Draft is missing its workflow run id");
    }

    // Cross-tenant/cross-run guard: _workflow_run_id lives in ai_profile_draft,
    // a column any org member can write via ordinary brands RLS. brand_crawls
    // is service-role-write-only (no authenticated INSERT/UPDATE policy), so
    // a row proving brand_id+workflow_id together is a trustworthy binding —
    // it cannot be forged by writing JSON into the draft column.
    const { data: crawlLink, error: crawlLinkError } = await sb
      .from("brand_crawls")
      .select("id")
      .eq("brand_id", brandId)
      .eq("workflow_id", runId)
      .limit(1)
      .maybeSingle();
    if (crawlLinkError) throw crawlLinkError;
    if (!crawlLink) {
      throw new Error("Draft's workflow run does not belong to this brand");
    }

    const rpcName = approved
      ? "approve_brand_intelligence_draft"
      : "reject_brand_intelligence_draft";
    const { data: result, error: rpcError } = await sb.rpc(rpcName, {
      p_brand_id: brandId,
      p_expected_draft_hash: draftHash,
    });
    if (rpcError) throw rpcError;

    const outcome = (result ?? {}) as { ok?: boolean; code?: string };
    if (!outcome.ok) {
      return {
        ok: false,
        approved,
        message: APPROVAL_MESSAGES[outcome.code ?? ""] ?? "Decision could not be recorded.",
      };
    }

    // ALREADY_APPROVED/ALREADY_REJECTED are ok:true idempotent-replay codes —
    // the decision was already recorded on an earlier call and that earlier
    // call already resumed (or is resuming) the workflow. Resuming again here
    // would double-resume a step that already moved past saveDraftAndWait.
    const freshDecision = outcome.code === "APPROVED" || outcome.code === "REJECTED";
    if (freshDecision) {
      try {
        const { mastra } = await import("@/mastra");
        const workflow = mastra.getWorkflow("brand-intelligence");
        const run = await workflow.createRun({ runId });
        await run.resume({
          resumeData: { approved },
          step: "saveDraftAndWait",
        });
      } catch (resumeError) {
        // The RPC already committed the decision durably (ai_profile/audit
        // row on approve, cleared draft on reject) — only the in-memory
        // workflow resume failed. Report success with a retry hint rather
        // than throwing: a retry re-hits the RPC, gets ALREADY_APPROVED/
        // ALREADY_REJECTED (this same ok:true branch, freshDecision=false),
        // and skips straight past this resume attempt.
        return {
          ok: true,
          approved,
          message:
            (approved ? "Draft approved" : "Draft rejected") +
            ", but the workflow did not finish updating — try again in a moment " +
            `(${resumeError instanceof Error ? resumeError.message : "resume failed"}).`,
        };
      }
    }

    return {
      ok: true,
      approved,
      message: approved
        ? "Draft approved. Brand profile will update shortly."
        : "Draft rejected. You can trigger a new analysis when ready.",
    };
  },
});

export const brandIntelligenceTools = {
  startBrandAnalysis,
  approveDraft,
};