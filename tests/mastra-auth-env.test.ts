import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  resolveMastraSupabaseAuthConfig,
  resolveSupabaseUserAuthConfig,
} from "@/mastra/server-auth";

/**
 * IPI-1308 · MASTRA-AUTH-ENV-001 — standalone Mastra owns its Supabase Auth
 * config and refuses to start without a usable one.
 */

const HOSTED = { IPIX_MASTRA_HOSTED: "1" };
const VALID = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
};

/** Test env literal; Next's ProcessEnv augmentation requires NODE_ENV. */
const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

function legacyJwt(role: string): string {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role, iss: "supabase" })}.signature`;
}

describe("resolveMastraSupabaseAuthConfig", () => {
  it("uses the server-owned SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY", () => {
    expect(resolveMastraSupabaseAuthConfig(env({ ...HOSTED, ...VALID }))).toEqual({
      url: VALID.SUPABASE_URL,
      publishableKey: VALID.SUPABASE_PUBLISHABLE_KEY,
    });
  });

  it("hosted: never falls back to browser NEXT_PUBLIC_* names", () => {
    expect(() =>
      resolveMastraSupabaseAuthConfig(env({
        ...HOSTED,
        NEXT_PUBLIC_SUPABASE_URL: VALID.SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: VALID.SUPABASE_PUBLISHABLE_KEY,
      })),
    ).toThrow("SUPABASE_URL is required when IPIX_MASTRA_HOSTED=1");
  });

  it("hosted: names the missing key variable without echoing values", () => {
    let message = "";
    try {
      resolveMastraSupabaseAuthConfig(env({ ...HOSTED, SUPABASE_URL: VALID.SUPABASE_URL }));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe("SUPABASE_PUBLISHABLE_KEY is required when IPIX_MASTRA_HOSTED=1");
    expect(message).not.toContain(VALID.SUPABASE_URL);
  });

  it("hosted: requires https", () => {
    expect(() =>
      resolveMastraSupabaseAuthConfig(env({ ...HOSTED, ...VALID, SUPABASE_URL: "http://project.supabase.co" })),
    ).toThrow("must use https");
  });

  it("rejects a malformed URL", () => {
    expect(() =>
      resolveMastraSupabaseAuthConfig(env({ ...VALID, SUPABASE_URL: "not a url" })),
    ).toThrow("SUPABASE_URL is not a valid URL");
  });

  it.each([
    ["sb_secret key", "sb_secret_abc"],
    ["legacy service_role JWT", legacyJwt("service_role")],
  ])("refuses a %s as the user-auth key", (_label, key) => {
    let message = "";
    try {
      resolveMastraSupabaseAuthConfig(env({ ...HOSTED, ...VALID, SUPABASE_PUBLISHABLE_KEY: key }));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("not a secret or service-role key");
    expect(message).not.toContain(key);
  });

  it("accepts a legacy anon JWT", () => {
    const key = legacyJwt("anon");
    expect(
      resolveMastraSupabaseAuthConfig(env({ ...VALID, SUPABASE_PUBLISHABLE_KEY: key })).publishableKey,
    ).toBe(key);
  });

  it("local dev: falls back to the NEXT_PUBLIC_* pair, including http localhost", () => {
    expect(
      resolveMastraSupabaseAuthConfig(env({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local",
      })),
    ).toEqual({ url: "http://127.0.0.1:54321", publishableKey: "sb_publishable_local" });
  });

  it("local dev: still fails when nothing is configured", () => {
    expect(() => resolveMastraSupabaseAuthConfig(env({}))).toThrow("SUPABASE_URL");
  });
});

describe("resolveSupabaseUserAuthConfig (in-process callers with a verified session)", () => {
  it("accepts the Next-owned NEXT_PUBLIC_* pair even when IPIX_MASTRA_HOSTED=1", () => {
    expect(
      resolveSupabaseUserAuthConfig(
        env({
          ...HOSTED,
          NEXT_PUBLIC_SUPABASE_URL: VALID.SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: VALID.SUPABASE_PUBLISHABLE_KEY,
        }),
      ),
    ).toEqual({ url: VALID.SUPABASE_URL, publishableKey: VALID.SUPABASE_PUBLISHABLE_KEY });
  });

  it("still refuses a secret key and non-https hosted URL", () => {
    expect(() =>
      resolveSupabaseUserAuthConfig(
        env({ ...HOSTED, SUPABASE_URL: VALID.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc" }),
      ),
    ).toThrow("not a secret or service-role key");
    expect(() =>
      resolveSupabaseUserAuthConfig(
        env({ ...HOSTED, NEXT_PUBLIC_SUPABASE_URL: "http://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" }),
      ),
    ).toThrow("must use https");
  });
});

describe("standalone Mastra CLI entry fails before it can serve", () => {
  const root = process.cwd();
  const tsx = join(root, "node_modules/.bin/tsx");

  function loadEntry(vars: Record<string, string>) {
    return spawnSync(
      tsx,
      [
        "--conditions=react-server",
        "-e",
        'import("./src/mastra/index.ts").then(() => console.log("ENTRY_LOADED"), (e) => { console.error("ENTRY_FAILED " + e.message); process.exit(1); })',
      ],
      {
        cwd: root,
        env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...vars } as unknown as NodeJS.ProcessEnv,
        encoding: "utf8",
        timeout: 60_000,
      },
    );
  }

  it("exits non-zero when hosted auth config is missing", () => {
    const result = loadEntry({ ...HOSTED });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ENTRY_FAILED SUPABASE_URL is required when IPIX_MASTRA_HOSTED=1");
    expect(result.stdout).not.toContain("ENTRY_LOADED");
  }, 60_000);

  it("passes the auth gate with valid config (next gate is hosted Postgres)", () => {
    const result = loadEntry({ ...HOSTED, ...VALID });
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("SUPABASE_");
    expect(result.stderr).toContain("IPIX_MASTRA_HOSTED requires MASTRA_DATABASE_URL");
  }, 60_000);
});
