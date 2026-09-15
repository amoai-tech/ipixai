import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const refactorPlan = readRepoFile(".claude/skills/refactor-plan/SKILL.md");
const domainModeling = readRepoFile(".claude/skills/domain-modeling/SKILL.md");
const adrFormat = readRepoFile(".claude/skills/domain-modeling/ADR-FORMAT.md");
const tasks = readRepoFile(".claude/skills/tasks/SKILL.md");
const mergeConflicts = readRepoFile(".claude/skills/resolving-merge-conflicts/SKILL.md");

describe("iPix engineering skill contracts", () => {
  test("refactor-plan continues when implementation was already requested", () => {
    expect(refactorPlan).toContain("If the user already asked to implement the refactor");
    expect(refactorPlan).toContain("continue without a second confirmation");
    expect(refactorPlan).toContain("If the user asked for planning only, stop after the plan and ask for confirmation");
  });

  test("domain-modeling uses the iPix source hierarchy and context-owned ADR directories", () => {
    const sourceOrder = [
      "Live Supabase/runtime contracts",
      "`docs/prd.md` and the product sitemap",
      "Accepted ADRs in `docs/adr/`",
      "Current `origin/main` implementation and generated types",
      "Lumina/legacy docs only as reference",
    ];

    let previousIndex = -1;
    for (const source of sourceOrder) {
      const index = domainModeling.indexOf(source);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }

    expect(adrFormat).toContain("If no root `CONTEXT-MAP.md` exists, use root `docs/adr/`");
    expect(adrFormat).toContain("If `CONTEXT-MAP.md` exists and the decision belongs to one context");
    expect(adrFormat).toContain("scan **that directory only**");
    expect(adrFormat).toContain("independent sequences");
  });

  test("tasks prefers tracer-bullet vertical slices and reserves expand-migrate-contract for wide refactors", () => {
    expect(tasks).toContain("## Ticket decomposition — vertical slices first");
    expect(tasks).toContain("prefer **tracer-bullet vertical slices** over layer-by-layer tickets");
    expect(tasks).toContain("### Wide-refactor exception — expand → migrate → contract");
    expect(tasks).toContain("whose blast radius cannot stay green as a vertical slice");
    expect(tasks).toContain("Do not pretend a horizontal breaking change is a tracer bullet");
  });

  test("merge-conflict skill allows safe pause or abort and requires confirmation for new trade-offs", () => {
    expect(mergeConflicts).toContain("If a safe evidence-backed resolution cannot be established, pause or abort");
    expect(mergeConflicts).toContain("require user confirmation before committing it");
    expect(mergeConflicts).toContain("Do **not** invent new behaviour");
  });

  test("merge-conflict skill preserves unrelated work and verifies the staged diff", () => {
    expect(mergeConflicts).toContain("Record any staged or unstaged changes that existed before conflict resolution");
    expect(mergeConflicts).toContain("Stage only the resolved files/hunks that belong to the current merge/rebase");
    expect(mergeConflicts).toContain("never use a blanket stage");
    expect(mergeConflicts).toContain("Inspect `git diff --cached` and `git status`");
    expect(mergeConflicts).toContain("the staged diff contains no unrelated changes");
  });

  test("merge-conflict skill routes high-risk iPix domains to targeted verification", () => {
    expect(mergeConflicts).toContain("Supabase migrations/RLS/RPCs");
    expect(mergeConflicts).toContain("auth/tenant code");
    expect(mergeConflicts).toContain("Mastra memory/HITL/workflows");
    expect(mergeConflicts).toContain("run the owning domain skill's targeted verification afterward");
    expect(mergeConflicts).toContain("run the cheapest decisive proof");
  });
});
