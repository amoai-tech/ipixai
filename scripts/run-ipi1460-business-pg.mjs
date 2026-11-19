#!/usr/bin/env node
/**
 * IPI-1460 · MASTRA-UPG-007 — local real-PostgreSQL business-workflow proof.
 *
 * Runs `tests/ipi1460-business-workflows.real-pg.test.ts` against:
 *   * the running local Supabase stack (loopback only) for app + approval truth;
 *   * a disposable database with the reviewed `mastra` schema for workflow
 *     persistence and restart continuity.
 *
 * The test is opt-in and skips in `npm test`. This runner supplies its env,
 * verifies the target is loopback and the disposable DB has the reviewed
 * tables, and cleans the synthetic namespace afterwards — including when the
 * test fails.
 *
 * Safety:
 *   * refuses a non-loopback Supabase URL/DB;
 *   * never prints a key, password or connection string;
 *   * writes only the IPI-1460 synthetic IDs and `IPI1460-%` run namespace;
 *   * does not reset the local database or apply migrations.
 *
 * Usage:
 *   node scripts/run-ipi1460-business-pg.mjs
 *   node scripts/run-ipi1460-business-pg.mjs --keep   # leave fixtures behind
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const KEEP = process.argv.includes("--keep");
const MASTRA_DB_NAME = "ipi1460_b1_20261119";

const BRAND_A = "14600000-0000-4000-8000-0000000000aa";
const BRAND_BI = "14600000-0000-4000-8000-0000000000ab";
const ORG_A = "14600000-0000-4000-8000-00000000000a";
const ORG_B = "14600000-0000-4000-8000-00000000000b";

const FIXTURE_USER_IDS = [
  "14600000-0000-4000-8000-000000000004",
  "14600000-0000-4000-8000-000000000001",
  "14600000-0000-4000-8000-000000000002",
  "14600000-0000-4000-8000-000000000003",
];

/**
 * Parse the URL and require the parsed hostname to be loopback. A substring
 * regex over the authority can be spoofed; the parsed host is what `pg`/
 * `fetch` will actually connect to.
 */
function assertLoopbackUrl(raw, label, protocols) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`refusing to run: ${label} is not a valid URL`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    fail(`refusing to run: ${label} host is not loopback (parsed: ${host})`);
  }
  if (!protocols.includes(url.protocol)) {
    fail(`refusing to run: ${label} has an unexpected protocol: ${url.protocol}`);
  }
  return url;
}

function fail(message) {
  console.error(`\nrun-ipi1460-business-pg: ${message}\n`);
  process.exit(1);
}

