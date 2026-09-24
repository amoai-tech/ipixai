import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Sentry Mastra observability contract", () => {
  it("installs the compatible Mastra observability package", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.["@mastra/core"]).toBe("1.63.2");
    expect(pkg.dependencies?.["@mastra/observability"]).toBe("1.18.0");
  });

  it("enables first-party Mastra instrumentation only on the server", () => {
    const server = read("sentry.server.config.ts");
    const edge = read("sentry.edge.config.ts");
    const client = read("instrumentation-client.ts");

    expect(server).toContain("Sentry.mastraIntegration()");
    expect(edge).not.toContain("mastraIntegration");
    expect(client).not.toContain("mastraIntegration");
  });

  it("does not create a second Mastra runtime for telemetry", () => {
    const server = read("sentry.server.config.ts");
    const runtime = read("src/mastra/runtime.ts");

    expect(server).not.toContain("new Mastra");
    expect(server).not.toContain("getMastra(");
    expect(runtime.match(/new Mastra\(/g)).toHaveLength(1);
  });

  it("keeps generative-AI payload collection disabled", () => {
    const server = read("sentry.server.config.ts");
    expect(server).toContain("genAI: { inputs: false, outputs: false }");
  });
});
