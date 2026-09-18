import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * IPI-1231 · VERCEL-RUNTIME-001 — importing the runtime must have NO side effects.
 *
 * `[SENSITIVE]` is the exact literal the Vercel CLI writes for a `sensitive`
 * variable during `vercel pull` (upstream constant
 * `SENSITIVE_ENV_VALUE_PLACEHOLDER`). Using the real placeholder rather than a
 * stand-in makes this a faithful reproduction of the CI failure:
 *
 *   vercel pull --environment=production  ->  MASTRA_DATABASE_URL="[SENSITIVE]"
 *   vercel build --prod                   ->  module import throws
 *
 * `vi.resetModules()` is mandatory: the factories memoise at module scope, so a
 * singleton left over from an earlier test would mask the result.
 *
 * NOTE for valid-URL tests: the pg pool/store singletons live on `globalThis`,
 * which `vi.resetModules()` does NOT clear. Any test exercising the *valid-URL*
 * path must also call `resetMastraPgSingletonsForTests()` from
 * `src/mastra/pg-store.ts`, or it inherits a pool from another test.
 */
const SENSITIVE = "[SENSITIVE]";
const URL_ERROR = /not a valid URL|requires MASTRA_DATABASE_URL/;

function stubHostedWithRedactedSecret() {
  vi.resetModules();
  vi.stubEnv("IPIX_MASTRA_HOSTED", "true");
  vi.stubEnv("MASTRA_DATABASE_URL", SENSITIVE);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("IPI-1231 · importing the runtime is side-effect free", () => {
  it("importing src/mastra/runtime does not validate the DB secret", async () => {
    stubHostedWithRedactedSecret();
    await expect(import("../src/mastra/runtime")).resolves.toBeDefined();
  });

  it("importing src/mastra/agents does not create agent storage", async () => {
    stubHostedWithRedactedSecret();
    await expect(import("../src/mastra/agents")).resolves.toBeDefined();
  });
});

describe("IPI-1231 · first use still fails closed on a bad hosted URL", () => {
  it("first getMastra() throws", async () => {
    stubHostedWithRedactedSecret();
    const { getMastra } = await import("../src/mastra/runtime");
    expect(() => getMastra()).toThrow(URL_ERROR);
  });

  it("first getProductionPlannerAgent() throws", async () => {
    stubHostedWithRedactedSecret();
    const { getProductionPlannerAgent } = await import("../src/mastra/agents");
    expect(() => getProductionPlannerAgent()).toThrow(URL_ERROR);
  });
});

describe("IPI-1231 · memoisation and registry identity (local path)", () => {
  it("getMastra() memoises and the default key resolves to the same agent factory", async () => {
    vi.resetModules();
    vi.stubEnv("IPIX_MASTRA_HOSTED", undefined);
    const { getMastra } = await import("../src/mastra/runtime");
    const { getProductionPlannerAgent } = await import("../src/mastra/agents");

    const first = getMastra();
    expect(getMastra()).toBe(first);
    expect(getProductionPlannerAgent()).toBe(getProductionPlannerAgent());
    expect(first.getAgent("default")).toBe(getProductionPlannerAgent());
  });
});
