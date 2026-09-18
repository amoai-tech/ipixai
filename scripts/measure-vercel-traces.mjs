import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Canonical Vercel function-trace measurement for iPix bundle work.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every bundle claim on IPI-1234 / IPI-1235 / IPI-1229 is only meaningful against a
 * self-consistent baseline. Independent reviews produced page / api / union numbers
 * for the same commit that did not agree with each other, and one of them reported a
 * "union" LARGER than its own "page" union — impossible when page functions are a
 * superset of api functions. A before/after gate ("Shiki page trace drops by >= 9 MiB")
 * is worthless if the two sides were measured differently.
 *
 * So: one script, one definition, committed, used for both sides of every A/B.
 *
 * WHAT IT MEASURES
 * ----------------
 * `.vercel/output/functions/**\/*.func/.vc-config.json -> filePathMap` is the
 * authoritative record of which source files Vercel uploads for each function.
 * Deployment storage is the UNION of all function traces, so:
 *
 *   - a dependency present only in PAGE functions lowers the union when removed
 *   - a dependency present in BOTH page and api functions lowers it by ZERO
 *
 * That distinction is why IPI-1234 is a real ~10 MiB win and IPI-1235 is worth 0 MiB
 * of storage.
 *
 * TWO TRAPS THIS SCRIPT EXISTS TO AVOID
 * -------------------------------------
 * 1. Vercel DEDUPLICATES identical functions with symlinks. A build can expose 113
 *    logical `.func` entries backed by only 5 real artifacts. `isDirectory()` is FALSE
 *    for a symlink, so a naive directory walk silently under-counts. Both the logical
 *    count and the unique-artifact count are reported here.
 *
 * 2. `filePathMap` values are RELATIVE to the build's project root (absolute values are
 *    also accepted — a real production trace was verified to contain relative ones).
 *    If `.next/` or `node_modules/` have changed since the build (a rebuild, an
 *    `npm install`, another agent working in the same checkout), some entries no longer
 *    resolve. Sizes then silently shrink and the number looks like a win. MISSING files
 *    are counted and reported, and a measurement with any missing file is flagged
 *    INVALID.
 *
 * 3. Structural damage fails OPEN, not closed. A `.func` whose `.vc-config.json` is
 *    absent or unparsable, or an output with no logical `.func` entries at all, yields
 *    an empty trace with zero missing files — which reads as a clean, healthy,
 *    zero-byte measurement. Such artifacts are therefore counted separately as
 *    `invalidFunctions`, and `complete` is false whenever that count is non-zero.
 *
 * Because of (2), always build and measure in the same breath, then `--save` the
 * baseline immediately.
 *
 * USAGE
 * -----
 *   node scripts/measure-vercel-traces.mjs
 *   node scripts/measure-vercel-traces.mjs --output .vercel/output --json
 *   node scripts/measure-vercel-traces.mjs --save before.json
 *   node scripts/measure-vercel-traces.mjs --compare before.json \
 *        --family @shikijs --min-reduction 9.0
 *
 * The last form is the IPI-1234 Checkpoint 1 gate: it exits 1 when the reduction is
 * below the threshold, so a negative result is machine-detectable rather than argued.
 *
 * Producing a build to measure:
 *   vercel pull --yes --environment=production && vercel build --prod
 *
 * TRUST MODEL / PATH HANDLING
 * ---------------------------
 * `--save` and `--compare` accept filesystem paths from the operator invoking this
 * script. They are validated by `validatePath` before any read or write: the resolved
 * target must sit inside the repository or inside a temp directory. That is an
 * ACCIDENT guard, not a security boundary — the operator already has the same
 * filesystem access as this script — but it means a mistyped or copy-pasted path
 * cannot silently overwrite something unrelated, and the `fs` calls only ever receive
 * a checked path.
 *
 * A legitimately different baseline location is an explicit opt-in:
 *   MEASURE_TRACES_ALLOW_DIRS=/data/baselines:/mnt/ci npm run measure:traces -- --save ...
 *
 * `--project-root` is NOT restricted: it is a read-only source root, and a wrong value
 * can only make files look missing (which the measurement already reports as invalid).
 */

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const MIB = 1024 * 1024;

