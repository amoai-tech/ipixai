import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  assertBrandProfile,
  extractDraftScores,
} from "@/lib/brand/brand-profile-contract";

const FAILURE_DETAIL_LIMIT = 500;

function boundDetail(raw: unknown): string {
  if (raw == null) return "(empty response body)";
  const text = String(raw).replace(/\s+/g, " ").trim();
  if (text.length <= FAILURE_DETAIL_LIMIT) return text;
  return `${text.slice(0, FAILURE_DETAIL_LIMIT)}… [truncated, ${text.length} chars]`;
}

function requireServiceRoleCredentials(): { url: string; key: string } {
  const config = getPublicSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config?.url || !key) {
    throw new Error("Service-role credentials unavailable");
  }
  return { url: config.url, key };
}

function edgeFnUrl(fn: string): string {
  const { url } = requireServiceRoleCredentials();
  return `${url}/functions/v1/${fn}`;
}

async function requireServiceRoleClient() {
  const sb = createServiceRoleClient();
  if (!sb) {
    throw new Error("Service-role client unavailable");
  }
  return sb;
}

async function failAnalysis(
  brandId: string,
  summary: string,
  detail: unknown,
): Promise<Error> {
  const sb = createServiceRoleClient();
  let writeErr: unknown = null;
  if (sb) {
    const { error } = await sb
      .from("brands")
      .update({ intake_status: "failed", updated_at: new Date().toISOString() })
      .eq("id", brandId);
    if (error) writeErr = error;
  }
  const base = `${summary}: ${boundDetail(detail)}`;
  return new Error(
    writeErr
      ? `${base} — intake_status=failed was NOT recorded: ${boundDetail((writeErr as Error).message)}`
      : base,
  );
}

const workflowInputSchema = z.object({
  brandId: z.string().uuid(),
  actorId: z.string().uuid(),
});

const workflowOutputSchema = z.object({
  status: z.string(),
});

const validateBrandInputSchema = z.object({
  brandId: z.string().uuid(),
  actorId: z.string().uuid(),
});

const validateBrandOutputSchema = z.object({
  brandId: z.string().uuid(),
  brandUrl: z.string().url(),
  brandName: z.string(),
  actorId: z.string().uuid(),
});

const startCrawlInputSchema = z.object({
  brandId: z.string().uuid(),
  brandUrl: z.string().url(),
  brandName: z.string(),
  actorId: z.string().uuid(),
});

const startCrawlOutputSchema = z.object({
  crawlId: z.string().uuid(),
  brandId: z.string().uuid(),
});

const waitForCrawlInputSchema = z.object({
  crawlId: z.string().uuid(),
  brandId: z.string().uuid(),
});

const waitForCrawlOutputSchema = z.object({
  crawlId: z.string().uuid(),
  brandId: z.string().uuid(),
});

const waitForCrawlResumeSchema = z.object({
  // Optional: a failure signal (failed:true) may arrive without a crawlId.
  // The step checks `failed` before comparing crawlId, so this still fails
  // the step cleanly via the "Crawl failed" branch rather than the resume
  // being rejected by schema validation before the step ever runs, which
  // would leave the workflow stuck suspended instead of failing closed.
  crawlId: z.string().uuid().optional(),
  failed: z.boolean().optional(),
  error: z.string().optional(),
});

const waitForCrawlSuspendSchema = z.object({
  crawlId: z.string().uuid(),
});

const extractProfileInputSchema = z.object({
  crawlId: z.string().uuid(),
  brandId: z.string().uuid(),
});

const extractProfileOutputSchema = z.object({
  brandId: z.string().uuid(),
});

const saveDraftAndWaitInputSchema = z.object({
  brandId: z.string().uuid(),
});

const saveDraftAndWaitOutputSchema = z.object({
  draftId: z.string(),
  brandId: z.string().uuid(),
  approved: z.boolean(),
});

const saveDraftAndWaitResumeSchema = z.object({
  approved: z.boolean(),
});

const saveDraftAndWaitSuspendSchema = z.object({
  brandId: z.string().uuid(),
  draftHash: z.string(),
});

const commitOrRejectInputSchema = z.object({
  draftId: z.string(),
  brandId: z.string().uuid(),
  approved: z.boolean(),
});

const commitOrRejectOutputSchema = z.object({
  status: z.string(),
});

