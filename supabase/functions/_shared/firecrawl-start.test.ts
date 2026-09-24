import { firecrawlStartCrawl } from "./firecrawl-start.ts";

Deno.test("firecrawlStartCrawl delegates crawl initiation to the SDK client", async () => {
  let receivedUrl = "";
  let receivedOptions: Record<string, unknown> | undefined;
  const sdk = {
    async startCrawl(url: string, options: Record<string, unknown>) {
      receivedUrl = url;
      receivedOptions = options;
      return {
        id: "fc-sdk-job",
        url: "https://api.firecrawl.dev/v2/crawl/fc-sdk-job",
      };
    },
  };

  const result = await firecrawlStartCrawl({
    url: "https://brand.example",
    limit: 7,
    maxDiscoveryDepth: 1,
    formats: ["markdown"],
    webhook: {
      url: "https://example.supabase.co/functions/v1/firecrawl-webhook",
      metadata: { crawl_id: "crawl-1" },
      events: ["started", "page", "completed", "failed"],
    },
  }, sdk);

  if (result.id !== "fc-sdk-job" || receivedUrl !== "https://brand.example") {
    throw new Error("official SDK crawl result was not propagated");
  }
  const expectedOptions = {
    limit: 7,
    maxDiscoveryDepth: 1,
    scrapeOptions: { formats: ["markdown"] },
    webhook: {
      url: "https://example.supabase.co/functions/v1/firecrawl-webhook",
      metadata: { crawl_id: "crawl-1" },
      events: ["started", "page", "completed", "failed"],
    },
  };

  if (JSON.stringify(receivedOptions) !== JSON.stringify(expectedOptions)) {
    throw new Error(`SDK crawl options changed: ${JSON.stringify(receivedOptions)}`);
  }
});

Deno.test("firecrawlStartCrawl fails closed when the SDK returns no job id", async () => {
  const sdk = {
    async startCrawl() {
      return { id: "" };
    },
  };

  let message = "";
  try {
    await firecrawlStartCrawl({
      url: "https://brand.example",
      webhook: { url: "https://example.supabase.co/functions/v1/firecrawl-webhook" },
    }, sdk);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  if (!/no job id/i.test(message)) {
    throw new Error(`expected missing-job-id failure, got: ${message}`);
  }
});

Deno.test("firecrawlStartCrawl propagates SDK failures to the handler cleanup boundary", async () => {
  const sdk = {
    async startCrawl() {
      throw new Error("provider unavailable");
    },
  };

  let message = "";
  try {
    await firecrawlStartCrawl({
      url: "https://brand.example",
      webhook: { url: "https://example.supabase.co/functions/v1/firecrawl-webhook" },
    }, sdk);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  if (message !== "provider unavailable") {
    throw new Error(`expected provider failure to propagate, got: ${message}`);
  }
});
