import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/codacy-coverage.yml", import.meta.url),
  "utf8",
);

const require = createRequire(import.meta.url);
const { safeLoad } = require("js-yaml") as {
  safeLoad: (source: string) => unknown;
};

type WorkflowStep = { name?: string; env?: Record<string, unknown> };
type WorkflowConfig = {
  env?: Record<string, unknown>;
  jobs?: {
    coverage?: {
      env?: Record<string, unknown>;
      steps?: WorkflowStep[];
    };
  };
};

const config = safeLoad(workflow) as WorkflowConfig;

describe("Codacy coverage workflow contract", () => {
  it("keeps the Codacy project token scoped to the upload step", () => {
    const coverageJob = config.jobs?.coverage;
    const tokenSteps = (coverageJob?.steps ?? []).filter(
      (step) => step.env && "CODACY_PROJECT_TOKEN" in step.env,
    );

    expect(config.env?.CODACY_PROJECT_TOKEN).toBeUndefined();
    expect(coverageJob?.env?.CODACY_PROJECT_TOKEN).toBeUndefined();
    expect(tokenSteps).toHaveLength(1);
    expect(tokenSteps[0]?.name).toBe("Upload Codacy coverage");
    expect(workflow).toContain('if [[ -z "$CODACY_PROJECT_TOKEN" ]]; then');
  });

  it("pins third-party workflow actions to verified commit SHAs", () => {
    expect(workflow).toContain(
      "actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0",
    );
    expect(workflow).toContain(
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7",
    );
    expect(workflow).not.toMatch(/uses: actions\/(checkout|setup-node)@v\d+/);
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
