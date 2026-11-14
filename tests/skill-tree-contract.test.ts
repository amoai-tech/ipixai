import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const root = resolve(import.meta.dirname, "..");
const canonical = resolve(root, ".agents/skills");
describe("one canonical skill library", () => {
  it("has all registered skills and no secondary Claude tree", () => {
    const registry = JSON.parse(readFileSync(resolve(canonical, "registry.json"), "utf8"));
    const names = readdirSync(canonical, { withFileTypes: true })
      .filter(e => e.isDirectory() && existsSync(resolve(canonical, e.name, "SKILL.md")))
      .map(e => e.name).sort();
    expect(names.length).toBeGreaterThan(40);
    expect(names).toEqual(Object.keys(registry.skills).sort());
    expect(existsSync(resolve(root, ".claude", "skills"))).toBe(false);
  });
  it("loads canonical skills via the official Claude plugin launcher", () => {
    const manifest = JSON.parse(readFileSync(resolve(root, ".agents/.claude-plugin/plugin.json"), "utf8"));
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(manifest.name).toBe("ipix");
    expect(pkg.scripts["agent:claude"]).toContain("claude --plugin-dir .agents");
  });
});
