import { describe, expect, it } from "vitest";

import { resolveChildEnv } from "../scripts/dev-guard.mjs";

/**
 * IPI-1232 · MASTRA-DEV-SEC-001
 *
 * `mastra dev` serves Studio AND an unauthenticated tool-execute API on :4111.
 * On origin/main@2d19790 the listener bound every interface (`LISTEN *:4111`)
 * while the banner printed `http://localhost:4111`. dev-guard now pins the
 * agent child to loopback through MASTRA_HOST, which the installed deployer
 * resolves as `serverOptions?.host ?? process.env.MASTRA_HOST ?? "localhost"`.
 */
const env = (extra: Record<string, string> = {}): NodeJS.ProcessEnv =>
  ({ NODE_ENV: "test", ...extra }) as NodeJS.ProcessEnv;

describe("dev-guard Mastra loopback pin", () => {
  it("pins MASTRA_HOST to loopback for the agent child", () => {
    expect(resolveChildEnv([4111], env())).toMatchObject({
      MASTRA_HOST: "127.0.0.1",
    });
  });

  it("pins loopback when the agent port is requested alongside the UI port", () => {
    expect(resolveChildEnv([3000, 4111], env())).toMatchObject({
      MASTRA_HOST: "127.0.0.1",
    });
  });

  it("preserves an explicit operator MASTRA_HOST override", () => {
    expect(resolveChildEnv([4111], env({ MASTRA_HOST: "0.0.0.0" }))).toMatchObject(
      { MASTRA_HOST: "0.0.0.0" },
    );
  });

  it("leaves the UI child environment untouched", () => {
    const uiEnv = env({ PATH: "/usr/bin" });
    expect(resolveChildEnv([3000], uiEnv)).toBe(uiEnv);
    expect(resolveChildEnv([3000], uiEnv)).not.toHaveProperty("MASTRA_HOST");
  });

  it("keeps inherited variables when pinning", () => {
    expect(resolveChildEnv([4111], env({ PATH: "/usr/bin" }))).toMatchObject({
      NODE_ENV: "test",
      PATH: "/usr/bin",
      MASTRA_HOST: "127.0.0.1",
    });
  });

  it("does not mutate the caller's env object", () => {
    const source = env();
    resolveChildEnv([4111], source);
    expect(source).not.toHaveProperty("MASTRA_HOST");
  });
});
