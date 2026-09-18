import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  classifyFunction,
  compareReports,
  createTraceResolver,
  isPageSupersetOfApi,
  listFunctionEntries,
  readFunctionTrace,
  runMeasurement,
  summarizeTraces,
  validatePath,
} from "../scripts/measure-vercel-traces.mjs";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const MIB = 1024 * 1024;

/**
 * Scaffold a minimal but structurally faithful `.vercel/output`.
 *
 * `filePathMap` values are written PROJECT-ROOT-RELATIVE, because that is what real
 * Vercel output contains — the script must not assume absolute paths.
 *
 * Source file sizes equal their path length, so assertions stay deterministic.
 */
function createBuild(options: {
  sources: string[];
  reals: Record<string, string[]>;
  symlinks?: Record<string, string>;
  missingSources?: string[];
}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ipix-trace-"));
  tempDirs.push(root);

  for (const source of options.sources) {
    const full = path.join(root, source);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, "x".repeat(source.length));
  }

  const outputDir = path.join(root, ".vercel", "output");
  const functionsDir = path.join(outputDir, "functions");

  for (const [name, sources] of Object.entries(options.reals)) {
    const dir = path.join(functionsDir, name);
    fs.mkdirSync(dir, { recursive: true });
    const filePathMap: Record<string, string> = {};
    for (const source of sources) filePathMap[source] = source;
    for (const source of options.missingSources ?? []) filePathMap[source] = source;
    fs.writeFileSync(path.join(dir, ".vc-config.json"), JSON.stringify({ filePathMap }));
  }

  for (const [link, target] of Object.entries(options.symlinks ?? {})) {
    const linkPath = path.join(functionsDir, link);
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(
      path.relative(path.dirname(linkPath), path.join(functionsDir, target)),
      linkPath,
    );
  }

  return { root, outputDir };
}

/** Create a bare `.vercel/output` root for tests that build functions by hand. */
function createRawRoot(tag = "raw") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `ipix-trace-${tag}-`));
  tempDirs.push(root);
  const outputDir = path.join(root, ".vercel", "output");
  fs.mkdirSync(path.join(outputDir, "functions"), { recursive: true });
  return { root, outputDir };
}

/**
 * Write a `.func` whose `.vc-config.json` is supplied verbatim, so malformed and
 * missing-metadata states can be constructed (`null` writes no config at all).
 */
function writeRawFunc(outputDir: string, name: string, configContents: string | null) {
  const dir = path.join(outputDir, "functions", name);
  fs.mkdirSync(dir, { recursive: true });
  if (configContents !== null) fs.writeFileSync(path.join(dir, ".vc-config.json"), configContents);
  return dir;
}

/** Minimal saved baseline with a single @shikijs family, for CLI gate tests. */
function writeBaseline(root: string, options: { complete: boolean; shikiPageOnlyMiB: number }) {
  const file = path.join(root, "baseline.json");
  const size = options.shikiPageOnlyMiB * MIB;
  fs.writeFileSync(
    file,
    JSON.stringify({
      complete: options.complete,
      union: { files: 1, bytes: 100 * MIB },
      api: { files: 1, bytes: 0 },
      families: [
        {
          name: "@shikijs",
          page: { files: 334, bytes: size },
          api: { files: 0, bytes: 0 },
          pageOnly: { files: 334, bytes: size },
        },
      ],
    }),
  );
  return file;
}

function familyOf(report: { families: Array<{ name: string }> }, name: string) {
  const found = report.families.find((entry) => entry.name === name);
  if (!found) throw new Error(`family ${name} missing from report`);
  return found as {
    name: string;
    page: { files: number; bytes: number };
    api: { files: number; bytes: number };
    pageOnly: { files: number; bytes: number };
  };
}

