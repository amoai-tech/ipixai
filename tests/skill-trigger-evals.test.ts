import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, posix, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

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
  id?: string;
  query: string;
  should_trigger: boolean;
  live_case?: boolean;
  benchmark_split?: "train" | "holdout";
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

function claudeLiveEvalPreflight(): { version?: string; skipReason?: string } {
  const version = spawnSync("claude", ["--version"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  if (version.error || version.status !== 0) {
    return { skipReason: "Claude Code CLI unavailable; install claude and ensure it is in PATH" };
  }

  // A Claude login, API key, or other configured provider may authenticate.
  const auth = spawnSync("claude", ["auth", "status"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  if (auth.error || auth.status !== 0) {
    return {
      version: version.stdout.trim(),
      skipReason: "Claude Code not authenticated; configure a provider or run claude auth login",
    };
  }
  return { version: version.stdout.trim() };
}

const liveEvalRequested = process.env.RUN_COPILOTKIT_SKILL_LIVE_EVAL === "1";
const livePreflight = liveEvalRequested ? claudeLiveEvalPreflight() : undefined;
const liveEvalSkipReason = liveEvalRequested
  ? livePreflight?.skipReason
  : "Opt-in live eval disabled";
if (liveEvalRequested && liveEvalSkipReason) {
  console.warn("[CopilotKit skill live eval] SKIPPED: " + liveEvalSkipReason);
}

type ClaudeEvent = {
  type?: string;
  subtype?: string;
  message?: { content?: unknown };
  plugins?: unknown;
  skills?: unknown;
  tools?: unknown;
  plugin_errors?: unknown;
  claude_code_version?: string;
  is_error?: boolean;
  total_cost_usd?: number;
};

type ToolCall = {
  type: "tool_use";
  id?: string;
  name: string;
  input?: { file_path?: string; path?: string; skill?: string };
};

type ToolReply = {
  type: "tool_result";
  tool_use_id?: string;
  is_error?: boolean;
};

// Only references inside this canonical skill are logged. Searches discover
// filenames; only a completed, successful Read proves contents were opened.
function normalizedToolPath(path: string): string {
  return posix.normalize(path.replace(/\\/g, "/"));
}

function localReferencePath(path?: string): string | undefined {
  if (!path) return undefined;
  const normalized = normalizedToolPath(path);
  const prefix = ".agents/skills/copilotkit/references/";
  const position = normalized.indexOf(prefix);
  return position < 0 ? undefined : normalized.slice(position);
}

function inspectLiveRouting(
  events: ClaudeEvent[],
  exitCode: number | null,
  shouldTrigger: boolean,
  expectedReference?: string,
) {
  const init = events.find((event) => event.type === "system" && event.subtype === "init");
  const plugins = init?.plugins;
  const errors = init?.plugin_errors;
  const skillAdvertised = Array.isArray(init?.skills) && init.skills.includes(fullSkillName);
  const skillToolAvailable = Array.isArray(init?.tools) && init.tools.includes("Skill");
  const pluginLoaded =
    Array.isArray(plugins) &&
    plugins.some((plugin: unknown) =>
      typeof plugin === "string"
        ? plugin === pluginName || plugin.startsWith(pluginName + "@")
        : plugin !== null &&
          typeof plugin === "object" &&
          "name" in plugin &&
          plugin.name === pluginName,
    );
  // On supported Claude versions plugin_errors is omitted when empty.
  const pluginFieldsKnown =
    Array.isArray(plugins) && (errors === undefined || Array.isArray(errors));
  const loadedPluginPath = Array.isArray(plugins)
    ? (plugins.find(
        (entry: unknown) =>
          entry !== null &&
          typeof entry === "object" &&
          "name" in entry &&
          entry.name === pluginName,
      ) as { path?: string } | undefined)?.path
    : undefined;
  // Match the CLI's explicit directory, or the resolved directory reported by init.
  const pluginPaths = new Set(
    [resolve(".agents"), ".agents", loadedPluginPath]
      .filter((path): path is string => typeof path === "string")
      .map(normalizedToolPath),
  );
  const pluginError =
    Array.isArray(errors) &&
    errors.some((entry: unknown) => {
      if (entry === null || typeof entry !== "object") return false;
      const error = entry as { plugin?: string; name?: string; path?: string };
      return (
        error.plugin === pluginName ||
        error.plugin?.startsWith(pluginName + "@") ||
        error.name === pluginName ||
        (typeof error.path === "string" &&
          pluginPaths.has(normalizedToolPath(error.path)))
      );
    });

  const blocks = (event: ClaudeEvent): Array<Record<string, unknown>> =>
    Array.isArray(event.message?.content)
      ? event.message.content.filter(
          (part): part is Record<string, unknown> =>
            part !== null && typeof part === "object",
        )
      : [];
  const calls = events
    .filter((event) => event.type === "assistant")
    .flatMap(blocks)
    .filter((part): part is ToolCall =>
      part.type === "tool_use" && typeof part.name === "string",
    );
  const completedReadIds = new Set(
    events
      .filter((event) => event.type === "user")
      .flatMap(blocks)
      .filter((part): part is ToolReply =>
        part.type === "tool_result" &&
        typeof part.tool_use_id === "string" &&
        part.is_error !== true,
      )
      .map((part) => part.tool_use_id),
  );
  const attemptedReads = Array.from(
    new Set(
      calls
        .filter((call) => call.name === "Read")
        .map((call) => localReferencePath(call.input?.file_path))
        .filter((path): path is string => Boolean(path)),
    ),
  );
  const attemptedSearches = Array.from(
    new Set(
      calls
        .filter((call) => call.name === "Grep" || call.name === "Glob")
        .map((call) => call.name + ":" + (localReferencePath(call.input?.path) ?? "other")),
    ),
  );
  const successfulReads = Array.from(
    new Set(
      calls
        .filter((call) => call.name === "Read" && call.id && completedReadIds.has(call.id))
        .map((call) => localReferencePath(call.input?.file_path))
        .filter((path): path is string => Boolean(path)),
    ),
  );
  const selected = calls.some(
    (call) => call.name === "Skill" && call.input?.skill === fullSkillName,
  );
  const result = events.findLast((event) => event.type === "result");
  const conclusive =
    exitCode === 0 &&
    result?.is_error === false &&
    pluginFieldsKnown &&
    pluginLoaded &&
    skillAdvertised &&
    skillToolAvailable &&
    !pluginError;
  return {
    verdict: !conclusive ? "INCONCLUSIVE" : selected === shouldTrigger ? "PASS" : "MISS",
    selected,
    pluginLoaded,
    skillAdvertised,
    skillToolAvailable,
    pluginError,
    pluginFieldsKnown,
    attemptedReads,
    attemptedSearches,
    successfulReads,
    referenceOpened: expectedReference
      ? successfulReads.some((path) => path.endsWith(expectedReference))
      : false,
    result,
    initVersion: init?.claude_code_version ?? null,
  };
}

describe("iPix CopilotKit skill-routing evaluation coverage", () => {
  it("does not count unsuccessful Read or Glob discovery as opened contents", () => {
    const path = ".agents/skills/copilotkit/references/ipix-production.md";
    const events: ClaudeEvent[] = [
      { type: "system", subtype: "init", plugins: [{ name: pluginName }], skills: [fullSkillName], tools: ["Skill"] },
      {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "r1", name: "Read", input: { file_path: path } },
            { type: "tool_use", id: "g1", name: "Glob", input: { path } },
            { type: "tool_use", id: "s1", name: "Skill", input: { skill: fullSkillName } },
          ],
        },
      },
      {
        type: "user",
        message: {
          content: [{ type: "tool_result", tool_use_id: "r1", is_error: true }],
        },
      },
      { type: "result", subtype: "success", is_error: false },
    ];
    const failed = inspectLiveRouting(events, 0, true, "references/ipix-production.md");
    expect(failed.verdict).toBe("PASS"); // Skill invocation stays independent.
    expect(failed.selected).toBe(true);
    expect(failed.attemptedReads).toContain(path);
    expect(failed.attemptedSearches).toContain("Glob:" + path);
    expect(failed.referenceOpened).toBe(false);
    events[2] = {
      type: "user",
      message: { content: [{ type: "tool_result", tool_use_id: "r1" }] },
    };
    expect(inspectLiveRouting(events, 0, true, "references/ipix-production.md").referenceOpened)
      .toBe(true);
  });

  it("reports empty output, missing plugin and plugin errors as inconclusive", () => {
    expect(inspectLiveRouting([], 0, false).verdict).toBe("INCONCLUSIVE");
    const complete: ClaudeEvent = { type: "result", subtype: "success", is_error: false };
    expect(inspectLiveRouting([complete], 0, false).verdict).toBe("INCONCLUSIVE");
    expect(inspectLiveRouting([
      { type: "system", subtype: "init", plugins: [{ name: pluginName }], tools: ["Skill"] },
      complete,
    ], 0, false).verdict).toBe("INCONCLUSIVE"); // plugin loaded, skill absent
    expect(inspectLiveRouting([
      { type: "system", subtype: "init", plugins: [{ name: pluginName }], skills: [fullSkillName] },
      complete,
    ], 0, false).verdict).toBe("INCONCLUSIVE"); // tool unavailable

    expect(
      inspectLiveRouting(
        [{ type: "system", subtype: "init", plugins: [] }, complete],
        0,
        false,
      ).verdict,
    ).toBe("INCONCLUSIVE");
    expect(
      inspectLiveRouting(
        [
          {
            type: "system",
            subtype: "init",
            plugins: [{ name: pluginName }], skills: [fullSkillName], tools: ["Skill"],
            plugin_errors: [{ plugin: pluginName, message: "load failed" }],
          },
          complete,
        ],
        0,
        false,
      ).verdict,
    ).toBe("INCONCLUSIVE");
    expect(
      inspectLiveRouting(
        [{ type: "system", subtype: "init", plugins: [{ name: pluginName }], skills: [fullSkillName], tools: ["Skill"] }, complete],
        0,
        false,
      ).verdict,
    ).toBe("PASS");
    expect(
      inspectLiveRouting(
        [{ type: "system", subtype: "init", plugins: [{ name: pluginName }], skills: [fullSkillName], tools: ["Skill"] }, complete],
        0,
        true,
      ).verdict,
    ).toBe("MISS");
  });

  it("does not bypass permissions or expose write tools in live diagnostics", () => {
    const args = liveClaudeArguments("read-only test");
    expect(args).not.toContain("--dangerously-" + "skip-permissions");
    expect(args).not.toContain("bypassPermissions");
    expect(args[args.indexOf("--tools") + 1]).toBe("Skill,Read,Grep,Glob");
    expect(args[args.indexOf("--allowedTools") + 1]).toBe("Skill,Read,Grep,Glob");
    expect(args).toContain("--strict-mcp-config");
  });

  it("normalizes Windows reference paths without confusing Glob and Read", () => {
    const file = ".agents/skills/copilotkit/references/ipix-production.md";
    const windowsPath = file.split("/").join(String.fromCharCode(92));
    const events: ClaudeEvent[] = [
      { type: "system", subtype: "init", plugins: [{ name: pluginName }], skills: [fullSkillName], tools: ["Skill"] },
      { type: "assistant", message: { content: [
        { type: "tool_use", id: "r1", name: "Read", input: { file_path: windowsPath } },
        { type: "tool_use", id: "g1", name: "Glob", input: { path: windowsPath } },
      ] } },
      { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "r1" }] } },
      { type: "result", subtype: "success", is_error: false },
    ];
    const evidence = inspectLiveRouting(events, 0, false, "references/ipix-production.md");
    expect(evidence.verdict).toBe("PASS");
    expect(evidence.attemptedReads).toContain(file);
    expect(evidence.attemptedSearches).toContain("Glob:" + file);
    expect(evidence.successfulReads).toContain(file);
    expect(evidence.referenceOpened).toBe(true);
  });

  it("recognizes relative and absolute plugin errors without misattributing other plugins", () => {
    const complete: ClaudeEvent = { type: "result", subtype: "success", is_error: false };
    for (const errorPath of [
      ".agents",
      "./.agents",
      resolve(".agents"),
      resolve(".agents").split("/").join(String.fromCharCode(92)),
      "/other/project/.agents",
    ]) {
      const pluginPath = errorPath === "/other/project/.agents"
        ? "/other/project/.agents"
        : resolve(".agents");
      const evidence = inspectLiveRouting(
        [
          { type: "system", subtype: "init",
            plugins: [{ name: pluginName, path: pluginPath }], skills: [fullSkillName], tools: ["Skill"],
            plugin_errors: [{ plugin: "inline[0]", path: errorPath }],
          },
          complete,
        ], 0, false,
      );
      expect(evidence.pluginError, errorPath).toBe(true);
      expect(evidence.verdict, errorPath).toBe("INCONCLUSIVE");
    }
    const unrelated = inspectLiveRouting(
      [{ type: "system", subtype: "init",
        plugins: [{ name: pluginName, path: resolve(".agents") }], skills: [fullSkillName], tools: ["Skill"],
        plugin_errors: [{ plugin: "other", path: "/other/irrelevant" }],
      }, complete],
      0, false,
    );
    expect(unrelated.pluginError).toBe(false);
    expect(unrelated.verdict).toBe("PASS");
  });

  it("matches Claude Code plugin namespace without renaming the skill", () => {
    expect(skillName).toBe("copilotkit");
    expect(pluginName).toBe("ipix");
    expect(fullSkillName).toBe("ipix:copilotkit");
  });
  it("includes positive and negative near-misses with grounded reference owners", () => {
    expect(liveRoutingCases).toHaveLength(8);
    expect(liveRoutingCases.filter((item) => item.should_trigger)).toHaveLength(4);
    expect(liveRoutingCases.filter((item) => !item.should_trigger)).toHaveLength(4);
    expect(new Set(liveRoutingCases.map((item) => item.id)).size).toBe(8);
    for (const split of ["train", "holdout"]) {
      const cohort = liveRoutingCases.filter((item) => item.benchmark_split === split);
      expect(cohort).toHaveLength(4);
      expect(cohort.filter((item) => item.should_trigger)).toHaveLength(2);
      expect(cohort.filter((item) => !item.should_trigger)).toHaveLength(2);
    }
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

function liveClaudeArguments(query: string, pluginDir = ".agents"): string[] {
  return [
          "-p",
          "--plugin-dir", pluginDir,
          "--strict-mcp-config",
          "--mcp-config", '{"mcpServers":{}}',
          "--model", process.env.COPILOTKIT_SKILL_EVAL_MODEL || "haiku",
          "--tools", "Skill,Read,Grep,Glob",
          "--allowedTools", "Skill,Read,Grep,Glob",
          "--max-turns", process.env.COPILOTKIT_SKILL_EVAL_MAX_TURNS || "8",
          "--max-budget-usd", process.env.COPILOTKIT_SKILL_EVAL_BUDGET_USD || "0.12",
          "--no-session-persistence",
          "--output-format", "stream-json",
          "--verbose",
          query,
  ];
}

// To compare the old skill and the candidate, pass a clean main worktree through
// COPILOTKIT_SKILL_EVAL_BASELINE_ROOT. Both variants get identical prompts,
// Claude model/tool permissions, budgets and timeout limits. No CI cost by default.
const baselineRootEnv = process.env.COPILOTKIT_SKILL_EVAL_BASELINE_ROOT;
const baselineRoot = baselineRootEnv ? resolve(baselineRootEnv) : undefined;
const liveRepeats = Number(process.env.COPILOTKIT_SKILL_EVAL_REPEATS ?? "1");
const liveVariants = baselineRoot
  ? [
      { variant: "baseline", root: baselineRoot },
      { variant: "candidate", root: process.cwd() },
    ]
  : [{ variant: "candidate", root: process.cwd() }];
const liveObservations: Array<{
  variant: string;
  split: string;
  shouldTrigger: boolean;
  verdict: string;
  selected: boolean;
  referenceOpened: boolean;
  costUsd: number;
  durationMs: number;
}> = [];

describe.runIf(liveEvalRequested && !liveEvalSkipReason)(
  "opt-in live Claude Code CopilotKit skill routing (paid, no writes)",
  () => {
    it("uses a valid isolated baseline and bounded repeats", () => {
      expect(Number.isInteger(liveRepeats) && liveRepeats >= 1 && liveRepeats <= 3).toBe(true);
      if (baselineRoot) {
        expect(baselineRoot).not.toBe(resolve(process.cwd()));
        expect(
          existsSync(join(baselineRoot, ".agents/skills/copilotkit/SKILL.md")),
          "baseline must be a checked-out skill, not a fabricated placeholder",
        ).toBe(true);
      }
    });

    afterAll(() => {
      const summary = liveVariants.map(({ variant }) => {
        const runs = liveObservations.filter((item) => item.variant === variant);
        const count = (items: typeof runs, verdict: string) =>
          items.filter((item) => item.verdict === verdict).length;
        const bySplit = (split: string) => {
          const observations = runs.filter((item) => item.split === split);
          return {
            split,
            total: observations.length,
            pass: count(observations, "PASS"),
            miss: count(observations, "MISS"),
            inconclusive: count(observations, "INCONCLUSIVE"),
            trueSkillCalls: observations.filter((item) => item.shouldTrigger && item.selected).length,
            falseSkillCalls: observations.filter((item) => !item.shouldTrigger && item.selected).length,
            openedReference: observations.filter((item) => item.shouldTrigger && item.referenceOpened).length,
          };
        };
        return {
          variant,
          runs: runs.length,
          pass: count(runs, "PASS"),
          miss: count(runs, "MISS"),
          inconclusive: count(runs, "INCONCLUSIVE"),
          totalCostUsd: Number(runs.reduce((sum, item) => sum + item.costUsd, 0).toFixed(5)),
          durationMs: runs.reduce((sum, item) => sum + item.durationMs, 0),
          cohorts: ["train", "holdout"].map(bySplit),
        };
      });
      console.info("[CopilotKit skill benchmark summary] " + JSON.stringify({
        model: process.env.COPILOTKIT_SKILL_EVAL_MODEL || "haiku",
        claudeCliVersion: livePreflight?.version ?? null,
        repeats: liveRepeats,
        summary,
      }));
    });

    it.each(liveRoutingCases)(
      "$id: $query",
      ({ id, query, should_trigger, expected_reference, benchmark_split }) => {
        for (let repeat = 0; repeat < liveRepeats; repeat++) {
          // Alternate order to reduce warm-start/time bias between variants.
          const variants = repeat % 2 === 0 ? liveVariants : [...liveVariants].reverse();
          for (const { variant, root } of variants) {
            const start = Date.now();
            const command = spawnSync(
              "claude",
              liveClaudeArguments(query, join(root, ".agents")),
              {
                cwd: root,
                encoding: "utf8",
                input: "",
                timeout: 110_000,
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
            const evidence = inspectLiveRouting(
              events, command.status, should_trigger, expected_reference,
            );
            const durationMs = Date.now() - start;
            const costUsd = evidence.result?.total_cost_usd ?? 0;
            liveObservations.push({
              variant,
              split: benchmark_split ?? "unassigned",
              shouldTrigger: should_trigger,
              verdict: evidence.verdict,
              selected: evidence.selected,
              referenceOpened: evidence.referenceOpened,
              costUsd,
              durationMs,
            });
            // Metadata only: no model output, file contents or credentials.
            console.info(JSON.stringify({
              caseId: id,
              split: benchmark_split,
              variant,
              repeat: repeat + 1,
              verdict: evidence.verdict,
              expectedSkill: should_trigger,
              skillInvoked: evidence.selected,
              pluginLoaded: evidence.pluginLoaded,
              skillAdvertised: evidence.skillAdvertised,
              skillToolAvailable: evidence.skillToolAvailable,
              pluginError: evidence.pluginError,
              pluginFieldsKnown: evidence.pluginFieldsKnown,
              claudeCliVersion: livePreflight?.version ?? evidence.initVersion,
              expectedReference: expected_reference ?? null,
              attemptedReads: evidence.attemptedReads,
              attemptedSearches: evidence.attemptedSearches,
              successfulReads: evidence.successfulReads,
              referenceOpened: evidence.referenceOpened,
              completion: evidence.result?.subtype ?? null,
              exitCode: command.status,
              eventCount: events.length,
              costUsd,
              durationMs,
            }));
          }
        }
      },
      115_000 * liveVariants.length * liveRepeats + 10_000,
    );
  },
);