/**
 * Realpath of the nearest existing ancestor of `target`, with the not-yet-existing
 * remainder re-appended.
 *
 * A `--save` target does not exist yet, so `realpathSync` on it would throw. Resolving
 * the ancestor instead means a symlinked checkout, `/tmp` vs `/private/tmp` on macOS,
 * or a symlink pointing out of an allowed directory are all compared as the filesystem
 * actually resolves them — not as the argument string is spelled.
 */
function realResolvedTarget(target) {
  let current = path.resolve(target);
  const tail = [];
  for (;;) {
    try {
      const real = fs.realpathSync(current);
      return tail.length === 0 ? real : path.join(real, ...tail.reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target); // reached the FS root
      tail.push(path.basename(current));
      current = parent;
    }
  }
}

/** Containment roots a `--save` / `--compare` target is allowed to resolve into. */
export function allowedPathRoots(env = process.env) {
  const roots = [repoRoot, os.tmpdir(), "/tmp"];
  const extra = env.MEASURE_TRACES_ALLOW_DIRS;
  if (extra) roots.push(...extra.split(path.delimiter).filter(Boolean));

  const resolved = [];
  for (const root of roots) {
    try {
      // A root that does not exist cannot contain anything, so it is dropped rather
      // than trusted as a prefix.
      resolved.push(fs.realpathSync(path.resolve(root)));
    } catch {
      /* not a real directory - ignore */
    }
  }
  return [...new Set(resolved)];
}

/**
 * Validate an operator-supplied `--save` / `--compare` path and return its resolved,
 * symlink-free absolute form.
 *
 * Throws (never silently coerces) when the path is empty, contains a NUL byte, or
 * resolves outside every allowed root.
 */
export function validatePath(rawPath, options = {}) {
  const { label = "path", env = process.env } = options;

  if (typeof rawPath !== "string" || rawPath.trim() === "") {
    throw new Error(`${label} must be a non-empty path`);
  }
  if (rawPath.includes("\0")) {
    throw new Error(`${label} must not contain a NUL byte`);
  }

  const target = realResolvedTarget(rawPath);
  const roots = allowedPathRoots(env);
  const contained = roots.some((root) =>
    target === root || target.startsWith(root.endsWith(path.sep) ? root : `${root}${path.sep}`),
  );

  if (!contained) {
    throw new Error(
      `${label} "${rawPath}" resolves to ${target}, which is outside the allowed locations.\n` +
        `  allowed: ${roots.join(", ")}\n` +
        "  Use a path inside the repository, or extend the list with\n" +
        "  MEASURE_TRACES_ALLOW_DIRS (colon-separated) if the baseline belongs elsewhere.",
    );
  }
  return target;
}

/** Families reported by default. Matched as `node_modules/<name>/` inside a trace path. */
export const DEFAULT_FAMILIES = [
  "@shikijs",
  "@mastra",
  "@libsql",
  "@copilotkit",
  "streamdown",
  "next",
];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

/**
 * Classify a LOGICAL function path as `api` or `page`.
 *
 *   "functions/app.func"                         -> page
 *   "functions/api.func"                         -> api
 *   "functions/api/copilotkit/[[...slug]].func"  -> api
 *
 * Only the first segment under `functions/` decides, so a page route that merely
 * contains "api" deeper in its path is not mis-bucketed. Classification must use the
 * LOGICAL path, never the symlink target: `functions/app/brands.func` points at
 * `../login.func` but is a page route.
 */
