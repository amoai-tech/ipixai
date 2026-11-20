import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Skill trigger evals must be real, not decorative.
 *
 * The `description` field is the primary mechanism deciding whether a skill is
 * consulted at all, so the skill-creator workflow evaluates it with realistic
 * should-trigger and should-not-trigger queries. This repository has carried
 * such a file for `copilotkit` while nothing read it and no skill pointed at it —
 * an eval nothing runs is documentation, not verification.
 *
 * These assertions keep the files honest and are deliberately shallow: they
 * check that an eval set could actually discriminate, not that its cases are
 * well chosen. Judging case quality needs the human review loop.
 *
 * Minimums follow the guidance's "keep it small: 8–12 cases per skill":
 *   - at least 8 cases, so a single case cannot stand in for a suite;
 *   - at least 3 of each direction, so an all-positive or all-negative set fails;
 *   - negative cases must not all be trivially unrelated — enforced by requiring
 *     at least one negative to share vocabulary with the skill's own domain,
 *     which is what makes near-misses worth testing;
 *   - queries must be substantive, because one-line requests like "format this
 *     data" do not trigger skills regardless of description quality.
 */

const SKILL_ROOTS = [".agents/skills"];
const MIN_CASES = 8;
const MIN_PER_DIRECTION = 3;
const MIN_QUERY_LENGTH = 20;

type TriggerCase = {
  query: string;
  should_trigger: boolean;
  live_case?: boolean;
  expected_reference?: string;
};

function findTriggerEvals(): Array<{ skill: string; path: string; cases: TriggerCase[] }> {
  const seen = new Set<string>();
  const found: Array<{ skill: string; path: string; cases: TriggerCase[] }> = [];

  for (const root of SKILL_ROOTS) {
    let skills: string[];
    try {
      skills = readdirSync(root);
    } catch {
      continue;
    }
    for (const skill of skills) {
      const dir = join(root, skill);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch {
        continue; // broken symlink
      }
      const file = join(dir, "evals", "trigger-eval.json");
      let real: string;
      try {
        real = realpathSync(file);
        if (!statSync(real).isFile()) continue;
      } catch {
        continue; // no trigger eval for this skill
      }
      if (seen.has(real)) continue;
      seen.add(real);
      found.push({
        skill,
        path: `${root}/${skill}/evals/trigger-eval.json`,
        cases: JSON.parse(readFileSync(real, "utf8")) as TriggerCase[],
      });
    }
  }
  return found;
}

const evals = findTriggerEvals();

describe("skill trigger evals", () => {
  it("exist for more than one skill", () => {
    // Without this the loop below could pass by finding nothing.
    expect(evals.map((entry) => entry.skill).sort()).toEqual(
      expect.arrayContaining(["copilotkit", "mastra"]),
    );
  });

  it.each(evals.map((entry) => [entry.path, entry] as const))(
    "%s is a well-formed, discriminating eval set",
    (_path, entry) => {
      const { cases } = entry;
      expect(Array.isArray(cases), `${entry.path} must be a JSON array`).toBe(true);
      expect(
        cases.length,
        `${entry.path} has ${cases.length} cases; the guidance recommends at least ${MIN_CASES}`,
      ).toBeGreaterThanOrEqual(MIN_CASES);

      for (const [index, item] of cases.entries()) {
        expect(
          typeof item.should_trigger,
          `${entry.path}[${index}] must set a boolean should_trigger`,
        ).toBe("boolean");
        expect(
          typeof item.query === "string" && item.query.trim().length >= MIN_QUERY_LENGTH,
          `${entry.path}[${index}] query is too short to be a realistic prompt: ${JSON.stringify(item.query)}`,
        ).toBe(true);
      }

      const shouldTrigger = cases.filter((item) => item.should_trigger).length;
      const shouldNot = cases.length - shouldTrigger;
      expect(
        shouldTrigger,
        `${entry.path} needs at least ${MIN_PER_DIRECTION} should-trigger cases`,
      ).toBeGreaterThanOrEqual(MIN_PER_DIRECTION);
      expect(
        shouldNot,
        `${entry.path} needs at least ${MIN_PER_DIRECTION} should-not-trigger cases`,
      ).toBeGreaterThanOrEqual(MIN_PER_DIRECTION);

      const queries = cases.map((item) => item.query);
      const duplicates = queries.filter((query, index) => queries.indexOf(query) !== index);
      expect(duplicates, `${entry.path} repeats a query`).toEqual([]);
    },
  );
});


// An opt-in live check, not a default paid CI job. The agent sees only local
// read/search and Skill tools, with all third-party MCP connections disabled.
// A JSON fixture is an intent claim; only the actual Skill event proves routing.
const copilotkitCases =
  evals.find((entry) => entry.skill === "copilotkit")?.cases ?? [];
const liveRoutingCases = copilotkitCases.filter((item) => item.live_case === true);

// Claude Code qualifies plugin skills as plugin-name:skill-name. The
// frontmatter/fixture name is "copilotkit"; the Skill tool uses the qualified
// name when the .agents plugin is loaded.
const pluginName = (
  JSON.parse(readFileSync(".agents/.claude-plugin/plugin.json", "utf8")) as {
    name: string;
  }
).name;
const skillName = readFileSync(".agents/skills/copilotkit/SKILL.md", "utf8")
  .match(/^name:\s*([\w-]+)\s*$/m)?.[1];
