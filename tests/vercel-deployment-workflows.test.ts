import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.resolve(root, file), "utf8");

function expectNoAutomaticPreviewTrigger(source: string) {
  expect(source).not.toMatch(/^\s{2}push:/m);
  expect(source).not.toMatch(/^\s{2}pull_request:/m);
}

describe("IPI-1229 Vercel deployment ownership", () => {
  it("deploys Production only after successful main push CI at the exact tested SHA", () => {
    const source = read(".github/workflows/vercel-production.yml");

    expect(source).toContain("workflow_run:");
    expect(source).toContain('workflows: ["CI"]');
    expect(source).toContain("branches: [main]");
    expect(source).toContain("types: [completed]");
    expect(source).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(source).toContain("github.event.workflow_run.event == 'push'");
    expect(source).toContain("ref: ${{ github.event.workflow_run.head_sha }}");
    expect(source).toContain("git rev-parse origin/main");
    expect(source).toContain("steps.latest.outputs.deploy == 'true'");
    expect(source).toContain("id: credentials");
    expect(source).toContain("steps.credentials.outputs.configured == 'true'");
    expect(source).toContain("permissions:\n  contents: read");
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

  it("pins the deploy runtime to the same Node major certified by CI", () => {
    const pkg = JSON.parse(read("package.json")) as { engines?: { node?: string } };
    const nvmrc = read(".nvmrc").trim();

    expect(nvmrc).toBe("22.23.2");
    expect(pkg.engines?.node).toBe(">=22.23.2 <23");
  });
});