export function classifyFunction(relativePath) {
  const normalised = toPosix(relativePath).replace(/^\.?\//, "");
  const underFunctions = normalised.startsWith("functions/")
    ? normalised.slice("functions/".length)
    : normalised;
  const firstSegment = underFunctions.split("/")[0].replace(/\.func$/, "");
  return firstSegment === "api" ? "api" : "page";
}

/**
 * Enumerate every logical `.func` entry under `<outputDir>/functions`.
 *
 * Returns logical entries (symlinks included), the list of unique real directories,
 * and any entry whose symlink target does not resolve. `name.endsWith(".func")` is used
 * rather than `isDirectory()` because Vercel emits deduplicated functions as symlinks.
 *
 * A broken symlink is reported through `broken` instead of thrown: `realpathSync` would
 * otherwise abort the whole measurement with a bare ENOENT, which is both unhelpful and
 * inconsistent with `readFunctionTrace`, which already degrades gracefully.
 */
export function listFunctionEntries(outputDir) {
  const functionsRoot = path.join(outputDir, "functions");
  if (!fs.existsSync(functionsRoot)) return { logical: [], uniqueDirs: [], broken: [] };

  const logical = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name.endsWith(".func")) {
        logical.push(full);
      } else if (entry.isDirectory()) {
        walk(full);
      }
    }
  };
  walk(functionsRoot);

  const uniqueDirs = [];
  const broken = [];
  const seen = new Set();
  for (const dir of logical) {
    let real;
    try {
      real = fs.realpathSync(dir);
    } catch {
      broken.push(dir);
      continue;
    }
    if (!seen.has(real)) {
      seen.add(real);
      uniqueDirs.push(real);
    }
  }

  return { logical: logical.sort(), uniqueDirs, broken };
}

/**
 * Read one `.func` directory's authoritative trace.
 *
 * Returns `{ trace, missing, invalid }`:
 *   - trace   Map<absolute source path, bytes>
 *   - missing filePathMap entries whose source no longer exists on disk
 *   - invalid a reason string when the trace metadata is unusable, else null
 *
 * `invalid` exists because unusable metadata used to be indistinguishable from a
 * genuinely empty trace: both produced `{ trace: empty, missing: 0 }`, which downstream
 * code read as a valid zero-byte measurement.
 *
 * `filePathMap` values are RELATIVE to the build's project root, not absolute — even
 * though several ad-hoc scripts have assumed otherwise and only appeared to work
 * because they happened to run from the project root. Resolving them against the
 * `.func` directory instead of the project root reports every file as missing.
 */
export function readFunctionTrace(functionDir, projectRoot) {
  const trace = new Map();
  let missing = 0;
  const configPath = path.join(functionDir, ".vc-config.json");
  if (!fs.existsSync(configPath)) {
    return { trace, missing, invalid: "missing .vc-config.json" };
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return { trace, missing, invalid: "unparsable .vc-config.json" };
  }

  const filePathMap = config.filePathMap;
  if (!filePathMap || typeof filePathMap !== "object") {
    return { trace, missing, invalid: ".vc-config.json has no filePathMap" };
  }

  const sources = Object.values(filePathMap).filter(
    (raw) => typeof raw === "string" && raw.length > 0,
  );
  if (sources.length === 0) {
    return { trace, missing, invalid: ".vc-config.json has an empty filePathMap" };
  }

  for (const raw of sources) {
    // Values are project-root-relative in practice; accept absolute too.
    const candidate = path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
    let size;
    try {
      const stat = fs.statSync(candidate);
      if (!stat.isFile()) continue;
      size = stat.size;
    } catch {
      missing += 1;
      continue;
    }
    const previous = trace.get(candidate) ?? 0;
    if (size > previous) trace.set(candidate, size);
  }
  return { trace, missing, invalid: null };
}

function bytes(map) {
  let total = 0;
  for (const size of map.values()) total += size;
  return total;
}

function familyStats(page, api, pageOnly, name) {
  // Two shapes occur in a trace:
  //   node_modules/@shikijs/core/dist/index.mjs          (raw package file)
  //   .next/server/chunks/ssr/node_modules_@shikijs_core_dist_index_mjs_x._.js
  //                                                       (compiled SSR chunk)
  // Matching only the first shape under-reports a family, so both are matched.
  const raw = `node_modules/${name}/`;
  const compiled = `node_modules_${name.split("/").join("_")}`;
  const matches = (file) => {
    const posix = toPosix(file);
    return posix.includes(raw) || posix.includes(compiled);
  };
  const pick = (source) => {
    let files = 0;
    let total = 0;
    for (const [file, size] of source) {
      if (matches(file)) {
        files += 1;
        total += size;
      }
    }
    return { files, bytes: total };
  };
  return { name, page: pick(page), api: pick(api), pageOnly: pick(pageOnly) };
}

