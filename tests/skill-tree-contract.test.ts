import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");
const agentsRoot = resolve(repoRoot, ".agents/skills");
const claudeRoot = resolve(repoRoot, ".claude/skills");

// Only skills intentionally exposed through Claude belong here. Other canonical .agents skills
// may remain .agents-only until a Claude workflow needs a compatibility symlink.
const claudeExposedSharedSkills = [
  "brainstorming",
  "code-review",
  "codebase-design",
  "diagnosing-bugs",
  "dispatching-parallel-agents",
  "domain-modeling",
  "explain",
  "lean",
  "playwright-cli",
  "qa-pr-analysis",
  "qa-review",
  "receiving-code-review",
  "refactor-plan",
  "requesting-code-review",
  "research",
  "explorbot",
  "resolving-merge-conflicts",
  "subagent-driven-development",
  "tdd",
  "testomatio",
  "to-spec",
  "writing-plans",
] as const;

function realSkillNames(root: string): Set<string> {
  return new Set(
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !lstatSync(resolve(root, entry.name)).isSymbolicLink())
      .map((entry) => entry.name),
  );
}

describe("canonical skill tree contract", () => {
  it("keeps intentionally Claude-exposed shared skills canonical in .agents and symlinked from .claude", () => {
    for (const skill of claudeExposedSharedSkills) {
      const canonical = resolve(agentsRoot, skill);
      const claude = resolve(claudeRoot, skill);
      expect(existsSync(resolve(canonical, "SKILL.md")), `${skill} canonical SKILL.md`).toBe(true);
      expect(lstatSync(claude).isSymbolicLink(), `${skill} Claude entry must be a symlink`).toBe(true);
      expect(realpathSync(claude), `${skill} symlink target`).toBe(realpathSync(canonical));
    }
  });

  it("has no skill represented by real directories in both trees", () => {
    const agentSkills = realSkillNames(agentsRoot);
    const claudeSkills = realSkillNames(claudeRoot);
    const duplicates = [...agentSkills].filter((skill) => claudeSkills.has(skill));
    expect(duplicates).toEqual([]);
  });

  it("has no broken symlinks in the Claude skill discovery layer", () => {
    const broken = readdirSync(claudeRoot, { withFileTypes: true })
      .filter((entry) => entry.isSymbolicLink())
      .map((entry) => entry.name)
      .filter((name) => !existsSync(resolve(claudeRoot, name, "SKILL.md")));
    expect(broken).toEqual([]);
  });
});
