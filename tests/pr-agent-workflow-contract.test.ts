import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/pr-agent.yml", import.meta.url), "utf8");
const config = readFileSync(new URL("../.pr_agent.toml", import.meta.url), "utf8");

describe("IPI-1246 PR-Agent workflow contract", () => {
  it("keeps the trusted-base and same-repository secret boundary", () => {
    expect(workflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(workflow).toContain("github.event.sender.type != 'Bot'");
    expect(workflow).toContain("ref: ${{ github.event.pull_request.base.sha }}");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("actions: read");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("issues: write");
    expect(workflow).toContain("pull-requests: write");
  });

  it("loads fs inside the changed-file discovery github-script block", () => {
    const block = workflow.split("- name: Read changed filenames")[1]?.split("- name: Checkout PR head lockfile")[0] ?? "";
    expect(block).toContain('const fs = require("fs");');
  });

  it("uses deterministic changed-file routing and evidence from trusted helpers", () => {
    expect(workflow).toContain("Read changed filenames");
    expect(workflow).toContain(".pr-agent/changed-files.json");
    expect(workflow).toContain("--changed-files-file .pr-agent/changed-files.json");
    expect(workflow).not.toContain('--changed-files "$CHANGED_FILES_JSON"');
    expect(workflow).toContain("scripts/select-pr-agent-skills.mjs");
    expect(workflow).toContain("scripts/pr-agent/build-evidence.mjs");
    expect(workflow).toContain("scripts/pr-agent/review-policy.mjs");
    expect(workflow).toContain("ARTIFACT_PATH: \".pr-agent/evidence.md\"");
  });

  it("selects full vs incremental review and independently verifies a fresh result", () => {
    expect(workflow).toContain("Select full or incremental review from certified base context");
    expect(workflow).toContain("verify-review-result:");
    expect(workflow).toContain("Require a fresh base-aware PR-Agent review result");
    expect(workflow).toContain("ipix-pr-agent-cert-history");
  });

  it("keeps the immutable PR-Agent image and current NVIDIA production profile", () => {
    expect(workflow).toContain("pragent/pr-agent@sha256:548b760b81ab4b3f729182428695ccc1194bbf87528c2b1e2b2b07e5223af7b6");
    expect(workflow).toContain("nvidia_nim/nvidia/nemotron-3-ultra-550b-a55b");
    expect(workflow).toContain("nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b");
    expect(workflow).toContain("timeout-minutes: 25");
  });

  it("requires YAML-safe free-text serialization to avoid blank-review false failures", () => {
    expect(config).toContain("For every free-text field in the PR-Agent review, always use a YAML block scalar (`|`) with indented content.");
    expect(config).toContain("Never start an unquoted YAML scalar with a backtick.");
  });
});