describe("classifyFunction", () => {
  it("treats ordinary routes as page functions", () => {
    expect(classifyFunction("functions/app.func")).toBe("page");
    expect(classifyFunction("functions/app.rsc.func")).toBe("page");
    expect(classifyFunction("functions/auth/callback.func")).toBe("page");
  });

  it("treats the api segment as an api function, including the bare api.func", () => {
    expect(classifyFunction("functions/api.func")).toBe("api");
    expect(classifyFunction("functions/api/copilotkit/[[...slug]].func")).toBe("api");
  });

  it("only considers the FIRST segment under functions/", () => {
    // A page route whose path merely contains "api" deeper down stays a page.
    expect(classifyFunction("functions/app/api-docs.func")).toBe("page");
    expect(classifyFunction("functions/docs/api/reference.func")).toBe("page");
  });

  it("accepts absolute-looking and leading-dot-segment inputs", () => {
    expect(classifyFunction("/functions/api/health.func")).toBe("api");
    expect(classifyFunction("./functions/app.func")).toBe("page");
  });
});

describe("listFunctionEntries", () => {
  it("counts SYMLINKED .func entries, which isDirectory() would silently drop", () => {
    const { outputDir } = createBuild({
      sources: ["node_modules/next/dist/x.js"],
      reals: { "login.func": ["node_modules/next/dist/x.js"] },
      symlinks: { "app.func": "login.func", "app.rsc.func": "login.func" },
    });

    const { logical, uniqueDirs } = listFunctionEntries(outputDir);

    // The regression this guards: a naive `isDirectory()` walk finds only 1.
    expect(logical).toHaveLength(3);
    expect(uniqueDirs).toHaveLength(1);
  });

  it("resolves symlinks nested under a route directory", () => {
    const { outputDir } = createBuild({
      sources: ["node_modules/next/dist/x.js"],
      reals: { "login.func": ["node_modules/next/dist/x.js"] },
      symlinks: { "app/brands.func": "login.func" },
    });

    const { logical } = listFunctionEntries(outputDir);
    expect(logical).toHaveLength(2);
    // Logical path decides the bucket, not the symlink target.
    expect(classifyFunction(path.relative(outputDir, logical[0]))).toBe("page");
  });

  it("returns empty results when there is no functions directory", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ipix-trace-empty-"));
    tempDirs.push(root);
    expect(listFunctionEntries(root)).toEqual({ logical: [], uniqueDirs: [], broken: [] });
  });

  it("reports a broken .func symlink instead of throwing ENOENT", () => {
    const { outputDir } = createBuild({
      sources: ["src/a.ts"],
      reals: { "login.func": ["src/a.ts"] },
    });
    const link = path.join(outputDir, "functions", "dangling.func");
    fs.symlinkSync(path.join(outputDir, "functions", "does-not-exist.func"), link);

    const { logical, broken } = listFunctionEntries(outputDir);

    expect(logical).toHaveLength(2);
    expect(broken).toEqual([link]);
  });
});