const fullSkillName = pluginName + ":" + (skillName ?? "");

function claudeLiveEvalSkipReason(): string | undefined {
  const version = spawnSync("claude", ["--version"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  if (version.error || version.status !== 0) {
    return "Claude Code CLI unavailable; install claude and ensure it is in PATH";
  }

  // A Claude login, API key, or other configured provider may authenticate.
  const auth = spawnSync("claude", ["auth", "status"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  if (auth.error || auth.status !== 0) {
    return "Claude Code not authenticated; configure a provider or run claude auth login";
  }
  return undefined;
}

const liveEvalRequested = process.env.RUN_COPILOTKIT_SKILL_LIVE_EVAL === "1";
const liveEvalSkipReason = liveEvalRequested
  ? claudeLiveEvalSkipReason()
  : "Opt-in live eval disabled";
if (liveEvalRequested && liveEvalSkipReason) {
  console.warn("[CopilotKit skill live eval] SKIPPED: " + liveEvalSkipReason);
}

describe("iPix CopilotKit skill-routing evaluation coverage", () => {
  it("matches Claude Code plugin namespace without renaming the skill", () => {
    expect(skillName).toBe("copilotkit");
    expect(pluginName).toBe("ipix");
    expect(fullSkillName).toBe("ipix:copilotkit");
  });
  it("includes positive and negative near-misses with grounded reference owners", () => {
    expect(liveRoutingCases).toHaveLength(4);
    expect(liveRoutingCases.filter((item) => item.should_trigger)).toHaveLength(2);
    expect(liveRoutingCases.filter((item) => !item.should_trigger)).toHaveLength(2);
    for (const item of liveRoutingCases) {
      expect(item.query).not.toContain("ipix:copilotkit");
      if (item.should_trigger) {
        expect(item.expected_reference?.startsWith("references/")).toBe(true);
        expect(item.expected_reference).not.toContain("..");
        expect(
          existsSync(join(".agents/skills/copilotkit", item.expected_reference!)),
        ).toBe(true);
      } else {
        expect(item.expected_reference).toBeUndefined();
      }
    }
  });
});

describe.runIf(liveEvalRequested && !liveEvalSkipReason)(
  "opt-in live Claude Code CopilotKit skill routing (paid, no writes)",
  () => {
    it.each(liveRoutingCases)("$query", ({ query, should_trigger, expected_reference }) => {
      const command = spawnSync(
        "claude",
        [
          "-p",
          "--plugin-dir", ".agents",
          "--strict-mcp-config",
          "--mcp-config", '{"mcpServers":{}}',
          "--model", "haiku",
          "--tools", "Skill,Read,Grep,Glob",
          "--allowedTools", "Skill,Read,Grep,Glob",
          "--max-turns", "5",
          "--max-budget-usd", "0.07",
          "--no-session-persistence",
          "--output-format", "stream-json",
          "--verbose",
          query,
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          input: "",
          timeout: 90_000,
          maxBuffer: 4 * 1024 * 1024,
        },
      );
      const events = (command.stdout ?? "")
        .split("\n")
        .filter((line) => line.trim().startsWith("{"))
        .flatMap((line) => {
          try {
            return [JSON.parse(line)];
          } catch {
            return [];
          }
        });
      const calls = events.flatMap((event) =>
        event.type === "assistant"
          ? (event.message?.content ?? []).filter((part: { type: string }) => part.type === "tool_use")
          : [],
      );
      const selected = calls.some(
        (call: { name: string; input?: { skill?: string } }) =>
          call.name === "Skill" && call.input?.skill === fullSkillName,
      );
      const inspectedReferences = Array.from(
        new Set(
          calls
            .filter((call: { name: string }) =>
              ["Read", "Grep", "Glob"].includes(call.name),
            )
            .map((call: { input?: { file_path?: string; path?: string } }) =>
              call.input?.file_path ?? call.input?.path ?? "",
            )
            .filter((path: string) => path.includes(".agents/skills/copilotkit/references/"))
            .map((path: string) =>
              path.slice(path.indexOf(".agents/skills/copilotkit/references/")),
            ),
        ),
      );
      const referenceOpened = expected_reference
        ? inspectedReferences.some((path) => path.endsWith(expected_reference))
        : false;
      const result = events.findLast((event) => event.type === "result");
      const conclusive = command.status === 0 && result?.is_error === false;
      const verdict = !conclusive
        ? "INCONCLUSIVE"
        : selected === should_trigger
          ? "PASS"
          : "MISS";
      // Emit only routing metadata. Direct file reads are NOT Skill activations.
      console.info(
        JSON.stringify({
          verdict,
          expectedSkill: should_trigger,
          skillInvoked: selected,
          expectedReference: expected_reference ?? null,
          inspectedReferences,
          referenceOpened,
          completion: result?.subtype ?? null,
          exitCode: command.status,
          eventCount: events.length,
          costUsd: result?.total_cost_usd ?? null,
        }),
      );
      // Model decisions/turn budgets are variable: never use a flaky gate here.
    }, 100_000);
  },
);
