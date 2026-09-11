import { getOptionalSecret } from "./env.ts";

const FIRECRAWL_BASE =
  Deno.env.get("FIRECRAWL_API_URL")?.replace(/\/$/, "") ??
  "https://api.firecrawl.dev/v2";

export type FirecrawlWebhookEvent = "started" | "page" | "completed" | "failed";

export type FirecrawlCrawlStart = {
  url: string;
  limit?: number;
  maxDiscoveryDepth?: number;
  formats?: ("markdown")[];
  webhook: {
    url: string;
    metadata?: Record<string, string>;
    events?: FirecrawlWebhookEvent[];
  };
};

export type FirecrawlPageMetadata = {
  title?: string;
  description?: string;
  statusCode?: number;
  url?: string;
  sourceURL?: string;
  scrapeId?: string;
  depth?: number;
};

export type FirecrawlPage = {
  markdown?: string;
  metadata?: FirecrawlPageMetadata;
};

export type FirecrawlWebhookPayload = {
  success?: boolean;
  type?: string;
  id?: string;
  /** Stable delivery id reused on Firecrawl retries (when present). */
  webhookId?: string;
  status?: string;
  data?: FirecrawlPage[];
  metadata?: Record<string, string>;
  error?: string;
};

/**
 * Dedupe key for terminal crawl events.
 * Prefer Firecrawl `webhookId` (stable across retries); fall back to job+event
 * when crawl payloads omit webhookId (common in current crawl.completed docs).
 */
export function firecrawlWebhookClaimId(
  payload: Pick<FirecrawlWebhookPayload, "webhookId" | "id" | "type">,
  eventType: string,
): string | null {
  const fromWebhook = typeof payload.webhookId === "string"
    ? payload.webhookId.trim()
    : "";
  if (fromWebhook) return fromWebhook;
  const jobId = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!jobId || !eventType) return null;
  return `fc:${jobId}:${eventType}`;
}

function requireApiKey(): string {
  const key = getOptionalSecret("FIRECRAWL_API_KEY");
  if (!key) throw new Error("FIRECRAWL_API_KEY is not configured");
  return key;
}

async function firecrawlFetch(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const res = await fetch(`${FIRECRAWL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return res;
}

export async function firecrawlStartCrawl(
  body: FirecrawlCrawlStart,
): Promise<{ id: string }> {
  const payload = {
    url: body.url,
    limit: body.limit ?? 50,
    maxDiscoveryDepth: body.maxDiscoveryDepth,
    scrapeOptions: {
      formats: body.formats ?? ["markdown"],
    },
    webhook: {
      url: body.webhook.url,
      metadata: body.webhook.metadata ?? {},
      events: body.webhook.events ?? ["started", "page", "completed", "failed"],
    },
  };

  const res = await firecrawlFetch("/crawl", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json: { success?: boolean; id?: string; error?: string } | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok || !json?.success || !json.id) {
    throw new Error(
      json?.error ?? `Firecrawl crawl start failed (${res.status})`,
    );
  }

  return { id: json.id };
}

export async function firecrawlScrape(url: string): Promise<unknown> {
  const res = await firecrawlFetch("/scrape", {
    method: "POST",
    body: JSON.stringify({
      url,
      formats: ["markdown"],
    }),
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const err =
      typeof json === "object" && json && "error" in json
        ? String((json as { error: string }).error)
        : `Firecrawl scrape failed (${res.status})`;
    throw new Error(err);
  }

  return json;
}

function hexFromBuffer(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export async function verifyFirecrawlSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const expectedHex = header.slice(7).toLowerCase();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const actualHex = hexFromBuffer(sig);
  return timingSafeEqual(actualHex, expectedHex);
}

export function parseCrawlWebhookEvent(
  event: unknown,
): FirecrawlWebhookPayload {
  if (!event || typeof event !== "object") {
    return {};
  }
  return event as FirecrawlWebhookPayload;
}

export function wordCountFromMarkdown(md: string): number {
  const trimmed = md.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function pageUrlFromMetadata(meta?: FirecrawlPageMetadata): string | null {
  if (!meta) return null;
  return meta.url ?? meta.sourceURL ?? null;
}

/** Legacy aggregate shape for IPI-25 backward compat. */
export function buildRawDataAggregate(
  pages: Array<{ markdown?: string; metadata?: FirecrawlPageMetadata }>,
): { pages: Array<{ markdown: string; metadata: Record<string, unknown> }> } {
  return {
    pages: pages.map((p) => ({
      markdown: p.markdown ?? "",
      metadata: (p.metadata ?? {}) as Record<string, unknown>,
    })),
  };
}