describe("readFunctionTrace", () => {
  it("resolves PROJECT-ROOT-RELATIVE filePathMap values, not function-dir-relative ones", () => {
    const { root, outputDir } = createBuild({
      sources: ["node_modules/next/dist/server.js"],
      reals: { "login.func": ["node_modules/next/dist/server.js"] },
    });

    const { trace, missing } = readFunctionTrace(
      path.join(outputDir, "functions", "login.func"),
      root,
    );

    // If the script resolved against the .func directory these would all be missing.
    expect(missing).toBe(0);
    expect(trace.size).toBe(1);
    expect([...trace.keys()][0]).toBe(path.join(root, "node_modules/next/dist/server.js"));
  });

  it("counts entries whose source no longer exists instead of throwing", () => {
    const { root, outputDir } = createBuild({
      sources: ["node_modules/next/dist/server.js"],
      reals: { "login.func": ["node_modules/next/dist/server.js"] },
      missingSources: ["node_modules/gone/dist/vanished.js"],
    });

    const { trace, missing } = readFunctionTrace(
      path.join(outputDir, "functions", "login.func"),
      root,
    );

    expect(trace.size).toBe(1);
    expect(missing).toBe(1);
  });

  it("flags a missing .vc-config.json as invalid rather than reporting an empty trace", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ipix-trace-noconfig-"));
    tempDirs.push(root);
    const dir = path.join(root, "functions", "broken.func");
    fs.mkdirSync(dir, { recursive: true });

    expect(readFunctionTrace(dir, root)).toEqual({
      trace: new Map(),
      missing: 0,
      invalid: "missing .vc-config.json",
    });
  });

  it("flags unparsable .vc-config.json as invalid", () => {
    const { root, outputDir } = createRawRoot("badjson");
    const dir = writeRawFunc(outputDir, "broken.func", "{ not json");

    expect(readFunctionTrace(dir, root).invalid).toBe("unparsable .vc-config.json");
  });

  it("flags a .vc-config.json with no filePathMap as invalid", () => {
    const { root, outputDir } = createRawRoot("nomap");
    const dir = writeRawFunc(outputDir, "broken.func", JSON.stringify({ runtime: "nodejs24.x" }));

    expect(readFunctionTrace(dir, root).invalid).toBe(".vc-config.json has no filePathMap");
  });

  it("flags an empty filePathMap as invalid", () => {
    const { root, outputDir } = createRawRoot("emptymap");
    const dir = writeRawFunc(outputDir, "broken.func", JSON.stringify({ filePathMap: {} }));

    expect(readFunctionTrace(dir, root).invalid).toBe(".vc-config.json has an empty filePathMap");
  });
});

