import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  commitOrReject,
  extractProfile,
  failAnalysis,
  saveDraftAndWait,
  validateBrand,
} from "@/mastra/workflows/brand-intelligence";

const workflowInputSchema = z.object({
  brandId: z.string().uuid(),
  actorId: z.string().uuid(),
});

const startDurableInputSchema = z.object({
  brandId: z.string().uuid(),
  brandUrl: z.string().url(),
  brandName: z.string(),
  actorId: z.string().uuid(),
});

const workflowOutputSchema = z.object({ status: z.string() });
const crawlIdentitySchema = z.object({
  brandId: z.string().uuid(),
  crawlId: z.string().uuid(),
  firecrawlJobId: z.string().min(1),
});

const waitResumeSchema = z.object({
  crawlId: z.string().uuid().optional(),
  failed: z.boolean().optional(),
  error: z.string().optional(),
});

const waitSuspendSchema = z.object({
  crawlId: z.string().uuid(),
  firecrawlJobId: z.string().min(1),
});

function requireEdgeCredentials(): { url: string; key: string } {
  const config = getPublicSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config?.url || !key) {
    throw new Error("Service-role credentials unavailable");
  }
  return { url: config.url, key };
}
function requireAdmin() {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("Service-role client unavailable");
  return admin;
}

const startDurableCrawl = createStep({
  id: "startDurableCrawl",
  inputSchema: startDurableInputSchema,
  outputSchema: crawlIdentitySchema,
  execute: async ({ inputData, runId }) => {
    let res: Response;
    try {
      const { url, key } = requireEdgeCredentials();
      res = await fetch(`${url}/functions/v1/start-brand-crawl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
        },
        body: JSON.stringify({
          brandId: inputData.brandId,
          url: inputData.brandUrl,
          actorId: inputData.actorId,
          workflowId: runId,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      throw await failAnalysis(inputData.brandId, "Failed to start brand crawl", err);
    }

    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      data?: { crawlId?: string; firecrawlJobId?: string };
      error?: { message?: string };
    } | null;

    if (!res.ok || !body?.ok) {
      throw await failAnalysis(
        inputData.brandId,
        "Failed to start brand crawl",
        body?.error?.message ?? `HTTP ${res.status}`,
      );
    }

    const crawlId = body.data?.crawlId;
    const firecrawlJobId = body.data?.firecrawlJobId;
    if (!crawlId || !firecrawlJobId) {
      throw await failAnalysis(
        inputData.brandId,
        "Crawl start response missing durable crawl identity",
        body,
      );
    }

    return { brandId: inputData.brandId, crawlId, firecrawlJobId };
  },
});

const waitForCrawl = createStep({
  id: "waitForCrawl",
  inputSchema: crawlIdentitySchema,
  outputSchema: crawlIdentitySchema,
  resumeSchema: waitResumeSchema,
  suspendSchema: waitSuspendSchema,
  execute: async ({ inputData, resumeData, suspend, runId }) => {
    if (resumeData?.failed) {
      throw await failAnalysis(
        inputData.brandId,
        "Crawl failed",
        resumeData.error || "Firecrawl crawl failed",
      );
    }
    if (resumeData && (!resumeData.crawlId || resumeData.crawlId !== inputData.crawlId)) {
      throw await failAnalysis(inputData.brandId, "Crawl ID mismatch", resumeData.crawlId);
    }

    const admin = requireAdmin();
    const { data: crawl, error } = await admin
      .from("brand_crawls")
      .select("brand_id, firecrawl_job_id, job_status, workflow_id")
      .eq("id", inputData.crawlId)
      .single();

    if (error || !crawl) {
      throw await failAnalysis(inputData.brandId, "Durable crawl row unavailable", error?.message);
    }
    if (crawl.brand_id !== inputData.brandId) {
      throw await failAnalysis(inputData.brandId, "Durable crawl brand mismatch", crawl.brand_id);
    }
    if (crawl.firecrawl_job_id !== inputData.firecrawlJobId) {
      throw await failAnalysis(inputData.brandId, "Firecrawl job mismatch", crawl.firecrawl_job_id);
    }

    // A completed durable crawl is reusable evidence. Its workflow_id may belong
    // to the earlier run that originally produced it, so do not wait for a webhook
    // that has already been processed and do not require rebinding that old row.
    if (crawl.job_status === "complete") {
      return inputData;
    }

    // Only a non-terminal crawl owned by this exact run may suspend awaiting its
    // provider webhook. Never let a new run wait on another run's active crawl.
    if (crawl.workflow_id !== runId) {
      throw await failAnalysis(inputData.brandId, "Durable crawl belongs to another workflow", crawl.workflow_id);
    }

    if (resumeData) {
      throw await failAnalysis(
        inputData.brandId,
        `Durable crawl is not complete (${crawl.job_status})`,
        inputData.crawlId,
      );
    }

    return suspend(
      {
        crawlId: inputData.crawlId,
        firecrawlJobId: inputData.firecrawlJobId,
      },
      { resumeLabel: "crawl-complete" },
    );
  },
});

export const officialBrandIntelligenceGoldenPathWorkflow = createWorkflow({
  id: "brand-intelligence-v2-golden",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
  steps: [
    validateBrand,
    startDurableCrawl,
    waitForCrawl,
    extractProfile,
    saveDraftAndWait,
    commitOrReject,
  ],
})
  .then(validateBrand)
  .then(startDurableCrawl)
  .then(waitForCrawl)
  .then(extractProfile)
  .then(saveDraftAndWait)
  .then(commitOrReject)
  .commit();