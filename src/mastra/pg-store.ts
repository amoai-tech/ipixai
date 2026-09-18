import { parseIntoClientConfig } from "pg-connection-string";
import { Pool, type PoolConfig } from "pg";
import { InMemoryStore } from "@mastra/core/storage";
import { PostgresStore } from "@mastra/pg";
import { SUPABASE_PROD_CA_2021 } from "./supabase-prod-ca-2021";

declare global {
  // ponytail: Next HMR otherwise opens extra pools; ceiling is one process-wide Pool.
  var __ipixMastraPgPool: PostgresStore["pool"] | undefined;
  var __ipixMastraPgStore: PostgresStore | undefined;
  var __ipixMastraPgConnectionString: string | undefined;
  var __ipixMastraMissingUrlWarned: boolean | undefined;
}

const MISSING_URL_WARNING =
  "MASTRA_DATABASE_URL is unset; Planner threads use Mastra in-memory storage and will not survive restart. Copy MASTRA_DATABASE_URL from .env.example (local Docker only).";

const HOSTED_MISSING_URL =
  "IPIX_MASTRA_HOSTED requires MASTRA_DATABASE_URL; refusing in-memory storage";

const GENERIC_HOSTED_REJECT =
  "MASTRA_DATABASE_URL is not the approved iPix Mastra Postgres project; refusing to connect";

const QUERY_OVERRIDE_REJECT =
  "MASTRA_DATABASE_URL must not override connection identity or TLS via query params; refusing to connect";

const TLS_REJECT =
  "MASTRA_DATABASE_URL TLS is not certificate-verified; refusing to connect";

const PROOF_HOSTED_NEEDS_URL =
  "Hosted golden proof requires MASTRA_DATABASE_URL";

const PROOF_HOSTED_PORT_BLOCK =
  "Hosted golden proof must use transaction pooler port 6543 first; set IPIX_MASTRA_PROOF_SESSION_POOLER=1 only after a recorded 6543 failure";

/** Existing fashionos project — the only hosted Mastra memory cabinet for runtime. */
export const APPROVED_MASTRA_PROJECT_REF = "nvdlhrodvevgwdsneplk";
export const APPROVED_MASTRA_DIRECT_HOST =
  `db.${APPROVED_MASTRA_PROJECT_REF}.supabase.co`;
export const APPROVED_MASTRA_RUNTIME_ROLE = "hyperdrive_mastra_runtime";
export const HOSTED_MASTRA_POOL_MAX = 1;
export const LOCAL_MASTRA_POOL_MAX = 8;

const IDENTITY_QUERY_KEYS = new Set([
  "user",
  "password",
  "host",
  "hostaddr",
  "socket",
  "database",
  "dbname",
  "port",
]);

const UNSAFE_SSLMODE = new Set(["disable", "no-verify", "allow", "prefer"]);

export function isMastraHostedRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.IPIX_MASTRA_HOSTED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function isAllowedLocalMastraDatabaseHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return false;
  return (
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "::1" ||
    host === "supabase_db_ipixai"
  );
}

function isApprovedPoolerHostname(hostname: string): boolean {
  return hostname.toLowerCase().endsWith(".pooler.supabase.com");
}

function isForbiddenRuntimeUser(user: string): boolean {
  const userBase = user.split(".")[0] ?? "";
  return userBase === "postgres" || user.toLowerCase().includes("service_role");
}

function isApprovedHostedIdentity(host: string, user: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (isForbiddenRuntimeUser(user)) return false;
  const expectedPoolerUser = `${APPROVED_MASTRA_RUNTIME_ROLE}.${APPROVED_MASTRA_PROJECT_REF}`;
  if (h === APPROVED_MASTRA_DIRECT_HOST) {
    return user === APPROVED_MASTRA_RUNTIME_ROLE || user === expectedPoolerUser;
  }
  if (isApprovedPoolerHostname(h)) {
    return user === expectedPoolerUser;
  }
  return false;
}

export function warnIfMastraDatabaseUrlMissing(url: string | undefined): void {
  if (url) return;
  if (globalThis.__ipixMastraMissingUrlWarned) return;
  globalThis.__ipixMastraMissingUrlWarned = true;
  console.warn(MISSING_URL_WARNING);
}

function assertPostgresUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("MASTRA_DATABASE_URL is not a valid URL");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(
      "MASTRA_DATABASE_URL must use postgres: or postgresql:; refusing to connect",
    );
  }
  for (const key of parsed.searchParams.keys()) {
    const k = key.toLowerCase();
    if (IDENTITY_QUERY_KEYS.has(k)) {
      throw new Error(QUERY_OVERRIDE_REJECT);
    }
    if (k === "sslmode" || k === "ssl") {
      const v = (parsed.searchParams.get(key) ?? "").toLowerCase();
      if (UNSAFE_SSLMODE.has(v) || v === "false" || v === "0") {
        throw new Error(TLS_REJECT);
      }
    }
    if (
      k === "sslcert" ||
      k === "sslkey" ||
      k === "sslrootcert" ||
      k === "sslpassword" ||
      k === "uselibpqcompat"
    ) {
      throw new Error(QUERY_OVERRIDE_REJECT);
    }
  }
  return parsed;
}

function effectiveClientConfig(url: string): PoolConfig {
  return parseIntoClientConfig(url) as PoolConfig;
}

