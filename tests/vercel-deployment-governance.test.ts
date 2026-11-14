import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attributeDeployment,
  listDeployments24h,
  runGovernance,
} from "../scripts/check-vercel-deployment-governance.mjs";

const NOW = 1800000000000;
const DAY = 24 * 60 * 60 * 1000;
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

const cli = (id: string, state = "READY", target: string | null = null) => ({
  uid: id,
  source: "cli",
  target,
  readyState: state,
  created: NOW - 1000,
  url: id + ".vercel.app",
});

afterEach(() => vi.unstubAllGlobals());

describe("Vercel deployment governance", () => {
  it("paginates and fails for an explicitly non-CLI Production source", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        deployments: [cli("dpl_1", "READY", "production")],
        pagination: { next: 1700000000000 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        deployments: [{ uid: "dpl_2", source: "git", target: "production", created: NOW - 1000, url: "two.vercel.app" }],
        pagination: { next: null },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await runGovernance({ env: baseEnv, now: NOW, log: () => {}, error: () => {} });
    expect(result.exitCode).toBe(1);
    expect(result.summary?.deployments24h).toBe(2);
    expect(result.summary?.unexpectedSources).toEqual([
      expect.objectContaining({ id: "dpl_2", source: "git", target: "production" }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.every((url) => url.startsWith("https://api.vercel.com/v7/deployments?"))).toBe(true);
    expect(urls.some((url) => url.includes("/v13/deployments/"))).toBe(false);
    expect(new URL(urls[1]).searchParams.get("until")).toBe("1700000000000");
  });

  it("counts each READY, ERROR and CANCELED attempt even when Git SHA repeats", async () => {
    const sameGit = { githubCommitSha: "a".repeat(40), githubCommitRef: "fix/build", githubOrg: "amoai-tech", githubRepo: "ipixai" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        deployments: [
          { uid: "d1", source: null, target: null, readyState: "READY", created: NOW - 1000, meta: sameGit },
          { uid: "d2", source: null, target: null, readyState: "CANCELED", created: NOW - 1200, meta: sameGit },
        ],
        pagination: { next: 42 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        deployments: [
          cli("d3", "ERROR"),
          { uid: "d4", source: null, target: null, readyState: "ERROR", created: NOW - 1400, meta: sameGit },
        ],
        pagination: { next: null },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await runGovernance({ env: baseEnv, now: NOW, log: () => {}, error: () => {} });
    expect(result.exitCode).toBe(1);
    expect(result.summary).toMatchObject({
      deployments24h: 4,
      byState: { READY: 1, CANCELED: 1, ERROR: 2 },
      byTarget: { preview: 4 },
      bySource: { unreported: 3, cli: 1 },
      unexpectedSources: [],
      unknownTargets: [],
    });
    expect(result.summary?.attempts.filter((x: { gitSha: string | null }) => x.gitSha === "a".repeat(40))).toHaveLength(3);
  });

  it("does not invent a deployment method from Git metadata or a null target", () => {
    const record = attributeDeployment({
      uid: "dpl_git",
      target: null,
      source: null,
      readyState: "ERROR",
      meta: {
        githubCommitSha: "b".repeat(40),
        githubCommitRef: "main",
        githubOrg: "amoai-tech",
        githubRepo: "ipixai",
      },
      creator: { username: "operator" },
    });
    expect(record).toMatchObject({
      id: "dpl_git",
      target: "preview",
      source: "unreported",
      state: "ERROR",
      gitSha: "b".repeat(40),
      gitRef: "main",
      repo: "amoai-tech/ipixai",
      creator: "operator",
    });
  });

  it("allows a Git-referenced Preview within budget but logs missing source clearly", async () => {
    const logs: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      deployments: [{ uid: "dpl_git", source: null, target: null, created: NOW - 1000,
        meta: { githubCommitSha: "a".repeat(40), githubCommitRef: "main" } }],
      pagination: { next: null },
    })));
    const result = await runGovernance({ env: baseEnv, now: NOW, log: (x: string) => logs.push(x), error: () => {} });
    expect(result.exitCode).toBe(0);
    expect(result.summary?.byTarget).toEqual({ preview: 1 });
    expect(result.summary?.unreportedSources).toHaveLength(1);
    expect(logs.join("\n")).toContain("source unreported");
  });

  it("fails closed for a Production deployment with no source method", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      deployments: [{ uid: "dpl_prod", source: null, target: "production", created: NOW - 1000 }],
      pagination: { next: null },
    })));
    const result = await runGovernance({ env: baseEnv, now: NOW, log: () => {}, error: () => {} });
    expect(result.exitCode).toBe(1);
    expect(result.summary?.unexpectedSources).toEqual([expect.objectContaining({ id: "dpl_prod", source: "unreported" })]);
  });

  it("fails closed if target is absent rather than explicitly null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      deployments: [{ uid: "dpl_unknown", source: "cli", created: NOW - 1000 }],
      pagination: { next: null },
    })));
    const result = await runGovernance({ env: baseEnv, now: NOW, log: () => {}, error: () => {} });
    expect(result.exitCode).toBe(1);
    expect(result.summary?.unknownTargets).toEqual([expect.objectContaining({ id: "dpl_unknown", target: "unknown" })]);
  });

  it("preserves the inclusive rolling 24h boundary and deduplicates identical IDs across pages", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        deployments: [
          { ...cli("before"), created: NOW - DAY - 1 },
          { ...cli("boundary"), created: NOW - DAY },
          cli("dup"),
        ],
        pagination: { next: NOW - DAY },
      }))
      .mockResolvedValueOnce(jsonResponse({
        deployments: [cli("dup"), cli("recent")],
        pagination: { next: null },
      }));
    const deployments = await listDeployments24h({
      fetchImpl: fetchMock,
      token: "fake",
      teamId: "team_test",
      projectId: "prj_test",
      since: NOW - DAY,
    });
    expect(deployments.map((x) => x.uid)).toEqual(["boundary", "dup", "recent"]);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("since")).toBe(String(NOW - DAY));
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("until")).toBe(String(NOW - DAY));
  });

  it("fails closed when the Vercel pagination cursor repeats", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      deployments: [cli("d")],
      pagination: { next: 42 },
    }));
    const result = await runGovernance({ env: baseEnv, now: NOW, fetchImpl: fetchMock, log: () => {}, error: () => {} });
    expect(result.exitCode).toBe(2);
    expect(result.summary).toBeNull();
  });

  it("fails closed for a malformed Vercel response", async () => {
    const result = await runGovernance({
      env: baseEnv, now: NOW,
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ pagination: { next: null } })),
      log: () => {}, error: () => {},
    });
    expect(result.exitCode).toBe(2);
  });

  it("fails closed when the Vercel list API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429, statusText: "Too Many Requests" })));
    const result = await runGovernance({ env: baseEnv, now: NOW, log: () => {}, error: () => {} });
    expect(result.exitCode).toBe(2);
    expect(result.summary).toBeNull();
  });
});