/**
 * The page union must contain every api trace path.
 *
 * Comparing byte totals (`bytes(union) === bytes(page)`) happens to agree with this
 * today only because zero-byte files are filtered out before reaching either map, so an
 * api-only entry can never contribute zero bytes. That is an accidental coupling — the
 * arithmetic stops expressing the invariant the moment zero-byte entries are tracked.
 * Stating it as a membership test removes the coupling.
 */
export function isPageSupersetOfApi(page, api) {
  for (const file of api.keys()) {
    if (!page.has(file)) return false;
  }
  return true;
}

/**
 * Fold every logical function's trace into the page/api unions.
 *
 * Broken symlinks are skipped here; the caller has already recorded them as invalid.
 */
function accumulateBuckets(logical, resolved, brokenSet, traceFor) {
  const page = new Map();
  const api = new Map();
  let pageFunctions = 0;
  let apiFunctions = 0;
  let largestPageFunction = null;

  for (const dir of logical) {
    if (brokenSet.has(dir)) continue;

    const relative = path.relative(resolved, dir);
    const kind = classifyFunction(relative);
    const { trace } = traceFor(dir);
    const bucket = kind === "api" ? api : page;
    if (kind === "api") apiFunctions += 1;
    else pageFunctions += 1;

    for (const [file, size] of trace) {
      const previous = bucket.get(file) ?? 0;
      if (size > previous) bucket.set(file, size);
    }

    if (kind === "page") {
      const size = bytes(trace);
      if (!largestPageFunction || size > largestPageFunction.bytes) {
        largestPageFunction = { name: toPosix(relative), bytes: size, files: trace.size };
      }
    }
  }

  return { page, api, pageFunctions, apiFunctions, largestPageFunction };
}

/**
 * Resolve logical `.func` directories to their authoritative trace.
 *
 * Reads and accounts for each PHYSICAL artifact exactly once: 113 logical routes can
 * share only 5 real artifacts, so counting per logical entry would multiply one
 * artifact's missing files by the number of symlinks pointing at it.
 *
 * Extracted from `summarizeTraces` so the caching/dedup contract is testable on its
 * own — `reads` exposes how many artifacts were actually parsed, which is the direct
 * proof that aliases hit the cache instead of re-reading.
 */
export function createTraceResolver(projectRoot, options = {}) {
  const { outputDir = projectRoot } = options;
  const broken = options.broken ?? [];

  const cache = new Map();
  const accounted = new Set();
  const invalidDetails = broken.map((dir) => ({
    name: toPosix(path.relative(outputDir, dir)),
    reason: "broken symlink",
  }));
  let missing = 0;

  const resolve = (dir) => {
    let real;
    try {
      real = fs.realpathSync(dir);
    } catch {
      real = dir;
    }
    if (!accounted.has(real)) {
      accounted.add(real);
      const record = readFunctionTrace(real, projectRoot);
      cache.set(real, record);
      missing += record.missing;
      if (record.invalid) {
        invalidDetails.push({
          name: toPosix(path.relative(outputDir, dir)),
          reason: record.invalid,
        });
      }
    }
    return cache.get(real);
  };

  return {
    resolve,
    get missing() {
      return missing;
    },
    get invalidDetails() {
      return invalidDetails;
    },
    /** Number of physical artifacts actually read — the cache-hit proof. */
    get reads() {
      return cache.size;
    },
  };
}

