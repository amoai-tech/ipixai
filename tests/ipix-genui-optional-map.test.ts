import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

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

  it("disables the optional module for both bundlers and keeps other aliases", async () => {
    const { default: nextConfig } = await import("../next.config");
    const placeholder = resolve(process.cwd(), "src/lib/copilotkit/maplibre-unavailable.ts");

    const turbopack = nextConfig.turbopack as
      | { resolveAlias?: Record<string, string> }
      | undefined;
    expect(turbopack?.resolveAlias?.["maplibre-gl"]).toBe(
      "./src/lib/copilotkit/maplibre-unavailable.ts",
    );

    const webpack = nextConfig.webpack;
    expect(typeof webpack).toBe("function");
    // Exercise Sentry's wrapped webpack callback, not a raw test-only export.
    // Its callback uses Next's build config, so provide the minimal realistic
    // options and webpack shape rather than an empty options object.
    const input = {
      resolve: { alias: { "@existing": "/tmp/existing" } },
      plugins: [],
      module: { rules: [] },
      optimization: {},
      output: {},
      experiments: {},
    };
    const options = {
      dev: true,
      isServer: false,
      buildId: "test",
      dir: process.cwd(),
      totalPages: 1,
      nextRuntime: undefined,
      defaultLoaders: { babel: {} },
      webpack: { DefinePlugin: class {}, IgnorePlugin: class {} },
      config: {
        distDir: ".next",
        basePath: "",
        assetPrefix: "",
        trailingSlash: false,
        output: "standalone",
        webpack: {},
        experimental: {},
      },
    };
    const output = webpack!(input as never, options as never) as {
      resolve: { alias: Record<string, string | false> };
    };

    // The webpack bundler must keep existing aliases and add the placeholder.
    expect(output.resolve.alias["@existing"]).toBe("/tmp/existing");
    expect(output.resolve.alias["maplibre-gl"]).toBe(false);

    const unavailable = readFileSync(placeholder, "utf8");
    expect(unavailable).not.toContain('from "maplibre-gl"');
    expect(unavailable).toContain("export {};");
  });
});
