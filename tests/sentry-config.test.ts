import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  replayIntegration: vi.fn((options: unknown) => ({ name: "Replay", options })),
  captureRouterTransitionStart: vi.fn(),
  mastraIntegration: vi.fn(() => ({ name: "Mastra" })),
}));

vi.mock("@sentry/nextjs", () => sentry);

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const originalClientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

beforeEach(() => {
  vi.resetModules();
  sentry.init.mockReset();
  sentry.replayIntegration.mockClear();
  sentry.mastraIntegration.mockClear();
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@example.invalid/1";
});

afterEach(() => {
  if (originalClientDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  else process.env.NEXT_PUBLIC_SENTRY_DSN = originalClientDsn;
});

describe("Sentry production configuration", () => {
  it("pins the supported Next.js SDK and creates runtime instrumentation", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.["@sentry/nextjs"]).toBe("11.0.0");
    expect(existsSync(join(root, "instrumentation.ts"))).toBe(true);
    expect(existsSync(join(root, "instrumentation-client.ts"))).toBe(true);
  });

  it("wraps the existing Next.js config without dropping iPix settings", () => {
    const config = read("next.config.ts");
    expect(config).toContain('from "@sentry/nextjs/config"');
    expect(config).toContain("withSentryConfig");
    expect(config).toContain("SERVICE_REDIRECTS");
    expect(config).toContain("root: process.cwd()");
    expect(config).toContain("cpus: 4");
  });

  it("passes conservative privacy and replay options to the client SDK", async () => {
    await import("../instrumentation-client");

    expect(sentry.replayIntegration).toHaveBeenCalledWith({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    });
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://public@example.invalid/1",
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
          graphQL: { document: false, variables: false },
          genAI: { inputs: false, outputs: false },
          databaseQueryData: false,
          queues: false,
          stackFrameVariables: false,
        },
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0.1,
      }),
    );
    expect(sentry.init.mock.calls[0]?.[0]).not.toHaveProperty("enableLogs");
  });

  it("keeps all production Sentry entrypoints in the normal TypeScript project", () => {
    const config = JSON.parse(read("tsconfig.json")) as { include?: string[] };
    expect(config.include).toEqual(
      expect.arrayContaining([
        "instrumentation.ts",
        "instrumentation-client.ts",
        "sentry.server.config.ts",
        "sentry.edge.config.ts",
      ]),
    );
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
      expect(source).not.toContain("enableLogs");
      expect(source).not.toContain("SENTRY_AUTH_TOKEN");
    }
  });
});