const validateBrand = createStep({
  id: "validateBrand",
  inputSchema: validateBrandInputSchema,
  outputSchema: validateBrandOutputSchema,
  execute: async ({ inputData }) => {
    const { brandId, actorId } = inputData;
    const sb = await requireServiceRoleClient();

    const { data: brand, error: brandError } = await sb
      .from("brands")
      .select("id, brand_url, name, org_id, user_id")
      .eq("id", brandId)
      .single();

    if (brandError || !brand) {
      throw new Error(`Brand not found: ${boundDetail(brandError?.message)}`);
    }
    if (!brand.brand_url) {
      throw new Error("Brand has no website URL to analyze");
    }

    if (brand.org_id) {
      const { data: member, error: memberError } = await sb
        .from("org_members")
        .select("role")
        .eq("org_id", brand.org_id)
        .eq("user_id", actorId)
        .maybeSingle();
      if (memberError) {
        throw new Error(`Membership check failed: ${boundDetail(memberError.message)}`);
      }
      if (!member || !["owner", "editor"].includes(member.role)) {
        throw new Error("Operator is not an editor or owner of this brand's organization");
      }
    } else if (brand.user_id !== actorId) {
      throw new Error("Operator does not own this brand");
    }

    const { data: claimed, error: claimError } = await sb
      .from("brands")
      .update({ intake_status: "crawl_running", updated_at: new Date().toISOString() })
      .eq("id", brandId)
      .not(
        "intake_status",
        "in",
        '("crawl_running","crawl_complete","analysis_running","scores_complete","draft_ready")',
      )
      .select("id")
      .single();

    if (claimError || !claimed) {
      throw new Error("Brand analysis already in progress or has an approved draft — duplicate run prevented");
    }

    return { brandId, brandUrl: brand.brand_url, brandName: brand.name, actorId };
  },
});

const startCrawl = createStep({
  id: "startCrawl",
  inputSchema: startCrawlInputSchema,
  outputSchema: startCrawlOutputSchema,
  execute: async ({ inputData, runId }) => {
    const { brandId, brandUrl, actorId } = inputData;
    const { key } = requireServiceRoleCredentials();
    const url = edgeFnUrl("start-brand-crawl");

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ brandId, url: brandUrl, actorId, workflowId: runId }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      throw await failAnalysis(brandId, "Failed to start brand crawl", err);
    }

    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      const detail = body?.error?.message ?? body?.message ?? body ?? `HTTP ${res.status}`;
      throw await failAnalysis(brandId, "Failed to start brand crawl", detail);
    }

    const crawlId = body?.data?.crawlId ?? body?.crawlId;
    if (!crawlId) {
      throw await failAnalysis(brandId, "Crawl start response missing crawlId", body);
    }

    return { crawlId, brandId };
  },
});

const waitForCrawl = createStep({
  id: "waitForCrawl",
  inputSchema: waitForCrawlInputSchema,
  outputSchema: waitForCrawlOutputSchema,
  resumeSchema: waitForCrawlResumeSchema,
  suspendSchema: waitForCrawlSuspendSchema,
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return suspend({ crawlId: inputData.crawlId }, { resumeLabel: "crawl-complete" });
    }
    // Every throw below must route through failAnalysis: intake_status is
    // still "crawl_running" here (set by validateBrand) and stays that way
    // on a bare throw, which the validateBrand claim guard treats as
    // already-in-progress — permanently blocking retry for the single most
    // common failure case in this workflow (the crawl provider failing).
    if (resumeData.failed) {
      throw await failAnalysis(inputData.brandId, "Crawl failed", resumeData.error);
    }
    if (!resumeData.crawlId) {
      throw await failAnalysis(
        inputData.brandId,
        "Crawl resume missing crawlId",
        `expected ${inputData.crawlId}, resume payload had no crawlId and failed was not set`,
      );
    }
    if (resumeData.crawlId !== inputData.crawlId) {
      throw await failAnalysis(
        inputData.brandId,
        "Crawl ID mismatch",
        `expected ${inputData.crawlId}, got ${resumeData.crawlId}`,
      );
    }
    return { crawlId: resumeData.crawlId, brandId: inputData.brandId };
  },
});

const extractProfile = createStep({
  id: "extractProfile",
  inputSchema: extractProfileInputSchema,
  outputSchema: extractProfileOutputSchema,
  execute: async ({ inputData }) => {
    const { crawlId, brandId } = inputData;
    const sb = await requireServiceRoleClient();
    const { key } = requireServiceRoleCredentials();

    const { data: brand, error: brandError } = await sb
      .from("brands")
      .select("brand_url")
      .eq("id", brandId)
      .single();
    if (brandError || !brand?.brand_url) {
      throw await failAnalysis(brandId, "Brand website URL unavailable", brandError?.message);
    }

    const { error: statusError } = await sb
      .from("brands")
      .update({ intake_status: "analysis_running", updated_at: new Date().toISOString() })
      .eq("id", brandId);
    if (statusError) {
      throw await failAnalysis(brandId, "Failed to mark analysis running", statusError.message);
    }

    const correlationId = `BI-${crypto.randomUUID()}`;
    const url = edgeFnUrl("brand-intelligence");

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "x-request-id": correlationId,
        },
        body: JSON.stringify({
          brandId,
          url: brand.brand_url,
          crawlResultId: crawlId,
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      throw await failAnalysis(brandId, "Brand intelligence extraction failed", err);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw await failAnalysis(brandId, "Brand intelligence extraction failed", detail);
    }

    const { data: draftBrand, error: draftError } = await sb
      .from("brands")
      .select("ai_profile_draft")
      .eq("id", brandId)
      .single();
    if (draftError || !draftBrand?.ai_profile_draft) {
      throw await failAnalysis(brandId, "No draft produced", draftError?.message ?? "ai_profile_draft empty after extraction");
    }

    try {
      assertBrandProfile(draftBrand.ai_profile_draft);
    } catch (err) {
      throw await failAnalysis(brandId, "Draft failed Brand DNA validation", err);
    }

    return { brandId };
  },
});