/** Assemble the canonical report object from the resolved buckets. */
function buildReport(input) {
  const {
    resolved,
    projectRoot,
    logical,
    uniqueDirs,
    page,
    api,
    pageFunctions,
    apiFunctions,
    largestPageFunction,
    missing,
    invalidDetails,
    families,
    topPageOnly,
  } = input;

  const union = new Map(page);
  for (const [file, size] of api) if (!union.has(file)) union.set(file, size);

  const pageOnly = new Map();
  for (const [file, size] of page) if (!api.has(file)) pageOnly.set(file, size);

  const topPageOnlyEntries = [...pageOnly.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topPageOnly)
    .map(([file, size]) => ({ path: file, bytes: size }));

  // `complete` is the single trust flag for a measurement. Structural damage counts
  // against it exactly as missing source files do, because both under-report sizes and
  // would otherwise be read as a legitimate zero-byte result.
  const invalidFunctions = invalidDetails.length;
  const complete = missing === 0 && invalidFunctions === 0 && logical.length > 0;

  return {
    measuredAt: new Date().toISOString(),
    outputDir: resolved,
    projectRoot,
    functions: {
      page: pageFunctions,
      api: apiFunctions,
      total: logical.length,
      uniqueArtifacts: uniqueDirs.length,
    },
    page: { files: page.size, bytes: bytes(page) },
    api: { files: api.size, bytes: bytes(api) },
    union: { files: union.size, bytes: bytes(union) },
    pageOnly: { files: pageOnly.size, bytes: bytes(pageOnly) },
    missingFiles: missing,
    invalidFunctions,
    invalidDetails,
    complete,
    pageIsSupersetOfApi: isPageSupersetOfApi(page, api),
    largestPageFunction,
    families: families.map((name) => familyStats(page, api, pageOnly, name)),
    topPageOnly: topPageOnlyEntries,
  };
}

/**
 * Build the canonical report for a Vercel build output directory.
 * Throws a helpful error when the directory is not a completed build.
 *
 * `options.projectRoot` overrides the derived `<output>/../..` root. Pass it when the
 * output directory has been moved or copied away from `<projectRoot>/.vercel/output`;
 * without it every `filePathMap` entry resolves against the wrong base and the
 * measurement reports every source file as missing (and therefore invalid).
 */
export function summarizeTraces(outputDir, options = {}) {
  const families = options.families ?? DEFAULT_FAMILIES;
  const topPageOnly = options.topPageOnly ?? 10;
  const resolved = path.resolve(outputDir);

  if (!fs.existsSync(path.join(resolved, "functions"))) {
    throw new Error(
      `No "functions" directory under ${resolved}. ` +
        "Run `vercel pull --yes --environment=production && vercel build --prod` first.",
    );
  }

  const { logical, uniqueDirs, broken } = listFunctionEntries(resolved);
  // `.vercel/output` normally lives at <projectRoot>/.vercel/output, so filePathMap
  // values resolve against the grandparent of the output directory — unless the
  // caller overrides it with --project-root.
  const projectRoot = options.projectRoot
    ? path.resolve(options.projectRoot)
    : path.resolve(resolved, "..", "..");

  const resolver = createTraceResolver(projectRoot, { outputDir: resolved, broken });
  const buckets = accumulateBuckets(logical, resolved, new Set(broken), resolver.resolve);

  return buildReport({
    resolved,
    projectRoot,
    logical,
    uniqueDirs,
    page: buckets.page,
    api: buckets.api,
    pageFunctions: buckets.pageFunctions,
    apiFunctions: buckets.apiFunctions,
    largestPageFunction: buckets.largestPageFunction,
    missing: resolver.missing,
    invalidDetails: resolver.invalidDetails,
    families,
    topPageOnly,
  });
}

function mib(value) {
  return `${(value / MIB).toFixed(2)} MiB`;
}

function formatFamilyTable(families) {
  const lines = ["  family            page          api           PAGE-ONLY"];
  for (const family of families) {
    lines.push(
      `  ${family.name.padEnd(16)}` +
        `${mib(family.page.bytes).padStart(9)}/${String(family.page.files).padStart(4)}  ` +
        `${mib(family.api.bytes).padStart(9)}/${String(family.api.files).padStart(4)}  ` +
        `${mib(family.pageOnly.bytes).padStart(9)}/${String(family.pageOnly.files).padStart(4)}` +
        (family.pageOnly.bytes === 0 && family.page.bytes > 0 ? "   (in BOTH -> 0 storage win)" : ""),
    );
  }
  return lines;
}

