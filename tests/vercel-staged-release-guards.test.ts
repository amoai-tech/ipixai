import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { describe, expect, it, vi } from "vitest";
import { verifyStagedProduction } from "../scripts/vercel-inspect-host.mjs";

const workflow = () => parseYaml(readFileSync(".github/workflows/ci.yml", "utf8"));
const steps = () => workflow().jobs["vercel-production"].steps as Array<{ name: string; run?: string; if?: string }>;

describe("IPI-1091 staged Production release safeguards", () => {
  it("documents paid AI and persistent QA consent before dispatch without forbidden inputs", () => {
    // Repo policy forbids workflow_dispatch inputs on CI; permission is a
    // separately recorded human gate before the manual release.
    expect(workflow().on.workflow_dispatch).toBeNull();
    const releaseSteps = steps();
    const stage = releaseSteps.findIndex(s => s.name === "Stage exact latest SHA without assigning customer domains");
    const qa = releaseSteps.findIndex(s => s.name.startsWith("Run staged Planner Stop"));
    expect(stage).toBeGreaterThanOrEqual(0);
    expect(qa).toBeGreaterThan(stage);
    const guideBeforeDispatch = readFileSync("docs/production-release.md", "utf8")
      .split("Use GitHub **Actions → CI → Run workflow")[0];
    expect(guideBeforeDispatch).toMatch(/paid.*AI/i);
    expect(guideBeforeDispatch).toMatch(/persist.*QA.*thread/i);
    expect(guideBeforeDispatch).toContain("record explicit approval in IPI-1091");
    expect(guideBeforeDispatch).toContain("do not dispatch");
    expect(guideBeforeDispatch).toContain("BOTH costs and persistent QA thread writes");
  });

  it("passes correct deployment metadata with the exact Vercel API request", async () => {
    const staged = { id: "dpl_qa", url: "ipixai-qa-amoco.vercel.app", target: "production", readyState: "READY" };
    const live = { url: "ipixai-old-amoco.vercel.app" };
    const actual = { projectId: "prj_correct", meta: { githubCommitSha: "a".repeat(40) }, target: "production" };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(actual)));
    const args = {
      staged, live, deploymentUrl: "https://ipixai-qa-amoco.vercel.app",
      liveBefore: live.url, projectId: actual.projectId,
      orgId: "team_correct", sha: actual.meta.githubCommitSha,
      token: "test-token", fetchImpl,
    };
    await expect(verifyStagedProduction(args)).resolves.toBe(live.url);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.vercel.com/v13/deployments/dpl_qa?teamId=team_correct",
      { headers: { Authorization: "Bearer test-token" } },
    );
  });

  it("fails closed for non-ready, wrong SHA/project, API error or live-alias drift", async () => {
    const staged = { id: "dpl_qa", url: "ipixai-qa-amoco.vercel.app", target: "production", readyState: "READY" };
    const live = { url: "ipixai-old-amoco.vercel.app" };
    const actual = { projectId: "prj_correct", meta: { githubCommitSha: "a".repeat(40) }, target: "production" };
    const args = {
      staged, live, deploymentUrl: "https://ipixai-qa-amoco.vercel.app",
      liveBefore: live.url, projectId: actual.projectId,
      orgId: "team_correct", sha: actual.meta.githubCommitSha, token: "test-token",
      fetchImpl: vi.fn(async () => new Response(JSON.stringify(actual))),
    };
    await expect(verifyStagedProduction({ ...args, staged: { ...staged, readyState: "ERROR" } })).rejects.toThrow(/ready/i);
    await expect(verifyStagedProduction({ ...args, staged: { ...staged, target: "preview" } })).rejects.toThrow(/ready/i);
    await expect(verifyStagedProduction({ ...args, staged: { ...staged, url: "ipixai-wrong-amoco.vercel.app" } })).rejects.toThrow(/ready/i);
    await expect(verifyStagedProduction({ ...args, fetchImpl: async () => new Response(null, { status: 403 }) })).rejects.toThrow(/403/);
    await expect(verifyStagedProduction({ ...args, fetchImpl: async () => new Response(JSON.stringify({ ...actual, projectId: "prj_wrong" })) })).rejects.toThrow(/SHA\/project/);
    await expect(verifyStagedProduction({ ...args, fetchImpl: async () => new Response(JSON.stringify({ ...actual, meta: { githubCommitSha: "b".repeat(40) } })) })).rejects.toThrow(/SHA\/project/);
    await expect(verifyStagedProduction({ ...args, fetchImpl: async () => new Response(JSON.stringify({ ...actual, target: "preview" })) })).rejects.toThrow(/SHA\/project/);
    await expect(verifyStagedProduction({ ...args, live: { url: "ipixai-drift-amoco.vercel.app" } })).rejects.toThrow(/alias changed/);
    await expect(verifyStagedProduction({ ...args, live: { url: staged.url } })).rejects.toThrow(/alias changed/);
  });

  it("requires the actual inspection to run before QA and the success notice", () => {
    const release = steps();
    const inspection = release.findIndex(s => s.name.startsWith("Inspect staged Production candidate"));
    const qa = release.findIndex(s => s.name.startsWith("Run staged authenticated QA"));
    const paid = release.findIndex(s => s.name.startsWith("Run staged Planner Stop"));
    const notice = release.findIndex(s => s.name.startsWith("Report staged candidate"));
    expect(inspection).toBeGreaterThanOrEqual(0);
    expect(qa).toBeGreaterThan(inspection);
    expect(paid).toBeGreaterThan(inspection);
    expect(notice).toBeGreaterThan(paid);
    expect(release[inspection].run).toContain("verifyStagedProduction(");
    for (const item of [qa, paid, notice]) {
      expect(release[item].if).toContain("steps.stage.outputs.url != ''");
    }
  });
});
