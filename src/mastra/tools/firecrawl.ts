import { Firecrawl, type CrawlOptions } from "firecrawl";

const DEFAULT_CRAWL_LIMIT = 10;
const DEFAULT_DISCOVERY_DEPTH = 1;

export type BrandCrawlMetadata = Record<string, string>;

export type StartBrandSiteCrawlInput = {
  url: string;
  webhookUrl: string;
  metadata: BrandCrawlMetadata;
};

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
      url: input.webhookUrl,
      metadata: input.metadata,
      events: ["started", "page", "completed", "failed"],
    },
  };

  const { id } = await firecrawl.startCrawl(input.url, options);
  return { id };
}