function formatTopPageOnly(entries) {
  const lines = ["  top page-only contributors"];
  for (const entry of entries) {
    lines.push(`    ${mib(entry.bytes).padStart(10)}  ${entry.path}`);
  }
  return lines;
}

/** Human-readable report — this block is what gets pasted into Linear / a PR body. */
export function formatReport(report) {
  const lines = [];
  lines.push("Vercel function-trace measurement");
  lines.push(`  output            : ${report.outputDir}`);
  if (report.projectRoot) lines.push(`  project root      : ${report.projectRoot}`);
  lines.push(`  measured at       : ${report.measuredAt}`);
  lines.push(
    `  functions         : ${report.functions.total} logical` +
      `  (${report.functions.page} page-class, ${report.functions.api} api-class)` +
      `  backed by ${report.functions.uniqueArtifacts} unique artifact(s)`,
  );
  lines.push("");
  lines.push(`  PAGE union        : ${mib(report.page.bytes).padStart(10)} / ${report.page.files} files`);
  lines.push(`  API  union        : ${mib(report.api.bytes).padStart(10)} / ${report.api.files} files`);
  lines.push(`  DEPLOYMENT union  : ${mib(report.union.bytes).padStart(10)} / ${report.union.files} files`);
  lines.push(`  PAGE-ONLY         : ${mib(report.pageOnly.bytes).padStart(10)} / ${report.pageOnly.files} files`);
  lines.push("");
  lines.push(
    `  missing traced files : ${report.missingFiles}${report.complete ? "" : "   <-- MEASUREMENT INVALID"}`,
  );
  if (report.missingFiles > 0) {
    lines.push(
      "    filePathMap references files that no longer exist on disk (rebuilt .next / changed",
    );
    lines.push(
      "    node_modules). Sizes are under-reported. Rebuild and re-measure before comparing.",
    );
  }
  lines.push(`  invalid functions    : ${report.invalidFunctions}`);
  for (const detail of report.invalidDetails.slice(0, 5)) {
    lines.push(`    ${detail.name} — ${detail.reason}`);
  }
  if (report.invalidDetails.length > 5) {
    lines.push(`    ... and ${report.invalidDetails.length - 5} more`);
  }
  if (report.functions.total === 0) {
    lines.push(
      "    no logical `.func` entries were found, so every size below is a meaningless zero",
    );
  }
  lines.push(
    `  page is superset of api : ${report.pageIsSupersetOfApi ? "YES" : "NO"}` +
      (report.pageIsSupersetOfApi
        ? ""
        : "  <-- INVARIANT BROKEN: union should equal page. Check function classification."),
  );
  if (report.largestPageFunction) {
    lines.push(
      `  largest page fn   : ${report.largestPageFunction.name} — ${mib(report.largestPageFunction.bytes)} / ${report.largestPageFunction.files} files`,
    );
  }
  lines.push("");
  lines.push(...formatFamilyTable(report.families));
  lines.push("");
  lines.push(...formatTopPageOnly(report.topPageOnly));
  return lines.join("\n");
}

/**
 * Compare a fresh measurement against a saved baseline.
 * Returns per-family deltas plus a gate verdict when a threshold is supplied.
 */
