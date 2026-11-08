import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../.claude/skills/mastra/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

describe("IPI-1419 — Mastra 1.82 reference migration safety", () => {
  it("quarantines the unrelated MDE concierge while preserving its history", () => {
    expect(read("references/mdeai-concierge.md")).toContain("LEGACY MDE ONLY");
    expect(read("../../../docs/archive/mastra/mdeai-concierge.md")).toContain("NOT FOR IPIX");
    expect(read("links.md")).toContain("docs/archive/mastra/mdeai-concierge.md");
    expect(read("references/topic-routing.md")).toContain("IPI-1385");
  });

  it("does not misclassify iPix CopilotKit v2 as deferred MDE v1", () => {
    for (const file of ["display-only.md", "headless-ui.md", "slots.md"]) {
      const content = read("references/" + file);
      expect(content).toContain("Historical sample, not an iPix setup guide");
      expect(content).toContain("canonical");
      expect(content).not.toContain("Do NOT load for mdeapp Phase 1");
      expect(content).not.toContain("mdeapp: defer-v2");
    }
    expect(read("references/copilotkit.md")).toContain("separate-server");
    expect(read("references/react.md")).toContain("New-project tutorial only");
    expect(read("references/create-mastra.md")).toContain("Scaffold-only reference");
  });

  it("marks optional supervisors, browser automation and v0 examples as historical", () => {
    expect(read("references/agents-supervisor.md")).toContain("Optional architecture");
    expect(read("references/browser.md")).toContain("iPix boundary");
    expect(read("references/examples-v0.md")).toContain("Historical / reference-only");
    expect(read("links.md")).not.toContain("../skill-creator/SKILL.md");
  });

  it("does not expose MDE embedding decisions as current iPix truth", () => {
    const generic = read("references/rag-pgvector.md");
    expect(generic).toContain("iPix upgrade boundary");
    expect(generic).toContain("ipix-supabase");
    expect(generic).not.toContain("**Embeddings = Gemini, not OpenAI.**");
    expect(generic).not.toContain("mdeai scope (read first");
    expect(read("../../../docs/archive/mastra/mdeai-vector-decisions.md")).toContain("MDE-only");
  });

  it("never grants workspace command execution through browser-controlled context", () => {
    const workspace = read("references/workspace.md");
    expect(workspace).not.toContain("return requestContext['allowExecution']");
    expect(workspace).toContain("enabled: async () => false");
    expect(workspace).toContain("server-side authenticated actor");
    expect(workspace).toContain("requireApproval: async () => true");
    expect(workspace).not.toContain("readOnly: role !== 'admin'");
    expect(workspace).toContain("createWorkspaceForAuthenticatedRequest(request: Request)");
    expect(workspace).toContain("requireAuthorizedWorkspaceRoot(request)");
    expect(workspace).not.toContain("const authorizedWorkspaceRoot = await");
  });

  it("distinguishes MCP schemas and optional observability features", () => {
    const docs = read("references/mcp-docs-lookup.md");
    expect(docs).toContain("search_mastra_knowledge_sources({ query:");
    expect(docs).toContain("actual schema");
    expect(docs).toContain("1.82.0");
    expect(read("references/trace-intelligence.md")).toContain("Optional Mastra Platform private beta");
    expect(read("references/trace-intelligence.md")).toContain("observability/tracing/advanced-queries#check-capabilities");
  });
});
