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

describe("IPI-1291 dependency security floors", () => {
  it("keeps Hono on the patched 4.13.8+ line", () => {
    expect(manifest.dependencies?.hono).toBe("^4.13.8");
    expect(lock.packages?.["node_modules/hono"]?.version).toBe("4.13.8");
  });

  it("forces transitive js-yaml v3 to the patched 3.15.2 release", () => {
    expect(manifest.overrides?.["js-yaml"]).toBe("3.15.2");
    expect(lock.packages?.["node_modules/js-yaml"]?.version).toBe("3.15.2");
  });
});