describe("summarizeTraces", () => {
  it("reports logical functions, unique artifacts and the page/api unions", () => {
    const { outputDir } = createBuild({
      sources: ["src/only-page.ts", "src/shared.ts", "src/only-api.ts"],
      reals: {
        "login.func": ["src/only-page.ts", "src/shared.ts"],
        "api/health.func": ["src/shared.ts", "src/only-api.ts"],
      },
      symlinks: { "app.func": "login.func" },
    });

    const report = summarizeTraces(outputDir);

    expect(report.functions.total).toBe(3);
    expect(report.functions.page).toBe(2);
    expect(report.functions.api).toBe(1);
    expect(report.functions.uniqueArtifacts).toBe(2);

    expect(report.page.files).toBe(2); // only-page + shared
    expect(report.api.files).toBe(2); // shared + only-api
    expect(report.union.files).toBe(3);
    expect(report.pageOnly.files).toBe(1);
    expect(report.missingFiles).toBe(0);
    expect(report.complete).toBe(true);
  });

  it("flags the superset invariant when the union exceeds the page union", () => {
    const { outputDir } = createBuild({
      sources: ["src/only-page.ts", "src/only-api.ts"],
      reals: {
        "login.func": ["src/only-page.ts"],
        "api/health.func": ["src/only-api.ts"],
      },
    });

    const report = summarizeTraces(outputDir);

    // api has a file page does not, so page is NOT a superset of api here.
    expect(report.pageIsSupersetOfApi).toBe(false);
    expect(report.union.bytes).toBeGreaterThan(report.page.bytes);
  });

  it("matches families against BOTH raw package files and compiled SSR chunks", () => {
    const { outputDir } = createBuild({
      sources: [
        "node_modules/@shikijs/core/dist/index.mjs",
        ".next/server/chunks/ssr/node_modules_@shikijs_core_dist_index_mjs_abc._.js",
        "node_modules/@mastra/core/dist/index.mjs",
      ],
      reals: {
        "login.func": [
          "node_modules/@shikijs/core/dist/index.mjs",
          ".next/server/chunks/ssr/node_modules_@shikijs_core_dist_index_mjs_abc._.js",
          "node_modules/@mastra/core/dist/index.mjs",
        ],
        "api/copilotkit.func": ["node_modules/@mastra/core/dist/index.mjs"],
      },
    });

    const report = summarizeTraces(outputDir, { families: ["@shikijs", "@mastra"] });

    const shiki = familyOf(report, "@shikijs");
    expect(shiki.pageOnly.files).toBe(2); // raw + compiled chunk
    expect(shiki.api.files).toBe(0);

    const mastra = familyOf(report, "@mastra");
    // Present in BOTH -> in api too -> zero page-only storage win.
    expect(mastra.page.files).toBe(1);
    expect(mastra.api.files).toBe(1);
    expect(mastra.pageOnly.files).toBe(0);
  });

  it("marks a measurement incomplete when traced files are missing", () => {
    const { outputDir } = createBuild({
      sources: ["src/only-page.ts"],
      reals: { "login.func": ["src/only-page.ts"] },
      missingSources: ["node_modules/gone/vanished.js"],
    });

    const report = summarizeTraces(outputDir);

    expect(report.missingFiles).toBe(1);
    expect(report.complete).toBe(false);
  });

  it("marks an output with no logical functions at all as incomplete", () => {
    const { outputDir } = createRawRoot("nofuncs");
    const report = summarizeTraces(outputDir);

    expect(report.functions.total).toBe(0);
    expect(report.invalidFunctions).toBe(0);
    expect(report.complete).toBe(false);
  });

  it("marks a function with no .vc-config.json structurally invalid", () => {
    const { outputDir } = createRawRoot("missingcfg");
    writeRawFunc(outputDir, "login.func", null);

    const report = summarizeTraces(outputDir);

    expect(report.invalidFunctions).toBe(1);
    expect(report.invalidDetails[0].reason).toBe("missing .vc-config.json");
    expect(report.complete).toBe(false);
  });

  it("marks an unparsable .vc-config.json structurally invalid", () => {
    const { outputDir } = createRawRoot("badcfg");
    writeRawFunc(outputDir, "login.func", "{ not json");

    const report = summarizeTraces(outputDir);

    expect(report.invalidFunctions).toBe(1);
    expect(report.complete).toBe(false);
  });

  it("counts missing files once per PHYSICAL artifact, not once per logical symlink", () => {
    const { outputDir } = createBuild({
      sources: ["src/ok.ts"],
      reals: { "login.func": ["src/ok.ts"] },
      missingSources: ["node_modules/gone/vanished.js"],
      symlinks: { "app.func": "login.func", "app.rsc.func": "login.func" },
    });

    const report = summarizeTraces(outputDir);

    expect(report.functions.total).toBe(3);
    expect(report.functions.uniqueArtifacts).toBe(1);
    // ONE physical artifact has ONE missing file, so this must be 1 — not 3.
    expect(report.missingFiles).toBe(1);
  });

  it("marks a broken .func symlink structurally invalid", () => {
    const { outputDir } = createBuild({
      sources: ["src/a.ts"],
      reals: { "login.func": ["src/a.ts"] },
    });
    fs.symlinkSync(
      path.join(outputDir, "functions", "gone.func"),
      path.join(outputDir, "functions", "dangling.func"),
    );

    const report = summarizeTraces(outputDir);

    expect(report.invalidFunctions).toBe(1);
    expect(report.invalidDetails[0].reason).toBe("broken symlink");
    expect(report.complete).toBe(false);
  });

  it("counts zero-byte traced files in `files` without inflating `bytes`", () => {
    const { root, outputDir } = createBuild({
      sources: ["src/page.ts"],
      reals: { "login.func": ["src/page.ts"] },
    });
    // A real, zero-byte traced file, referenced only by an api function.
    fs.writeFileSync(path.join(root, "src/zero.ts"), "");
    writeRawFunc(
      outputDir,
      "api/health.func",
      JSON.stringify({ filePathMap: { "src/zero.ts": "src/zero.ts" } }),
    );

    const report = summarizeTraces(outputDir);

    // Presence is counted even though the file contributes no bytes...
    expect(report.api.files).toBe(1);
    expect(report.api.bytes).toBe(0);
    // ...and the api-only path is still detected. A byte-total comparison could not see
    // this: bytes(union) === bytes(page) is true here, so it would have claimed the
    // invariant held while an api path was absent from the page union.
    expect(report.pageIsSupersetOfApi).toBe(false);
    expect(report.union.files).toBe(report.page.files + 1);
  });

  it("throws a helpful error when the directory is not a build output", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ipix-trace-notbuild-"));
    tempDirs.push(root);

    expect(() => summarizeTraces(root)).toThrow(/No "functions" directory/);
  });
});

