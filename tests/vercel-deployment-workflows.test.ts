import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.resolve(root, file), "utf8");

function expectNoAutomaticPreviewTrigger(source: string) {
  expect(source).not.toMatch(/^\s{2}push:/m);
  expect(source).not.toMatch(/^\s{2}pull_request:/m);
}

describe("IPI-1229 Vercel deployment ownership", () => {
  it("deploys Production from the same trusted CI run that tested main", () => {
    const source = read(".github/workflows/ci.yml");

    expect(existsSync(path.resolve(root, ".github/workflows/vercel-production.yml"))).toBe(false);
    expect(source).not.toContain("workflow_run:");
    expect(source).toContain("  vercel-production:");
    expect(source).toContain("playwright-e2e");
    expect(source).toContain("supabase-fresh-replay");
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

  it("keeps hosted AI smoke advisory so provider failures do not block Production", () => {
    const source = read(".github/workflows/ci.yml");
    const start = source.indexOf("  playwright-ai-smoke:");
    const end = source.indexOf("\n  planner-default-acl:", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(source.slice(start, end)).toContain("continue-on-error: true");
  });

  it("pins the deploy runtime to the same Node major certified by CI", () => {
    const pkg = JSON.parse(read("package.json")) as { engines?: { node?: string } };
    const nvmrc = read(".nvmrc").trim();

    expect(nvmrc).toBe("22.23.2");
    expect(pkg.engines?.node).toBe(">=22.23.2 <23");
  });
});
