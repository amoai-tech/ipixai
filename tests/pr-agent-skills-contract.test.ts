import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/pr-agent.yml", import.meta.url),
  "utf8",
);
const routing = readFileSync(new URL("../scripts/select-pr-agent-skills.mjs", import.meta.url), "utf8");
const copilotReviewSkill = readFileSync(
  new URL("../.claude/skills/copilotkit-review/SKILL.md", import.meta.url),
  "utf8",
);
const mastraSkill = readFileSync(
  new URL("../.claude/skills/mastra/SKILL.md", import.meta.url),
  "utf8",
);
const traceQueryReference = readFileSync(
  new URL("../.claude/skills/mastra/references/trace-query.md", import.meta.url),
  "utf8",
);

describe("IPI-1213 PR-Agent review skills contract", () => {
  it("keeps deterministic review-skill ownership local while the shared core orchestrates it", () => {
    expect(workflow).toContain("amoai-tech/pr-review-infra/.github/workflows/pr-agent.yml@b50dee03932eea0576e498454e8d18666311556b");
    expect(routing).toContain("pr-agent-code-review");
    expect(routing).toContain("mastra");
    expect(routing).toContain("copilotkit-review");
    expect(routing).toContain("supabase-review");
    expect(routing).toContain("nextjs-review");
    expect(routing).toContain("ci-review");
    expect(routing).toContain("cloudinary-review");
    expect(routing).toContain("max_tokens=${result.maxTokens}");
  });

  it("uses one canonical Mastra skill for implementation and PR review", () => {
    expect(routing).toContain('"mastra"');
    expect(routing).not.toContain("mastra-review");
    expect(existsSync(new URL("../.claude/skills/mastra-review/SKILL.md", import.meta.url))).toBe(false);
    expect(traceQueryReference).not.toMatch(/\bnpx mastra\b/);
    expect(mastraSkill).toContain("one canonical Mastra skill for iPix");
    expect(mastraSkill).toContain("PR review");
    expect(mastraSkill).toContain("references/trace-query.md");
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
