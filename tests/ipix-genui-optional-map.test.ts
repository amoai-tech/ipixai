import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { nextConfig } from "../next.config";

// CopilotKit 1.85 ships an optional dynamic import of maplibre-gl in the native
// Generative UI entrypoint, even when the iPix catalog uses no Map component.
// The compatible 5.x line has a critical XSS vulnerability (CVE-2026-85061).
// Keep the optional import safely aliased away until a separately approved
// Map feature adopts a patched compatible runtime. Do not ship the package.
describe("iPix read-only GenUI optional MapLibre boundary", () => {
  it("does not install the vulnerable optional MapLibre dependency", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    const lock = JSON.parse(readFileSync(join(process.cwd(), "package-lock.json"), "utf8"));
    expect(pkg.dependencies).not.toHaveProperty("maplibre-gl");
    expect(pkg.devDependencies ?? {}).not.toHaveProperty("maplibre-gl");
    expect(lock.packages).not.toHaveProperty("node_modules/maplibre-gl");
  });

  it("maps the optional module to the inert placeholder for both bundlers and keeps other aliases", () => {
    const placeholder = resolve(process.cwd(), "src/lib/copilotkit/maplibre-unavailable.ts");

    const turbopack = nextConfig.turbopack as
      | { resolveAlias?: Record<string, string> }
      | undefined;
    expect(turbopack?.resolveAlias?.["maplibre-gl"]).toBe(
      "./src/lib/copilotkit/maplibre-unavailable.ts",
    );

    const webpack = nextConfig.webpack;
    expect(typeof webpack).toBe("function");
    const input = {
      resolve: { alias: { "@existing": "/tmp/existing" } as Record<string, string> },
    };
    const output = webpack!(input as never, {} as never) as {
      resolve: { alias: Record<string, string> };
    };

    // The webpack bundler must keep existing aliases and add the placeholder.
    expect(output.resolve.alias["@existing"]).toBe("/tmp/existing");
    expect(output.resolve.alias["maplibre-gl"]).toBe(placeholder);

    const unavailable = readFileSync(placeholder, "utf8");
    expect(unavailable).not.toContain('from "maplibre-gl"');
    expect(unavailable).toContain("export {};");
  });
});
