import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");
const agentsRoot = resolve(repoRoot, ".agents/skills");
const claudeRoot = resolve(repoRoot, ".claude/skills");

const deprecatedSkills = [
  "epic-requirements-specification",
  "write-user-story",
  "qa-requirement-reviewer",
  "debug-fix-failed-flaky-autotests",
] as const;

function skillMarkdownFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) out.push(...skillMarkdownFiles(path));
    else if (entry.isFile() && entry.name === "SKILL.md") out.push(path);
  }
  return out;
}

function bodyWithoutFrontmatter(text: string): string {
  if (!text.startsWith("---\n")) return text;
  const end = text.indexOf("\n---\n", 4);
  return end === -1 ? text : text.slice(end + 5);
}

describe("skill reference integrity", () => {
  it("does not route live skill docs to removed entry points", () => {
    const files = [...skillMarkdownFiles(agentsRoot), ...skillMarkdownFiles(claudeRoot)];
    const offenders: string[] = [];
    for (const file of files) {
      const text = bodyWithoutFrontmatter(readFileSync(file, "utf8"));
      for (const removed of deprecatedSkills) {
        if (text.includes(`\`${removed}\``) || text.includes(`${removed} skill`)) {
          offenders.push(`${file.slice(repoRoot.length + 1)} -> ${removed}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps consolidated requirements provenance metadata", () => {
    const text = readFileSync(resolve(agentsRoot, "requirements/SKILL.md"), "utf8");
    expect(text).toContain("license: MIT");
    expect(text).toContain("source: consolidated from testomatio/skills");
    expect(text).toContain("version: 1.0.0-ipix");
  });

  it("keeps every registry canonical path real and every replacement removed", () => {
    const registry = JSON.parse(readFileSync(resolve(agentsRoot, "registry.json"), "utf8")) as {
      skills: Record<string, { canonical: string; claude?: boolean; replaces?: string[] }>;
    };
    for (const [name, entry] of Object.entries(registry.skills)) {
      expect(existsSync(resolve(repoRoot, entry.canonical, "SKILL.md")), `${name} canonical path`).toBe(true);
      if (entry.claude) {
        expect(existsSync(resolve(claudeRoot, name, "SKILL.md")), `${name} Claude exposure`).toBe(true);
      }
      for (const removed of entry.replaces ?? []) {
        expect(existsSync(resolve(agentsRoot, removed)), `${removed} must stay removed`).toBe(false);
        expect(existsSync(resolve(claudeRoot, removed)), `${removed} Claude alias must stay removed`).toBe(false);
      }
    }
  });
});
