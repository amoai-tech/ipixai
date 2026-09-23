import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.resolve(root, file), "utf8");

/**
 * IPI-1310 · MASTRA-PROD-001 — standalone Mastra service deployability guard.
 *
 * The Mastra service must be deployable as ONE long-running process behind one
 * stable HTTPS origin, because exact-run Stop resolves the active Planner run
 * from the owning process (`Agent.listActiveThreadRuns` / `Agent.abortRunStream`
 * in `src/mastra/run-control.ts`) and Mastra's default PubSub is in-process.
 *
 * These are the failure modes this file exists to prevent, each of which is
 * silent in review and only shows up in production:
 *
 *  1. No production build/start command. A host cannot run `mastra dev` (that
 *     serves Mastra Studio plus an unauthenticated tool-execute API, and the
 *     loopback pin in `scripts/dev-guard.mjs` only applies to dev).
 *  2. `MASTRA_HOST` defaulting to `localhost` inside a container, so the port is
 *     open but unreachable from outside and every healthcheck fails.
 *  3. `drainTimeout` left at Mastra's 5s default; SIGTERM then truncates live
 *     Planner turns on every restart/deploy. `agent.stream()` cannot resume
 *     after the process exits, so this is lost work, not a retryable error.
 *  4. A shipped base image that bundles Studio or bakes in `.env` secrets.
 */
describe("IPI-1310 · standalone Mastra service is deployable", () => {
  it("exposes a production build and start command for the agent", () => {
    const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;

    expect(
      scripts["build:agent"],
      "package.json must expose `build:agent` so a host can produce the standalone server",
    ).toBe("mastra build");
    expect(
      scripts["start:agent"],
      "package.json must expose `start:agent`; `dev:agent` runs the dev server and is not a production entrypoint",
    ).toBe("mastra start");
  });

  it("ships an agent image that binds a routable host and runs the built server", () => {
    const dockerfile = read("Dockerfile.agent");

    // The generated server resolves its bind as
    // `serverOptions?.host ?? process.env.MASTRA_HOST ?? "localhost"`. Inside a
    // container the fallback is loopback-only, so this env var is load-bearing.
    expect(
      dockerfile,
      "Dockerfile.agent must set MASTRA_HOST=0.0.0.0 or the container listens on loopback only",
    ).toMatch(/^ENV MASTRA_HOST=0\.0\.0\.0$/m);

    expect(dockerfile).toMatch(/^EXPOSE 4111$/m);
    expect(
      dockerfile,
      "Dockerfile.agent must run the built server entrypoint, not `mastra dev`",
    ).toMatch(/^CMD \["node", "index\.mjs"\]$/m);

    expect(
      dockerfile,
      "the agent image must not be built with `mastra build --studio`; Studio is not separately protected",
    ).not.toMatch(/mastra build[^\n]*--studio/);
  });

  it("gives the host a real readiness signal on the documented health endpoint", () => {
    const dockerfile = read("Dockerfile.agent");

    expect(
      dockerfile,
      "Dockerfile.agent needs a HEALTHCHECK so a host can gate traffic on real readiness",
    ).toMatch(/^HEALTHCHECK /m);
    expect(
      dockerfile,
      "the healthcheck must probe /health, the endpoint the built Mastra server actually serves",
    ).toContain("/health");
  });

  it("does not bake environment files into the agent build context", () => {
    const dockerignore = read(".dockerignore");

    expect(
      dockerignore,
      ".dockerignore must keep .env files out of the image build context",
    ).toMatch(/^\.env\*?$/m);
    expect(
      dockerignore,
      ".dockerignore must exclude a stale local .mastra build output from the context",
    ).toMatch(/^\.mastra$/m);
  });

  it("drains in-flight Planner turns for materially longer than Mastra's 5s default", () => {
    const runtime = read("src/mastra/runtime.ts");
    const match = /drainTimeout:\s*([0-9_]+)/.exec(runtime);

    expect(
      match,
      "src/mastra/runtime.ts must set server.drainTimeout; the 5s default truncates live Planner turns on SIGTERM",
    ).not.toBeNull();

    const drainTimeout = Number((match?.[1] ?? "").replace(/_/g, ""));
    expect(Number.isFinite(drainTimeout)).toBe(true);
    // Mastra documents the default as 5000ms. A Planner turn runs for minutes,
    // so anything near the default is not a meaningful drain window.
    expect(
      drainTimeout,
      `drainTimeout=${drainTimeout}ms is not meaningfully longer than Mastra's 5000ms default`,
    ).toBeGreaterThanOrEqual(60_000);
  });
});
