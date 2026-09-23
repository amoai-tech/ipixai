import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/pr-agent.yml", import.meta.url),
  "utf8",
);
const routing = readFileSync(new URL("../scripts/select-pr-agent-skills.mjs", import.meta.url), "utf8");
const copilotSkill = readFileSync(
  new URL("../.claude/skills/copilotkit/SKILL.md", import.meta.url),
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
    expect(workflow).toContain("amoai-tech/pr-review-infra/.github/workflows/pr-agent.yml@a3c9600de7a31184266fade8387359ccbb8e6d68");
    expect(routing).toContain("code-review");
    expect(routing).toContain("mastra");
    expect(routing).toContain("copilotkit");
    expect(routing).toContain("supabase-review");
    expect(routing).toContain("nextjs-developer");
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

  it("keeps canonical CopilotKit review guidance anchored to v2 invariants", () => {
    expect(copilotSkill).toContain("name: copilotkit");
    expect(copilotSkill).toContain("@copilotkit/runtime/v2");
    expect(copilotSkill).toContain("@copilotkit/react-core/v2");
    expect(copilotSkill).toContain("Browser-supplied IDs are not authorization");
    expect(copilotSkill).toContain("installed package source/types");
        expect(copilotSkill).toContain("Fix: Restore the changed CopilotKit import to its `/v2` subpath.");
    expect(copilotSkill).toContain("Verification: Run the existing targeted CopilotKit route tests, then `npm run typecheck`.");
    expect(copilotSkill).toContain("Expected result: The route uses the `/v2` import and the targeted tests/typecheck pass.");
  });
});
