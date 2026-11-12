import { describe, expect, it, vi } from "vitest";
import { verifyVercelDeploymentOwnership } from "../e2e/support/vercel-ownership";

const origin = "https://ipixai-abc123-amo-agency.vercel.app";
const valid = {
  token: "test-token",
  teamId: "team_PbKG2U0lCR67rN57C4fqcfaw",
  projectId: "prj_KIVAtc7rizfqvPl4Qaz8OdCFlMCh",
};
const deployment = {
  url: "ipixai-abc123-amo-agency.vercel.app",
  projectId: valid.projectId,
  readyState: "READY",
};
const respond = (body: unknown, status = 200) =>
  vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));

describe("trusted Vercel preview ownership", () => {
  it("looks up the exact hostname under our team and verifies its project", async () => {
    const fetchImpl = respond(deployment);
    await expect(verifyVercelDeploymentOwnership(origin, { ...valid, fetchImpl })).resolves.toBeUndefined();
    const [input, options] = fetchImpl.mock.calls[0];
    const url = new URL(input.toString());
    expect(url.origin).toBe("https://api.vercel.com");
    expect(url.pathname).toBe("/v13/deployments/ipixai-abc123-amo-agency.vercel.app");
    expect(url.searchParams.get("teamId")).toBe(valid.teamId);
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer test-token");
    expect(options?.signal).toBeDefined();
  });

  it("rejects an attacker-owned deployment with the same team suffix", async () => {
    const attacker = "https://ipixai-abc123-evil-amo-agency.vercel.app";
    await expect(verifyVercelDeploymentOwnership(attacker, {
      ...valid, fetchImpl: respond({ ...deployment, url: new URL(attacker).hostname, projectId: "prj_foreign" }),
    })).rejects.toThrow(/does not belong/);
    await expect(verifyVercelDeploymentOwnership(attacker, {
      ...valid, fetchImpl: vi.fn(async () => new Response(null, { status: 404 })),
    })).rejects.toThrow(/HTTP 404/);
  });

  it.each([
    ["project mismatch", { ...deployment, projectId: "prj_old" }],
    ["hostname mismatch", { ...deployment, url: "ipixai-elsewhere-amo-agency.vercel.app" }],
    ["not READY", { ...deployment, readyState: "BUILDING" }],
    ["missing project identity", { url: deployment.url, readyState: "READY" }],
  ])("rejects %s", async (_reason, candidate) => {
    await expect(verifyVercelDeploymentOwnership(origin, {
      ...valid, fetchImpl: respond(candidate),
    })).rejects.toThrow(/does not belong/);
  });

  it("fails closed if token, team, project, or API response is missing", async () => {
    await expect(verifyVercelDeploymentOwnership(origin, {
      ...valid, token: "", fetchImpl: respond(deployment),
    })).rejects.toThrow(/VERCEL_TOKEN/);
    await expect(verifyVercelDeploymentOwnership(origin, {
      ...valid, projectId: "prj_wrong", fetchImpl: respond(deployment),
    })).rejects.toThrow(/does not belong/);
    await expect(verifyVercelDeploymentOwnership(origin, {
      ...valid, fetchImpl: vi.fn(async () => { throw new Error("network"); }),
    })).rejects.toThrow(/lookup failed/);
    await expect(verifyVercelDeploymentOwnership(origin, {
      ...valid, fetchImpl: vi.fn(async () => new Response("bad JSON")),
    })).rejects.toThrow(/response is invalid/);
  });

  it.each([
    "http://ipixai-abc123-amo-agency.vercel.app",
    "https://user:pass@ipixai-abc123-amo-agency.vercel.app",
    "https://ipixai-abc123-amo-agency.vercel.app/path",
    "https://ipixai-abc123-amo-agency.vercel.app:444",
    "https://ipixai-abc123-amo-agency.vercel.app?x=1",
  ])("rejects malformed or credentialed origin %s without an API call", async (url) => {
    const fetchImpl = respond(deployment);
    await expect(verifyVercelDeploymentOwnership(url, { ...valid, fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
