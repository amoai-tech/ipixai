import { readFileSync, readlinkSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/pr-agent.yml", import.meta.url),
  "utf8",
);
const copilotReviewSkill = readFileSync(
  new URL("../.claude/skills/copilotkit-review/SKILL.md", import.meta.url),
  "utf8",
);
const mastraSkill = readFileSync(
  new URL("../.claude/skills/mastra/SKILL.md", import.meta.url),
  "utf8",
);

describe("IPI-1213 PR-Agent review skills contract", () => {
  it("selects trusted review skills through the deterministic router without autonomous fixes", () => {
    expect(workflow).toContain("ref: ${{ github.event.pull_request.base.sha }}");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("Select trusted iPix review skills");
    expect(workflow).toContain("scripts/select-pr-agent-skills.mjs");
    expect(workflow).toContain("skills.enabled: ${{ steps.reviewer-skills.outputs.enabled }}");
    expect(workflow).toContain("skills.paths: ${{ steps.reviewer-skills.outputs.paths }}");
    expect(workflow).toContain("skills.max_skills_tokens: ${{ steps.reviewer-skills.outputs.max_tokens }}");
    expect(workflow).toContain("github_action_config.auto_improve: \"false\"");
  });

  it("reuses the existing Mastra skill body without recursively inlining references", () => {
    const target = readlinkSync(
      new URL("../.claude/skills/mastra-review/SKILL.md", import.meta.url),
    );
    expect(target).toBe("../mastra/SKILL.md");
    expect(mastraSkill).toContain("references/README.md");
  });

  it("keeps the CopilotKit adapter review-only and anchored to v2 invariants", () => {
    expect(copilotReviewSkill).toContain("name: copilotkit-review");
    expect(copilotReviewSkill).toContain("@copilotkit/runtime/v2");
    expect(copilotReviewSkill).toContain("@copilotkit/react-core/v2");
    expect(copilotReviewSkill).toContain("Browser-supplied IDs are not authorization");
    expect(copilotReviewSkill).toContain("installed package source/types");
    expect(copilotReviewSkill).not.toContain("references/");
    expect(copilotReviewSkill).toContain("Fix: Restore the changed CopilotKit import to its `/v2` subpath.");
    expect(copilotReviewSkill).toContain("Verification: Run the existing targeted CopilotKit route tests, then `npm run typecheck`.");
    expect(copilotReviewSkill).toContain("Expected result: The route uses the `/v2` import and the targeted tests/typecheck pass.");
  });
});
