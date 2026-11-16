import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { describe, expect, it, vi } from "vitest";
import { verifyProductionEnvironment } from "../scripts/check-production-environment.mjs";

const repo = "amoai-tech/ipixai";
const environmentUrl = "https://api.github.com/repos/" + repo + "/environments/Production";
const branchesUrl = environmentUrl + "/deployment-branch-policies";

const correctEnvironment = {
  name: "Production",
  can_admins_bypass: false,
  deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
  protection_rules: [
    { type: "required_reviewers", prevent_self_review: false, reviewers: [
      { type: "User", reviewer: { login: "amoai-tech", id: 320616881 } },
    ] },
    { type: "branch_policy" },
  ],
};
const correctBranches = {
  total_count: 1,
  branch_policies: [{ type: "branch", name: "main" }],
};
function fakeApi(environment: unknown = correctEnvironment, branches: unknown = correctBranches) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url === environmentUrl) return new Response(JSON.stringify(environment));
    if (url === branchesUrl) return new Response(JSON.stringify(branches));
    return new Response(null, { status: 404 });
  });
  return fetchImpl;
}

describe("IPI-1091 protected Production approval configuration", () => {
  it("verifies the live GitHub API environment and exact main-only branch protection", async () => {
    const fetchImpl = fakeApi();
    await expect(verifyProductionEnvironment({ fetchImpl })).resolves.toBe(true);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([environmentUrl, branchesUrl]);
  });

  it.each([
    ["missing rules", { protection_rules: [] }],
    ["admin bypass enabled", { can_admins_bypass: true }],
    ["reviewer deleted", { protection_rules: [{ type: "branch_policy" }] }],
    ["new unapproved reviewer", { protection_rules: [
      { type: "required_reviewers", reviewers: [
        { type: "User", reviewer: { login: "amoai-tech", id: 320616881 } },
        { type: "User", reviewer: { login: "untrusted", id: 123 } },
      ] },
      { type: "branch_policy" },
    ] }],
    ["wrong reviewer", { protection_rules: [
      { type: "required_reviewers", reviewers: [{ type: "User", reviewer: { login: "other", id: 456 } }] },
      { type: "branch_policy" },
    ] }],
    ["no branch restriction", { deployment_branch_policy: { protected_branches: false, custom_branch_policies: false } }],
  ])("rejects drift: %s", async (_label, change) => {
    const fetchImpl = fakeApi({ ...correctEnvironment, ...change });
    await expect(verifyProductionEnvironment({ fetchImpl })).rejects.toThrow(/Production approval/);
  });

  it.each([
    ["other branch", { total_count: 1, branch_policies: [{ type: "branch", name: "develop" }] }],
    ["extra branch", { total_count: 2, branch_policies: [
      { type: "branch", name: "main" }, { type: "branch", name: "feature/*" },
    ] }],
    ["wildcard", { total_count: 1, branch_policies: [{ type: "branch", name: "*" }] }],
  ])("rejects policy drift: %s", async (_label, branches) => {
    await expect(verifyProductionEnvironment({ fetchImpl: fakeApi(correctEnvironment, branches) }))
      .rejects.toThrow(/Production approval/);
  });

  it("fails closed when public GitHub API is unavailable or forbidden", async () => {
    for (const status of [403, 404, 429, 500]) {
      await expect(verifyProductionEnvironment({
        fetchImpl: async () => new Response(null, { status }),
      })).rejects.toThrow(/Production approval/);
    }
  });

  it("reports a missing inspection secret before calling Vercel CLI", () => {
    const ci = parseYaml(readFileSync(".github/workflows/ci.yml", "utf8"));
    const step = ci.jobs["vercel-production"].steps.find(
      (item: { name: string }) =>
        item.name === "Inspect staged Production candidate and unchanged live alias",
    ) as { run: string; env: { VERCEL_TOKEN: string } };
    expect(step.env.VERCEL_TOKEN).toBe("\${{ secrets.VERCEL_TOKEN }}");
    const dir = mkdtempSync(path.join(tmpdir(), "ipix-inspect-missing-secret-"));
    const marker = path.join(dir, "vercel-called");
    try {
      const vercel = path.join(dir, "vercel");
      writeFileSync(vercel, '#!/bin/sh\\n' + 'printf called > "$MOCK_VERCEL_MARKER"\\n');
      chmodSync(vercel, 0o700);
      const result = spawnSync("bash", ["-c", step.run], {
        encoding: "utf8",
        timeout: 3000,
        env: {
          ...process.env,
          PATH: dir + ":" + process.env.PATH,
          VERCEL_TOKEN: "",
          MOCK_VERCEL_MARKER: marker,
        },
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("::error title=Missing VERCEL_TOKEN");
      expect(result.stdout).toContain("GitHub Actions");
      expect(existsSync(marker)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("also checks live approval settings in a tokenless scheduled governance job", () => {
    const y = parseYaml(readFileSync(".github/workflows/vercel-governance.yml", "utf8"));
    expect(y.on.schedule).toHaveLength(1);
    const productionPolicy = y.jobs["production-policy"];
    expect(productionPolicy.environment).toBeUndefined();
    expect(productionPolicy.env?.VERCEL_TOKEN).toBeUndefined();
    const policySteps = productionPolicy.steps as Array<{ name?: string; run?: string }>;
    const guard = policySteps.find(s => s.name === "Verify Production approval policy has not drifted");
    expect(guard?.run).toBe("node scripts/check-production-environment.mjs");

    const audit = y.jobs.audit;
    expect(audit.environment).toBe("Governance");
    expect(audit.if).toBe("github.ref == 'refs/heads/main'");
    const auditSteps = audit.steps as Array<{ name?: string; run?: string }>;
    expect(auditSteps.some(s => s.name === "Check Vercel deployment count and ownership")).toBe(true);
  });

  it("checks the policy before any Vercel pull/build/staging or paid AI QA", () => {
    const file = parseYaml(readFileSync(".github/workflows/ci.yml", "utf8"));
    const job = file.jobs["vercel-production"];
    const steps = job.steps as Array<{ name?: string; run?: string; env?: Record<string, string> }>;
    expect(job.environment).toBe("Production");
    const policy = steps.findIndex(x => x.name === "Verify required Production environment reviewers");
    const pull = steps.findIndex(x => x.name === "Pull Production environment");
    const stage = steps.findIndex(x => x.name === "Stage exact latest SHA without assigning customer domains");
    const qa = steps.findIndex(x => x.name === "Run staged Planner Stop and thread isolation against real AI");
    expect(policy).toBeGreaterThanOrEqual(0);
    expect(policy).toBeLessThan(pull);
    expect(policy).toBeLessThan(stage);
    expect(policy).toBeLessThan(qa);
    expect(steps[policy].run).toContain("node scripts/check-production-environment.mjs");
    const inspect = steps.find(x => x.name === "Inspect staged Production candidate and unchanged live alias");
    expect(inspect?.env?.VERCEL_TOKEN).toBe("${{ secrets.VERCEL_TOKEN }}");
    expect(inspect?.run).toContain("Missing VERCEL_TOKEN");
    expect(inspect?.run).toContain("exit 1");
  });
});
