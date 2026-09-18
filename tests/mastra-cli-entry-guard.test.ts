import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../src", import.meta.url));

/**
 * IPI-1231 · VERCEL-RUNTIME-001 — regression guard.
 *
 * Importing the Mastra CLI entry (`@/mastra` -> `src/mastra/index.ts`) at module
 * scope constructs `new Mastra({ storage: createMastraStorage() })` immediately,
 * which validates `MASTRA_DATABASE_URL` during Next.js page-data collection.
 * With the `[SENSITIVE]` placeholder that `vercel pull` writes, the production
 * build dies before any request runs.
 *
 * One careless `import { mastra } from "@/mastra"` re-breaks it, and it would
 * only surface in a full `vercel build`. Hence this scan.
 *
 * THREE import forms must be caught. A static-only pattern misses real call
 * sites — measured on `4c2ba455`: 3 static + 4 dynamic — and a pattern without
 * the side-effect form misses `import "@/mastra";`, which also evaluates the
 * CLI entry and restores the failure.
 */
const BARE_CLI_ENTRY =
  /(?:\bfrom\s*["']@\/mastra["']|\bimport\s*["']@\/mastra["']|\bimport\(\s*["']@\/mastra["']\s*\))/;

// The CLI boundary file is the only place allowed to touch the entry — and today
// it does not even need the specifier (it uses a relative "./runtime").
const ALLOWED = new Set(["mastra/index.ts"]);

/** Drop whole-line comments so documentation mentioning the specifier cannot trip the scan. */
function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return !(trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*"));
    })
    .join("\n");
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx|mts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("IPI-1231 · no application module imports the Mastra CLI entry", () => {
  it("src/** contains no bare `@/mastra` specifier, static or dynamic", () => {
    const offenders = sourceFiles(SRC)
      .map((file) => relative(SRC, file).replace(/\\/g, "/"))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) => BARE_CLI_ENTRY.test(codeOnly(readFileSync(join(SRC, rel), "utf8"))));

    expect(
      offenders,
      "These modules import the Mastra CLI entry (@/mastra). At module scope that " +
        "re-validates MASTRA_DATABASE_URL during page-data collection and breaks " +
        "`vercel build --prod`. Import from @/mastra/runtime instead. See IPI-1231.",
    ).toEqual([]);
  });

  it("the scan catches all three import forms and tolerates the runtime specifiers", () => {
    // The three forms that MUST be caught.
    expect(BARE_CLI_ENTRY.test('import { mastra } from "@/mastra";')).toBe(true);
    expect(BARE_CLI_ENTRY.test("const { mastra } = await import('@/mastra');")).toBe(true);
    // Side-effect form: evaluates the CLI entry and restores the build failure.
    expect(BARE_CLI_ENTRY.test('import "@/mastra";')).toBe(true);
    // A plain string that merely mentions the specifier is not an import.
    expect(BARE_CLI_ENTRY.test('const specifier = "@/mastra";')).toBe(false);

    // A static-only pattern would miss the dynamic form — the defect this test exists to prevent.
    expect(/from\s*["']@\/mastra["']/.test('await import("@/mastra")')).toBe(false);

    // The allowed specifiers must NOT match, or the guard becomes noise.
    expect(BARE_CLI_ENTRY.test('import { getMastra } from "@/mastra/runtime";')).toBe(false);
    expect(BARE_CLI_ENTRY.test('import { getProductionPlannerAgent } from "@/mastra/agents";')).toBe(false);
    expect(BARE_CLI_ENTRY.test('import type { PlannerChatMessage } from "@/mastra/thread-types";')).toBe(false);
    // Side-effect import of an ALLOWED specifier must also pass.
    expect(BARE_CLI_ENTRY.test('import "@/mastra/runtime";')).toBe(false);
  });
});
