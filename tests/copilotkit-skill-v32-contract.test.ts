import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../.agents/skills/copilotkit/", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");

describe("IPI-1420 — official CopilotKit v3.2 lookup with iPix overlay", () => {
  it("pins official upstream while retaining one local iPix skill", () => {
    const s = read("SKILL.md");
    expect(s).toContain("3.2.0-ipix.1");
    expect(s).toContain("c7815d9ac96f48fb3a64ad8c18e176a870c81763");
    expect(s).toContain("one canonical iPix CopilotKit skill");
    expect(s).toContain("AGENTS.md");
  });

  it("keeps v2 API and in-process tenant runtime contracts", () => {
    const s = read("SKILL.md");
    for (const required of [
      "@copilotkit/runtime/v2",
      "@copilotkit/react-core/v2",
      "createLocalAgents(resourceId)",
      "TenantAbortRunner",
      "default",
      "Supabase Auth",
      "RLS",
      "Humans decide",
    ]) expect(s).toContain(required);
  });

  it("routes docs to separate CopilotKit and AG-UI sources with an MCP fallback", () => {
    const s = read("SKILL.md");
    for (const required of [
      "docs.copilotkit.ai/llms.txt",
      "docs.copilotkit.ai/sitemap.xml",
      "search-docs",
      "search-code",
      "search-ag-ui-docs",
      "search-ag-ui-code",
      "docs.ag-ui.com/llms.txt",
      "does not",
    ]) expect(s).toContain(required);
    expect(s).not.toContain("MCP auto-configured");
  });

  it("does not run cloud setup, new project scaffolding or live round trip by default", () => {
    const s = read("SKILL.md");
    expect(s).toContain("Do not run automatically");
    expect(s).toContain("--expect-runtime oss");
    expect(s).toContain("model");
    expect(s).toContain("persist");
    expect(s).toContain("project select");
    expect(s).toContain("login");
  });

  it("updates stale upstream inventory and prevents unsafe v1 migration", () => {
    const update = read("references/self-update.md");
    expect(update).toContain("copilotkit-cli");
    expect(update).toContain("intelligence-vocabulary");
    expect(update).toContain("current official inventory");
    const migration = read("references/upgrade/upgrade.md");
    expect(migration).toContain("@copilotkit/react-core/v2");
    expect(migration).not.toContain("@copilotkit/react (consolidated into one package)");
    expect(read("references/debug/debug.md")).toContain("four");
  });

  it("has available legacy reference routes rather than deleting their evidence", () => {
    const s = read("SKILL.md");
    const links = [...s.matchAll(/\]\((references\/[^)#]+)(?:#[^)]+)?\)/g)];
    expect(links.length).toBeGreaterThan(12);
    for (const [, path] of links) {
      expect(existsSync(new URL(path, root)), path).toBe(true);
    }
  });

  it("routes native catalogs, surfaces, and AG-UI/A2UI inside the single CopilotKit skill", () => {
    const entry = read("SKILL.md");
    for (const ref of [
      "references/generative-ui/catalogs-and-standard.md",
      "references/generative-ui/surfaces.md",
      "references/generative-ui/a2ui-and-dynamic-schema.md",
    ]) {
      expect(entry).toContain(ref);
      expect(existsSync(new URL(ref, root)), ref).toBe(true);
    }
    expect(entry).toContain("catalogs");
    expect(entry).toContain("surfaces");
    expect(entry).toContain("dynamic schema");
  });

  it("maps official catalogs + standard UI sources to trusted read-only iPix data", () => {
    const guide = read("references/generative-ui/catalogs-and-standard.md");
    for (const url of [
      "https://docs.copilotkit.ai/generative-ui/components/catalogs",
      "https://docs.copilotkit.ai/generative-ui/components/standard-catalog",
    ]) expect(guide).toContain(url);
    for (const phrase of [
      "createGenerativeUI",
      "standardUI",
      "IPI-1387",
      "experimental",
      "Org A/B",
      "server DTO",
    ]) expect(guide.toLowerCase()).toContain(phrase.toLowerCase());
    expect(guide).toContain("Do not copy");
  });

  it("preserves single provider, named surface fallback and safe user action boundaries", () => {
    const guide = read("references/generative-ui/surfaces.md");
    expect(guide).toContain("https://docs.copilotkit.ai/generative-ui/components/surfaces");
    expect(guide).toContain("GenerativeUISurface");
    expect(guide).toContain("fallback");
    expect(guide).toContain("components");
    expect(guide).toContain("server revalidation");
    expect(guide).toContain("No new provider");
    expect(guide).toContain("Org A/B");
  });

  it("separates A2UI 1.0 native catalog from legacy v0.9 and defers dynamic schema", () => {
    const guide = read("references/generative-ui/a2ui-and-dynamic-schema.md");
    for (const url of [
      "https://www.copilotkit.ai/ag-ui-and-a2ui",
      "https://docs.copilotkit.ai/generative-ui/a2ui",
      "https://docs.copilotkit.ai/generative-ui/a2ui/dynamic-schema",
      "https://docs.copilotkit.ai/generative-ui/components/from-a2ui",
    ]) expect(guide).toContain(url);
    expect(guide).toContain("A2UI v0.9");
    expect(guide).toContain("A2UI 1.0");
    expect(guide).toContain("DEFER");
    expect(guide).toContain("createGenerativeUI");
    expect(guide).toContain("createCatalog");
    const legacy = read("references/a2ui-renderer.md");
    expect(legacy).toContain("HISTORICAL A2UI v0.9");
    expect(read("references/generative-ui.md")).toContain("IPI-1386");
  });

});
