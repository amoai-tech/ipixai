import Firecrawl from "npm:firecrawl@4.41.0";

import { getOptionalSecret } from "./env.ts";
import type {
  FirecrawlCrawlStart,
  FirecrawlWebhookEvent,
} from "./firecrawl.ts";

const FIRECRAWL_START_TIMEOUT_MS = 30_000;

type FirecrawlStartClient = {
  startCrawl(
    url: string,
    options: {
      limit?: number;
      maxDiscoveryDepth?: number;
      scrapeOptions?: { formats?: ("markdown")[] };
      webhook?: {
        url: string;
        metadata?: Record<string, string>;
        events?: FirecrawlWebhookEvent[];
      };
    },
  ): Promise<{ id: string }>;
};

function requireFirecrawlApiKey(): string {
  const key = getOptionalSecret("FIRECRAWL_API_KEY");
  if (!key) throw new Error("FIRECRAWL_API_KEY is not configured");
  return key;
}

function firecrawlSdkApiUrl(): string {
  const configured = Deno.env.get("FIRECRAWL_API_URL")?.replace(/\/$/, "");
  return configured?.replace(/\/v2$/, "") ?? "https://api.firecrawl.dev";
}

function createFirecrawlStartClient(): FirecrawlStartClient {
  return new Firecrawl({
    apiKey: requireFirecrawlApiKey(),
    apiUrl: firecrawlSdkApiUrl(),
    timeoutMs: FIRECRAWL_START_TIMEOUT_MS,
  });
}

/** Official Firecrawl SDK boundary used only by the authorized crawl-start Edge function. */
export async function firecrawlStartCrawl(
  body: FirecrawlCrawlStart,
  client: FirecrawlStartClient = createFirecrawlStartClient(),
): Promise<{ id: string }> {
  const started = await client.startCrawl(body.url, {
    limit: body.limit ?? 50,
    maxDiscoveryDepth: body.maxDiscoveryDepth,
    scrapeOptions: { formats: body.formats ?? ["markdown"] },
    webhook: {
      url: body.webhook.url,
      metadata: body.webhook.metadata ?? {},
      events: body.webhook.events ?? ["started", "page", "completed", "failed"],
    },
  });

  if (!started?.id) throw new Error("Firecrawl crawl start returned no job id");
  return { id: started.id };
}
