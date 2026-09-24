import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");
const skill = (name: string) => resolve(repoRoot, ".agents/skills", name, "SKILL.md");
const claudeSkill = (name: string) => resolve(repoRoot, ".claude/skills", name, "SKILL.md");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

describe("skill consolidation contract", () => {
  it("uses one QA review skill and one PR analysis skill", () => {
    expect(existsSync(skill("qa-review"))).toBe(true);
    expect(existsSync(skill("qa-pr-analysis"))).toBe(true);

    for (const removed of [
      "qa-review-pr",
      "qa-thinking",
      "pull-request-diff-analyzer",
      "qa-pr-requirements-analyzer",
    ]) {
      expect(existsSync(skill(removed)), `${removed} should be removed`).toBe(false);
    }

    const workflow = read(".agents/skills/testing-workflow/SKILL.md");
    expect(workflow).toContain("`qa-review`");
    expect(workflow).toContain("`qa-pr-analysis`");
    expect(workflow).not.toMatch(/`(?:qa-review-pr|qa-thinking|pull-request-diff-analyzer|qa-pr-requirements-analyzer)`/);
  });

  it("uses one Explorbot skill", () => {
    expect(existsSync(skill("explorbot"))).toBe(true);
    for (const removed of ["explorbot-setup", "explorbot-plan", "explorbot-fundamentals"]) {
      expect(existsSync(skill(removed)), `${removed} should be removed`).toBe(false);
    }
  });


  it("uses one Testomat.io integration skill with reference workflows", () => {
    expect(existsSync(skill("testomatio"))).toBe(true);

    for (const ref of ["reporting.md", "sync.md", "mcp.md", "runs.md", "pr-testing.md"]) {
      expect(
        existsSync(resolve(repoRoot, ".agents/skills/testomatio/references", ref)),
        `testomatio reference ${ref}`,
      ).toBe(true);
    }

    for (const removed of [
      "qa-e2e-tests-reporting",
      "qa-sprint-report-by-testomatio",
      "run-tests-with-testomatio-reporter",
      "setup-change-aware-pr-testing",
      "sync-test-cases-with-tms",
      "testomatio-mcp",
    ]) {
      expect(existsSync(skill(removed)), `${removed} should be removed`).toBe(false);
    }

    const workflow = read(".agents/skills/testing-workflow/SKILL.md");
    expect(workflow).toContain("`testomatio`");
    expect(workflow).not.toMatch(
      /`(?:qa-e2e-tests-reporting|qa-sprint-report-by-testomatio|run-tests-with-testomatio-reporter|setup-change-aware-pr-testing|sync-test-cases-with-tms|testomatio-mcp)`/,
    );
  });

  it("routes fastest-path requests through tasks without a standalone fastest skill", () => {
    expect(existsSync(claudeSkill("fastest"))).toBe(false);

    const fastestMode = read(".claude/skills/tasks/references/fastest-path.md");
    expect(fastestMode).toContain("Verified fastest-path mode");
    expect(fastestMode).toContain("Stop at the first solution that fully satisfies the task without weakening evidence");

    const claudeCommand = read(".claude/commands/fastest.md");
    expect(claudeCommand).toContain(".claude/skills/tasks/SKILL.md");
    expect(claudeCommand).toContain(".claude/skills/tasks/references/fastest-path.md");
    expect(claudeCommand).not.toContain(".claude/skills/fastest/SKILL.md");
  });

  it("does not keep removed upstream skill names in the provenance lock", () => {
    const lock = read("skills-lock.json");
    for (const removed of [
      "qa-review-pr",
      "qa-thinking",
      "pull-request-diff-analyzer",
      "qa-pr-requirements-analyzer",
      "explorbot-setup",
      "explorbot-plan",
      "explorbot-fundamentals",
      "qa-e2e-tests-reporting",
      "qa-sprint-report-by-testomatio",
      "run-tests-with-testomatio-reporter",
      "setup-change-aware-pr-testing",
      "sync-test-cases-with-tms",
      "testomatio-mcp",
    ]) {
      expect(lock).not.toContain(`\"${removed}\"`);
    }
  });
});
