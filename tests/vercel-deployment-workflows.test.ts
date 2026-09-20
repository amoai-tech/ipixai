import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.resolve(root, file), "utf8");

/**
 * Jobs that are allowed to fail without blocking Production.
 *
 * `jobs.<job_id>.continue-on-error: true` normalises a failed job to
 * `needs.<job_id>.result == "success"`, so an advisory job listed in
 * `vercel-production.needs` cannot block the deploy. That behaviour was proven
 * live on 2026-09-18 in a throwaway repository: a job with
 * `continue-on-error: true` that ran `exit 1` reported `conclusion=failure` in
 * the run UI, while a plain `needs: [that-job]` dependent job still ran and saw
 * `needs.<job>.result == success`.
 *
 * Every other job in `ci.yml` is a release gate: it must be able to fail, and
 * it must be a dependency of Production.
 */
const ADVISORY_JOBS = new Set(["playwright-ai-smoke"]);

/** Split a workflow's `jobs:` mapping into one raw block per top-level job id. */
function workflowJobs(source: string) {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  expect(start).toBeGreaterThanOrEqual(0);

  const jobs = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of lines.slice(start + 1)) {
    const jobStart = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobStart) {
      current = jobStart[1];
      jobs.set(current, []);
      continue;
    }
    if (current) jobs.get(current)?.push(line);
  }
  return jobs;
}

function blockOf(jobs: Map<string, string[]>, job: string) {
  const block = jobs.get(job);
  expect(block, `expected .github/workflows/ci.yml to define job "${job}"`).toBeDefined();
  return block ?? [];
}

