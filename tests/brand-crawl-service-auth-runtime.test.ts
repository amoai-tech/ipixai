import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  serviceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({
  getPublicSupabaseConfig: () => ({ url: "https://example.supabase.co" }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
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
  delete process.env.SUPABASE_SECRET_KEYS;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({ ok: true, data: { crawlId: "33333333-3333-4333-8333-333333333333" } }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
});

describe("Brand crawl service auth runtime", () => {
  it("uses the canonical modern default secret key instead of legacy fallback", async () => {
    process.env.SUPABASE_SECRET_KEYS = JSON.stringify({ default: "sb_secret_modern_test" });
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-test";

    await startCrawlExecute()({
      inputData: {
        brandId: "11111111-1111-4111-8111-111111111111",
        brandUrl: "https://brand.example",
        brandName: "Example",
        actorId: "22222222-2222-4222-8222-222222222222",
      },
      runId: "run-auth-modern-default",
    });

    const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ apikey: "sb_secret_modern_test" });
    expect(init.headers).not.toMatchObject({ apikey: "legacy-service-role-test" });
  });

  it.each([
    ["empty object", JSON.stringify({})],
    ["custom-only object", JSON.stringify({ custom: "sb_secret_custom_test" })],
    ["empty default", JSON.stringify({ default: "" })],
  ])("falls back to the legacy backend key when modern config has %s", async (_label, modernConfig) => {
    process.env.SUPABASE_SECRET_KEYS = modernConfig;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-test";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await startCrawlExecute()({
      inputData: {
        brandId: "11111111-1111-4111-8111-111111111111",
        brandUrl: "https://brand.example",
        brandName: "Example",
        actorId: "22222222-2222-4222-8222-222222222222",
      },
      runId: "run-auth-fallback-missing-default",
    });

    const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ apikey: "legacy-service-role-test" });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid SUPABASE_SECRET_KEYS"),
    );
  });

  it("logs malformed modern config and falls back to the legacy backend key", async () => {
    process.env.SUPABASE_SECRET_KEYS = "{invalid-json";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-test";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await startCrawlExecute()({
      inputData: {
        brandId: "11111111-1111-4111-8111-111111111111",
        brandUrl: "https://brand.example",
        brandName: "Example",
        actorId: "22222222-2222-4222-8222-222222222222",
      },
      runId: "run-auth-fallback",
    });

    const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ apikey: "legacy-service-role-test" });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid SUPABASE_SECRET_KEYS"),
    );
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("{invalid-json");
  });
});
