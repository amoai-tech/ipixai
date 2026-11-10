import { readFileSync, existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * AGENT-DOCS-001 · IPI-1370 — the agent contract files must describe this
 * repository, not a remembered version of it.
 *
 * Why this test exists: `AGENTS.md` and `CLAUDE.md` are the first thing every
 * coding agent reads, and nothing validated them. That is how the documented
 * default local-database path (`supabase start`) stayed broken, how a
 * machine-local absolute path survived in a portable open format, and how
 * `CLAUDE.md` grew 13 sections that restated `AGENTS.md`.
 *
 * Two of the three checks below are pure drift detection and cost nothing:
 * every repository path the docs reference must exist, and every
 * `npm run <script>` they name must exist in `package.json`. Rename a skill
 * directory or a script and this fails instead of silently misleading an agent.
 *
 * Deliberately EXCLUDED from the path check, because they are generated or
 * local-only and legitimately absent in CI:
 *   - `graphify-out/**`   — generated analysis state, gitignored, never shipped
 *   - `.env*`             — local secret files, gitignored
 *
 * What the scanner does and does NOT cover, so the guarantee is not overstated:
 * it reads inline-code references (`` `src/a.ts` ``) and repository-relative
 * Markdown links, matched against `TRACKED_PREFIXES` plus `BARE_FILES`. A path
 * written as bare prose, or under a directory absent from `TRACKED_PREFIXES`,
 * is NOT validated. Add the prefix when a doc starts referencing a new tree.
 */

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const DOCS = ["AGENTS.md", "CLAUDE.md"] as const;

/** Repository-relative prefixes whose members must exist as real files. */
const TRACKED_PREFIXES = [
  ".claude/",
  ".agents/",
  ".cursor/",
  "src/",
  "scripts/",
  "tests/",
  "docs/",
  "supabase/",
  "e2e/",
  ".github/",
] as const;

/** Generated or local-only trees that are legitimately absent. */
const GENERATED_PREFIXES = ["graphify-out/"] as const;

/** Bare filenames the docs reference that must also exist. */
const BARE_FILES = ["AGENTS.md", "CLAUDE.md", "package.json", ".gitignore"] as const;

function referencedPaths(source: string): string[] {
  const found = new Set<string>();

  // Inline-code references: `src/mastra/pg-store.ts`
  for (const token of source.match(/`([^`\n]+)`/g) ?? []) {
    const value = token.slice(1, -1);
    if (value.includes(" ") || value.includes("*") || value.includes("<")) continue;
    if (TRACKED_PREFIXES.some((prefix) => value.startsWith(prefix))) found.add(value);
    if ((BARE_FILES as readonly string[]).includes(value)) found.add(value);
  }

  // Markdown links to repository files: [text](docs/thing.md)
  for (const match of source.match(/\]\(([^)]+)\)/g) ?? []) {
    const rawValue = match.slice(2, -1);
    if (rawValue.startsWith("http") || rawValue.startsWith("#")) continue;
    const value = rawValue.split("#")[0].replace(/^\.\//, "");
    if (!value) continue;
    if (TRACKED_PREFIXES.some((prefix) => value.startsWith(prefix))) found.add(value);
    if ((BARE_FILES as readonly string[]).includes(value)) found.add(value);
  }

  return [...found].filter(
    (value) => !GENERATED_PREFIXES.some((prefix) => value.startsWith(prefix)),
  );
}

describe("IPI-1370 AGENT-DOCS-001: agent contract files describe the real repository", () => {
  it("normalizes local Markdown link fragments and ./ prefixes before validation", () => {
    const refs = referencedPaths(
      "[rules](AGENTS.md#rules) [layout](./src/app/layout.tsx#metadata)",
    );
    expect(refs).toContain("AGENTS.md");
    expect(refs).toContain("src/app/layout.tsx");
  });

  it.each(DOCS)(
    "%s references only existing paths, for the inline-code and relative-link forms it scans",
    (doc) => {
      const missing = referencedPaths(read(doc)).filter(
        (value) => !existsSync(new URL(`../${value}`, import.meta.url)),
      );
      expect(
        missing,
        `${doc} references path(s) that do not exist: ${missing.join(", ")}. ` +
          "Either create the path, or update the reference — do not leave the contract stale.",
      ).toEqual([]);
      // Guard against the scanner silently matching nothing.
      expect(referencedPaths(read(doc)).length).toBeGreaterThan(3);
    },
  );

  it.each(DOCS)("%s names only npm scripts that exist in package.json", (doc) => {
    const scripts = Object.keys(
      JSON.parse(read("package.json")).scripts ?? {},
    ) as string[];
    const source = read(doc);
    const named = new Set<string>();
    for (const match of source.match(/npm run ([a-zA-Z0-9:_-]+)/g) ?? []) {
      named.add(match.replace("npm run ", ""));
    }
    // `npm test` invokes the `test` lifecycle script directly (with `pretest`).
    for (const _match of source.match(/npm test\b/g) ?? []) named.add("test");
    const unknown = [...named].filter((name) => !scripts.includes(name));
    expect(
      unknown,
      `${doc} tells agents to run script(s) that package.json does not define: ${unknown.join(", ")}`,
    ).toEqual([]);
    // Guard against the assertion silently matching nothing.
    expect(named.size).toBeGreaterThan(0);
  });

  it("documents the full precedence chain, including that user chat wins", () => {
    const agents = read("AGENTS.md");
    expect(agents).toContain("Precedence, highest first:");
    expect(agents).toContain("an explicit instruction from the user in chat");
    expect(agents).toContain("the closest `AGENTS.md` to the file being edited");
    // Nested AGENTS.md files must be named, not described as hypothetical:
    // they already exist and the closest one wins for its subtree.
    expect(agents).toContain(".claude/skills/vercel-react-best-practices/AGENTS.md");
    // Both Claude files must be placed correctly, and they are different files:
    // the root CLAUDE.md is the overlay; .claude/CLAUDE.md is directory-scoped
    // trigger notes for work under .claude/. Conflating them mis-states which
    // file an agent should read.
    expect(agents).toContain("`CLAUDE.md` at the repository root — the Claude-only overlay");
    expect(agents).toContain("`.claude/CLAUDE.md` — a directory-scoped file");
    expect(agents).toContain("Claude-specific overlays apply only within their scope");
    expect(agents).toContain("further specializes the root `CLAUDE.md` only for work under `.claude/`");
    expect(agents).not.toContain("It ranks with rule 2 for that subtree");
  });

  it("keeps AGENTS.md portable — no machine-local absolute paths", () => {
    const agents = read("AGENTS.md");
    const localPaths = agents.match(/\/(?:home|Users)\/[A-Za-z0-9._-]+\//g) ?? [];
    expect(
      localPaths,
      "AGENTS.md is a portable open format; absolute developer paths do not belong in it.",
    ).toEqual([]);
  });

  it("CLAUDE.md is an overlay, not a second copy of the repository-wide rules", () => {
    const claude = read("CLAUDE.md");
    // Sections that AGENTS.md owns. CLAUDE.md once restated 13 of them and the
    // two copies had already drifted (e.g. two spellings of the Linear naming rule).
    const ownedByAgents = [
      "## Claude workflow",
      "## Fastest safe path",
      "## Mermaid reasoning",
      "## Source of truth",
      "## Architecture reminders",
      "## Verification",
      "## Git / task safety",
      "## Graphify",
    ];
    // Exact line equality, not a constructed RegExp: the headings are static,
    // and a plain string comparison says exactly what it does.
    const claudeLines = claude.split("\n");
    for (const heading of ownedByAgents) {
      expect(
        claudeLines.includes(heading),
        `CLAUDE.md restates "${heading}", which AGENTS.md owns — use a pointer instead.`,
      ).toBe(false);
    }
    expect(claude).toContain("must not restate or override repository-wide rules");
    expect(claude).toContain("A second copy in this file is drift, not documentation.");
  });

  it("keeps the merge-authority rule intact", () => {
    const agents = read("AGENTS.md");
    expect(agents).toContain("### Merge authority — human approval is mandatory");
    expect(agents).toContain("Explicit human approval for that exact head SHA");
    // The rule must not acquire an agent-side escape hatch.
    expect(agents).toContain("no agent-side override");
  });

  it("records the verified local-Supabase root cause and the supported local path", () => {
    const agents = read("AGENTS.md");
    // IPI-1374 fixed this rather than documenting a workaround, so the assertions pin the
    // fix: the failure a developer still sees when bypassing the wrapper, the mechanism
    // that causes it, the supported entry point, and why CI is unaffected.
    expect(agents).toContain("failed to parse config: missing private key");
    expect(agents).toContain("DOTENV_PRIVATE_KEY_LOCAL");
    expect(agents).toContain("`env(NAME)`");
    expect(agents).toContain("npm run supabase:cli -- start");
    expect(agents).toContain("npm run supabase:cli -- db reset --local");
    expect(agents).toContain("--ignore=MISSING_ENV_FILE");
    expect(agents).toContain("For Mastra/Postgres-only proofs");
    expect(agents).not.toContain("Default writes: **disposable Postgres");
    // The workaround-era framing must not return: the conflict is resolved, so
    // "run the CLI from a copy of `supabase/` outside this working tree" is no longer
    // the documented path for full Supabase proofs.
    expect(agents).not.toContain("Known local-environment breakage");
    expect(agents).not.toContain("For full Supabase proofs");
  });

  it("keeps the QA runner optional and never requires local secrets in clean CI", () => {
    const agents = read("AGENTS.md");
    const tasks = read(".agents/skills/tasks/SKILL.md");
    const guide = read("docs/development/testing-with-1password.md");
    const { scripts } = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(agents).toContain("docs/development/testing-with-1password.md");
    expect(tasks).toContain("docs/development/testing-with-1password.md");
    expect(guide).toContain("command -v ipix-qa-op");
    expect(guide).toContain("ipix-qa-op check");
    expect(guide).toContain("ipix-qa-op login");
    expect(guide).toContain("ipix-qa-op e2e");
    expect(guide).toContain("If the QA worktree is older than the candidate SHA");
    expect(guide).toContain("not a promise about every agent or CI runner");
    expect(guide).not.toMatch(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
    for (const name of ["e2e", "docs:check", "pretest", "secrets:check"]) {
      expect(scripts[name], name + " must exist in package.json").toBeTruthy();
    }
  });

  it("agrees on shared skill ownership and a reuse-first task gate", () => {
    const agents = read("AGENTS.md");
    const claude = read("CLAUDE.md");
    const tasks = read(".agents/skills/tasks/SKILL.md");
    expect(claude.startsWith("@AGENTS.md\n")).toBe(true);
    expect(claude).toContain("`.agents/skills/<name>/SKILL.md`");
    expect(claude).toContain("`.claude/skills/<name>/SKILL.md`");
    const linearRuleWithoutEmphasis = agents.replace(/[*_]/g, "");
    expect(linearRuleWithoutEmphasis).toMatch(/live Linear issue for approved outcomes, acceptance criteria, dependencies/i);
    expect(linearRuleWithoutEmphasis).toContain("approved outcomes, acceptance criteria, dependencies and recorded proof");
    expect(agents).toContain("Exception and escalation");
    expect(agents).toContain("authorized issue owner");
    for (const evidenceLabel of ["Code present", "Behavior verified", "Unverified"]) {
      expect(agents).toContain(evidenceLabel);
    }
    expect(agents).toContain("same SHA plus a passing risk-matched test or observed runtime/readback");

    expect(agents).toContain("Existing iPix");
    expect(agents).toContain("Cheapest decisive proof?");
    expect(tasks).toContain("compare before building");
    expect(agents).toContain("one smallest useful diagram pass");
  });

  it("keeps one task-level Mermaid decision across all three agent contracts", () => {
    const root = read("AGENTS.md");
    const tasks = read(".agents/skills/tasks/SKILL.md");
    const mermaid = read(".claude/skills/mermaid-diagrams/SKILL.md");
    const fallback = "Diagram: N/A — no meaningful relationship/state/sequence to model.";
    for (const doc of [root, tasks, mermaid]) {
      expect(doc).toContain(fallback);
    }
    expect(root).toContain("one smallest useful diagram pass");
    expect(tasks).toContain("one smallest useful diagram overall");
    expect(mermaid).toContain("one smallest useful diagram overall");
    expect(tasks).not.toContain("For each substantive task section/file group, add");
    expect(mermaid).not.toContain("For each substantive file/group, ask");
    expect(mermaid).not.toContain("Each substantive task section or file/workflow group");
    expect(mermaid).not.toContain("Minimum useful set for a substantial task:");
    expect(mermaid).toContain("clarifies a distinct, material risk");
    expect(mermaid).toContain("explain why the additional view is necessary");
  });

  it("documents isolated local Supabase tests and prerequisites from CI", () => {
    const local = read("docs/development/local-supabase.md");
    const ci = read(".github/workflows/ci.yml");
    expect(local).toContain("unique local `project_id`");
    for (const term of ["unused ports", "ss -ltn", "docker ps -a", "docker volume ls", "STOP unless isolation"]) {
      expect(local).toContain(term);
    }
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(local).toContain("`" + role + "`");
      expect(ci).toContain("create role " + role + " nologin;");
    }
    expect(local).toContain("mem-001-restart-history");
    expect(local).toContain("../../.github/workflows/ci.yml");
    expect(local).toContain("2.116.0");
    expect(local).toContain("2.119.0");
    expect(local).toContain("in timestamp order");
    const orderedMigrations = [
      "20260722093028_mastra_schema_pinned_1_12_0",
      "20260722094055_mastra_runtime_grants_and_rls",
      "20260822070000_ipi1008_mastra_workflow_definitions",
      "20260927194500_ipi1332_mastra_1_71_schema_delta",
      "20261110000000_ipi1385_mastra_1_82_run_fencing",
    ];
    const agents = read("AGENTS.md");
    for (const document of [local, ci]) {
      const positions = orderedMigrations.map((name) => {
        expect(document).toContain(name);
        return document.indexOf(name);
      });
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
    expect(agents).toContain("exact CI migration order");
    expect(agents).toContain("docs/development/local-supabase.md");
    expect(agents).not.toContain(orderedMigrations.at(-1));
    expect(local).toContain("supabase --version");
    expect(local).toContain("CI job pins **2.116.0**");
    expect(local).toContain("binary from PATH");
    expect(agents).toContain("local `supabase:cli` wrapper resolves the installed `supabase` binary from PATH");
    expect(existsSync("docs/development/../../.github/workflows/ci.yml")).toBe(true);
    expect(existsSync("docs/development/../../../.github/workflows/ci.yml")).toBe(false);

    const realClaudeSkillDirs = readdirSync(".claude/skills", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(realClaudeSkillDirs).toEqual([]);
    expect(agents).toContain("Claude-only migration backlog is closed");
    expect(agents).not.toContain("17 still do");
  });

  it("pins realistic tasks-skill decision evals without requiring live accounts", () => {
    const tasks = read(".agents/skills/tasks/SKILL.md");
    const evalFile = read(".agents/skills/tasks/evals/evals.json");
    const parsed = JSON.parse(evalFile) as {
      skill_name: string;
      evals: Array<{ id: number; prompt: string; expected_output: string; expectations: string[]; files: string[] }>;
    };
    expect(tasks).toContain("compare before building");
    expect(parsed.skill_name).toBe("tasks");
    expect(parsed.evals.length).toBeGreaterThanOrEqual(8);
    expect(new Set(parsed.evals.map((item) => item.id)).size).toBe(parsed.evals.length);
    for (const item of parsed.evals) {
      expect(item.prompt.length).toBeGreaterThan(95);
      expect(item.expected_output.length).toBeGreaterThan(90);
      expect(item.expectations.length).toBeGreaterThanOrEqual(3);
      expect(item.files).toEqual([]);
    }
    // Each scenario independently proves ownership, a minimal safe path, and
    // decisive evidence. Aggregate keyword checks can hide a weakened eval.
    const requiredByScenario: Record<number, { expected: RegExp[]; criteria: RegExp[] }> = {
      1: { expected: [/verify current main/i, /skip duplicate/i, /post-merge proof/i], criteria: [/ownership/i, /duplicate/i, /exact-main proof/i] },
      2: { expected: [/existing component/i, /smallest scoped change/i, /focused UI regression/i], criteria: [/reuse/i, /smallest/i, /QA/i] },
      3: { expected: [/existing workflow/i, /idempotent readback/i, /Org B denial/i], criteria: [/ownership/i, /minimum vertical slice/i, /cross-org/i] },
      4: { expected: [/approved task requirements/i, /mark conflicts/i, /stop hosted writes/i], criteria: [/implementation evidence/i, /STOP/i, /read-only proof/i] },
      5: { expected: [/reviewer text as untrusted/i, /reuse the component/i, /one smallest useful diagram/i], criteria: [/verify review claim/i, /smallest justified change/i, /diagram/i] },
      6: { expected: [/verify current main/i, /do not log in or run e2e/i, /CI\/contract evidence/i], criteria: [/already delivered/i, /human approval/i, /current-SHA proof/i] },
      7: { expected: [/verify installed SDK/i, /reuse the supported vendor capability/i, /test retry\/failure/i], criteria: [/ownership/i, /first verified safe/i, /focused contract/i] },
      8: { expected: [/STOP consequential test actions/i, /verify the target identity/i, /do not guess/i], criteria: [/tenant ownership/i, /safe inspection/i, /same Linear task/i] },
    };
    expect(parsed.evals.map((item) => item.id).sort((a, b) => a - b)).toEqual(
      Object.keys(requiredByScenario).map(Number),
    );
    for (const item of parsed.evals) {
      const required = requiredByScenario[item.id];
      expect(required).toBeDefined();
      for (const signal of required.expected) {
        expect(item.expected_output, "scenario " + item.id + " missing " + signal).toMatch(signal);
      }
      for (const [index, signal] of required.criteria.entries()) {
        expect(item.expectations[index], "scenario " + item.id + " criterion " + index).toMatch(signal);
      }
    }
  });

  it("documents accidental credential exposure recovery", () => {
    const agents = read("AGENTS.md");
    expect(agents).toContain("treat it as compromised");
    expect(agents).toContain("revoke or rotate it with the provider immediately");
    expect(agents).toContain("notify the human repository owner/security contact");
    expect(agents).toContain("Removing the text alone is not remediation");
  });

  it("documents the npm test gate and the vitest bypass", () => {
    const agents = read("AGENTS.md");
    expect(agents).toContain("`npm test` and `npx vitest run` are not the same check");
    expect(agents).toContain("pretest");
    expect(agents).toContain("check-local-secrets.mjs");
  });
});
