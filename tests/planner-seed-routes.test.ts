import { describe, expect, it } from "vitest";

import { plannerSeedRoutesEnabled } from "@/lib/planner/seed-routes";

const PROD_E2E = { NODE_ENV: "production", IPIX_E2E_SEED_ROUTES: "1", IPIX_E2E_WEBSERVER: "playwright" } as const;

describe("plannerSeedRoutesEnabled", () => {
  it("is on in development", () => {
    expect(plannerSeedRoutesEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is off in a production build by default", () => {
    expect(plannerSeedRoutesEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("is on in a production build only with the exact opt-in on a Playwright-started server", () => {
    expect(plannerSeedRoutesEnabled(PROD_E2E)).toBe(true);
    expect(plannerSeedRoutesEnabled({ ...PROD_E2E, IPIX_E2E_SEED_ROUTES: "true" })).toBe(false);
    expect(plannerSeedRoutesEnabled({ ...PROD_E2E, IPIX_E2E_WEBSERVER: "1" })).toBe(false);
  });

  it("is off with the opt-in alone, even when a generic CI flag is inherited", () => {
    expect(plannerSeedRoutesEnabled({ NODE_ENV: "production", IPIX_E2E_SEED_ROUTES: "1", CI: "true" })).toBe(false);
  });

  it("is never on when deployed on Vercel, even from a Playwright-started server", () => {
    expect(plannerSeedRoutesEnabled({ ...PROD_E2E, VERCEL: "1" })).toBe(false);
  });
});
