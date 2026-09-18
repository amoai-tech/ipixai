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

    expect(existsSync(path.resolve(root, ".github/workflows/vercel-production.yml"))).toBe(false);
    expect(source).not.toContain("workflow_run:");
    expect(source).toContain("  vercel-production:");
    expect(source).toContain("github.event_name == 'push'");
    expect(source).toContain("github.event_name == 'workflow_dispatch'");
    expect(source).toContain("github.ref == 'refs/heads/main'");
    expect(source).toContain("VERCEL_ACTIONS_PRODUCTION_ENABLED == 'true'");
    expect(source).toContain("ref: ${{ github.sha }}");
    expect(source.match(/git rev-parse origin\/main/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain("id: credentials");
    expect(source).toContain("steps.credentials.outputs.configured == 'true'");
    expect(source).toContain("vercel@59.23.1");
    expect(source).toContain("vercel pull --yes --environment=production");
    expect(source).toContain("vercel build --prod");
    expect(source).toContain("vercel deploy --prebuilt --prod");
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
});
