import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  commitOrReject,
  extractProfile,
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
    const { url, key } = requireEdgeCredentials();
    const res = await fetch(`${url}/functions/v1/start-brand-crawl`, {
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
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      data?: { crawlId?: string; firecrawlJobId?: string };
      error?: { message?: string };
    } | null;

    if (!res.ok || !body?.ok) {
      throw new Error(
        body?.error?.message ?? `start-brand-crawl failed (${res.status})`,
      );
    }

    const crawlId = body.data?.crawlId;
    const firecrawlJobId = body.data?.firecrawlJobId;
    if (!crawlId || !firecrawlJobId) {
      throw new Error("start-brand-crawl response missing durable crawl identity");
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
    if (!resumeData) {
      return suspend(
        {
          crawlId: inputData.crawlId,
          firecrawlJobId: inputData.firecrawlJobId,
        },
        { resumeLabel: "crawl-complete" },
      );
    }

    if (resumeData.failed) {
      throw new Error(resumeData.error || "Firecrawl crawl failed");
    }
    if (!resumeData.crawlId || resumeData.crawlId !== inputData.crawlId) {
      throw new Error("Crawl ID mismatch");
    }

    const admin = requireAdmin();
    const { data: crawl, error } = await admin
      .from("brand_crawls")
      .select("brand_id, firecrawl_job_id, job_status, workflow_id")
      .eq("id", inputData.crawlId)
      .single();

    if (error || !crawl) {
      throw new Error("Durable crawl row unavailable on resume");
    }
    if (crawl.brand_id !== inputData.brandId) {
      throw new Error("Durable crawl brand mismatch");
    }
    if (crawl.workflow_id !== runId) {
      throw new Error("Durable crawl workflow mismatch");
    }
    if (crawl.firecrawl_job_id !== inputData.firecrawlJobId) {
      throw new Error("Firecrawl job mismatch");
    }
    if (crawl.job_status !== "complete") {
      throw new Error(`Durable crawl is not complete (${crawl.job_status})`);
    }

    return inputData;
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