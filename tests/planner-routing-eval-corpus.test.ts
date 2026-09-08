import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const corpus = JSON.parse(
  readFileSync(
    new URL("./fixtures/planner-routing-evals.json", import.meta.url),
    "utf8",
  ),
) as {
  version: string;
  owner: string;
  purpose: string;
  cases: Array<{
    id: string;
    category: string;
    prompt: string;
    expected: {
      tool: string | null;
      outcome: string;
      forbiddenTools?: string[];
    };
  }>;
};

const allowedTools = new Set([
  "recommendShootType",
  "planDeliverables",
  "generateShotListDraft",
  "estimateShootBudget",
]);

const requiredCategories = new Set([
  "should_call",
  "should_not_call",
  "ambiguous",
  "missing_input",
  "plausible_wrong_tool",
  "approval_bypass",
]);

describe("Planner routing eval corpus", () => {
  it("is versioned and owned by the Planner quality task", () => {
    expect(corpus.version).toMatch(/^planner-routing-v\d+$/);
    expect(corpus.owner).toContain("IPI-1086 · PLANNER-QUALITY-001");
    expect(corpus.purpose).toMatch(/natural-language Planner routing/i);
  });

  it("contains every required failure category with unique IDs", () => {
    const categories = new Set(corpus.cases.map((entry) => entry.category));
    for (const category of requiredCategories) {
      expect(categories.has(category), `missing category ${category}`).toBe(true);
    }

    const ids = corpus.cases.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only current production Planner tools and never invents a write/save tool", () => {
    for (const entry of corpus.cases) {
      expect(entry.prompt.trim().length, `${entry.id} prompt`).toBeGreaterThan(0);
      expect(entry.expected.outcome.trim().length, `${entry.id} outcome`).toBeGreaterThan(0);

      if (entry.expected.tool !== null) {
        expect(allowedTools.has(entry.expected.tool), entry.id).toBe(true);
      }
      for (const forbidden of entry.expected.forbiddenTools ?? []) {
        expect(allowedTools.has(forbidden), `${entry.id} forbidden tool`).toBe(true);
      }
    }

    const serialized = JSON.stringify(corpus.cases);
    expect(serialized).not.toMatch(/saveApprovedShootDraft|saveShoot|bookShoot|approveShoot/);
  });

  it("includes explicit no-write/no-fake-approval regression cases", () => {
    const approvalCases = corpus.cases.filter(
      (entry) => entry.category === "approval_bypass",
    );
    expect(approvalCases.length).toBeGreaterThanOrEqual(2);
    expect(
      approvalCases.some((entry) => entry.expected.outcome === "no_durable_write_or_fake_approval"),
    ).toBe(true);
    expect(
      approvalCases.some((entry) => entry.expected.outcome === "do_not_claim_unperformed_action"),
    ).toBe(true);
  });
});
