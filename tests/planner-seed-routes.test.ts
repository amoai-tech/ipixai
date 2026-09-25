import { describe, expect, it } from "vitest";

import { plannerSeedRoutesEnabled } from "@/lib/planner/seed-routes";

describe("plannerSeedRoutesEnabled", () => {
  it("is on in development", () => {
    expect(plannerSeedRoutesEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is off in a production build by default", () => {
    expect(plannerSeedRoutesEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("is on in a production build only with the exact opt-in on a CI runner", () => {
    expect(plannerSeedRoutesEnabled({ NODE_ENV: "production", IPIX_E2E_SEED_ROUTES: "1", CI: "true" })).toBe(true);
    expect(plannerSeedRoutesEnabled({ NODE_ENV: "production", IPIX_E2E_SEED_ROUTES: "true", CI: "true" })).toBe(false);
  });

  it("is off with the opt-in alone, outside CI", () => {
    expect(plannerSeedRoutesEnabled({ NODE_ENV: "production", IPIX_E2E_SEED_ROUTES: "1" })).toBe(false);
  });

  it("is never on when deployed on Vercel, even with the opt-in on CI", () => {
    expect(
      plannerSeedRoutesEnabled({ NODE_ENV: "production", IPIX_E2E_SEED_ROUTES: "1", CI: "true", VERCEL: "1" }),
    ).toBe(false);
  });
});
