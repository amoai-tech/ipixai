import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");
const agentsRoot = resolve(repoRoot, ".agents/skills");
const claudeRoot = resolve(repoRoot, ".claude/skills");
const registryPath = resolve(agentsRoot, "registry.json");

type RegistryEntry = {
  owner: string;
  type: string;
  canonical: string;
  modes: string[];
  delegates_to: string[];
  do_not_use_for: string[];
  claude_exposed: boolean;
  replaces?: string[];
  routing_patterns?: string[];
};

type Registry = { version: number; skills: Record<string, RegistryEntry> };
const registry = JSON.parse(readFileSync(registryPath, "utf8")) as Registry;

function canonicalSkillNames(): string[] {
  return readdirSync(agentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(agentsRoot, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}

function selectSkill(prompt: string): string | undefined {
  for (const [name, entry] of Object.entries(registry.skills)) {
    if ((entry.routing_patterns ?? []).some((pattern) => new RegExp(pattern, "i").test(prompt))) return name;
  }
  return undefined;
}

describe("skill registry contract", () => {
  it("covers every canonical .agents skill exactly once with required governance metadata", () => {
    expect(Object.keys(registry.skills).sort()).toEqual(canonicalSkillNames());

    for (const [name, entry] of Object.entries(registry.skills)) {
      expect(entry.owner, `${name} owner`).toBeTruthy();
      expect(entry.type, `${name} type`).toBeTruthy();
      expect(entry.canonical, `${name} canonical`).toBe(`.agents/skills/${name}`);
      expect(Array.isArray(entry.modes), `${name} modes`).toBe(true);
      expect(Array.isArray(entry.delegates_to), `${name} delegates_to`).toBe(true);
      expect(Array.isArray(entry.do_not_use_for), `${name} do_not_use_for`).toBe(true);
      expect(typeof entry.claude_exposed, `${name} claude_exposed`).toBe("boolean");
      expect(existsSync(resolve(repoRoot, entry.canonical, "SKILL.md")), `${name} canonical SKILL.md`).toBe(true);

      const claudePath = resolve(claudeRoot, name);
      const isClaudeSymlink = existsSync(claudePath) && lstatSync(claudePath).isSymbolicLink();
      expect(isClaudeSymlink, `${name} Claude exposure must match registry`).toBe(entry.claude_exposed);
      if (entry.claude_exposed) expect(realpathSync(claudePath)).toBe(realpathSync(resolve(agentsRoot, name)));

      for (const delegate of entry.delegates_to) {
        const known = delegate in registry.skills || existsSync(resolve(claudeRoot, delegate, "SKILL.md"));
        expect(known, `${name} delegates_to unknown skill ${delegate}`).toBe(true);
      }
    }
  });

  it("routes representative prompts to the intended canonical skill", () => {
    const cases = [
      ["write acceptance criteria", "requirements"],
      ["turn this conversation into a spec", "to-spec"],
      ["make an implementation plan", "writing-plans"],
      ["plan a risky multi-file migration", "refactor-plan"],
      ["tests are flaky in CI", "diagnosing-bugs"],
      ["explore this app for bugs", "explorbot"],
      ["run deterministic browser steps", "playwright-cli"],
    ] as const;
    for (const [prompt, expected] of cases) expect(selectSkill(prompt), prompt).toBe(expected);
  });

  it("keeps the committed skill index generated from the registry", () => {
    const index = readFileSync(resolve(claudeRoot, "index-skills.md"), "utf8");
    expect(index).toContain("GENERATED FILE — DO NOT EDIT");
    for (const name of canonicalSkillNames()) expect(index, `index missing ${name}`).toContain(`\`${name}\``);
  });

  it("enforces registry and generated-index checks in the main CI build job", () => {
    const ci = readFileSync(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("npm run skills:registry:check");
    expect(ci).toContain("npm run skills:index:check");
  });
});
