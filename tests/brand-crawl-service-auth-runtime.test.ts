import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  serviceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({
  getPublicSupabaseConfig: () => ({ url: "https://example.supabase.co" }),
}));

vi.mock("@/lib/supabase/service-role", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/service-role")>()),
  createServiceRoleClient: mocks.serviceClient,
}));

import { brandIntelligenceWorkflow } from "@/mastra/workflows/brand-intelligence";

type StepExecute = (args: Record<string, unknown>) => Promise<unknown>;

function startCrawlExecute(): StepExecute {
  const step = brandIntelligenceWorkflow.steps.startCrawl as unknown as {
    execute: StepExecute;
  };
  return step.execute;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SECRET_KEYS;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({ ok: true, data: { crawlId: "33333333-3333-4333-8333-333333333333" } }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
});

const INPUT = {
  brandId: "11111111-1111-4111-8111-111111111111",
  brandUrl: "https://brand.example",
  brandName: "Example",
  actorId: "22222222-2222-4222-8222-222222222222",
};

async function sentApiKey(): Promise<unknown> {
  await startCrawlExecute()({ inputData: INPUT, runId: "run-auth" });
  const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
  const headers = init.headers as Record<string, string>;
  expect(headers.Authorization).toBeUndefined();
  return headers.apikey;
}

describe("Brand crawl start idempotency", () => {
  it("keys each crawl to its own workflow run so a retry never reuses an old crawl", async () => {
    process.env.SUPABASE_SECRET_KEY = "sb_secret_singular_test";
    await startCrawlExecute()({ inputData: INPUT, runId: "run-retry-2" });
    const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ workflowId: "run-retry-2", idempotencyKey: "workflow-run-retry-2" });
  });
});

function extractProfileExecute(): StepExecute {
  const step = brandIntelligenceWorkflow.steps.extractProfile as unknown as {
    execute: StepExecute;
  };
  return step.execute;
}

// Just enough of the Supabase client for extractProfile to reach its edge call.
function fakeServiceClient() {
  const chain = {
    select: () => chain,
    update: () => chain,
    eq: () => chain,
    single: async () => ({ data: { brand_url: "https://brand.example" }, error: null }),
    then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
  };
  return { from: () => chain };
}

describe("Brand intelligence extraction correlation id", () => {
  it("derives x-request-id from the workflow run so every retry of the step shares it", async () => {
    process.env.SUPABASE_SECRET_KEY = "sb_secret_singular_test";
    mocks.serviceClient.mockReturnValue(fakeServiceClient());
    mocks.fetch.mockResolvedValue(new Response("boom", { status: 500 }));
    const args = {
      inputData: { brandId: INPUT.brandId, crawlId: "33333333-3333-4333-8333-333333333333" },
      runId: "run-extract-1",
    };

    await expect(extractProfileExecute()(args)).rejects.toThrow();
    await expect(extractProfileExecute()(args)).rejects.toThrow();

    const requestIds = mocks.fetch.mock.calls.map(
      ([, init]) => ((init as RequestInit).headers as Record<string, string>)["x-request-id"],
    );
    expect(requestIds).toEqual(["BI-run-extract-1", "BI-run-extract-1"]);
  });
});

describe("Brand crawl service auth runtime", () => {
  it("prefers the modern SUPABASE_SECRET_KEY over every other variable", async () => {
    process.env.SUPABASE_SECRET_KEY = "sb_secret_singular_test";
    process.env.SUPABASE_SECRET_KEYS = JSON.stringify({ default: "sb_secret_map_test" });
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-test";
    expect(await sentApiKey()).toBe("sb_secret_singular_test");
  });

  it("falls back to the default entry of the SUPABASE_SECRET_KEYS map", async () => {
    process.env.SUPABASE_SECRET_KEYS = JSON.stringify({ default: "sb_secret_map_test" });
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-test";
    expect(await sentApiKey()).toBe("sb_secret_map_test");
  });

  it("accepts a bare sb_secret_ key pasted into SUPABASE_SECRET_KEYS", async () => {
    process.env.SUPABASE_SECRET_KEYS = "sb_secret_bare_test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-test";
    expect(await sentApiKey()).toBe("sb_secret_bare_test");
  });

  it.each([
    ["empty object", JSON.stringify({})],
    ["custom-only object", JSON.stringify({ custom: "sb_secret_custom_test" })],
    ["empty default", JSON.stringify({ default: "" })],
    ["malformed JSON", "{invalid-json"],
  ])("falls back to the legacy key when the map has %s, without logging the value", async (_label, value) => {
    process.env.SUPABASE_SECRET_KEYS = value;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-test";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await sentApiKey()).toBe("legacy-service-role-test");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid SUPABASE_SECRET_KEYS"));
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain(value === "{invalid-json" ? value : "sb_secret_");
    errorSpy.mockRestore();
  });
});
