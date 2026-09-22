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

beforeEach(() => {
  vi.stubEnv("FIRECRAWL_API_KEY", "fc-test-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
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
        url: "https://example.supabase.co/functions/v1/firecrawl-webhook",
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

  it("ignores caller-controlled webhook destinations and derives the fixed Supabase callback", async () => {
    await startBrandSiteCrawl({
      url: "https://brand.example",
      metadata: { workflow_id: "run-safe" },
      // Deliberately present at runtime even though the TypeScript contract forbids it.
      ...({ webhookUrl: "https://attacker.example/collect" } as Record<string, string>),
    });

    expect(mocks.startCrawl).toHaveBeenCalledWith(
      "https://brand.example",
      expect.objectContaining({
        webhook: expect.objectContaining({
          url: "https://example.supabase.co/functions/v1/firecrawl-webhook",
        }),
      }),
    );
  });

  it("fails closed when the server-side Firecrawl key is missing", async () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "");

    await expect(
      startBrandSiteCrawl({ url: "https://brand.example", metadata: {} }),
    ).rejects.toThrow("FIRECRAWL_API_KEY is not configured");
    expect(mocks.startCrawl).not.toHaveBeenCalled();
  });
});
