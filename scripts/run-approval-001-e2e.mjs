#!/usr/bin/env node
/**
 * IPI-1084 · APPROVAL-001 — PR 2b local runner.
 *
 * Provisions the local Supabase stack for the authenticated browser proof:
 *
 *   supabase status  →  verify the target is LOOPBACK ONLY
 *   [--reset]        →  supabase db reset --local (clean, deterministic schema)
 *   seed             →  e2e/support/approval-001-tenant-fixtures.sql
 *   playwright       →  playwright.approval.config.ts (starts Next with local env)
 *
 * Safety: the ambient shell in this repo can export HOSTED Supabase values
 * (NEXT_PUBLIC_SUPABASE_URL etc.), and Next will NOT let .env.local override an
 * already-exported process env var. This runner therefore refuses any
 * non-loopback status and then explicitly overrides those variables for both
 * the Playwright process and the Next server it spawns. Secrets are never
 * printed.
 *
 * Usage: npm run e2e:approval [-- --reset]
 */
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURES = "e2e/support/approval-001-tenant-fixtures.sql";
const CONFIG = "playwright.approval.config.ts";
const BASE_URL = process.env.IPI1084_BASE_URL ?? "http://localhost:3016";
const RESET = process.argv.includes("--reset");

const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/;
const LOOPBACK_DB = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)[:/]/;

function fail(message) {
  console.error(`\nrun-approval-001-e2e: ${message}\n`);
  process.exit(1);
}

function supabaseStatus() {
  let raw;
  try {
    raw = execFileSync("supabase", ["status", "--output", "json"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    fail(
      `could not read local Supabase status (${error instanceof Error ? error.message.split("\n")[0] : "unknown"}). Run \`supabase start\` first.`,
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    fail("`supabase status --output json` did not return JSON");
  }
}

const status = supabaseStatus();
const apiUrl = status.API_URL;
const dbUrl = status.DB_URL;
const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const serviceRoleKey = status.SERVICE_ROLE_KEY;

if (!apiUrl || !dbUrl || !publishableKey || !serviceRoleKey) {
  fail("local Supabase status is missing API_URL / DB_URL / publishable key / service role key");
}
if (!LOOPBACK.test(apiUrl)) {
  fail(`refusing to run: local Supabase API_URL is not loopback (${apiUrl})`);
}
if (!LOOPBACK_DB.test(dbUrl)) {
  fail("refusing to run: local Supabase DB_URL is not loopback");
}
if (!LOOPBACK.test(BASE_URL)) {
  fail(`refusing to run: IPI1084_BASE_URL is not local (${BASE_URL})`);
}

if (RESET) {
  console.log("run-approval-001-e2e: supabase db reset --local");
  const reset = spawnSync("supabase", ["db", "reset", "--local"], { cwd: ROOT, stdio: "inherit" });
  if (reset.status !== 0) fail("`supabase db reset --local` failed");
}

console.log(`run-approval-001-e2e: seeding ${FIXTURES}`);
const seed = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-q", "-f", FIXTURES], {
  cwd: ROOT,
  stdio: ["ignore", "inherit", "inherit"],
});
if (seed.status !== 0) fail("fixture seeding failed");

// Override the ambient (hosted) env for the Playwright process AND the Next
// server Playwright starts. `psql`/`supabase` above already used the loopback
// DB_URL explicitly, so nothing here can reach a hosted project.
const childEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  // Mastra workflow persistence. Without this the app falls back to the
  // in-memory LibSQL store, which has no workflow-snapshot table — the run
  // suspends but can never resume, so the browser proof could not show a real
  // resume. The local Supabase Postgres is on pg-store's explicit local
  // allowlist and is the same Postgres-backed storage production uses.
  MASTRA_DATABASE_URL: dbUrl,
  COPILOTKIT_TELEMETRY_DISABLED: "true",
  IPI1084_BASE_URL: BASE_URL,
  IPI1084_LOCAL_DB_URL: dbUrl,
  PATH: `${ROOT}/node_modules/.bin:${process.env.PATH ?? ""}`,
};

// `playwright` is a real file in node_modules/.bin, so no shell is involved and
// no secret can be echoed by a shell trace.
console.log("run-approval-001-e2e: playwright test");
const result = spawnSync("playwright", ["test", `--config=${CONFIG}`, ...process.argv.slice(2).filter((a) => a !== "--reset")], {
  cwd: ROOT,
  env: childEnv,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
