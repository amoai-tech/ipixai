import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("uses Next 16's explicit optional-module alias, never a real Map implementation", () => {
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).toContain('"maplibre-gl": "./src/lib/copilotkit/maplibre-unavailable.ts"');
    const unavailable = readFileSync(
      join(process.cwd(), "src/lib/copilotkit/maplibre-unavailable.ts"), "utf8",
    );
    expect(unavailable).not.toContain('from "maplibre-gl"');
    expect(unavailable).toContain("export {};");
  });
});
