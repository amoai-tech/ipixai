import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

let agents: string;
let bestPractices: string;
let todo: string;
let changelog: string;
let refactorPlan: string;
let domainModeling: string;
let adrFormat: string;
let tasks: string;
let taskFormat: string;
let researchEvidence: string;
let externalReferenceMapping: string;
let mergeConflicts: string;

describe("iPix engineering skill contracts", () => {
  beforeAll(() => {
    agents = readRepoFile("AGENTS.md");
    bestPractices = readRepoFile("docs/ipix-platform/BEST-PRACTICES.md");
    todo = readRepoFile("todo.md");
    changelog = readRepoFile("changelog.md");
    refactorPlan = readRepoFile(".claude/skills/refactor-plan/SKILL.md");
    domainModeling = readRepoFile(".claude/skills/domain-modeling/SKILL.md");
    adrFormat = readRepoFile(".claude/skills/domain-modeling/ADR-FORMAT.md");
    tasks = readRepoFile(".claude/skills/tasks/SKILL.md");
    taskFormat = readRepoFile(".claude/skills/tasks/references/task-format.md");
    researchEvidence = readRepoFile(".claude/skills/tasks/references/research-evidence.md");
    externalReferenceMapping = readRepoFile(".claude/skills/tasks/references/external-reference-mapping.md");
    mergeConflicts = readRepoFile(".claude/skills/resolving-merge-conflicts/SKILL.md");
  });

  test("refactor-plan continues when implementation was already requested", () => {
    expect(refactorPlan).toContain("If the user already asked to implement the refactor");
    expect(refactorPlan).toContain("continue without a second confirmation");
    expect(refactorPlan).toContain("If the user asked for planning only, stop after the plan and ask for confirmation");
  });

  test("domain-modeling preserves the ordered iPix source hierarchy", () => {
    expect(domainModeling).toContain(
      [
        "1. Live Supabase/runtime contracts when they are the durable source of truth.",
        "2. `docs/prd.md` and the product sitemap for product language and scope.",
        "3. Accepted ADRs in `docs/adr/`.",
        "4. Current `origin/main` implementation and generated types.",
        "5. Lumina/legacy docs only as reference, never as V2 authority.",
      ].join("\n"),
    );
  });

  test("ADR format selects the owning directory and increments its local sequence", () => {
    expect(adrFormat).toMatch(
      /Choose the directory before numbering:[\s\S]*- If no root `CONTEXT-MAP\.md` exists, use root `docs\/adr\/`\.[\s\S]*- If `CONTEXT-MAP\.md` exists and the decision is system-wide or spans multiple contexts, use root `docs\/adr\/`\.[\s\S]*- If `CONTEXT-MAP\.md` exists and the decision belongs to one context, follow the map to that context and use that context's `docs\/adr\/`\.[\s\S]*After selecting the owning ADR directory above, scan \*\*that directory only\*\* for the highest existing number and increment by one\. Root and context-specific ADR directories maintain independent sequences\./,
    );
  });

  test("tasks prefers tracer-bullet vertical slices and reserves expand-migrate-contract for wide refactors", () => {
    expect(tasks).toContain("## Ticket decomposition — vertical slices first");
    expect(tasks).toContain("prefer **tracer-bullet vertical slices** over layer-by-layer tickets");
    expect(tasks).toContain("### Wide-refactor exception — expand → migrate → contract");
    expect(tasks).toContain("whose blast radius cannot stay green as a vertical slice");
    expect(tasks).toContain("Do not pretend a horizontal breaking change is a tracer bullet");
  });

  test("Linear governance routes each work type to exactly four approved templates and preserves the ordered reference contract", () => {
    const routingBlock = tasks.match(
      /## Linear template routing — mandatory[\s\S]*?```text\n([\s\S]*?)```/,
    )?.[1];

    expect(routingBlock?.trim()).toBe(
      [
        "Production/release certification?",
        "→ Production Readiness / Release Gate",
        "",
        "Confirmed failure requiring root-cause repair?",
        "→ Forensic Error Audit & Fix",
        "",
        "Audit/research only with no implementation?",
        "→ iPix Task Audit & Implementation Plan",
        "",
        "Otherwise",
        "→ Universal Engineering Task",
      ].join("\n"),
    );

    expect(routingBlock?.match(/^→ /gm)).toHaveLength(4);
    expect(agents).toContain("- Normal feature/fix → `Universal Engineering Task`");
    expect(agents).toContain("- Audit/research only; no implementation → `iPix Task Audit & Implementation Plan`");
    expect(agents).toContain("- Confirmed bug/root-cause repair → `Forensic Error Audit & Fix`");
    expect(agents).toContain("- Production/release certification → `Production Readiness / Release Gate`");
    expect(agents).toContain("Before implementation, use one of two explicit paths:");
    expect(agents).toContain("**Standard path:**");
    expect(agents).toContain("**Exception path:**");
    expect(tasks).toContain("Before implementation, use one of two explicit paths:");
    expect(tasks).toContain("**Standard path:**");
    expect(tasks).toContain("**Exception path:**");
    expect(agents).toContain("If Linear is temporarily unavailable");
    expect(agents).toContain("reconcile that handoff back into Linear before marking the issue Done");
    expect(tasks).toContain("If Linear is temporarily unavailable");
    expect(tasks).toContain("reconcile it back into Linear before marking the issue Done");

    for (const source of [agents, tasks, bestPractices]) {
      expect(source).not.toContain("reuse-rule-linear-task");
    }

    expect(bestPractices).toMatch(
      /exact URL \+ exact source file\/example\/section\/symbol[\s\S]*tracking class:[\s\S]*Inspect[\s\S]*approved implementation Action[\s\S]*Current owner \/ truth[\s\S]*exact target\/destination[\s\S]*do-not-copy\/defer\/drop boundary[\s\S]*Constraints[\s\S]*precise change[\s\S]*exact verification[\s\S]*Checkpoint: PASS \+ evidence[\s\S]*STOP condition/,
    );
  });

  test("todo stays a short Linear handoff while changelog stays curated shipped history", () => {
    expect(todo).toContain("Linear is the authoritative task/status source");
    expect(todo).toContain("## Current");
    expect(todo).toContain("## Durable sources");
    expect(todo).toContain("Live verification evidence: PR #258 + IPI-1294");
    expect(todo).toContain("PR merge gate:");
    expect(todo).toContain("Remaining IPI-1294 work (not PR merge blockers):");
    expect(todo).not.toContain("Exact head:");
    expect(todo).not.toContain("complete the live Linear template + integration settings work, then merge/certify PR #258");
    expect(changelog).toContain("# Changelog");
    expect(changelog).toContain("## [Unreleased]");
    expect(changelog).toContain("### Added");
    expect(changelog).toContain("### Security");
    expect(changelog).toContain("notable verified");
  });

  test("tasks makes the external-reference mapping supplement discoverable from governing guidance", () => {
    expect(tasks).toContain("[external-reference-mapping.md](references/external-reference-mapping.md)");
    expect(taskFormat).toContain("[external-reference-mapping.md](external-reference-mapping.md)");
    expect(researchEvidence).toContain("[external-reference-mapping.md](external-reference-mapping.md)");
  });

  test("external-reference mapping supplements the canonical action and source contract", () => {
    expect(externalReferenceMapping).toMatch(/supplement[s]?, rather than replace[s]?/i);
    expect(externalReferenceMapping).toContain("Tracking class");
    expect(externalReferenceMapping).toContain("**Inspect**");
    expect(externalReferenceMapping).toContain("**Action**");
    expect(externalReferenceMapping).toContain("**Current owner / truth**");
    expect(externalReferenceMapping).toContain("**Constraints**");
    expect(externalReferenceMapping).not.toContain("**Reference 1 — ADAPT**");
  });

  test("external-reference mapping keeps checkpoint and STOP requirements synchronized", () => {
    expect(externalReferenceMapping).toMatch(
      /Required mapping:[\s\S]*checkpoint[\s\S]*STOP condition[\s\S]*```/i,
    );
    expect(externalReferenceMapping).toMatch(
      /## Ready gate[\s\S]*Inspect[\s\S]*Action[\s\S]*Current owner \/ truth[\s\S]*Constraints[\s\S]*checkpoint[\s\S]*STOP condition/i,
    );
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
