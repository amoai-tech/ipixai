import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

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
const mastraCoreConcepts = readFileSync(
  new URL("../.claude/skills/mastra/references/core-concepts.md", import.meta.url),
  "utf8",
);
const mastraFullGuide = readFileSync(
  new URL("../.claude/skills/mastra/references/full-guide.md", import.meta.url),
  "utf8",
);

describe("IPI-1213 PR-Agent review skills contract", () => {
  it("keeps deterministic review-skill ownership local while the shared core orchestrates it", () => {
    expect(workflow).toContain("amoai-tech/pr-review-infra/.github/workflows/pr-agent.yml@a3c9600de7a31184266fade8387359ccbb8e6d68");
    expect(routing).toContain("code-review");
    expect(routing).toContain("mastra");
    expect(routing).toContain("copilotkit");
    expect(routing).toContain("ipix-supabase");
    expect(routing).toContain("nextjs-developer");
    expect(routing).toContain("ci-review");
    expect(routing).toContain("cloudinary");
    expect(routing).toContain("max_tokens=${result.maxTokens}");
  });

  it("uses canonical Supabase and Cloudinary skills for PR review", () => {
    expect(existsSync(new URL("../.claude/skills/supabase-review/SKILL.md", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../.claude/skills/cloudinary-review/SKILL.md", import.meta.url))).toBe(false);
    expect(routing).toContain('"ipix-supabase"');
    expect(routing).toContain('"cloudinary"');
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


  it("routes the official Mastra skill refresh through iPix compatibility and privacy gates", () => {
    expect(mastraSkill).toContain('version: "2.5.0-ipix.2"');
    expect(mastraSkill).toContain("3020257c173e40f3a49ae6a67d46557fa771e0d4");
    expect(mastraSkill).toContain("explicit human approval");
    expect(mastraSkill).toContain("npm run dev:agent");
    expect(mastraSkill).toContain("npm run dev:ui");
    expect(mastraSkill).toContain("server verified");
    expect(traceQueryReference).toContain("https://mastra.ai/reference/observability/tracing/advanced-queries");
    expect(traceQueryReference).toContain("does not expose");
    expect(traceQueryReference).toContain("spanQuery");
    expect(traceQueryReference).toContain("traceAggregate");
    expect(traceQueryReference).toContain("scores.some");
    expect(traceQueryReference).toContain("feedback.some");
    expect(traceQueryReference).toContain("not a successful live query");
    expect(mastraFullGuide).toContain("default: getProductionPlannerAgent()");
    expect(mastraFullGuide).toContain("Local development may warn and use in-memory storage");
    expect(mastraFullGuide).not.toContain("**Current:** `weather-agent`");
    expect(mastraCoreConcepts).toContain("default: getProductionPlannerAgent()");
    expect(mastraCoreConcepts).toContain("IPIX_MASTRA_HOSTED");
    expect(mastraCoreConcepts).toContain("warned in-memory storage");
    expect(mastraCoreConcepts).not.toContain("starter `weather-agent`");
  });

  it("uses real Claude Code discovery instead of inert metadata paths", () => {
    const match = mastraSkill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    expect(match).not.toBeNull();
    const meta = parse(match![1]) as {
      name: string;
      description: string;
      paths?: string[];
      metadata?: { paths?: string[] };
    };
    expect(meta.name).toBe("mastra");
    expect(meta.description.length).toBeLessThan(500);
    expect(meta.description).toContain("Production Planner");
    expect(meta.description).toContain("CopilotKit/AG-UI");
    expect(meta.description).toContain("outside src/mastra/");
    expect(meta.paths).toBeUndefined();
    expect(meta.metadata?.paths).toBeUndefined();
    const triggerCases = JSON.parse(readFileSync(
      new URL("../.claude/skills/mastra/evals/trigger-eval.json", import.meta.url),
      "utf8",
    )) as { query: string; should_trigger: boolean }[];
    expect(triggerCases.some((item) => item.should_trigger && item.query.includes("/api/copilotkit"))).toBe(true);
    expect(triggerCases.some((item) => !item.should_trigger && item.query.includes("Cloudinary"))).toBe(true);
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
