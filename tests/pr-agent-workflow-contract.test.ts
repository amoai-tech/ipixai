import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/pr-agent.yml", import.meta.url), "utf8");
const config = readFileSync(new URL("../.pr_agent.toml", import.meta.url), "utf8");
const reviewPolicy = readFileSync(new URL("../scripts/pr-agent/review-policy.mjs", import.meta.url), "utf8");
const evidenceBuilder = readFileSync(new URL("../scripts/pr-agent/build-evidence.mjs", import.meta.url), "utf8");
const sharedSha = "877b08c324b47f3c06063e8a69d71ebe2cd54bbc";

describe("IPI-1246 shared PR-Agent caller contract", () => {
  it("pins iPix to the immutable shared workflow", () => {
    expect(workflow).toContain(`amoai-tech/pr-review-infra/.github/workflows/pr-agent.yml@${sharedSha}`);
    expect(workflow).toContain("evidence_title: iPix PR-Agent Evidence");
    expect(workflow).toContain("NVIDIA_API_KEY: ${{ secrets.NVIDIA_API_KEY }}");
  });

  it("keeps the same-repository trust boundary and exact permissions", () => {
    expect(workflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(workflow).toContain("github.event.sender.type != 'Bot'");
    expect(workflow).toContain("actions: read");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("issues: write");
    expect(workflow).toContain("pull-requests: write");
  });

  it("moves provider/model runtime ownership out of iPix", () => {
    expect(workflow).not.toContain("docker://pragent/pr-agent");
    expect(workflow).not.toContain("NVIDIA_NIM_API_BASE");
    expect(workflow).not.toContain("nemotron-3-ultra");
    expect(config).not.toMatch(/^model\s*=/m);
    expect(config).not.toMatch(/^fallback_models\s*=/m);
    expect(config).not.toMatch(/^custom_model_max_tokens\s*=/m);
  });

  it("keeps repo-local policy/evidence compatible with the shared core", () => {
    expect(reviewPolicy).toContain("export const CERT_HISTORY_MARKER");
    expect(reviewPolicy).toContain("export function selectReviewCommand");
    expect(reviewPolicy).toContain("export function verifyReviewResult");
    expect(reviewPolicy).toContain("export function appendCertification");
    expect(evidenceBuilder).toContain('args["changed-files-file"]');
    expect(evidenceBuilder).toContain('missing --changed-files-file or --changed-files');
  });

  it("keeps YAML-safe free-text review serialization local", () => {
    expect(config).toContain("For every free-text field in the PR-Agent review, always use a YAML block scalar (`|`) with indented content.");
    expect(config).toContain("Never start an unquoted YAML scalar with a backtick.");
  });
});