describe("isPageSupersetOfApi", () => {
  it("requires PATH membership, not equal byte totals", () => {
    // Comparing totals cannot see a zero-byte api-only path: union and page totals are
    // both 100 while the api path is absent from the page union. summarizeTraces now
    // tracks zero-byte files, so this is also proven end-to-end in the zero-byte test.
    const page = new Map([["src/page.ts", 100]]);
    const api = new Map([
      ["src/page.ts", 100],
      ["src/api-only.ts", 0],
    ]);

    expect(isPageSupersetOfApi(page, api)).toBe(false);
  });

  it("is true when every api path is present in the page union", () => {
    const page = new Map([
      ["src/page.ts", 100],
      ["src/shared.ts", 50],
    ]);
    const api = new Map([["src/shared.ts", 50]]);

    expect(isPageSupersetOfApi(page, api)).toBe(true);
  });
});

describe("compareReports", () => {
  function reportWith(
    pageOnlyShikiBytes: number,
    apiBytes = 0,
    unionBytes = 100 * MIB,
    complete = true,
  ) {
    return {
      complete,
      union: { files: 1, bytes: unionBytes },
      api: { files: 1, bytes: apiBytes },
      families: [
        {
          name: "@shikijs",
          page: { files: 334, bytes: pageOnlyShikiBytes },
          api: { files: 0, bytes: 0 },
          pageOnly: { files: 334, bytes: pageOnlyShikiBytes },
        },
      ],
    };
  }

  it("passes the gate when the page-only reduction meets the threshold", () => {
    const result = compareReports(reportWith(10 * MIB), reportWith(0.5 * MIB), {
      family: "@shikijs",
      minReductionMiB: 9,
    });

    expect(result.gated).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.reductionBytes).toBeCloseTo(9.5 * MIB, 0);
  });

  it("fails the gate when the reduction is below the threshold", () => {
    const result = compareReports(reportWith(10 * MIB), reportWith(9.5 * MIB), {
      family: "@shikijs",
      minReductionMiB: 9,
    });

    expect(result.passed).toBe(false);
  });

  it("reports a regression as a negative reduction", () => {
    const result = compareReports(reportWith(1 * MIB), reportWith(4 * MIB), {
      family: "@shikijs",
    });

    expect(result.reductionBytes).toBeLessThan(0);
    expect(result.gated).toBe(false);
    expect(result.passed).toBe(null);
  });

  it("surfaces an api union that grew", () => {
    const result = compareReports(reportWith(10 * MIB, 40 * MIB), reportWith(1 * MIB, 44 * MIB), {
      family: "@shikijs",
    });

    expect(result.apiDeltaBytes).toBe(4 * MIB);
  });

  it("errors clearly when the family is absent from a report", () => {
    const result = compareReports(reportWith(10 * MIB), reportWith(1 * MIB), { family: "nope" });
    expect(result.error).toContain("not present in both reports");
  });

  it("refuses to gate on an incomplete BASELINE even when the reduction looks sufficient", () => {
    const result = compareReports(
      reportWith(10 * MIB, 0, 100 * MIB, false),
      reportWith(1 * MIB),
      { family: "@shikijs", minReductionMiB: 9 },
    );

    expect(result.complete).toBe(false);
    expect(result.error).toContain("incomplete");
    // The regression this guards: the gate used to report PASS off a partial baseline.
    expect(result.passed).toBe(null);
  });

  it("refuses to gate on an incomplete CURRENT report", () => {
    const result = compareReports(
      reportWith(10 * MIB),
      reportWith(1 * MIB, 0, 100 * MIB, false),
      { family: "@shikijs", minReductionMiB: 9 },
    );

    expect(result.complete).toBe(false);
    expect(result.error).toContain("incomplete");
    expect(result.passed).toBe(null);
  });

  it("reports both size deltas as current-minus-baseline", () => {
    const result = compareReports(
      reportWith(10 * MIB, 40 * MIB, 100 * MIB),
      reportWith(1 * MIB, 44 * MIB, 90 * MIB),
    );

    // Negative always means "smaller now" for both, with no per-field sign flipping.
    expect(result.unionDeltaBytes).toBe(-10 * MIB);
    expect(result.apiDeltaBytes).toBe(4 * MIB);
  });
});

