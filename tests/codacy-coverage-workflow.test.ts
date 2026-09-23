import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/codacy-coverage.yml", import.meta.url),
  "utf8",
);

describe("Codacy coverage workflow contract", () => {
  it("keeps the Codacy project token scoped to the upload step", () => {
    expect(workflow).not.toMatch(/^ {6}CODACY_PROJECT_TOKEN:/m);
    expect(workflow.match(/^ {10}CODACY_PROJECT_TOKEN:/gm)).toHaveLength(1);
    expect(workflow).toContain('if [[ -z "$CODACY_PROJECT_TOKEN" ]]; then');
  });

  it("uploads one unified LCOV report for both source languages before finalizing", () => {
    const javascript = "report --partial -l Javascript -r coverage/lcov.info";
    const typescript = "report --partial -l TypeScript -r coverage/lcov.info";
    const final = "bash <(curl -Ls https://coverage.codacy.com/get.sh) final";

    expect(workflow).toContain(javascript);
    expect(workflow).toContain(typescript);
    expect(workflow).toContain(final);
    expect(workflow.indexOf(javascript)).toBeLessThan(workflow.indexOf(typescript));
    expect(workflow.indexOf(typescript)).toBeLessThan(workflow.indexOf(final));
  });

  it("pins the reporter and keeps AI provider keys empty during coverage", () => {
    expect(workflow).toContain('CODACY_REPORTER_VERSION: "14.1.3"');
    expect(workflow).toContain('GOOGLE_GENERATIVE_AI_API_KEY: ""');
    expect(workflow).toContain('GEMINI_API_KEY: ""');
    expect(workflow).toContain('GOOGLE_API_KEY: ""');
    expect(workflow).toContain('OPENAI_API_KEY: ""');
  });

  it("warns instead of failing when the Codacy token is unavailable", () => {
    expect(workflow).toContain("::warning::CODACY_PROJECT_TOKEN is unavailable");
    expect(workflow).toMatch(/CODACY_PROJECT_TOKEN is unavailable[\s\S]*exit 0/);
  });
});