export function compareReports(baseline, current, options = {}) {
  const family = options.family ?? "@shikijs";
  const minReductionBytes =
    typeof options.minReductionMiB === "number" && Number.isFinite(options.minReductionMiB)
      ? options.minReductionMiB * MIB
      : null;

  const pick = (report) =>
    (report?.families ?? []).find((entry) => entry.name === family) ?? null;
  const before = pick(baseline);
  const after = pick(current);

  // One stable shape for every outcome: consumers (including the TypeScript tests,
  // which `next build` type-checks) can read any field without union narrowing.
  const base = {
    family,
    error: null,
    beforePageOnly: null,
    afterPageOnly: null,
    reductionBytes: null,
    unionDeltaBytes: null,
    apiDeltaBytes: null,
    gated: minReductionBytes !== null,
    passed: null,
    minReductionBytes,
    complete: Boolean(current?.complete && baseline?.complete),
  };

  if (!base.complete) {
    return {
      ...base,
      error:
        "baseline or current report is incomplete — a partial measurement under-reports " +
        "sizes and cannot gate a reduction",
    };
  }

  if (!before || !after) {
    return { ...base, error: `family "${family}" is not present in both reports` };
  }

  const reduction = before.pageOnly.bytes - after.pageOnly.bytes;
  return {
    ...base,
    beforePageOnly: before.pageOnly,
    afterPageOnly: after.pageOnly,
    reductionBytes: reduction,
    // Both deltas use ONE convention — current minus baseline — so a negative value
    // always means "smaller now". `reductionBytes` above is deliberately the opposite
    // sign because it is a reduction, not a delta: positive means the family shrank.
    unionDeltaBytes: current.union.bytes - baseline.union.bytes,
    apiDeltaBytes: current.api.bytes - baseline.api.bytes,
    passed: minReductionBytes === null ? null : reduction >= minReductionBytes,
  };
}

/** Render a current-minus-baseline delta so the direction is never ambiguous. */
function describeDelta(deltaBytes) {
  return deltaBytes > 0 ? `${mib(deltaBytes)} LARGER` : `${mib(-deltaBytes)} smaller`;
}

export function formatComparison(result) {
  if (result.error) return `comparison error: ${result.error}`;
  const lines = [];
  lines.push(`A/B comparison — family "${result.family}"`);
  lines.push(
    `  page-only before  : ${mib(result.beforePageOnly.bytes)} / ${result.beforePageOnly.files} files`,
  );
  lines.push(
    `  page-only after   : ${mib(result.afterPageOnly.bytes)} / ${result.afterPageOnly.files} files`,
  );
  lines.push(
    `  reduction         : ${mib(result.reductionBytes)} (${result.reductionBytes >= 0 ? "smaller" : "LARGER — regression"})`,
  );
  lines.push(`  deployment union  : ${describeDelta(result.unionDeltaBytes)}`);
  lines.push(
    `  api union         : ${describeDelta(result.apiDeltaBytes)}` +
      (result.apiDeltaBytes > 0 ? "  <-- check for accidental api regression" : "  (good)"),
  );
  if (result.gated) {
    lines.push(
      `  GATE              : ${result.passed ? "PASS" : "FAIL"} — required reduction >= ${(result.minReductionBytes / MIB).toFixed(2)} MiB`,
    );
  }
  return lines.join("\n");
}

function parseArgs(argv) {
  const options = {
    output: path.join(repoRoot, ".vercel", "output"),
    json: false,
    save: null,
    compare: null,
    family: "@shikijs",
    minReductionMiB: null,
    allowMissing: false,
    projectRoot: null,
    families: [...DEFAULT_FAMILIES],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    // A flag whose value is missing must fail closed. Returning undefined here used to
    // make `--save`, `--compare` and `--min-reduction` silently no-op at the end of the
    // argument list — so a mistyped invocation exited 0 without writing a baseline or
    // running the gate at all.
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      return value;
    };
    if (arg === "--output") options.output = next();
    else if (arg === "--project-root") options.projectRoot = next();
    else if (arg === "--json") options.json = true;
    else if (arg === "--save") options.save = next();
    else if (arg === "--compare") options.compare = next();
    else if (arg === "--family") options.family = next();
    else if (arg === "--min-reduction") {
      const raw = next();
      const minReductionMiB = Number(raw);
      if (raw.trim() === "" || !Number.isFinite(minReductionMiB) || minReductionMiB < 0) {
        throw new Error(`--min-reduction must be a finite, non-negative number of MiB (got "${raw}")`);
      }
      options.minReductionMiB = minReductionMiB;
    } else if (arg === "--families") {
      const families = next().split(",").map((s) => s.trim()).filter(Boolean);
      if (families.length === 0) throw new Error("--families requires at least one family name");
      options.families = families;
    } else if (arg === "--allow-missing") options.allowMissing = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  return [
    "Usage: node scripts/measure-vercel-traces.mjs [options]",
    "",
    "  --output <dir>          build output dir (default .vercel/output)",
    "  --project-root <dir>    project root for filePathMap resolution (default <output>/../..)",
    "                          pass this when the output dir was moved or copied",
    "  --json                  print the raw report as JSON",
    "  --save <file>           write the report JSON to a file (baseline). Must resolve",
    "                          inside the repo or a temp dir; see MEASURE_TRACES_ALLOW_DIRS",
    "  --compare <file>        compare against a saved baseline report",
    "  --family <name>         family for the comparison (default @shikijs)",
    "  --min-reduction <MiB>   gate: exit 1 unless page-only shrinks by this much",
    "  --families a,b,c        families to report (default a built-in list)",
    "  --allow-missing         do not fail when traced files are missing (unsafe). Does NOT",
    "                          excuse a structurally invalid build — that always exits 2",
    "  --help                  show this message",
  ].join("\n");
}