describe("runMeasurement CLI contract", () => {
  it("exits non-zero when the superset invariant is broken", () => {
    const { outputDir } = createBuild({
      sources: ["src/only-page.ts", "src/only-api.ts"],
      reals: {
        "login.func": ["src/only-page.ts"],
        "api/health.func": ["src/only-api.ts"],
      },
    });

    expect(runMeasurement(["--output", outputDir, "--json"])).not.toBe(0);
  });

  it("exits non-zero when traced files are missing, unless explicitly allowed", () => {
    const { outputDir } = createBuild({
      sources: ["src/only-page.ts"],
      reals: { "login.func": ["src/only-page.ts"] },
      missingSources: ["node_modules/gone/vanished.js"],
    });

    expect(runMeasurement(["--output", outputDir, "--json"])).not.toBe(0);
    expect(runMeasurement(["--output", outputDir, "--json", "--allow-missing"])).toBe(0);
  });

  it("exits 2 with usage on an unknown argument", () => {
    expect(runMeasurement(["--nope"])).toBe(2);
  });

  it("exits 0 on --help", () => {
    expect(runMeasurement(["--help"])).toBe(0);
  });

  it("exits 2 when the build has no logical functions", () => {
    const { outputDir } = createRawRoot("cli-nofuncs");
    expect(runMeasurement(["--output", outputDir, "--json"])).toBe(2);
  });

  it("exits 2 when a .func has no .vc-config.json", () => {
    const { outputDir } = createRawRoot("cli-nocfg");
    writeRawFunc(outputDir, "login.func", null);
    expect(runMeasurement(["--output", outputDir, "--json"])).toBe(2);
  });

  it("exits 2 when a .vc-config.json is malformed", () => {
    const { outputDir } = createRawRoot("cli-badcfg");
    writeRawFunc(outputDir, "login.func", "{ not json");
    expect(runMeasurement(["--output", outputDir, "--json"])).toBe(2);
  });

  it("exits 2 when a .func symlink is broken", () => {
    const { outputDir } = createBuild({
      sources: ["src/a.ts"],
      reals: { "login.func": ["src/a.ts"] },
    });
    fs.symlinkSync(
      path.join(outputDir, "functions", "gone.func"),
      path.join(outputDir, "functions", "dangling.func"),
    );

    expect(runMeasurement(["--output", outputDir, "--json"])).toBe(2);
  });

  it("passes the gate on a COMPLETE baseline with a sufficient reduction", () => {
    const { root, outputDir } = createBuild({
      sources: ["src/only-page.ts"],
      reals: { "login.func": ["src/only-page.ts"] },
    });
    const baseline = writeBaseline(root, { complete: true, shikiPageOnlyMiB: 10 });

    expect(
      runMeasurement([
        "--output",
        outputDir,
        "--compare",
        baseline,
        "--family",
        "@shikijs",
        "--min-reduction",
        "9",
      ]),
    ).toBe(0);
  });

  it("exits 2 rather than passing the gate off an incomplete baseline", () => {
    const { root, outputDir } = createBuild({
      sources: ["src/only-page.ts"],
      reals: { "login.func": ["src/only-page.ts"] },
    });
    const baseline = writeBaseline(root, { complete: false, shikiPageOnlyMiB: 10 });

    expect(
      runMeasurement([
        "--output",
        outputDir,
        "--compare",
        baseline,
        "--family",
        "@shikijs",
        "--min-reduction",
        "9",
      ]),
    ).toBe(2);
  });

  it("exits 2 on a non-numeric or negative --min-reduction", () => {
    const { root, outputDir } = createBuild({
      sources: ["src/only-page.ts"],
      reals: { "login.func": ["src/only-page.ts"] },
    });
    const baseline = writeBaseline(root, { complete: true, shikiPageOnlyMiB: 10 });
    const args = ["--output", outputDir, "--compare", baseline];

    expect(runMeasurement([...args, "--min-reduction", "nine"])).toBe(2);
    expect(runMeasurement([...args, "--min-reduction", "-1"])).toBe(2);
  });

  it("exits 2 when a value-taking flag is missing its value", () => {
    // These used to no-op silently (exit 0) instead of surfacing the mistyped flag.
    expect(runMeasurement(["--min-reduction"])).toBe(2);
    expect(runMeasurement(["--save"])).toBe(2);
    expect(runMeasurement(["--compare"])).toBe(2);
    expect(runMeasurement(["--families"])).toBe(2);
  });
});

