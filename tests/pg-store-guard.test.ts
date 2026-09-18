import { afterAll, afterEach, describe, expect, it } from "vitest";
import { MASTRA_SCHEMA_FINGERPRINT_SQL } from "../scripts/mastra-schema-fingerprint";
import { InMemoryStore } from "@mastra/core/storage";
import { PostgresStore } from "@mastra/pg";
import {
  APPROVED_MASTRA_DIRECT_HOST,
  APPROVED_MASTRA_PROJECT_REF,
  HOSTED_MASTRA_POOL_MAX,
  assertMastraProofWritesAllowed,
  assertSafeMastraDatabaseUrl,
  createMastraStorage,
  getMastraPgPool,
  getMastraPostgresStore,
  isAllowedLocalMastraDatabaseHost,
  isMastraHostedRuntime,
  requireMastraPostgresUrl,
  resetMastraPgSingletonsForTests,
} from "../src/mastra/pg-store";

const APPROVED_POOLER_USER = `hyperdrive_mastra_runtime.${APPROVED_MASTRA_PROJECT_REF}`;
const APPROVED_DIRECT =
  `postgresql://${APPROVED_POOLER_USER.split(".")[0]}:x@${APPROVED_MASTRA_DIRECT_HOST}:5432/postgres?sslmode=require`;
const APPROVED_TX_POOLER =
  `postgresql://${APPROVED_POOLER_USER}:supersecret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`;
