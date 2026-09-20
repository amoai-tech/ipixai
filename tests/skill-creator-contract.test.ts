import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), ".claude/skills/skill-creator");
const required = [
  "SKILL.md",
  "LICENSE.txt",
  "agents/analyzer.md",
  "agents/comparator.md",
  "agents/grader.md",
  "references/schemas.md",
  "eval-viewer/generate_review.py",
  "eval-viewer/viewer.html",
  "scripts/aggregate_benchmark.py",
  "scripts/generate_report.py",
  "scripts/improve_description.py",
  "scripts/package_skill.py",
  "scripts/quick_validate.py",
  "scripts/run_eval.py",
  "scripts/run_loop.py",
  "scripts/utils.py",
];

describe("official Anthropic skill-creator contract", () => {
  it("vendors the complete executable workflow, not only SKILL.md", () => {
    for (const file of required) expect(existsSync(join(root, file)), file).toBe(true);
  });

  it("keeps the official trigger and evaluation workflow", () => {
    const skill = readFileSync(join(root, "SKILL.md"), "utf8");
    expect(skill).toContain("name: skill-creator");
    expect(skill).toContain("measure skill performance");
    expect(skill).toContain("with-skill AND baseline");
    expect(skill).toContain("scripts.aggregate_benchmark");
    expect(skill).toContain("generate_review.py");
  });
});