describe("createTraceResolver", () => {
  it("reads each PHYSICAL artifact once even when several logical routes alias it", () => {
    const { root, outputDir } = createBuild({
      sources: ["src/a.ts"],
      reals: { "login.func": ["src/a.ts"] },
      symlinks: { "app.func": "login.func", "app.rsc.func": "login.func" },
    });
    const { logical, broken } = listFunctionEntries(outputDir);
    const resolver = createTraceResolver(root, { outputDir, broken });

    for (const dir of logical) resolver.resolve(dir);

    expect(logical).toHaveLength(3);
    // The cache-hit contract, asserted directly: three routes, one physical read.
    expect(resolver.reads).toBe(1);
  });

  it("counts a missing file once per physical artifact, not once per alias", () => {
    const { root, outputDir } = createBuild({
      sources: ["src/ok.ts"],
      reals: { "login.func": ["src/ok.ts"] },
      missingSources: ["node_modules/gone/vanished.js"],
      symlinks: { "app.func": "login.func" },
    });
    const { logical, broken } = listFunctionEntries(outputDir);
    const resolver = createTraceResolver(root, { outputDir, broken });
    for (const dir of logical) resolver.resolve(dir);

    expect(resolver.missing).toBe(1);
  });

  it("records an unusable config once and reports it through invalidDetails", () => {
    const { outputDir } = createRawRoot("resolver-badcfg");
    writeRawFunc(outputDir, "login.func", "{ not json");
    const { logical, broken } = listFunctionEntries(outputDir);
    const resolver = createTraceResolver(path.dirname(path.dirname(outputDir)), {
      outputDir,
      broken,
    });

    for (const dir of logical) resolver.resolve(dir);

    expect(resolver.invalidDetails).toHaveLength(1);
    expect(resolver.invalidDetails[0].reason).toBe("unparsable .vc-config.json");
  });
});

