import { insertAgentLog } from "../_shared/agent-log.ts";
import { getOptionalSecret } from "../_shared/env.ts";
import {
  buildRawDataAggregate,
  firecrawlWebhookClaimId,
  parseCrawlWebhookEvent,
  pageUrlFromMetadata,
  verifyFirecrawlSignature,
  wordCountFromMarkdown,
  type FirecrawlPage,
  type FirecrawlWebhookPayload,
} from "../_shared/firecrawl.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-client.ts";

type AdminClient = ReturnType<typeof createServiceClient>;

type ClaimStatus = "processing" | "processed" | "failed";

type BeginClaimResult =
  | { outcome: "claimed"; claimKey: string }
  | { outcome: "duplicate" };

/** Stale processing lease — reclaim after crash / hung waitUntil. */
const CLAIM_STALE_MS = 10 * 60 * 1000;

/**
 * Update claim status. Never overwrite `processed` with `failed`
 * (finalize-after-success must not erase evidence on a later write race).
 */
async function setClaimStatus(
  admin: AdminClient,
  claimKey: string,
  status: ClaimStatus,
): Promise<void> {
  let q = admin
    .from("processed_firecrawl_webhooks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("webhook_id", claimKey);
  if (status === "failed") {
    q = q.neq("status", "processed");
  }
  const { error } = await q;
  if (error) throw new Error(`setClaimStatus(${status}): ${error.message}`);
}

/**
 * Begin a retryable claim (status=processing).
 * - processed → permanent duplicate (skip)
 * - failed → reclaim with CAS on observed status + updated_at
 * - processing + fresh → concurrent duplicate (skip)
 * - processing + stale → reclaim with CAS
 *
 * Returns the row's actual webhook_id so job+event unique conflicts
 * update the existing row, not the incoming synthetic id.
 */
async function beginTerminalClaim(
  admin: AdminClient,
  claimId: string,
  firecrawlJobId: string,
  eventType: string,
  crawlId: string,
): Promise<BeginClaimResult> {
  const now = new Date().toISOString();
  const { error } = await admin.from("processed_firecrawl_webhooks").insert({
    webhook_id: claimId,
    firecrawl_job_id: firecrawlJobId,
    event_type: eventType,
    crawl_id: crawlId,
    status: "processing",
    updated_at: now,
  });
  if (!error) return { outcome: "claimed", claimKey: claimId };
  if (error.code !== "23505") {
    throw new Error(`beginTerminalClaim: ${error.message}`);
  }

  const { data: byId, error: selErr } = await admin
    .from("processed_firecrawl_webhooks")
    .select("webhook_id, status, updated_at")
    .eq("webhook_id", claimId)
    .maybeSingle();
  if (selErr) throw new Error(`beginTerminalClaim select: ${selErr.message}`);

  let row = byId;
  if (!row) {
    const { data: byJob, error: jobErr } = await admin
      .from("processed_firecrawl_webhooks")
      .select("webhook_id, status, updated_at")
      .eq("firecrawl_job_id", firecrawlJobId)
      .eq("event_type", eventType)
      .maybeSingle();
    if (jobErr) throw new Error(`beginTerminalClaim select job: ${jobErr.message}`);
    row = byJob;
  }
  if (!row) throw new Error("beginTerminalClaim: unique conflict but row missing");

  if (row.status === "processed") return { outcome: "duplicate" };

  const updatedMs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  const stale = row.status === "processing" &&
    Date.now() - updatedMs > CLAIM_STALE_MS;
  if (row.status === "processing" && !stale) return { outcome: "duplicate" };

  // CAS reclaim: only the observer that still sees this status+lease wins.
  const { data: reclaimed, error: updErr } = await admin
    .from("processed_firecrawl_webhooks")
    .update({
      status: "processing",
      updated_at: now,
      crawl_id: crawlId,
    })
    .eq("webhook_id", row.webhook_id)
    .eq("status", row.status)
    .eq("updated_at", row.updated_at)
    .select("webhook_id")
    .maybeSingle();
  if (updErr) throw new Error(`beginTerminalClaim reclaim: ${updErr.message}`);
  if (!reclaimed) return { outcome: "duplicate" };
  return { outcome: "claimed", claimKey: row.webhook_id };
}

/** Run terminal work under a claim; only mark processed after full success. */
async function withTerminalClaim(
  admin: AdminClient,
  claimId: string,
  firecrawlJobId: string,
  eventType: string,
  crawlId: string,
  work: () => Promise<void>,
): Promise<"done" | "duplicate"> {
  const claim = await beginTerminalClaim(
    admin,
    claimId,
    firecrawlJobId,
    eventType,
    crawlId,
  );
  if (claim.outcome === "duplicate") return "duplicate";
  const claimKey = claim.claimKey;
  try {
    await work();
  } catch (err) {
    try {
      await setClaimStatus(admin, claimKey, "failed");
    } catch (markErr) {
      console.error("firecrawl-webhook: failed to mark claim failed", markErr);
    }
    throw err;
  }
  // work() succeeded — never mark failed if finalize throws (Sentry HIGH).
  try {
    await setClaimStatus(admin, claimKey, "processed");
  } catch (finalizeErr) {
    console.error(
      "firecrawl-webhook: finalize processed failed; leaving claim processing for retry",
      finalizeErr,
    );
    throw finalizeErr;
  }
  return "done";
}

/** Resume-route returns 500 when wait-for-crawl throws on failed:true — signal was delivered. */
function isExpectedFailedCrawlResume(status: number, body: string): boolean {
  return status === 500 && /Crawl failed/i.test(body);
}

async function requireWorkflowResumeConfig(workflowRunId: string): Promise<{
  appUrl: string;
  resumeSecret: string;
}> {
  const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? Deno.env.get("APP_URL");
  const resumeSecret = Deno.env.get("INTERNAL_WEBHOOK_SECRET");
  if (!appUrl || !resumeSecret) {
    throw new Error(
      `cannot resume workflow ${workflowRunId} — APP_URL or INTERNAL_WEBHOOK_SECRET not configured`,
    );
  }
  return { appUrl, resumeSecret };
}

function normalizeEventType(type: string): string {
  if (!type) return "";
  return type.startsWith("crawl.") ? type : `crawl.${type}`;
}

async function loadPagesForCrawl(
  admin: ReturnType<typeof createServiceClient>,
  crawlId: string,
) {
  const { data, error } = await admin
    .from("brand_crawl_results")
    .select("markdown, page_url, title, description, status_code, raw_json")
    .eq("crawl_id", crawlId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`loadPagesForCrawl: ${error.message}`);

  return (data ?? []).map((row) => ({
    markdown: row.markdown ?? "",
    metadata: {
      title: row.title ?? undefined,
      description: row.description ?? undefined,
      statusCode: row.status_code ?? undefined,
      url: row.page_url ?? undefined,
      ...(typeof row.raw_json === "object" && row.raw_json
        ? (row.raw_json as { metadata?: Record<string, unknown> }).metadata
        : {}),
    },
  })) as FirecrawlPage[];
}

async function rebuildJobRawData(
  admin: ReturnType<typeof createServiceClient>,
  crawlId: string,
) {
  const pages = await loadPagesForCrawl(admin, crawlId);
  const raw_data = buildRawDataAggregate(pages);
  const { error } = await admin
    .from("brand_crawls")
    .update({ raw_data, updated_at: new Date().toISOString() })
    .eq("id", crawlId);
  if (error) throw new Error(`rebuildJobRawData: ${error.message}`);
}

async function upsertPage(
  admin: ReturnType<typeof createServiceClient>,
  crawlId: string,
  brandId: string,
  page: FirecrawlPage,
) {
  const meta = page.metadata;
  const pageUrl = pageUrlFromMetadata(meta);
  if (!pageUrl) return;

  const markdown = page.markdown ?? "";
  const scrapeId = meta?.scrapeId ?? null;

  const row = {
    brand_id: brandId,
    crawl_id: crawlId,
    page_url: pageUrl,
    title: meta?.title ?? null,
    description: meta?.description ?? null,
    status_code: meta?.statusCode ?? null,
    word_count: wordCountFromMarkdown(markdown),
    page_depth: meta?.depth ?? 0,
    markdown,
    raw_json: page,
    firecrawl_scrape_id: scrapeId,
  };

  const onConflict = scrapeId
    ? "crawl_id,firecrawl_scrape_id"
    : "crawl_id,page_url";

  const { error } = await admin
    .from("brand_crawl_results")
    .upsert(row, { onConflict });

  if (error) throw new Error(`upsertPage: ${error.message}`);
}

/** HTTP handler — exported for Deno unit tests (IPI-686). */
export async function handleFirecrawlWebhook(req: Request): Promise<Response> {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("method_not_allowed", "Use POST", 405);
  }

  const secret = getOptionalSecret("FIRECRAWL_WEBHOOK_SECRET");
  if (!secret) {
    console.error("FIRECRAWL_WEBHOOK_SECRET not configured");
    return errorResponse("config_error", "Webhook not configured", 503);
  }

  const rawBody = await req.text();
  const signature = req.headers.get("X-Firecrawl-Signature");

  const valid = await verifyFirecrawlSignature(rawBody, signature, secret);
  if (!valid) {
    return errorResponse("unauthorized", "Invalid webhook signature", 401);
  }

  let payload: FirecrawlWebhookPayload;
  try {
    payload = parseCrawlWebhookEvent(JSON.parse(rawBody));
  } catch {
    return errorResponse("invalid_request", "Invalid JSON body", 400);
  }

  const firecrawlJobId = payload.id;
  if (!firecrawlJobId) {
    return jsonResponse({ received: true, ignored: true });
  }

  const admin = createServiceClient();
  const meta = payload.metadata ?? {};

  let crawlId = meta.crawl_id;
  let brandId = meta.brand_id;

  const { data: job } = await admin
    .from("brand_crawls")
    .select("id, brand_id, started_at, started_by, workflow_id")
    .eq("firecrawl_job_id", firecrawlJobId)
    .maybeSingle();

  if (job) {
    crawlId = job.id;
    brandId = job.brand_id;
  }

  if (!crawlId || !brandId) {
    console.warn("firecrawl-webhook: missing crawl mapping", firecrawlJobId);
    return jsonResponse({ received: true, ignored: true });
  }

  const eventType = normalizeEventType(payload.type ?? "");
  const now = new Date().toISOString();

  const logWebhook = async (
    output: Record<string, unknown>,
    durationMs?: number | null,
  ) => {
    if (!job?.started_by) return;
    try {
      await insertAgentLog(admin, {
        agentName: "firecrawl-webhook",
        userId: job.started_by,
        brandId,
        input: { eventType, firecrawlJobId, crawlId },
        output,
        durationMs: durationMs ?? null,
      });
    } catch (logErr) {
      console.warn("firecrawl-webhook: agent log insert failed", logErr);
    }
  };

  const process = async () => {
    if (eventType === "crawl.started") {
      const { error } = await admin
        .from("brand_crawls")
        .update({
          job_status: "running",
          pages_found: payload.data?.length ?? 0,
          updated_at: now,
        })
        .eq("id", crawlId);
      if (error) throw new Error(`crawl.started update: ${error.message}`);
      return;
    }

    if (eventType === "crawl.page" && payload.data?.length) {
      for (const page of payload.data) {
        await upsertPage(admin, crawlId, brandId, page);
      }

      const { count, error: countErr } = await admin
        .from("brand_crawl_results")
        .select("id", { count: "exact", head: true })
        .eq("crawl_id", crawlId);
      if (countErr) throw new Error(`crawl.page count: ${countErr.message}`);

      const { error: updateErr } = await admin
        .from("brand_crawls")
        .update({
          pages_crawled: count ?? payload.data.length,
          job_status: "running",
          updated_at: now,
        })
        .eq("id", crawlId);
      if (updateErr) throw new Error(`crawl.page update: ${updateErr.message}`);

      await rebuildJobRawData(admin, crawlId);
      return;
    }

    if (eventType === "crawl.completed") {
      // IPI-692: processing lease → work → processed only after resume succeeds.
      const claimId = firecrawlWebhookClaimId(payload, eventType);
      if (!claimId) {
        throw new Error("crawl.completed: missing webhook claim id");
      }
      const outcome = await withTerminalClaim(
        admin,
        claimId,
        firecrawlJobId,
        eventType,
        crawlId,
        async () => {
          if (payload.data?.length) {
            for (const page of payload.data) {
              await upsertPage(admin, crawlId, brandId, page);
            }
          }

          const startedAt = job?.started_at
            ? new Date(job.started_at).getTime()
            : null;
          const duration_ms = startedAt
            ? Math.max(0, Date.now() - startedAt)
            : null;

          const pages = await loadPagesForCrawl(admin, crawlId);
          const raw_data = buildRawDataAggregate(pages);

          const { error: jobUpdateErr } = await admin
            .from("brand_crawls")
            .update({
              job_status: "complete",
              pipeline_state: "crawl_only",
              pages_crawled: pages.length,
              duration_ms,
              raw_payload: payload,
              raw_data,
              completed_at: now,
              updated_at: now,
            })
            .eq("id", crawlId);
          if (jobUpdateErr) {
            throw new Error(`crawl.completed job update: ${jobUpdateErr.message}`);
          }

          const { error: brandUpdateErr } = await admin
            .from("brands")
            .update({ intake_status: "crawl_complete" })
            .eq("id", brandId);
          if (brandUpdateErr) {
            throw new Error(`crawl.completed brand update: ${brandUpdateErr.message}`);
          }

          await logWebhook(
            { job_status: "complete", pages_crawled: pages.length, webhookClaimId: claimId },
            duration_ms,
          );

          // IPI-32: resume Mastra brand-intelligence workflow if one is waiting.
          // Only use the DB-persisted workflow_id — never fall back to payload data.
          const workflowRunId = job?.workflow_id;
          if (workflowRunId) {
            const { appUrl, resumeSecret } = await requireWorkflowResumeConfig(
              workflowRunId,
            );
            const res = await fetch(
              `${appUrl}/api/workflows/brand-intelligence/resume`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Internal-Secret": resumeSecret,
                },
                body: JSON.stringify({ runId: workflowRunId, crawlId }),
              },
            );
            if (!res.ok) {
              const msg = await res.text().catch(() => res.statusText);
              throw new Error(`workflow resume ${res.status}: ${msg}`);
            }
          }
        },
      );
      if (outcome === "duplicate") {
        console.info("firecrawl-webhook: duplicate crawl.completed ignored", claimId);
      }
      return;
    }

    if (eventType === "crawl.failed" || payload.success === false) {
      const failedEventType = eventType === "crawl.failed" ? eventType : "crawl.failed";
      const claimId = firecrawlWebhookClaimId(payload, failedEventType);
      if (!claimId) {
        throw new Error("crawl.failed: missing webhook claim id");
      }
      const outcome = await withTerminalClaim(
        admin,
        claimId,
        firecrawlJobId,
        failedEventType,
        crawlId,
        async () => {
          const errorMessage =
            payload.error ?? "Firecrawl reported crawl failure";

          const { error: jobFailErr } = await admin
            .from("brand_crawls")
            .update({
              job_status: "failed",
              raw_payload: { ...payload, error: errorMessage },
              completed_at: now,
              updated_at: now,
            })
            .eq("id", crawlId);
          if (jobFailErr) throw new Error(`crawl.failed job update: ${jobFailErr.message}`);

          const { error: brandFailErr } = await admin
            .from("brands")
            .update({ intake_status: "failed" })
            .eq("id", brandId);
          if (brandFailErr) {
            throw new Error(`crawl.failed brand update: ${brandFailErr.message}`);
          }

          await logWebhook({
            job_status: "failed",
            error: errorMessage,
            webhookClaimId: claimId,
          });

          // Resume workflow with failure signal so it doesn't stay permanently suspended.
          // wait-for-crawl throws on failed:true → resume route often returns 500; that
          // still means the fail signal was delivered (do not leave claim failed forever).
          const failWorkflowRunId = job?.workflow_id;
          if (failWorkflowRunId) {
            const { appUrl, resumeSecret } = await requireWorkflowResumeConfig(
              failWorkflowRunId,
            );
            const res = await fetch(
              `${appUrl}/api/workflows/brand-intelligence/resume`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Internal-Secret": resumeSecret,
                },
                body: JSON.stringify({
                  runId: failWorkflowRunId,
                  crawlId,
                  failed: true,
                  error: errorMessage,
                }),
              },
            );
            if (!res.ok) {
              const msg = await res.text().catch(() => res.statusText);
              if (!isExpectedFailedCrawlResume(res.status, msg)) {
                throw new Error(`workflow fail-resume ${res.status}: ${msg}`);
              }
            }
          }
        },
      );
      if (outcome === "duplicate") {
        console.info("firecrawl-webhook: duplicate crawl.failed ignored", claimId);
      }
    }
  };

  // Terminal events must await work so Firecrawl can retry on non-2xx.
  // Non-terminal (started/page) may use waitUntil for snappy ack.
  const isTerminal = eventType === "crawl.completed" ||
    eventType === "crawl.failed" ||
    payload.success === false;

  const runtime = (globalThis as {
    EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
  }).EdgeRuntime;

  if (!isTerminal && runtime?.waitUntil) {
    runtime.waitUntil(
      process().catch((e) => console.error("webhook process:", e)),
    );
    return jsonResponse({ received: true });
  }

  try {
    await process();
    return jsonResponse({ received: true });
  } catch (e) {
    console.error("webhook process:", e);
    return errorResponse(
      "process_failed",
      e instanceof Error ? e.message : "Webhook processing failed",
      500,
    );
  }
}