const saveDraftAndWait = createStep({
  id: "saveDraftAndWait",
  inputSchema: saveDraftAndWaitInputSchema,
  outputSchema: saveDraftAndWaitOutputSchema,
  resumeSchema: saveDraftAndWaitResumeSchema,
  suspendSchema: saveDraftAndWaitSuspendSchema,
  execute: async ({ inputData, resumeData, suspendData, suspend, runId }) => {
    const { brandId } = inputData;

    if (!resumeData) {
      const sb = await requireServiceRoleClient();

      // Every failure branch below routes through failAnalysis: intake_status
      // is still "analysis_running" here (set by extractProfile) and stays
      // that way on a bare throw, which the validateBrand claim guard treats
      // as "already in progress" — permanently blocking any retry. See the
      // matching comment on extractProfile's assertBrandProfile call above.
      const { data: brand, error: brandError } = await sb
        .from("brands")
        .select("ai_profile_draft")
        .eq("id", brandId)
        .single();
      if (brandError || !brand?.ai_profile_draft) {
        throw await failAnalysis(brandId, "No draft to review", brandError?.message);
      }

      // The deployed brand-intelligence edge function does not write the
      // workflow run id into the draft. Persist it here (before hashing) so
      // the operator approve/reject tool can resume this exact run; the hash
      // then covers it and the approve RPC hashes the current draft, so they
      // match. The draft schema is passthrough, so the extra key is valid.
      const draftWithRunId = {
        // ai_profile_draft is typed Json (string | number | boolean | null |
        // object | Json[]) from the generated Supabase types, not guaranteed
        // to be an object — but the not-null check above plus the schema
        // (jsonb default '{}') mean it always is one in practice; assertBrandProfile
        // below still validates the real shape before this is used further.
        ...(brand.ai_profile_draft as Record<string, unknown>),
        _workflow_run_id: runId,
      };
      const { error: runIdError } = await sb
        .from("brands")
        .update({
          ai_profile_draft: draftWithRunId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", brandId);
      if (runIdError) {
        throw await failAnalysis(brandId, "Failed to record workflow run on draft", runIdError.message);
      }

      try {
        assertBrandProfile(draftWithRunId);
        extractDraftScores(draftWithRunId);
      } catch (err) {
        throw await failAnalysis(brandId, "Draft failed Brand DNA validation", err);
      }

      const { data: draftHash, error: hashError } = await sb.rpc("get_brand_draft_hash", {
        p_brand_id: brandId,
      });
      if (hashError || !draftHash) {
        throw await failAnalysis(brandId, "Failed to compute draft hash", hashError?.message);
      }

      const { error: statusError } = await sb
        .from("brands")
        .update({ intake_status: "draft_ready", updated_at: new Date().toISOString() })
        .eq("id", brandId);
      if (statusError) {
        throw await failAnalysis(brandId, "Failed to mark draft ready", statusError.message);
      }

      return suspend({ brandId, draftHash }, { resumeLabel: "operator-review" });
    }

    const draftHash = suspendData?.draftHash;
    if (!draftHash) {
      throw new Error("Resume missing draft hash from suspend payload");
    }

    return { draftId: draftHash, brandId, approved: resumeData.approved };
  },
});

const commitOrReject = createStep({
  id: "commitOrReject",
  inputSchema: commitOrRejectInputSchema,
  outputSchema: commitOrRejectOutputSchema,
  execute: async ({ inputData }) => {
    const { brandId, approved } = inputData;
    const sb = await requireServiceRoleClient();

    const { data: brand, error: brandError } = await sb
      .from("brands")
      .select("approved_profile_at, intake_status, ai_profile_draft")
      .eq("id", brandId)
      .single();
    if (brandError || !brand) {
      throw new Error(`Brand state unavailable: ${boundDetail(brandError?.message)}`);
    }

    if (approved) {
      if (!brand.approved_profile_at || brand.intake_status !== "ready") {
        throw new Error("Approval recorded but brand is not in approved state");
      }
      return { status: "approved" };
    }

    if (brand.ai_profile_draft != null) {
      throw new Error("Rejection recorded but draft is still present");
    }
    return { status: "rejected" };
  },
});

export const brandIntelligenceWorkflow = createWorkflow({
  id: "brand-intelligence",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
  steps: [
    validateBrand,
    startCrawl,
    waitForCrawl,
    extractProfile,
    saveDraftAndWait,
    commitOrReject,
  ],
})
  .then(validateBrand)
  .then(startCrawl)
  .then(waitForCrawl)
  .then(extractProfile)
  .then(saveDraftAndWait)
  .then(commitOrReject)
  .commit();