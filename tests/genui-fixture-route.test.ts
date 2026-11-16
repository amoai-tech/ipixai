import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/components/operator-panel/genui-fixture-harness", () => ({
  GenUIFixtureHarness: () => null,
}));

import { plannerSeedRoutesEnabled } from "../src/lib/planner/seed-routes";
import GenUIFixturePage from "../src/app/genui-fixture/page";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GenUI fixture route gate", () => {
  it("is disabled on Vercel even when the E2E flags are set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("IPIX_E2E_SEED_ROUTES", "1");
    vi.stubEnv("IPIX_E2E_WEBSERVER", "playwright");

    expect(plannerSeedRoutesEnabled()).toBe(false);
    expect(() => GenUIFixturePage()).toThrow("NEXT_NOT_FOUND");
  });

  it("is enabled only for the guarded local Playwright production run", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("IPIX_E2E_SEED_ROUTES", "1");
    vi.stubEnv("IPIX_E2E_WEBSERVER", "playwright");

    expect(plannerSeedRoutesEnabled()).toBe(true);
    expect(() => GenUIFixturePage()).not.toThrow();
  });

  it("is always enabled in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("IPIX_E2E_SEED_ROUTES", "");
    vi.stubEnv("IPIX_E2E_WEBSERVER", "");

    expect(plannerSeedRoutesEnabled()).toBe(true);
    expect(() => GenUIFixturePage()).not.toThrow();
  });
});