const WRONG_PROJECT_POOLER =
  "postgresql://hyperdrive_mastra_runtime.wtuhdynujhszsbwxlbdi:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const POSTGRES_SUPERUSER_POOLER =
  `postgresql://postgres.${APPROVED_MASTRA_PROJECT_REF}:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

describe("IPI-1044 local URL guard", () => {
  afterAll(async () => {
    await resetMastraPgSingletonsForTests();
  });

  it("allows local Docker Postgres", () => {
    const parsed = assertSafeMastraDatabaseUrl(
      "postgresql://postgres:postgres@127.0.0.1:54342/postgres",
    );
    expect(parsed.hostname).toBe("127.0.0.1");
    expect(parsed.port).toBe("54342");
  });

  it("allows localhost, ::1, and the local Docker db hostname", () => {
    expect(
      assertSafeMastraDatabaseUrl("postgresql://postgres@localhost:5432/postgres")
        .hostname,
    ).toBe("localhost");
    expect(isAllowedLocalMastraDatabaseHost("::1")).toBe(true);
    expect(
      assertSafeMastraDatabaseUrl(
        "postgresql://postgres@supabase_db_ipixai:5432/postgres",
      ).hostname,
    ).toBe("supabase_db_ipixai");
    expect(isAllowedLocalMastraDatabaseHost("db.local")).toBe(false);
  });

  it("fails closed on non-postgres URL schemes", () => {
    expect(() =>
      assertSafeMastraDatabaseUrl("http://127.0.0.1:54342/postgres"),
    ).toThrow(/postgres: or postgresql:/);
    expect(() =>
      assertSafeMastraDatabaseUrl("postgresql://postgres@127.0.0.1:54342/postgres"),
    ).not.toThrow();
    expect(() =>
      assertSafeMastraDatabaseUrl("postgres://postgres@127.0.0.1:54342/postgres"),
    ).not.toThrow();
  });

  it("fails closed when host/hostaddr/socket query params would override the authority", () => {
    expect(() =>
      assertSafeMastraDatabaseUrl(
        "postgresql://postgres:pw@127.0.0.1:54342/postgres?host=db.prod.example.com",
      ),
    ).toThrow(/query params|host\/hostaddr\/socket/);
    expect(() =>
      assertSafeMastraDatabaseUrl(
        "postgresql://postgres:pw@127.0.0.1:54342/postgres?hostaddr=8.8.8.8",
      ),
    ).toThrow(/query params|host\/hostaddr\/socket/);
    expect(() =>
      assertSafeMastraDatabaseUrl(
        "postgresql://postgres:pw@127.0.0.1:54342/postgres?HOST=db.prod.example.com",
      ),
    ).toThrow(/query params|host\/hostaddr\/socket/);
  });

  it("fails closed on hosted fashionos, RDS, Neon, and supabase.com poolers", () => {
    const rejected = [
      "postgresql://postgres:x@db.nvdlhrodvevgwdsneplk.supabase.co:5432/postgres",
      "postgresql://postgres:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
      "postgresql://postgres:x@project.supabase.com:5432/postgres",
      "postgresql://postgres:x@my-db.cluster-xyz.us-east-1.rds.amazonaws.com:5432/postgres",
      "postgresql://postgres:x@ep-cool-name.us-east-1.aws.neon.tech:5432/neondb",
    ];
    for (const url of rejected) {
      expect(() => assertSafeMastraDatabaseUrl(url)).toThrow(/allowlist|refusing/);
    }
  });

  it.skipIf(!process.env.MASTRA_DATABASE_URL)(
    "reuses one bounded pool for concurrent local queries",
    async () => {
      const url = process.env.MASTRA_DATABASE_URL!;
      const a = getMastraPgPool(url);
      const b = getMastraPgPool(url);
      expect(a).toBe(b);
      expect(getMastraPostgresStore(url)).toBe(getMastraPostgresStore(url));
      const [first, second] = await Promise.all([
        a.query("select 1 as n"),
        b.query("select 1 as n"),
      ]);
      expect(first.rows[0].n).toBe(1);
      expect(second.rows[0].n).toBe(1);
    },
  );

  it("throws if the singleton is reused with a different connection string", async () => {
    await resetMastraPgSingletonsForTests();
    const first =
      process.env.MASTRA_DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:54342/postgres";
    const second = first.includes("@localhost")
      ? "postgresql://postgres:postgres@127.0.0.1:54342/postgres"
      : "postgresql://postgres:postgres@localhost:54342/postgres";
    getMastraPgPool(first);
    expect(() => getMastraPgPool(second)).toThrow(/refusing to reuse the singleton/);
    expect(() => getMastraPostgresStore(second)).toThrow(
      /refusing to reuse the singleton/,
    );
  });

  it("fingerprints mastra function and trigger catalogs", () => {
    expect(MASTRA_SCHEMA_FINGERPRINT_SQL).toMatch(/pg_get_functiondef/);
    expect(MASTRA_SCHEMA_FINGERPRINT_SQL).toMatch(/pg_get_triggerdef/);
    expect(MASTRA_SCHEMA_FINGERPRINT_SQL).toMatch(/pg_get_constraintdef/);
    expect(MASTRA_SCHEMA_FINGERPRINT_SQL).not.toMatch(/proname = 'trigger_set_timestamps'/);
  });
});

describe("IPI-1124 hosted URL guard and fail-closed", () => {
  const prevHosted = process.env.IPIX_MASTRA_HOSTED;
  const prevUrl = process.env.MASTRA_DATABASE_URL;
  const prevSessionProof = process.env.IPIX_MASTRA_PROOF_SESSION_POOLER;

  afterEach(async () => {
    await resetMastraPgSingletonsForTests();
    if (prevHosted === undefined) delete process.env.IPIX_MASTRA_HOSTED;
    else process.env.IPIX_MASTRA_HOSTED = prevHosted;
    if (prevUrl === undefined) delete process.env.MASTRA_DATABASE_URL;
    else process.env.MASTRA_DATABASE_URL = prevUrl;
    if (prevSessionProof === undefined) delete process.env.IPIX_MASTRA_PROOF_SESSION_POOLER;
    else process.env.IPIX_MASTRA_PROOF_SESSION_POOLER = prevSessionProof;
  });

  it("still rejects hosted fashionos URLs when IPIX_MASTRA_HOSTED is unset", () => {
    delete process.env.IPIX_MASTRA_HOSTED;
    expect(isMastraHostedRuntime()).toBe(false);
    expect(() => assertSafeMastraDatabaseUrl(APPROVED_DIRECT)).toThrow(/local allowlist/);
    expect(() => assertSafeMastraDatabaseUrl(APPROVED_TX_POOLER)).toThrow(/local allowlist/);
  });

  it("accepts the approved direct host and pooler identity only in hosted mode", () => {
    process.env.IPIX_MASTRA_HOSTED = "1";
    expect(assertSafeMastraDatabaseUrl(APPROVED_DIRECT).hostname).toBe(
      APPROVED_MASTRA_DIRECT_HOST,
    );
    expect(assertSafeMastraDatabaseUrl(APPROVED_TX_POOLER).port).toBe("6543");
    expect(() =>
      assertSafeMastraDatabaseUrl(APPROVED_TX_POOLER, { hosted: true }),
    ).not.toThrow();
  });

  it("rejects the same pooler hostname with a different project ref", () => {
    process.env.IPIX_MASTRA_HOSTED = "1";
    expect(() => assertSafeMastraDatabaseUrl(WRONG_PROJECT_POOLER)).toThrow(
      /approved iPix Mastra Postgres project/,
    );
  });

  it("rejects postgres superuser, RDS, Neon, and other Supabase projects in hosted mode", () => {
    process.env.IPIX_MASTRA_HOSTED = "1";
    const rejected = [
      POSTGRES_SUPERUSER_POOLER,
      `postgresql://hyperdrive_mastra_runtime:x@db.wtuhdynujhszsbwxlbdi.supabase.co:5432/postgres`,
      "postgresql://postgres:x@my-db.cluster-xyz.us-east-1.rds.amazonaws.com:5432/postgres",
      "postgresql://postgres:x@ep-cool-name.us-east-1.aws.neon.tech:5432/neondb",
      "postgresql://postgres:x@127.0.0.1:54342/postgres",
    ];
    for (const url of rejected) {
      expect(() => assertSafeMastraDatabaseUrl(url, { hosted: true })).toThrow(
        /approved iPix Mastra Postgres project/,
      );
    }
  });

  it("does not put passwords in thrown messages", () => {
    process.env.IPIX_MASTRA_HOSTED = "1";
    expect(() => assertSafeMastraDatabaseUrl(APPROVED_TX_POOLER.replace("hyperdrive_mastra_runtime", "postgres"))).toThrow();
    try {
      assertSafeMastraDatabaseUrl(WRONG_PROJECT_POOLER.replace(":x@", ":supersecret@"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain("supersecret");
      expect(message).not.toContain("wtuhdynujhszsbwxlbdi");
    }
  });

  it("fails closed when hosted and the URL is missing or rejected", () => {
    process.env.IPIX_MASTRA_HOSTED = "1";
    delete process.env.MASTRA_DATABASE_URL;
    expect(() => requireMastraPostgresUrl()).toThrow(/IPIX_MASTRA_HOSTED requires MASTRA_DATABASE_URL/);
    process.env.MASTRA_DATABASE_URL = WRONG_PROJECT_POOLER;
    expect(() => requireMastraPostgresUrl()).toThrow(/approved iPix Mastra Postgres project/);
  });

  it("keeps local in-memory fallback when not hosted and URL is missing", () => {
    delete process.env.IPIX_MASTRA_HOSTED;
    delete process.env.MASTRA_DATABASE_URL;
    expect(requireMastraPostgresUrl()).toBeUndefined();
  });

  it("uses pool max 1 and one singleton in hosted mode", async () => {
    process.env.IPIX_MASTRA_HOSTED = "1";
    await resetMastraPgSingletonsForTests();
    const a = getMastraPgPool(APPROVED_TX_POOLER);
    const b = getMastraPgPool(APPROVED_TX_POOLER);
    expect(a).toBe(b);
    expect(a.options.max).toBe(HOSTED_MASTRA_POOL_MAX);
    const store = getMastraPostgresStore(APPROVED_TX_POOLER);
    expect(store).toBe(getMastraPostgresStore(APPROVED_TX_POOLER));
    expect(store.disableInit).toBe(true);
    expect((store as unknown as { schema: string }).schema).toBe("mastra");
    expect(a.options.ssl).toEqual({
      rejectUnauthorized: true,
      ca: expect.stringContaining("BEGIN CERTIFICATE"),
    });
  });

  it("rejects TLS and identity query-parameter overrides", () => {
    process.env.IPIX_MASTRA_HOSTED = "1";
    expect(() =>
      assertSafeMastraDatabaseUrl(
        `postgresql://${APPROVED_POOLER_USER}:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=disable`,
      ),
    ).toThrow(/TLS|certificate-verified/);
    expect(() =>
      assertSafeMastraDatabaseUrl(
        `postgresql://${APPROVED_POOLER_USER}:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=no-verify`,
      ),
    ).toThrow(/TLS|certificate-verified/);
    expect(() =>
      assertSafeMastraDatabaseUrl(`${APPROVED_TX_POOLER}&user=postgres`),
    ).toThrow(/query params/);
  });

  it("allows hosted golden proof only on clerk 6543, not postgres or session-first", () => {
    process.env.IPIX_MASTRA_HOSTED = "1";
    delete process.env.MASTRA_DATABASE_URL;
    delete process.env.IPIX_MASTRA_PROOF_SESSION_POOLER;
    expect(() => assertMastraProofWritesAllowed()).toThrow(/MASTRA_DATABASE_URL/);
    process.env.MASTRA_DATABASE_URL = POSTGRES_SUPERUSER_POOLER;
    expect(() => assertMastraProofWritesAllowed()).toThrow(
      /approved iPix Mastra Postgres project/,
    );
    process.env.MASTRA_DATABASE_URL = APPROVED_TX_POOLER.replace(":6543/", ":5432/");
    expect(() => assertMastraProofWritesAllowed()).toThrow(/6543 first/);
    process.env.MASTRA_DATABASE_URL = APPROVED_TX_POOLER;
    expect(() => assertMastraProofWritesAllowed()).not.toThrow();
    process.env.MASTRA_DATABASE_URL = APPROVED_TX_POOLER.replace(":6543/", ":5432/");
    process.env.IPIX_MASTRA_PROOF_SESSION_POOLER = "1";
    expect(() => assertMastraProofWritesAllowed()).not.toThrow();
  });

  it("createMastraStorage: hosted missing/invalid throws and does not return local in-memory storage", () => {
    process.env.IPIX_MASTRA_HOSTED = "1";
    delete process.env.MASTRA_DATABASE_URL;
    expect(() => createMastraStorage()).toThrow(/IPIX_MASTRA_HOSTED requires MASTRA_DATABASE_URL/);
    process.env.MASTRA_DATABASE_URL = WRONG_PROJECT_POOLER;
    expect(() => createMastraStorage()).toThrow(/approved iPix Mastra Postgres project/);
  });

  it("createMastraStorage: local missing URL returns Mastra core in-memory storage", () => {
    delete process.env.IPIX_MASTRA_HOSTED;
    delete process.env.MASTRA_DATABASE_URL;
    const storage = createMastraStorage();
    expect(storage).toBeInstanceOf(InMemoryStore);
    expect(storage).not.toBeInstanceOf(PostgresStore);
  });
});