/** `needs:` values for one job, supporting both list and inline-array syntax. */
function needsOf(block: string[]) {
  const at = block.findIndex((line) => /^ {4}needs:/.test(line));
  if (at < 0) return [];

  const inline = /^ {4}needs:\s*\[(.*)\]\s*$/.exec(block[at]);
  if (inline) {
    return inline[1]
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  const needs: string[] = [];
  for (const line of block.slice(at + 1)) {
    const item = /^ {6}- (.+?)\s*$/.exec(line);
    if (!item) break;
    needs.push(item[1]);
  }
  return needs;
}

const isContinueOnError = (block: string[]) =>
  block.some((line) => /^ {4}continue-on-error:\s*true\s*$/.test(line));

/**
 * The JOB-level `if:` condition of one job, flattened to a single string.
 *
 * Only the 4-space-indented `if:` counts — step conditions are 8-space indented,
 * so they cannot be mistaken for the job condition.
 */
function jobConditionOf(block: string[]) {
  const at = block.findIndex((line) => /^ {4}if:/.test(line));
  if (at < 0) return "";

  const inline = /^ {4}if:\s*(.*)$/.exec(block[at])?.[1] ?? "";
  const parts = inline ? [inline] : [];
  for (const line of block.slice(at + 1)) {
    if (!/^ {6}\S/.test(line)) break;
    parts.push(line.trim());
  }
  return parts.join(" ");
}

function expectNoAutomaticPreviewTrigger(source: string) {
  expect(source).not.toMatch(/^\s{2}push:/m);
  expect(source).not.toMatch(/^\s{2}pull_request:/m);
}

describe("IPI-1229 Vercel deployment ownership", () => {
  it("requires every current CI gate as a Production dependency", () => {
    const jobs = workflowJobs(read(".github/workflows/ci.yml"));
    const production = blockOf(jobs, "vercel-production");
    const needs = needsOf(production);

    // Derived from the workflow itself, not copied from a stale PR description:
    // adding a new gate job without wiring it into Production fails this test.
    const required = [...jobs.keys()].filter(
      (job) => job !== "vercel-production" && !ADVISORY_JOBS.has(job),
    );

    expect(required.length).toBeGreaterThan(5);
    expect(new Set(needs)).toEqual(new Set([...required, ...ADVISORY_JOBS]));
  });

  it("refuses to run Production when the approval-tenant security E2E fails", () => {
    const jobs = workflowJobs(read(".github/workflows/ci.yml"));
    const production = blockOf(jobs, "vercel-production");
    const gate = blockOf(jobs, "playwright-approval-tenant");

    // The real authenticated ShootPlan review boundary must run the real spec...
    expect(gate.join("\n")).toContain("npm run e2e:approval");
    // ...must be able to fail, so `needs` can skip Production...
    expect(isContinueOnError(gate)).toBe(false);
    // ...and Production must actually depend on it.
    expect(needsOf(production)).toContain("playwright-approval-tenant");

    // A failing `needs` job skips its dependents. Any of these status-check
    // functions in Production's condition would opt out of that guarantee.
    const condition = production.join("\n");
    expect(condition).not.toMatch(/\balways\s*\(/);
    expect(condition).not.toMatch(/\bfailure\s*\(/);
    expect(condition).not.toMatch(/\bcancelled\s*\(/);
  });

  it("keeps only the documented advisory job unable to block Production", () => {
    const jobs = workflowJobs(read(".github/workflows/ci.yml"));
    const production = blockOf(jobs, "vercel-production");

    for (const need of needsOf(production)) {
      const block = blockOf(jobs, need);
      if (ADVISORY_JOBS.has(need)) {
        expect(isContinueOnError(block), `${need} must stay advisory`).toBe(true);
      } else {
        expect(isContinueOnError(block), `${need} must be able to block Production`).toBe(false);
      }
    }
  });

  it("deploys Production from the same trusted CI run that tested main", () => {
    const source = read(".github/workflows/ci.yml");
    const production = blockOf(workflowJobs(source), "vercel-production");

    expect(existsSync(path.resolve(root, ".github/workflows/vercel-production.yml"))).toBe(false);
    expect(source).not.toContain("workflow_run:");
    expect(source).toContain("  vercel-production:");
    // Production is manual-only: a push must never reach this job.
    const jobCondition = jobConditionOf(production);
    expect(jobCondition).toContain("github.event_name == 'workflow_dispatch'");
    expect(jobCondition).not.toContain("github.event_name == 'push'");
    expect(jobCondition).toContain("github.ref == 'refs/heads/main'");
    // The release switch must never gate the job itself — see the
    // "fails loudly when the Production release switch is unset" test.
    expect(jobCondition).not.toContain("VERCEL_ACTIONS_PRODUCTION_ENABLED");
    expect(source).toContain("ref: ${{ github.sha }}");
    expect(source.match(/git rev-parse origin\/main/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain("id: credentials");
    expect(source).toContain("steps.credentials.outputs.configured == 'true'");
    expect(source).toContain("vercel@59.23.1");
    expect(source).toContain("vercel pull --yes --environment=production");
    expect(source).toContain("vercel build --prod");
    expect(source).toContain("vercel deploy --prebuilt --prod");
  });

  it("keeps full CI on every merge but never deploys Production from a push", () => {
    const source = read(".github/workflows/ci.yml");

    // The workflow itself must still run on every merge and PR...
    expect(source).toMatch(/^on:\s*$/m);
    expect(source).toMatch(/^ {2}push:\s*$/m);
    expect(source).toMatch(/^ {4}branches:\s*\[main\]\s*$/m);
    expect(source).toMatch(/^ {2}pull_request:\s*$/m);
    // ...and remain manually dispatchable, which is now the ONLY release trigger.
    expect(source).toMatch(/^ {2}workflow_dispatch:\s*$/m);

    // Regression (PR #214 review): `(github.event_name == 'push' ||
    // github.event_name == 'workflow_dispatch')` billed one Production
    // deployment per merge, which is the outcome this task exists to stop.
    const production = blockOf(workflowJobs(source), "vercel-production");
    const block = production.join("\n");
    expect(block).not.toMatch(/github\.event_name\s*==\s*'push'/);
    expect(block).toMatch(/github\.event_name\s*==\s*'workflow_dispatch'/);
    expect(jobConditionOf(production)).not.toContain("github.event_name == 'push'");
  });

  it("keeps manual release runs out of the push run's concurrency group", () => {
    const source = read(".github/workflows/ci.yml");
    const production = blockOf(workflowJobs(source), "vercel-production");

    // A normal push must not be able to cancel an in-flight manual release (or
    // the reverse), so the event name belongs in the top-level group.
    expect(source).toMatch(
      /^ {2}group: ci-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}-\$\{\{ github\.event_name \}\}\s*$/m,
    );

    // The Production job keeps its own non-cancelling lock, and stale-main
    // protection stays the final gate rather than being replaced by concurrency.
    expect(production.join("\n")).toContain("group: vercel-production");
    expect(production.join("\n")).toContain("cancel-in-progress: false");
    expect(source.match(/git rev-parse origin\/main/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps every Vercel Git deployment disabled", () => {
    const config = JSON.parse(read("vercel.json")) as {
      git?: { deploymentEnabled?: unknown };
    };

    // Regression: restoring `"deploymentEnabled": { "main": true }` would put
    // Vercel Git back into the release path next to the manual Actions release,
    // recreating a Production deployment per merge and the Git/CLI duplicate.
    expect(config.git?.deploymentEnabled).toBe(false);
  });

  it("fails loudly when the Production release switch is unset instead of skipping", () => {
    const jobs = workflowJobs(read(".github/workflows/ci.yml"));
    const production = blockOf(jobs, "vercel-production");
    const block = production.join("\n");

    // Regression (PR #214 review): the switch used to live in the job-level `if:`.
    // A job-level condition reports conclusion=skipped, which is not a failure — so
    // once vercel.json removed the Vercel Git fallback, an unset variable silently
    // stopped every production release while main CI stayed green.
    expect(jobConditionOf(production)).not.toContain("VERCEL_ACTIONS_PRODUCTION_ENABLED");

    // The switch is read inside the job...
    expect(block).toContain("PRODUCTION_ENABLED: ${{ vars.VERCEL_ACTIONS_PRODUCTION_ENABLED }}");
    // ...an unset or malformed value is an explicit ::error that fails the job...
    expect(block).toMatch(/must be exactly 'true' or 'false'/);
    expect(block).toMatch(/::error/);
    expect(block).toMatch(/exit 1/);
    // ...a deliberate 'false' stays visible rather than silent...
    expect(block).toMatch(/::warning/);
    // ...and the deploy pipeline only runs after the switch validated as enabled.
    expect(block).toContain("steps.release.outputs.enabled == 'true'");
  });

  it("creates Preview deployments only by manual exact-SHA dispatch with branch-scoped env", () => {
    const source = read(".github/workflows/vercel-preview.yml");

    expect(source).toContain("workflow_dispatch:");
    expect(source).toContain("sha:");
    expect(source).toContain("branch:");
    expectNoAutomaticPreviewTrigger(source);
    expect(source).toContain("ref: ${{ inputs.sha }}");
    expect(source).toContain("permissions:\n  contents: read");
    expect(source).toContain("vercel@59.23.1");
    expect(source).toContain('git check-ref-format --branch "$BRANCH"');
    expect(source).toContain('git merge-base --is-ancestor "$SHA" "origin/$BRANCH"');
    expect(source).toMatch(/vercel pull --yes --environment=preview\s+--git-branch="\$BRANCH"/);
    expect(source).toContain("vercel build");
    expect(source).toContain("vercel deploy --prebuilt");
    expect(source).not.toContain("vercel deploy --prebuilt --prod");
  });

  it("keeps CI, package engines and the Vercel deploy runtime on one Node major", () => {
    const pkg = JSON.parse(read("package.json")) as { engines?: { node?: string } };
    const nvmrc = read(".nvmrc").trim();

    expect(nvmrc).toMatch(/^\d+\.\d+\.\d+$/);
    const pinnedMajor = Number(nvmrc.split(".")[0]);

    // CI and the deploy jobs install the exact release from `.nvmrc`. The
    // package engine range must accept that same major, otherwise a local
    // install and a CI/Vercel build can silently run different Node majors —
    // the exact drift that made the prebuilt Vercel artifact non-canonical.
    const range = pkg.engines?.node ?? "";
    const lowerBoundMajor = Number(/(\d+)/.exec(range)?.[1]);
    expect(Number.isNaN(lowerBoundMajor)).toBe(false);
    expect(lowerBoundMajor).toBe(pinnedMajor);
  });

  it("runs a read-only deployment-volume governance check every six hours", () => {
    const source = read(".github/workflows/vercel-governance.yml");

    expect(source).toMatch(/^ {2}schedule:\s*$/m);
    expect(source).toContain('cron: "17 */6 * * *"');
    expect(source).toMatch(/^ {2}workflow_dispatch:\s*$/m);
    expect(source).not.toMatch(/^ {2}push:/m);
    expect(source).not.toMatch(/^ {2}pull_request:/m);
    expect(source).toContain("node scripts/check-vercel-deployment-governance.mjs");
    expect(source).toContain("VERCEL_MAX_DEPLOYMENTS_24H: \"3\"");
  });

  it("keeps Vercel deployment monitoring read-only and flags unexpected deployment ownership", () => {
    const source = read("scripts/check-vercel-deployment-governance.mjs");

    expect(source).toContain("https://api.vercel.com/v7/deployments");
    expect(source).not.toContain("https://api.vercel.com/v13/deployments/");
    expect(source).toContain("pagination?.next");
    expect(source).toContain('searchParams.set("until", until)');
    expect(source).toContain('method: "GET"');
    expect(source).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
    expect(source).toContain('deployment.source !== "cli"');
    expect(source).toContain("VERCEL_MAX_DEPLOYMENTS_24H");
  });

  it("tracks a project-scoped native Vercel usage-anomaly rule as code", () => {
    const rule = JSON.parse(read("ops/vercel/ipixai-usage-anomaly.json")) as {
      type?: string;
      name?: string;
      ruleScope?: { type?: string; projectIds?: string[] };
      triggers?: { mode?: string; items?: Array<{ type?: string }> };
      matchMinimumSeverityLevel?: string;
      notificationSettings?: { enableTeamOwnerNotifications?: boolean };
    };

    expect(rule.type).toBe("built-in");
    expect(rule.name).toBe("iPix usage anomalies");
    expect(rule.ruleScope).toEqual({
      type: "include",
      projectIds: ["prj_NeYqsq8o7yRWz7H5sYay8KHtEl1C"],
    });
    expect(rule.triggers).toEqual({ mode: "selected", items: [{ type: "usage_anomaly" }] });
    expect(rule.matchMinimumSeverityLevel).toBe("medium");
    expect(rule.notificationSettings?.enableTeamOwnerNotifications).toBe(true);
  });

});
