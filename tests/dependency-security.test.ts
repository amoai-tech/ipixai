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
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(isPatchedJsYaml(version)).toBe(true);
    }
  });
});
