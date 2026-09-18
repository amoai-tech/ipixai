import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  classifyFunction,
  compareReports,
  listFunctionEntries,
  readFunctionTrace,
  runMeasurement,
  summarizeTraces,
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
    expect(listFunctionEntries(root)).toEqual({ logical: [], uniqueDirs: [] });
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

  it("returns an empty trace when .vc-config.json is absent", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ipix-trace-noconfig-"));
    tempDirs.push(root);
    const dir = path.join(root, "functions", "broken.func");
    fs.mkdirSync(dir, { recursive: true });

    expect(readFunctionTrace(dir, root)).toEqual({ trace: new Map(), missing: 0 });
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

  it("throws a helpful error when the directory is not a build output", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ipix-trace-notbuild-"));
    tempDirs.push(root);

    expect(() => summarizeTraces(root)).toThrow(/No "functions" directory/);
  });
});

describe("compareReports", () => {
  function reportWith(pageOnlyShikiBytes: number, apiBytes = 0, unionBytes = 100 * MIB) {
    return {
      complete: true,
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
});
