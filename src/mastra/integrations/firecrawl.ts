import { Firecrawl, type CrawlOptions } from "firecrawl";

const DEFAULT_CRAWL_LIMIT = 10;
const DEFAULT_DISCOVERY_DEPTH = 1;

export type BrandCrawlMetadata = Record<string, string>;

export type StartBrandSiteCrawlInput = {
  url: string;
  metadata: BrandCrawlMetadata;
};

function requireFirecrawlWebhookUrl(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  const origin = new URL(supabaseUrl);
  if (
    origin.protocol !== "https:" &&
    origin.hostname !== "127.0.0.1" &&
    origin.hostname !== "localhost"
  ) {
    throw new Error("Supabase URL must use HTTPS outside local development");
  }
  return new URL("/functions/v1/firecrawl-webhook", origin).toString();
}

function requireFirecrawlApiKey(): string {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }
  return apiKey;
}
export async function startBrandSiteCrawl(
  input: StartBrandSiteCrawlInput,
): Promise<{ id: string }> {
  const firecrawl = new Firecrawl({ apiKey: requireFirecrawlApiKey() });

  const options: CrawlOptions = {
    limit: DEFAULT_CRAWL_LIMIT,
    maxDiscoveryDepth: DEFAULT_DISCOVERY_DEPTH,
    scrapeOptions: { formats: ["markdown"] },
    webhook: {
      url: requireFirecrawlWebhookUrl(),
      metadata: input.metadata,
      events: ["started", "page", "completed", "failed"],
    },
  };

  const { id } = await firecrawl.startCrawl(input.url, options);
  return { id };
}
