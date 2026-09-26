import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { markdownTableCell, pathEntryExists, selectSkillForPrompt, validateRegistry } from "../scripts/skill-registry.mjs";

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
  routing_phrases?: string[];
};

type Registry = { version: number; skills: Record<string, RegistryEntry> };
const registry = JSON.parse(readFileSync(registryPath, "utf8")) as Registry;

function canonicalSkillNames(): string[] {
  return readdirSync(agentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(agentsRoot, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
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
        const known = Object.hasOwn(registry.skills, delegate) || existsSync(resolve(claudeRoot, delegate, "SKILL.md"));
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
    for (const [prompt, expected] of cases) expect(selectSkillForPrompt(prompt, registry), prompt).toBe(expected);
  });

  it("uses literal routing phrases instead of dynamic regular expressions", () => {
    const source = readFileSync(resolve(repoRoot, "scripts/skill-registry.mjs"), "utf8");
    expect(source).not.toContain("new RegExp");
    expect(source).not.toContain("routing_patterns");
  });

  it("bounds raw prompt length before normalization and matching", () => {
    expect(selectSkillForPrompt("a".repeat(20_001), registry)).toBeUndefined();
  });

  it("returns undefined for ambiguous routing instead of silently choosing the first match", () => {
    const ambiguous = structuredClone(registry) as Registry;
    ambiguous.skills["writing-plans"].routing_phrases = ["acceptance criteria"];
    expect(selectSkillForPrompt("write acceptance criteria", ambiguous)).toBeUndefined();
  });

  it("matches routing phrases only at literal token boundaries", () => {
    expect(selectSkillForPrompt("please write a user story about checkout", registry)).toBe("requirements");
    expect(selectSkillForPrompt("please write a user storyboard", registry)).toBeUndefined();
    expect(selectSkillForPrompt("plan a multi-file refactoring", registry)).toBeUndefined();
  });

  it("rejects inherited Object.prototype names as unknown delegates", () => {
    const malformed = structuredClone(registry) as Registry;
    malformed.skills.requirements.delegates_to = ["constructor"];
    expect(validateRegistry(malformed)).toContain("requirements: unknown delegate constructor");
  });

  it("rejects aliases claimed by different owners", () => {
    const conflicting = structuredClone(registry) as Registry & { deprecated_aliases?: Record<string, string> };
    conflicting.skills.requirements.replaces = ["shared-alias"];
    conflicting.skills.explain.replaces = ["shared-alias"];
    conflicting.deprecated_aliases = { "deprecated-shared": "requirements" };
    conflicting.skills.explain.replaces.push("deprecated-shared");

    const errors = validateRegistry(conflicting);
    expect(errors).toContain("alias shared-alias claimed by both explain and requirements");
    expect(errors).toContain("alias deprecated-shared claimed by both explain and requirements");
  });

  it("rejects non-array replaces and routing_phrases without throwing on invalid phrases", () => {
    const malformed = structuredClone(registry) as any;
    malformed.skills.requirements.replaces = "legacy-skill";
    malformed.skills.requirements.routing_phrases = "write acceptance criteria";
    malformed.skills.explain.routing_phrases = [null, "", "x".repeat(201)];

    const errors = validateRegistry(malformed);
    expect(errors).toContain("requirements: replaces must be an array");
    expect(errors).toContain("requirements: routing_phrases must be an array");
    expect(errors.filter((error) => error === "explain: routing phrase must be a non-empty string")).toHaveLength(2);
    expect(errors).toContain("explain: routing phrase is too long");
  });

  it("detects dangling symlink filesystem entries without following them", () => {
    const root = mkdtempSync(resolve(tmpdir(), "ipix-skill-registry-"));
    const link = resolve(root, "deprecated-alias");
    try {
      symlinkSync(resolve(root, "missing-target"), link);
      expect(pathEntryExists(link)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports a missing canonical directory instead of throwing", () => {
    const broken = structuredClone(registry) as Registry;
    broken.skills["missing-canonical"] = {
      ...structuredClone(registry.skills.explain),
      canonical: ".agents/skills/missing-canonical",
      claude_exposed: true,
    };
    expect(validateRegistry(broken)).toContain("missing-canonical: canonical skill directory missing");
  });

  it("escapes Markdown table delimiters and newlines", () => {
    expect(markdownTableCell("owner | team\nline 2")).toBe("owner \\| team<br>line 2");
  });

  it("preserves literal backslashes while escaping Markdown table pipes", () => {
    expect(markdownTableCell(String.raw`owner \| team`)).toBe(String.raw`owner \\\| team`);
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
