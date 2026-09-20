import { readFileSync, readlinkSync } from "node:fs";
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

describe("IPI-1213 PR-Agent review skills contract", () => {
  it("keeps deterministic review-skill ownership local while the shared core orchestrates it", () => {
    expect(workflow).toContain("amoai-tech/pr-review-infra/.github/workflows/pr-agent.yml@a3c9600de7a31184266fade8387359ccbb8e6d68");
    expect(routing).toContain("pr-agent-code-review");
    expect(routing).toContain("mastra-review");
    expect(routing).toContain("copilotkit-review");
    expect(routing).toContain("supabase-review");
    expect(routing).toContain("nextjs-review");
    expect(routing).toContain("ci-review");
    expect(routing).toContain("cloudinary-review");
    expect(routing).toContain("max_tokens=${result.maxTokens}");
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