export function runMeasurement(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`measure-vercel-traces: ${error.message}`);
    console.error(usage());
    return 2;
  }
  if (options.help) {
    console.log(usage());
    return 0;
  }

  // Validate operator-supplied paths BEFORE doing any work, so a rejected path fails
  // fast and the fs calls below only ever receive a checked, resolved path.
  let savePath = null;
  let comparePath = null;
  try {
    if (options.save) savePath = validatePath(options.save, { label: "--save" });
    if (options.compare) comparePath = validatePath(options.compare, { label: "--compare" });
  } catch (error) {
    console.error(`measure-vercel-traces: ${error.message}`);
    return 2;
  }

  let report;
  try {
    report = summarizeTraces(options.output, {
      families: options.families,
      projectRoot: options.projectRoot ?? undefined,
    });
  } catch (error) {
    console.error(`measure-vercel-traces: ${error.message}`);
    return 2;
  }

  if (options.json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatReport(report));

  if (savePath) {
    fs.writeFileSync(savePath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\nbaseline written to ${savePath}`);
  }

  if (!report.pageIsSupersetOfApi) {
    console.error(
      "\nmeasure-vercel-traces: page union is not a superset of api union — the classification invariant is broken. Do not use these numbers as a gate.",
    );
    return 1;
  }

  // Structural damage is never overridable: `--allow-missing` acknowledges vanished
  // source files, it does not make a malformed build measurable.
  if (report.functions.total === 0) {
    console.error(
      "\nmeasure-vercel-traces: no logical `.func` entries were found under functions/ — this is not a usable build output. Rebuild before measuring.",
    );
    return 2;
  }

  if (report.invalidFunctions > 0) {
    console.error(
      `\nmeasure-vercel-traces: ${report.invalidFunctions} function artifact(s) have unusable trace metadata (missing/unparsable .vc-config.json, empty filePathMap, or a broken symlink), so every size above is unreliable.`,
    );
    for (const detail of report.invalidDetails.slice(0, 5)) {
      console.error(`  ${detail.name} — ${detail.reason}`);
    }
    return 2;
  }

  if (!report.complete && !options.allowMissing) {
    console.error(
      `\nmeasure-vercel-traces: ${report.missingFiles} traced file(s) are missing on disk, so every size above is under-reported. Rebuild and re-measure, or pass --allow-missing to acknowledge.`,
    );
    return 1;
  }

  if (comparePath) {
    let baseline;
    try {
      baseline = JSON.parse(fs.readFileSync(comparePath, "utf8"));
    } catch (error) {
      console.error(`measure-vercel-traces: cannot read baseline ${comparePath}: ${error.message}`);
      return 2;
    }
    const result = compareReports(baseline, report, {
      family: options.family,
      minReductionMiB: options.minReductionMiB,
    });
    console.log(`\n${formatComparison(result)}`);
    if (result.error) return 2;
    if (result.gated && !result.passed) return 1;
  }

  return 0;
}

if (path.resolve(process.argv[1] ?? "") === scriptPath) {
  process.exitCode = runMeasurement();
}