function assertEffectiveTls(config: PoolConfig): void {
  const ssl = config.ssl;
  if (ssl === false) throw new Error(TLS_REJECT);
  if (ssl && typeof ssl === "object" && ssl.rejectUnauthorized === false) {
    throw new Error(TLS_REJECT);
  }
}

export function assertSafeMastraDatabaseUrl(
  url: string,
  options?: { hosted?: boolean },
): URL {
  const parsed = assertPostgresUrl(url);
  const hosted = options?.hosted ?? isMastraHostedRuntime();
  const effective = effectiveClientConfig(url);
  const effectiveHost = String(effective.host ?? parsed.hostname);
  const effectiveUser = String(effective.user ?? "");
  if (hosted) {
    assertEffectiveTls(effective);
    if (!isApprovedHostedIdentity(effectiveHost, effectiveUser)) {
      throw new Error(GENERIC_HOSTED_REJECT);
    }
    return parsed;
  }
  if (!isAllowedLocalMastraDatabaseHost(effectiveHost)) {
    throw new Error(
      "MASTRA_DATABASE_URL host is not on the local allowlist; refusing to connect",
    );
  }
  return parsed;
}

/**
 * Local: missing URL uses Mastra core in-memory storage. Hosted: missing or unapproved URL throws.
 * Never returns a URL that failed the guard.
 */
export function requireMastraPostgresUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const hosted = isMastraHostedRuntime(env);
  const url = env.MASTRA_DATABASE_URL;
  if (hosted) {
    if (!url?.trim()) {
      throw new Error(HOSTED_MISSING_URL);
    }
    assertSafeMastraDatabaseUrl(url, { hosted: true });
    return url;
  }
  warnIfMastraDatabaseUrlMissing(url);
  if (!url) return undefined;
  assertSafeMastraDatabaseUrl(url, { hosted: false });
  return url;
}

/**
 * Hosted golden proof (IPI-1124 A): clerk role + fashionos identity + 6543 first.
 * Runtime still rejects postgres/service_role via assertSafeMastraDatabaseUrl.
 */
export function assertMastraProofWritesAllowed(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isMastraHostedRuntime(env)) return;
  const url = env.MASTRA_DATABASE_URL;
  if (!url?.trim()) {
    throw new Error(PROOF_HOSTED_NEEDS_URL);
  }
  const parsed = assertSafeMastraDatabaseUrl(url, { hosted: true });
  const port = parsed.port === "" ? 5432 : Number(parsed.port);
  const sessionFallback =
    env.IPIX_MASTRA_PROOF_SESSION_POOLER?.trim() === "1";
  if (port !== 6543 && !(sessionFallback && port === 5432)) {
    throw new Error(PROOF_HOSTED_PORT_BLOCK);
  }
}

export function createMastraStorage() {
  const url = requireMastraPostgresUrl();
  if (!url) {
    return new InMemoryStore({ id: "mastra-storage" });
  }
  return getMastraPostgresStore(url);
}

export function createAgentMemoryStorage() {
  const url = requireMastraPostgresUrl();
  if (!url) {
    return new InMemoryStore({ id: "weather-agent-memory" });
  }
  return getMastraPostgresStore(url);
}

export async function resetMastraPgSingletonsForTests(): Promise<void> {
  const pool = globalThis.__ipixMastraPgPool;
  globalThis.__ipixMastraPgPool = undefined;
  globalThis.__ipixMastraPgStore = undefined;
  globalThis.__ipixMastraPgConnectionString = undefined;
  if (pool) await pool.end();
}

function assertSameMastraConnectionString(connectionString: string): void {
  const existing = globalThis.__ipixMastraPgConnectionString;
  if (existing && existing !== connectionString) {
    throw new Error(
      "MASTRA_DATABASE_URL changed after the Mastra pool was created; refusing to reuse the singleton",
    );
  }
}

export function getMastraPgPool(connectionString: string): PostgresStore["pool"] {
  assertSafeMastraDatabaseUrl(connectionString);
  assertSameMastraConnectionString(connectionString);
  if (!globalThis.__ipixMastraPgPool) {
    const hosted = isMastraHostedRuntime();
    const pool = hosted
      ? new Pool(hostedPoolConfig(connectionString))
      : new Pool({
          connectionString,
          max: LOCAL_MASTRA_POOL_MAX,
        });
    pool.on("error", (err: Error) => {
      console.error("Mastra pg pool idle client error", err);
    });
    globalThis.__ipixMastraPgPool = pool;
    globalThis.__ipixMastraPgConnectionString = connectionString;
  }
  return globalThis.__ipixMastraPgPool;
}

function hostedPoolConfig(connectionString: string): PoolConfig {
  const parsed = effectiveClientConfig(connectionString);
  return {
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    max: HOSTED_MASTRA_POOL_MAX,
    ssl: { rejectUnauthorized: true, ca: SUPABASE_PROD_CA_2021 },
  };
}

export function getMastraPostgresStore(connectionString: string): PostgresStore {
  assertSameMastraConnectionString(connectionString);
  if (!globalThis.__ipixMastraPgStore) {
    const pool = getMastraPgPool(connectionString);
    globalThis.__ipixMastraPgStore = new PostgresStore({
      id: "ipix-mastra-storage",
      pool,
      schemaName: "mastra",
      disableInit: true,
    });
  }
  return globalThis.__ipixMastraPgStore;
}
