import { afterEach, describe, expect, it, vi } from "vitest";

import { establishDeploymentAccess, isPublicIpixLanding, isStagedProductionQaOptIn } from "../e2e/support/vercel-bypass";

const ORIGIN = "https://ipixai-3pz8ibr1k-amo-agency.vercel.app";

describe("isPublicIpixLanding", () => {
  it("treats the real public iPix app on the exact staged origin as public", () => {
    expect(
      isPublicIpixLanding({
        landed: `${ORIGIN}/`,
        title: "iPix — AI-Powered Content Studio for Fashion Brands",
        deploymentOrigin: ORIGIN,
      }),
    ).toBe(true);
  });

  it("does not treat Vercel's SSO screen as the public app", () => {
    expect(
      isPublicIpixLanding({
        landed: "https://vercel.com/sso/verify?next=https%3A%2F%2Fipixai-3pz8ibr1k-amo-agency.vercel.app%2F",
        title: "Vercel Authentication",
        deploymentOrigin: ORIGIN,
      }),
    ).toBe(false);
  });

  it("rejects an iPix-looking response on a different origin", () => {
    expect(
      isPublicIpixLanding({
        landed: "https://www.ipix.co/",
        title: "iPix — AI-Powered Content Studio for Fashion Brands",
        deploymentOrigin: ORIGIN,
      }),
    ).toBe(false);
  });

  it("rejects an SSO-looking page served on the deployment host", () => {
    expect(
      isPublicIpixLanding({
        landed: `${ORIGIN}/`,
        title: "Vercel Authentication",
        deploymentOrigin: ORIGIN,
      }),
    ).toBe(false);
  });

  it("rejects an empty or unparseable landing URL", () => {
    expect(
      isPublicIpixLanding({
        landed: "",
        title: "iPix",
        deploymentOrigin: ORIGIN,
      }),
    ).toBe(false);
  });
});

describe("isStagedProductionQaOptIn", () => {
  const SHA = "95c4c9b4b62aeb3a91e5bcfada014190bfa8ded4";

  it("requires both the explicit flag and an exact 40-character SHA", () => {
    expect(
      isStagedProductionQaOptIn({
        IPIX_STAGED_PRODUCTION_QA: "1",
        VERCEL_DEPLOYMENT_SHA: SHA,
      }),
    ).toBe(true);
    expect(
      isStagedProductionQaOptIn({
        IPIX_STAGED_PRODUCTION_QA: "1",
      }),
    ).toBe(false);
    expect(
      isStagedProductionQaOptIn({
        IPIX_STAGED_PRODUCTION_QA: "true",
        VERCEL_DEPLOYMENT_SHA: SHA,
      }),
    ).toBe(false);
    expect(
      isStagedProductionQaOptIn({
        IPIX_STAGED_PRODUCTION_QA: "1",
        VERCEL_DEPLOYMENT_SHA: "not-a-sha",
      }),
    ).toBe(false);
  });
});

// Exercise the real ownership verifier at the browser's pre-login boundary.
// Fake the Vercel API rather than making hosted requests or paid AI calls.
describe("public staged QA deployment identity", () => {
  const SHA = "95c4c9b4b62aeb3a91e5bcfada014190bfa8ded4";
  const PROJECT = "prj_KIVAtc7rizfqvPl4Qaz8OdCFlMCh";
  const TEAM = "team_TestTeam";
  const appTitle = "iPix — AI-Powered Content Studio for Fashion Brands";

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function givenPublicCandidate(
    deployment: Record<string, unknown> = {},
    status = 200,
    origin = ORIGIN,
  ) {
    vi.stubEnv("VERCEL_TOKEN", "test-token");
    vi.stubEnv("VERCEL_ORG_ID", TEAM);
    vi.stubEnv("VERCEL_PROJECT_ID", PROJECT);
    const lookup = vi.fn(async () =>
      new Response(JSON.stringify({
        url: new URL(origin).hostname,
        projectId: PROJECT,
        readyState: "READY",
        target: "production",
        meta: { githubCommitSha: SHA },
        ...deployment,
      }), { status }),
    );
    vi.stubGlobal("fetch", lookup);
    const headers = vi.fn(async () => ({ "x-vercel-protection-bypass": "unused" }));
    const page = {
      goto: vi.fn(async () => undefined),
      url: () => origin + "/",
      title: async () => appTitle,
    };
    const access = () => establishDeploymentAccess({
      context: {} as never,
      page: page as never,
      deploymentOrigin: origin,
      headers,
      env: { IPIX_STAGED_PRODUCTION_QA: "1", VERCEL_DEPLOYMENT_SHA: SHA },
    });
    return { access, headers, page, lookup };
  }

  it("accepts only the expected READY Production project and exact commit before login", async () => {
    const h = givenPublicCandidate();
    await expect(h.access()).resolves.toBeUndefined();
    expect(h.page.goto).toHaveBeenCalledTimes(1);
    expect(h.headers).not.toHaveBeenCalled();
    expect(h.lookup).toHaveBeenCalledTimes(1);
    const [endpoint, request] = h.lookup.mock.calls[0] as unknown as [URL, RequestInit];
    expect(new URL(endpoint.toString()).searchParams.get("teamId")).toBe(TEAM);
    expect(new Headers(request.headers).get("Authorization")).toBe("Bearer test-token");
  });

  it("rejects a spoofed team-suffix host belonging to a different project", async () => {
    const otherOrigin = "https://ipixai-a1b2c3d4e-other-amo-agency.vercel.app";
    const h = givenPublicCandidate({ projectId: "prj_Attacker" }, 200, otherOrigin);
    await expect(h.access()).rejects.toThrow(/does not belong/);
    expect(h.headers).not.toHaveBeenCalled();
    expect(h.lookup).toHaveBeenCalledTimes(1);
  });

  it("rejects missing ownership credentials before any API request", async () => {
    const h = givenPublicCandidate();
    vi.stubEnv("VERCEL_TOKEN", "");
    await expect(h.access()).rejects.toThrow(/VERCEL_TOKEN/);
    expect(h.lookup).not.toHaveBeenCalled();
    expect(h.headers).not.toHaveBeenCalled();
  });

  it("rejects a failed ownership lookup before requesting bypass headers", async () => {
    const h = givenPublicCandidate({}, 403);
    await expect(h.access()).rejects.toThrow(/HTTP 403/);
    expect(h.headers).not.toHaveBeenCalled();
  });

  it("rejects mismatched commit SHA and Preview target for a staged Production opt-in", async () => {
    const wrongSha = givenPublicCandidate({ meta: { githubCommitSha: "b".repeat(40) } });
    await expect(wrongSha.access()).rejects.toThrow(/expected commit SHA or target/);
    expect(wrongSha.headers).not.toHaveBeenCalled();
    const wrongTarget = givenPublicCandidate({ target: "preview" });
    await expect(wrongTarget.access()).rejects.toThrow(/expected commit SHA or target/);
    expect(wrongTarget.headers).not.toHaveBeenCalled();
  });
});
