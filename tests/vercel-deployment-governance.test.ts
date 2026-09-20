import { afterEach, describe, expect, it, vi } from "vitest";
import { runGovernance } from "../scripts/check-vercel-deployment-governance.mjs";

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  VERCEL_TOKEN: "test-token",
  VERCEL_ORG_ID: "team_test",
  VERCEL_PROJECT_ID: "prj_test",
  VERCEL_MAX_DEPLOYMENTS_24H: "3",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Vercel deployment governance", () => {
  it("paginates list results, uses list source, and catches a non-cli deployment on page 2", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        deployments: [{ uid: "dpl_1", source: "cli", target: "production", url: "one.vercel.app" }],
        pagination: { next: 1700000000000 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        deployments: [{ uid: "dpl_2", source: "git", target: null, url: "two.vercel.app" }],
        pagination: { next: null },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGovernance({ env: baseEnv, now: 1800000000000, log: () => {}, error: () => {} });

    expect(result.exitCode).toBe(1);
    if (!result.summary) throw new Error("expected governance summary");
    expect(result.summary.deployments24h).toBe(2);
    expect(result.summary.unexpectedSources).toEqual([
      { id: "dpl_2", source: "git", target: "unknown", url: "two.vercel.app" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.every((url) => url.startsWith("https://api.vercel.com/v7/deployments?"))).toBe(true);
    expect(urls.some((url) => url.includes("/v13/deployments/"))).toBe(false);
    expect(new URL(urls[1]).searchParams.get("until")).toBe("1700000000000");
  });

  it("counts deployments across pages and fails when the rolling 24h budget is exceeded", async () => {
    const cli = (id: string) => ({ uid: id, source: "cli", target: null, url: `${id}.vercel.app` });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ deployments: [cli("d1"), cli("d2")], pagination: { next: 42 } }))
      .mockResolvedValueOnce(jsonResponse({ deployments: [cli("d3"), cli("d4")], pagination: { next: null } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGovernance({ env: baseEnv, now: 1800000000000, log: () => {}, error: () => {} });

    expect(result.exitCode).toBe(1);
    if (!result.summary) throw new Error("expected governance summary");
    expect(result.summary.deployments24h).toBe(4);
    expect(result.summary.unexpectedSources).toEqual([]);
  });

  it("passes when all paginated deployments are cli-owned and within budget", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      deployments: [{ uid: "d1", source: "cli", target: "production", url: "one.vercel.app" }],
      pagination: { next: null },
    })));

    const result = await runGovernance({ env: baseEnv, now: 1800000000000, log: () => {}, error: () => {} });

    expect(result.exitCode).toBe(0);
    if (!result.summary) throw new Error("expected governance summary");
    expect(result.summary.deployments24h).toBe(1);
  });

  it("fails closed with exit code 2 when the Vercel list API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429, statusText: "Too Many Requests" })));

    const result = await runGovernance({ env: baseEnv, now: 1800000000000, log: () => {}, error: () => {} });

    expect(result.exitCode).toBe(2);
    expect(result.summary).toBeNull();
  });
});
