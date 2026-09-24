import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Sentry production configuration", () => {
  it("pins the supported Next.js SDK and creates runtime instrumentation", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.["@sentry/nextjs"]).toBe("11.0.0");
    expect(existsSync(join(root, "instrumentation.ts"))).toBe(true);
    expect(existsSync(join(root, "instrumentation-client.ts"))).toBe(true);
  });

  it("wraps the existing Next.js config without dropping iPix settings", () => {
    const config = read("next.config.ts");
    expect(config).toContain("withSentryConfig");
    expect(config).toContain("SERVICE_REDIRECTS");
    expect(config).toContain("root: process.cwd()");
    expect(config).toContain("cpus: 4");
  });

  it("uses conservative client privacy and replay defaults", () => {
    const client = read("instrumentation-client.ts");
    expect(client).toContain("userInfo: false");
    expect(client).toContain("httpBodies: []");
    expect(client).toContain("cookies: false");
    expect(client).toContain("httpHeaders: false");
    expect(client).toContain("urlQueryParams: false");
    expect(client).toContain("inputs: false");
    expect(client).toContain("outputs: false");
    expect(client).toContain("stackFrameVariables: false");
    expect(client).toContain("replaysSessionSampleRate: 0");
    expect(client).toContain("replaysOnErrorSampleRate: 0.1");
    expect(client).toContain("maskAllText: true");
    expect(client).toContain("maskAllInputs: true");
    expect(client).toContain("blockAllMedia: true");
    expect(client).not.toContain("SENTRY_AUTH_TOKEN");
  });

  it("uses environment-driven DSNs and conservative server privacy", () => {
    const instrumentation = read("instrumentation.ts");
    expect(instrumentation).toContain("sentry.server.config");
    expect(instrumentation).toContain("sentry.edge.config");

    for (const path of ["sentry.server.config.ts", "sentry.edge.config.ts"]) {
      expect(existsSync(join(root, path))).toBe(true);
      const source = read(path);
      expect(source).toContain("process.env.SENTRY_DSN");
      expect(source).toContain("userInfo: false");
      expect(source).toContain("httpBodies: []");
      expect(source).toContain("cookies: false");
      expect(source).toContain("httpHeaders: false");
      expect(source).toContain("genAI: { inputs: false, outputs: false }");
      expect(source).toContain("databaseQueryData: false");
      expect(source).toContain("stackFrameVariables: false");
      expect(source).not.toContain("SENTRY_AUTH_TOKEN");
    }
  });
});