describe("validatePath (--save / --compare guard)", () => {
  it("accepts a repository-relative path and returns an absolute resolved form", () => {
    const resolved = validatePath("baseline.json");

    expect(path.isAbsolute(resolved)).toBe(true);
    expect(resolved.endsWith("baseline.json")).toBe(true);
  });

  it("accepts a temp-directory path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ipix-guard-"));
    tempDirs.push(dir);

    expect(validatePath(path.join(dir, "before.json"))).toContain("before.json");
  });

  it("rejects a path outside the repo and temp roots", () => {
    const outside = fs.mkdtempSync(path.join(os.homedir(), ".ipix-pathguard-"));
    tempDirs.push(outside);
    const target = path.join(outside, "baseline.json");

    expect(() => validatePath(target)).toThrow(/outside the allowed locations/);
  });

  it("accepts the same outside path once explicitly allowlisted", () => {
    const outside = fs.mkdtempSync(path.join(os.homedir(), ".ipix-pathguard-"));
    tempDirs.push(outside);
    const target = path.join(outside, "baseline.json");

    const resolved = validatePath(target, {
      env: { MEASURE_TRACES_ALLOW_DIRS: outside },
    });

    // realpath is applied by the guard, so compare against the real prefix.
    expect(resolved).toBe(path.join(fs.realpathSync(outside), "baseline.json"));
  });

  it("rejects a symlink that escapes an allowed root", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ipix-escape-"));
    tempDirs.push(dir);
    fs.symlinkSync("/etc", path.join(dir, "escape"));

    expect(() => validatePath(path.join(dir, "escape", "passwd"))).toThrow(
      /outside the allowed locations/,
    );
  });

  it("rejects empty, whitespace and NUL-containing paths", () => {
    expect(() => validatePath("")).toThrow(/non-empty/);
    expect(() => validatePath("   ")).toThrow(/non-empty/);
    expect(() => validatePath("bad\0name")).toThrow(/NUL/);
    expect(() => validatePath(undefined as unknown as string)).toThrow(/non-empty/);
  });

  it("makes the CLI refuse an out-of-bounds --save instead of writing", () => {
    const outside = fs.mkdtempSync(path.join(os.homedir(), ".ipix-pathguard-"));
    tempDirs.push(outside);
    const target = path.join(outside, "should-not-exist.json");

    expect(runMeasurement(["--save", target, "--json"])).toBe(2);
    expect(fs.existsSync(target)).toBe(false);
  });
});

describe("--project-root override", () => {
  it("reports the measurement invalid when a moved output dir is measured without it", () => {
    const { root, outputDir } = createBuild({
      sources: ["src/a.ts"],
      reals: { "login.func": ["src/a.ts"] },
    });
    const moved = fs.mkdtempSync(path.join(os.tmpdir(), "ipix-moved-"));
    tempDirs.push(moved);
    const movedOutput = path.join(moved, "output");
    fs.cpSync(outputDir, movedOutput, { recursive: true });

    // `<moved>/output/../..` is the temp root, not the build's project root, so every
    // filePathMap entry resolves to a non-existent path.
    const withoutRoot = summarizeTraces(movedOutput);
    expect(withoutRoot.complete).toBe(false);
    expect(withoutRoot.missingFiles).toBeGreaterThan(0);

    const withRoot = summarizeTraces(movedOutput, { projectRoot: root });
    expect(withRoot.complete).toBe(true);
    expect(withRoot.missingFiles).toBe(0);
    expect(withRoot.projectRoot).toBe(root);
  });

  it("accepts --project-root on the CLI and flips the exit code", () => {
    const { root, outputDir } = createBuild({
      sources: ["src/a.ts"],
      reals: { "login.func": ["src/a.ts"] },
    });
    const moved = fs.mkdtempSync(path.join(os.tmpdir(), "ipix-moved-cli-"));
    tempDirs.push(moved);
    const movedOutput = path.join(moved, "output");
    fs.cpSync(outputDir, movedOutput, { recursive: true });

    expect(runMeasurement(["--output", movedOutput, "--json"])).not.toBe(0);
    expect(
      runMeasurement(["--output", movedOutput, "--project-root", root, "--json"]),
    ).toBe(0);
  });
});
