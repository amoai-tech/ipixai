import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies?: Record<string, string>;
  overrides?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, { version?: string }>;
};

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageManifest;

const lock = JSON.parse(
  readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
) as PackageLock;

const HONO_FLOOR = "4.13.8";
const HONO_NODE_SERVER_V1_FLOOR = "1.19.15";
const HONO_NODE_SERVER_V2_FLOOR = "2.0.5";
const JS_YAML_V3_FLOOR = "3.15.2";
const JS_YAML_V4_FLOOR = "4.3.2";

function parseStableVersion(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Expected a stable x.y.z version, received ${version}`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isAtLeast(version: string, floor: string): boolean {
  const actual = parseStableVersion(version);
  const minimum = parseStableVersion(floor);

  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== minimum[index]) {
      return actual[index] > minimum[index];
    }
  }

  return true;
}

function resolvedVersions(packageName: string): string[] {
  return Object.entries(lock.packages ?? {})
    .filter(([path, entry]) =>
      (path === `node_modules/${packageName}` ||
        path.endsWith(`/node_modules/${packageName}`)) &&
      typeof entry.version === "string",
    )
    .map(([, entry]) => entry.version as string);
}

function isPatchedHonoNodeServer(version: string): boolean {
  const [major] = parseStableVersion(version);
  if (major === 1) return isAtLeast(version, HONO_NODE_SERVER_V1_FLOOR);
  if (major === 2) return isAtLeast(version, HONO_NODE_SERVER_V2_FLOOR);
  return major > 2;
}

function isPatchedJsYaml(version: string): boolean {
  const [major] = parseStableVersion(version);
  if (major === 3) return isAtLeast(version, JS_YAML_V3_FLOOR);
  if (major === 4) return isAtLeast(version, JS_YAML_V4_FLOOR);
  return major > 4;
}

describe("IPI-1291 dependency security floors", () => {
  it("keeps every Hono copy on the patched 4.13.8+ line", () => {
    const declared = manifest.dependencies?.hono;
    expect(declared).toMatch(/^\^4\.\d+\.\d+$/);
    expect(isAtLeast(declared!.slice(1), HONO_FLOOR)).toBe(true);

    const versions = resolvedVersions("hono");
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(parseStableVersion(version)[0]).toBe(4);
      expect(isAtLeast(version, HONO_FLOOR)).toBe(true);
    }
  });

  it("keeps every @hono/node-server copy above its patched advisory floor", () => {
    const versions = resolvedVersions("@hono/node-server");
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(isPatchedHonoNodeServer(version)).toBe(true);
    }
  });

  it("keeps every js-yaml copy above its patched advisory floor", () => {
    const override = manifest.overrides?.["js-yaml"];
    expect(override).toMatch(/^3\.\d+\.\d+$/);
    expect(isAtLeast(override!, JS_YAML_V3_FLOOR)).toBe(true);

    const versions = resolvedVersions("js-yaml");
    // Mastra 1.82 no longer pulls a js-yaml copy. Zero copies is safe; if any
    // transitive copy reappears, the floor override above must still protect it.
    for (const version of versions) {
      expect(isPatchedJsYaml(version)).toBe(true);
    }
  });
});


// IPI-1218: Prevent a future lockfile refresh from silently restoring
// vulnerable transitive copies while respecting the consumers' major ranges.
describe("IPI-1218 compatible advisory patches", () => {
  it("keeps Express/MCP body-parser at 2.4.0+ (GHSA-27r3-jxmh-p828)", () => {
    const versions = resolvedVersions("body-parser");
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(parseStableVersion(version)[0]).toBe(2);
      expect(isAtLeast(version, "2.4.0")).toBe(true);
    }
  });

  it("protects each brace-expansion major from both recursion advisories", () => {
    // GHSA-qhr7-859c-m2p7 and GHSA-6j4f-fj2g-mc7p.
    // Different installed minimatch majors depend on incompatible brace majors.
    const floors: Record<number, string> = {
      1: "1.1.20",
      2: "2.1.6",
      3: "3.0.8",
      5: "5.0.11",
    };
    const versions = resolvedVersions("brace-expansion");
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      const major = parseStableVersion(version)[0];
      const floor = floors[major];
      // v4 has no patched release in the advisory: require compatible v5+.
      if (major > 5) continue;
      expect(floor, `Unreviewed brace-expansion major ${major}`).toBeDefined();
      expect(isAtLeast(version, floor)).toBe(true);
    }
  });

  it("keeps Mastra RE2JS past the patched floor (GHSA-gg6h-894w-4m9c)", () => {
    const versions = resolvedVersions("re2js");
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(parseStableVersion(version)[0]).toBe(2);
      expect(isAtLeast(version, "2.8.7")).toBe(true);
    }
  });

  it("keeps PostCSS source-map-js patched (GHSA-68fv-2mgg-jv7q)", () => {
    const versions = resolvedVersions("source-map-js");
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(parseStableVersion(version)[0]).toBe(1);
      expect(isAtLeast(version, "1.2.2")).toBe(true);
    }
  });

  it("keeps each installed Zod 4 copy patched without pinning root Zod 3", () => {
    // GHSA-mrhx-c7xc-m3w5: inspect Zod 3 exposure separately, but do not
    // require an older major to remain installed after a safe upstream upgrade.
    const versions = resolvedVersions("zod");
    const zod4 = versions.filter((version) => parseStableVersion(version)[0] === 4);
    expect(zod4.length).toBeGreaterThan(0);
    for (const version of zod4) {
      expect(isAtLeast(version, "4.6.6")).toBe(true);
    }
  });
});
