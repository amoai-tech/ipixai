import { insertAgentLog } from "../_shared/agent-log.ts";
import { normalizeBrandUrl } from "../_shared/brand-url.ts";
import { handleCors } from "../_shared/cors.ts";
import { getOptionalSecret } from "../_shared/env.ts";
import { firecrawlStartCrawl } from "../_shared/firecrawl.ts";
import {
  errorResponse,
  jsonResponse,
  safeErrorMessage,
} from "../_shared/response.ts";
import { isCallerFailure, resolveCaller } from "../_shared/resolve-caller.ts";
import { createServiceClient } from "../_shared/supabase-client.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const CRAWL_LIMIT = 10;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StartBody = {
  brandId?: string;
  url?: string;
  websiteUrl?: string;
  idempotencyKey?: string;
  workflowId?: string;
  requestId?: string;
  /** Required — this is a service-role-only, internal endpoint (IPI-817 / IPI-1093 #3). */
  actorId?: string;
};

type BrandRow = {
  id: string;
  brand_url: string | null;
  org_id: string | null;
  user_id: string | null;
};

const ACTIVE_CRAWL_STATUSES = ["queued", "running", "complete"] as const;

async function findActiveCrawl(
  admin: ReturnType<typeof createServiceClient>,
  brandId: string,
  idempotencyKey: string,
) {
  const { data, error } = await admin
    .from("brand_crawls")
    .select("id, firecrawl_job_id, job_status")
    .eq("brand_id", brandId)
    .eq("idempotency_key", idempotencyKey)
    .in("job_status", [...ACTIVE_CRAWL_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Service-role callers bypass RLS — authorize the explicit actorId the same way
 * validate-brand does (org owner/editor, or personal-brand owner).
 */
async function authorizeActorForBrand(
  admin: SupabaseClient,
  brandId: string,
  actorId: string,
): Promise<{ brand: BrandRow } | { response: Response }> {
  const { data: brand, error: brandErr } = await admin
    .from("brands")
    .select("id, brand_url, org_id, user_id")
    .eq("id", brandId)
    .maybeSingle();

  if (brandErr) throw new Error(brandErr.message);
  if (!brand) {
    return {
      response: errorResponse("not_found", "Brand not found or access denied", 404),
    };
  }

  if (brand.org_id) {
    const { data: member, error: memberErr } = await admin
      .from("org_members")
      .select("role")
      .eq("org_id", brand.org_id)
      .eq("user_id", actorId)
      .maybeSingle();
    if (memberErr) throw new Error(memberErr.message);
    if (!member || !["owner", "editor"].includes(member.role as string)) {
      return {
        response: errorResponse(
          "forbidden",
          "Not authorized to start a crawl for this brand",
          403,
        ),
      };
    }
  } else if (brand.user_id !== actorId) {
    return {
      response: errorResponse(
        "forbidden",
        "Not authorized to start a crawl for this brand",
        403,
      ),
    };
  }

  return { brand: brand as BrandRow };
}

/** HTTP handler — exported for Deno unit tests (IPI-686 / IPI-817). */
export async function handleStartBrandCrawl(req: Request): Promise<Response> {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("method_not_allowed", "Use POST", 405);
  }

  if (!getOptionalSecret("FIRECRAWL_API_KEY")) {
    return errorResponse("config_error", "Firecrawl is not configured", 503);
  }

  try {
    // Service-role + body.actorId (trusted workflow) only — see the blocker
    // #3 comment below. resolveCaller still accepts a user JWT here so this
    // check can reject it with a clear 403 instead of resolveCaller's own
    // generic auth-failure response.
    const caller = await resolveCaller(req);
    if (isCallerFailure(caller)) return caller.response;

    let body: StartBody;
    try {
      body = (await req.json()) as StartBody;
    } catch {
      return errorResponse("invalid_request", "Invalid JSON body", 400);
    }
    const brandId = body.brandId?.trim();

    if (!brandId) {
      return errorResponse("invalid_request", "brandId is required", 400);
    }

    // IPI-949 · ONB2-INT-001h — shared brand-URL SSOT (IPI-920): only the
    // canonical public origin is stored/crawled; anything else is a typed 422
    // and never reaches brand_crawls.source_url.
    const rawUrl = body.url ?? body.websiteUrl ?? "";
    const sourceUrl = typeof rawUrl === "string"
      ? normalizeBrandUrl(rawUrl)
      : null;
    if (sourceUrl === null) {
      return errorResponse(
        "validation_error",
        "A valid public http(s) url is required",
        422,
      );
    }

    // IPI-1093 · BRAND-INTEL-001 blocker #3 — internal/service-to-service
    // only. The former user-JWT branch here relied on brands_select_org
    // (any org member, including a viewer) for "authorization" — no
    // owner/editor check at all — so any org member with a valid session
    // could start a crawl directly, bypassing the real owner/editor check
    // in the Mastra workflow's validateBrand step. Mastra is now the sole
    // operator-authorization boundary: only the service-role credential
    // (held server-side by the workflow, never the browser), with an
    // explicit already-authorized actorId, may call this endpoint.
    if (caller.userId !== null) {
      return errorResponse(
        "forbidden",
        "This endpoint is internal — start analysis through the operator app",
        403,
      );
    }

    const admin = createServiceClient();

    const actorId = body.actorId?.trim();
    if (!actorId || !UUID_RE.test(actorId)) {
      return errorResponse(
        "invalid_request",
        "actorId must be a valid UUID when using the service-role credential",
        400,
      );
    }
    const authz = await authorizeActorForBrand(admin, brandId, actorId);
    if ("response" in authz) return authz.response;
    const startedBy: string = actorId;

    const idempotencyKey =
      body.idempotencyKey?.trim() ||
      `onboarding-${brandId}-${sourceUrl}`;

    const existing = await findActiveCrawl(admin, brandId, idempotencyKey);

    if (
      existing &&
      (existing.job_status === "running" ||
        existing.job_status === "complete" ||
        existing.firecrawl_job_id)
    ) {
      return jsonResponse({
        crawlId: existing.id,
        firecrawlJobId: existing.firecrawl_job_id,
        reused: true,
      });
    }

    const requestId =
      body.requestId?.trim() ||
      crypto.randomUUID();

    let crawlRowId: string;

    if (existing?.job_status === "queued" && !existing.firecrawl_job_id) {
      crawlRowId = existing.id;
      const { error: resetErr } = await admin
        .from("brand_crawls")
        .update({
          source_url: sourceUrl,
          request_id: requestId,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", crawlRowId);
      if (resetErr) throw new Error(resetErr.message);
    } else {
      const { data: crawlRow, error: insertErr } = await admin
        .from("brand_crawls")
        .insert({
          brand_id: brandId,
          source_url: sourceUrl,
          job_status: "queued",
          pipeline_state: "crawl_only",
          idempotency_key: idempotencyKey,
          // Never the service-role UUID — always the verified operator (IPI-817).
          started_by: startedBy,
          workflow_id: body.workflowId?.trim() || null,
          request_id: requestId,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertErr || !crawlRow?.id) {
        if (insertErr?.code === "23505") {
          const dup = await findActiveCrawl(admin, brandId, idempotencyKey);
          if (dup) {
            return jsonResponse({
              crawlId: dup.id,
              firecrawlJobId: dup.firecrawl_job_id,
              reused: true,
            });
          }
        }
        throw new Error(insertErr?.message ?? "Failed to create crawl job");
      }
      crawlRowId = crawlRow.id;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL missing");

    const webhookUrl = `${supabaseUrl}/functions/v1/firecrawl-webhook`;

    let firecrawlJobId: string;
    try {
      ({ id: firecrawlJobId } = await firecrawlStartCrawl({
        url: sourceUrl,
        limit: CRAWL_LIMIT,
        maxDiscoveryDepth: 1,
        formats: ["markdown"],
        webhook: {
          url: webhookUrl,
          metadata: {
            brand_id: brandId,
            crawl_id: crawlRowId,
            request_id: requestId,
            ...(body.workflowId ? { workflow_id: body.workflowId } : {}),
          },
          events: ["started", "page", "completed", "failed"],
        },
      }));
    } catch (firecrawlErr) {
      const message = safeErrorMessage(firecrawlErr);
      const failedAt = new Date().toISOString();
      await admin
        .from("brand_crawls")
        .update({
          job_status: "failed",
          raw_payload: { error: message },
          completed_at: failedAt,
          updated_at: failedAt,
        })
        .eq("id", crawlRowId);
      await admin
        .from("brands")
        .update({ intake_status: "failed" })
        .eq("id", brandId);
      throw firecrawlErr;
    }

    const { error: updateErr } = await admin
      .from("brand_crawls")
      .update({
        firecrawl_job_id: firecrawlJobId,
        job_status: "running",
        updated_at: new Date().toISOString(),
      })
      .eq("id", crawlRowId);

    if (updateErr) throw new Error(updateErr.message);

    await admin
      .from("brands")
      .update({ intake_status: "crawl_running" })
      .eq("id", brandId);

    try {
      await insertAgentLog(admin, {
        agentName: "start-brand-crawl",
        userId: startedBy,
        brandId,
        input: { sourceUrl, idempotencyKey, requestId },
        output: { crawlId: crawlRowId, firecrawlJobId },
      });
    } catch (logErr) {
      console.warn("start-brand-crawl: agent log insert failed", logErr);
    }

    return jsonResponse({
      crawlId: crawlRowId,
      firecrawlJobId,
      requestId,
      reused: false,
    });
  } catch (err) {
    console.error("start-brand-crawl error:", err);
    return errorResponse("internal_error", safeErrorMessage(err), 500);
  }
}
