import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  startCrawl: vi.fn(),
}));

vi.mock("firecrawl", () => ({
  Firecrawl: class {
    constructor(options: unknown) {
      mocks.constructor(options);
    }

    startCrawl = mocks.startCrawl;
  },
}));
import { startBrandSiteCrawl } from "@/mastra/tools/firecrawl";

const WEBHOOK = "https://example.supabase.co/functions/v1/firecrawl-webhook";

beforeEach(() => {
  vi.stubEnv("FIRECRAWL_API_KEY", "fc-test-key");
  mocks.constructor.mockClear();
  mocks.startCrawl.mockReset();
  mocks.startCrawl.mockResolvedValue({ id: "fc-job-123", url: "https://brand.example" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("official Firecrawl SDK Brand crawl", () => {
  it("starts the bounded async crawl with webhook correlation metadata", async () => {
    const result = await startBrandSiteCrawl({
      url: "https://brand.example",
      webhookUrl: WEBHOOK,
      metadata: {
        brand_id: "11111111-1111-4111-8111-111111111111",
        crawl_id: "22222222-2222-4222-8222-222222222222",
        workflow_id: "run-123",
      },
    });
    expect(mocks.constructor).toHaveBeenCalledWith({ apiKey: "fc-test-key" });
    expect(mocks.startCrawl).toHaveBeenCalledWith("https://brand.example", {
      limit: 10,
      maxDiscoveryDepth: 1,
      scrapeOptions: { formats: ["markdown"] },
      webhook: {
        url: WEBHOOK,
        metadata: {
          brand_id: "11111111-1111-4111-8111-111111111111",
          crawl_id: "22222222-2222-4222-8222-222222222222",
          workflow_id: "run-123",
        },
        events: ["started", "page", "completed", "failed"],
      },
    });
    expect(result).toEqual({ id: "fc-job-123" });
  });

  it("fails closed when the server-side Firecrawl key is missing", async () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "");

    await expect(
      startBrandSiteCrawl({ url: "https://brand.example", webhookUrl: WEBHOOK, metadata: {} }),
    ).rejects.toThrow("FIRECRAWL_API_KEY is not configured");
    expect(mocks.startCrawl).not.toHaveBeenCalled();
  });
});
