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
    const final = '"$REPORTER" final';

    expect(workflow).toContain(javascript);
    expect(workflow).toContain(typescript);
    expect(workflow).toContain(final);
    expect(workflow.indexOf(javascript)).toBeLessThan(
      workflow.indexOf(typescript),
    );
    expect(workflow.indexOf(typescript)).toBeLessThan(workflow.indexOf(final));
  });

  it("verifies a pinned reporter binary instead of executing a remote script", () => {
    expect(workflow).not.toContain("coverage.codacy.com/get.sh");
    expect(workflow).not.toContain("bash <(curl");
    expect(workflow).toContain('CODACY_REPORTER_VERSION: "14.1.3"');
    expect(workflow).toContain(
      'CODACY_REPORTER_SHA256: "15c5f052207d27b8501ab5d5910c68c206ea70b0157ee1725132780530580875"',
    );
    expect(workflow).toContain("sha256sum -c -");
  });

  it("keeps AI provider keys empty during coverage", () => {
    expect(workflow).toContain('GOOGLE_GENERATIVE_AI_API_KEY: ""');
    expect(workflow).toContain('GEMINI_API_KEY: ""');
    expect(workflow).toContain('GOOGLE_API_KEY: ""');
    expect(workflow).toContain('OPENAI_API_KEY: ""');
  });

  it("warns instead of failing when the Codacy token is unavailable", () => {
    expect(workflow).toContain(
      "::warning::CODACY_PROJECT_TOKEN is unavailable",
    );
    expect(workflow).toMatch(
      /CODACY_PROJECT_TOKEN is unavailable[\s\S]*exit 0/,
    );
  });
});