function localSupabaseStatus() {
  // The repo wrapper injects only the dotenvx private keys the CLI needs; a
  // temporary HOME keeps CLI telemetry inside a writable scratch directory.
  const home = mkdtempSync(path.join(tmpdir(), "ipi1460-home-"));
  let raw;
  try {
    raw = execFileSync("npm", ["run", "--silent", "supabase:cli", "--", "status", "--output", "json"], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: home,
        XDG_CONFIG_HOME: path.join(home, ".config"),
        XDG_DATA_HOME: path.join(home, ".local", "share"),
        XDG_CACHE_HOME: path.join(home, ".cache"),
        DO_NOT_TRACK: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    fail(
      `could not read local Supabase status (${error instanceof Error ? error.message.split("\n")[0] : "unknown"}). Is \`supabase start\` running, and is .env.keys present?`,
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
  const jsonStart = raw.indexOf("{");
  if (jsonStart < 0) fail("`supabase status --output json` did not return JSON");
  try {
    return JSON.parse(raw.slice(jsonStart));
  } catch {
    fail("could not parse `supabase status --output json`");
  }
}

const status = localSupabaseStatus();
const apiUrl = status.API_URL;
const dbUrl = status.DB_URL;
const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const serviceRoleKey = status.SERVICE_ROLE_KEY;

if (!apiUrl || !dbUrl || !publishableKey || !serviceRoleKey) {
  fail("local Supabase status is missing API_URL / DB_URL / publishable key / service role key");
}
assertLoopbackUrl(apiUrl, "local Supabase API_URL", ["http:", "https:"]);
assertLoopbackUrl(dbUrl, "local Supabase DB_URL", ["postgres:", "postgresql:"]);

const mastraUrl = new URL(dbUrl);
mastraUrl.pathname = `/${MASTRA_DB_NAME}`;
assertLoopbackUrl(mastraUrl.toString(), `disposable ${MASTRA_DB_NAME} URL`, [
  "postgres:",
  "postgresql:",
]);

async function cleanup(client) {
  for (const statement of [
    `delete from shoot.shoot_plan_approvals where brand_id = any($1::uuid[])`,
    `delete from public.brand_profile_approvals where brand_id = any($1::uuid[])`,
    `delete from public.brand_crawls where brand_id = any($1::uuid[])`,
    `delete from public.brand_scores where brand_id = any($1::uuid[])`,
  ]) {
    await client.query(statement, [[BRAND_A, BRAND_BI]]);
  }
  await client.query(`delete from public.brands where id = any($1::uuid[])`, [
    [BRAND_A, BRAND_BI],
  ]);
  await client.query(`delete from public.org_members where org_id = any($1::uuid[])`, [
    [ORG_A, ORG_B],
  ]);
  await client.query(`delete from public.organizations where id = any($1::uuid[])`, [
    [ORG_A, ORG_B],
  ]);
}

async function deleteFixtureUsers() {
  if (!serviceRoleKey) return;
  const headers = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
  };
  await Promise.allSettled(
    FIXTURE_USER_IDS.map((id) =>
      fetch(`${apiUrl}/auth/v1/admin/users/${id}`, { method: "DELETE", headers }),
    ),
  );
}

async function cleanupMastra(client) {
  for (const table of [
    "mastra.mastra_workflow_run_entries",
    "mastra.mastra_workflow_runs",
    "mastra.mastra_workflow_snapshot",
  ]) {
    await client.query(`delete from ${table} where run_id like $1`, ["IPI1460-%"]);
  }
}

// The disposable database must already carry the reviewed 1.84 tables; this
// runner never applies DDL.
const mastraClient = new pg.Client({ connectionString: mastraUrl.toString() });
try {
  await mastraClient.connect();
} catch (error) {
  fail(
    `could not connect to disposable database ${MASTRA_DB_NAME} (${error instanceof Error ? error.message.split("\n")[0] : "unknown"})`,
  );
}
try {
  const tables = await mastraClient.query(
    `select table_name from information_schema.tables
      where table_schema = 'mastra'
        and table_name in ('mastra_workflow_runs', 'mastra_workflow_run_entries', 'mastra_workflow_snapshot')`,
  );
  if (tables.rowCount !== 3) {
    fail(
      `${MASTRA_DB_NAME} is missing the reviewed Mastra schema (found ${tables.rowCount}/3 expected tables)`,
    );
  }
} catch (error) {
  fail(`could not inspect ${MASTRA_DB_NAME}: ${error instanceof Error ? error.message : "unknown"}`);
}

const appClient = new pg.Client({ connectionString: dbUrl });
await appClient.connect();

// Two overlapping proofs would delete each other's fixed fixtures. Fail fast
// instead of corrupting the active run.
const lock = await appClient.query("select pg_try_advisory_lock(146001460) as ok");
if (!lock.rows[0]?.ok) {
  fail("another IPI-1460 proof is already running; refusing concurrent fixture cleanup");
}

let exitCode = 1;
try {
  // Converge after an earlier interrupted run, then let the test seed.
  try {
    await cleanup(appClient);
    await cleanupMastra(mastraClient);
  } catch (error) {
    fail(`pre-run cleanup failed: ${error instanceof Error ? error.message : "unknown"}`);
  }

  console.log("run-ipi1460-business-pg: vitest (real PostgreSQL business workflows)");
  const result = spawnSync(
    "npx",
    ["--no-install", "vitest", "run", "tests/ipi1460-business-workflows.real-pg.test.ts"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        IPI1460_REAL_PG: "1",
        NEXT_PUBLIC_SUPABASE_URL: apiUrl,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
        IPI1460_LOCAL_DB_URL: dbUrl,
        IPI1460_MASTRA_DB_URL: mastraUrl.toString(),
        COPILOTKIT_TELEMETRY_DISABLED: "true",
      },
      stdio: "inherit",
    },
  );
  exitCode = result.status ?? 1;
} finally {
  if (!KEEP) {
    try {
      await cleanup(appClient);
      await cleanupMastra(mastraClient);
      await deleteFixtureUsers();
    } catch (error) {
      console.error(
        `run-ipi1460-business-pg: cleanup failed (${error instanceof Error ? error.message : "unknown"})`,
      );
      exitCode = exitCode === 0 ? 1 : exitCode;
    }
  }
  await appClient.query("select pg_advisory_unlock(146001460)").catch(() => {});
  await appClient.end();
  await mastraClient.end();
}

console.log(`run-ipi1460-business-pg: exit ${exitCode}`);
process.exit(exitCode);
