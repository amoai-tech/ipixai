#!/usr/bin/env node
/**
 * IPI-1084 · APPROVAL-001 — PR 2b local runner.
 *
 * Provisions the local Supabase stack for the authenticated browser proof:
 *
 *   supabase status  →  verify the target is LOOPBACK ONLY
 *   [--reset]        →  supabase db reset --local (clean, deterministic schema)
 *   seed             →  local fixture users + orgs/members/brands (via `pg`)
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
import net from "node:net";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
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

/**
 * Fail closed if something already listens on the proof port.
 *
 * playwright.approval.config.ts sets `reuseExistingServer: false`, so a stale
 * listener would otherwise surface as an opaque Playwright startup error — and
 * reusing it would be worse: that server may have been started with HOSTED
 * Supabase env or older code, silently pointing this "local-only" proof at the
 * wrong target.
 */
const port = new URL(BASE_URL).port || (BASE_URL.startsWith("https:") ? "443" : "80");
const listener = await new Promise((resolve) => {
  const socket = net.connect({ host: "127.0.0.1", port: Number(port) });
  socket.once("connect", () => {
    socket.destroy();
    resolve(true);
  });
  socket.once("error", () => resolve(false));
  socket.setTimeout(2000, () => {
    socket.destroy();
    resolve(false);
  });
});
if (listener) {
  fail(
    `something is already listening on ${BASE_URL}. Stop it (this proof must start its own ` +
      `server with the local Supabase env) or run with a free port via IPI1084_BASE_URL.`,
  );
}

/**
 * Mint the fixture users through GoTrue's own admin API.
 *
 * Hand-built auth.users/auth.identities rows verify locally but fail in CI with
 * `500 {"code":"unexpected_failure","message":"Database error querying schema"}`
 * because they depend on GoTrue's exact schema expectations. The admin API is
 * the canonical way to create a password user and stays correct across GoTrue
 * versions. Must match e2e/support/approval-001-fixtures.ts.
 *
 * Org A deliberately has BOTH an owner and a distinct `editor`: the positive
 * browser actor must be a real editor, because `is_org_editor_or_above` accepts
 * owner OR editor and an owner-based proof would not show that an editor can
 * start and decide a review.
 */
const FIXTURE_USERS = [
  { id: "10840000-0000-4000-8000-000000000004", email: "ipi1084-owner-a@ipix.test" },
  { id: "10840000-0000-4000-8000-000000000001", email: "ipi1084-editor-a@ipix.test" },
  { id: "10840000-0000-4000-8000-000000000002", email: "ipi1084-viewer-a@ipix.test" },
  { id: "10840000-0000-4000-8000-000000000003", email: "ipi1084-orgb@ipix.test" },
];
const FIXTURE_PASSWORD = "ipi1084-local-e2e-password";

async function ensureFixtureUsers() {
  const headers = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };
  for (const user of FIXTURE_USERS) {
    const create = await fetch(`${apiUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        password: FIXTURE_PASSWORD,
        email_confirm: true,
      }),
    });
    if (create.ok) continue;
    const body = await create.text();
    // Re-runs and a dirty local database must converge rather than fail: the
    // user already exists, so restore the password/confirmation instead.
    const update = await fetch(`${apiUrl}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ password: FIXTURE_PASSWORD, email_confirm: true }),
    });
    if (!update.ok) {
      fail(
        `could not create or update fixture user ${user.email}: ` +
          `create ${create.status} ${body.slice(0, 200)} / update ${update.status}`,
      );
    }
  }
  console.log(`run-approval-001-e2e: ensured ${FIXTURE_USERS.length} fixture auth users`);
}

await ensureFixtureUsers();

/**
 * Org / membership / brand fixtures for the browser proof.
 *
 * The three auth users are NOT created here — ensureFixtureUsers() above mints
 * them through GoTrue's admin API, because hand-built auth.users/auth.identities
 * rows are GoTrue-schema sensitive (they verified locally but failed in CI with
 * `500 {"code":"unexpected_failure","message":"Database error querying schema"}`).
 * The organizations.owner_id foreign key below also proves those users exist.
 *
 * Executed through `pg` rather than an external `psql` process: `pg` is already
 * a direct dependency and is what the spec uses for its own assertions, so the
 * runner no longer requires a PostgreSQL client to be installed. Keeping the
 * fixture SQL here also keeps it out of the SQL linter, which otherwise applies
 * T-SQL dialect rules to it (e.g. suggesting `SET NOCOUNT ON`, invalid in
 * Postgres).
 *
 *   Org A  iPix 1084 Org A   owner-a (owner) + editor-a (editor) + viewer-a (viewer) + Brand A
 *   Org B  iPix 1084 Org B   orgb    (owner)                                        + Brand B
 *
 * Local-only credential for these throwaway accounts (FIXTURE_PASSWORD above).
 * It is not a secret and never reaches a hosted environment.
 *
 * Must match e2e/support/approval-001-fixtures.ts.
 */
const FIXTURE_SQL = `
begin;

insert into public.organizations (id, name, slug, type, owner_id)
values
  ('10840000-0000-4000-8000-00000000000a', 'iPix 1084 Org A', 'ipix-1084-org-a', 'brand', '10840000-0000-4000-8000-000000000004'),
  ('10840000-0000-4000-8000-00000000000b', 'iPix 1084 Org B', 'ipix-1084-org-b', 'brand', '10840000-0000-4000-8000-000000000003')
on conflict (id) do update
  set name = excluded.name, owner_id = excluded.owner_id, updated_at = now();

-- Explicit and idempotent. Org A keeps a real owner (org integrity) alongside a
-- distinct editor — the editor, not the owner, is the positive browser actor.
insert into public.org_members (org_id, user_id, role)
values
  ('10840000-0000-4000-8000-00000000000a', '10840000-0000-4000-8000-000000000004', 'owner'),
  ('10840000-0000-4000-8000-00000000000a', '10840000-0000-4000-8000-000000000001', 'editor'),
  ('10840000-0000-4000-8000-00000000000a', '10840000-0000-4000-8000-000000000002', 'viewer'),
  ('10840000-0000-4000-8000-00000000000b', '10840000-0000-4000-8000-000000000003', 'owner')
on conflict (org_id, user_id) do update set role = excluded.role;

-- One brand per org — the review is authorized against the brand's org.
insert into public.brands (id, user_id, name, org_id)
values
  ('10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-000000000001', 'IPI-1084 Brand A', '10840000-0000-4000-8000-00000000000a'),
  ('10840000-0000-4000-8000-0000000000bb', '10840000-0000-4000-8000-000000000003', 'IPI-1084 Brand B', '10840000-0000-4000-8000-00000000000b')
on conflict (id) do update
  set name = excluded.name, user_id = excluded.user_id, org_id = excluded.org_id, updated_at = now();

commit;
`;

async function seedFixtures() {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query(FIXTURE_SQL);
  } finally {
    await client.end();
  }
  console.log("run-approval-001-e2e: seeded orgs, memberships and brands");
}

try {
  await seedFixtures();
} catch (error) {
  fail(`fixture seeding failed: ${error instanceof Error ? error.message : "unknown error"}`);
}

// Override the ambient (hosted) env for the Playwright process AND the Next
// server Playwright starts. `supabase` and the `pg` connection above already
// used the loopback URL explicitly, so nothing here can reach a hosted project.
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
  // Used by the spec to stage through the REAL service-role client (the same
  // privilege boundary the workflow uses), rather than a superuser connection.
  IPI1084_SERVICE_ROLE_KEY: serviceRoleKey,
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
