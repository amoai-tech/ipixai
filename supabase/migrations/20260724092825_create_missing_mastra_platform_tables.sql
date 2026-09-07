-- IPI-796 · MASTRA-PG-010 — Create the 9 Missing mastra.* Tables via Migration.
--
-- Adds the optional Mastra Studio/agent-builder domains that IPI-628 deliberately
-- excluded from the private "mastra" schema:
--   MCP clients/servers (4), Skills (3), Workspaces (2).
--
-- Source of truth (installed packages in app/ — do NOT use exportSchemas()):
--   @mastra/pg@1.12.0
--   @mastra/core@1.41.0  TABLE_* + *_SCHEMA constants in @mastra/core/storage
--
-- exportSchemas('mastra') from @mastra/pg@1.12.0 does NOT emit these nine tables
-- (verified 2026-07-24). DDL below is static, generated from core SCHEMA objects
-- plus the same ...Z TIMESTAMPTZ DEFAULT NOW() companions as IPI-628.
--
-- Does NOT depend on public.mastra_* (CREATE TABLE ... LIKE forbidden).
-- No foreign keys (adapter manages parent/version deletes in app code).
-- No timestamp triggers (domains write timestamp + Z columns explicitly).
--
-- Security: same private-schema contract as IPI-629 — revoke PostgREST roles,
-- grant DML only to hyperdrive_mastra_runtime, ENABLE RLS + trusted-role policy.
-- Fail-closed postflight aborts the migration on shape/grant/RLS/row mismatches.

-- ─── DDL ─────────────────────────────────────────────────────────────────────

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_mcp_clients" (
              "id" TEXT PRIMARY KEY NOT NULL,
"status" TEXT NOT NULL,
"activeVersionId" TEXT ,
"authorId" TEXT ,
"metadata" JSONB ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );



            CREATE TABLE IF NOT EXISTS "mastra"."mastra_mcp_client_versions" (
              "id" TEXT PRIMARY KEY NOT NULL,
"mcpClientId" TEXT NOT NULL,
"versionNumber" INTEGER NOT NULL,
"name" TEXT NOT NULL,
"description" TEXT ,
"servers" JSONB NOT NULL,
"changedFields" JSONB ,
"changeMessage" TEXT ,
"createdAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW()
            );



            CREATE TABLE IF NOT EXISTS "mastra"."mastra_mcp_servers" (
              "id" TEXT PRIMARY KEY NOT NULL,
"status" TEXT NOT NULL,
"activeVersionId" TEXT ,
"authorId" TEXT ,
"metadata" JSONB ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );



            CREATE TABLE IF NOT EXISTS "mastra"."mastra_mcp_server_versions" (
              "id" TEXT PRIMARY KEY NOT NULL,
"mcpServerId" TEXT NOT NULL,
"versionNumber" INTEGER NOT NULL,
"name" TEXT NOT NULL,
"version" TEXT NOT NULL,
"description" TEXT ,
"instructions" TEXT ,
"repository" JSONB ,
"releaseDate" TEXT ,
"isLatest" BOOLEAN ,
"packageCanonical" TEXT ,
"tools" JSONB ,
"agents" JSONB ,
"workflows" JSONB ,
"changedFields" JSONB ,
"changeMessage" TEXT ,
"createdAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW()
            );



            CREATE TABLE IF NOT EXISTS "mastra"."mastra_skills" (
              "id" TEXT PRIMARY KEY NOT NULL,
"status" TEXT NOT NULL,
"activeVersionId" TEXT ,
"authorId" TEXT ,
"visibility" TEXT ,
"favoriteCount" INTEGER ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );



            CREATE TABLE IF NOT EXISTS "mastra"."mastra_skill_versions" (
              "id" TEXT PRIMARY KEY NOT NULL,
"skillId" TEXT NOT NULL,
"versionNumber" INTEGER NOT NULL,
"name" TEXT NOT NULL,
"description" TEXT NOT NULL,
"instructions" TEXT NOT NULL,
"license" TEXT ,
"compatibility" JSONB ,
"source" JSONB ,
"references" JSONB ,
"scripts" JSONB ,
"assets" JSONB ,
"files" JSONB ,
"metadata" JSONB ,
"tree" JSONB ,
"changedFields" JSONB ,
"changeMessage" TEXT ,
"createdAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW()
            );



            CREATE TABLE IF NOT EXISTS "mastra"."mastra_skill_blobs" (
              "hash" TEXT PRIMARY KEY NOT NULL,
"content" TEXT NOT NULL,
"size" INTEGER NOT NULL,
"mimeType" TEXT ,
"createdAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW()
            );



            CREATE TABLE IF NOT EXISTS "mastra"."mastra_workspaces" (
              "id" TEXT PRIMARY KEY NOT NULL,
"status" TEXT NOT NULL,
"activeVersionId" TEXT ,
"authorId" TEXT ,
"metadata" JSONB ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );



            CREATE TABLE IF NOT EXISTS "mastra"."mastra_workspace_versions" (
              "id" TEXT PRIMARY KEY NOT NULL,
"workspaceId" TEXT NOT NULL,
"versionNumber" INTEGER NOT NULL,
"name" TEXT NOT NULL,
"description" TEXT ,
"filesystem" JSONB ,
"sandbox" JSONB ,
"mounts" JSONB ,
"search" JSONB ,
"skills" JSONB ,
"tools" JSONB ,
"autoSync" BOOLEAN ,
"operationTimeout" INTEGER ,
"changedFields" JSONB ,
"changeMessage" TEXT ,
"createdAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW()
            );

CREATE UNIQUE INDEX IF NOT EXISTS "idx_mcp_client_versions_client_version"
  ON "mastra"."mastra_mcp_client_versions" ("mcpClientId", "versionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_mcp_server_versions_server_version"
  ON "mastra"."mastra_mcp_server_versions" ("mcpServerId", "versionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_skill_versions_skill_version"
  ON "mastra"."mastra_skill_versions" ("skillId", "versionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_workspace_versions_workspace_version"
  ON "mastra"."mastra_workspace_versions" ("workspaceId", "versionNumber");

-- ─── Grants + RLS (explicit nine-table list — do not loop all mastra_*) ───────

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'mastra_mcp_clients',
    'mastra_mcp_client_versions',
    'mastra_mcp_servers',
    'mastra_mcp_server_versions',
    'mastra_skills',
    'mastra_skill_versions',
    'mastra_skill_blobs',
    'mastra_workspaces',
    'mastra_workspace_versions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('REVOKE ALL ON TABLE mastra.%I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON TABLE mastra.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON TABLE mastra.%I FROM authenticated', t);
    EXECUTE format('REVOKE ALL ON TABLE mastra.%I FROM service_role', t);

    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE mastra.%I TO hyperdrive_mastra_runtime',
      t
    );

    EXECUTE format('ALTER TABLE mastra.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format(
      'DROP POLICY IF EXISTS hyperdrive_mastra_runtime_all ON mastra.%I',
      t
    );
    EXECUTE format(
      'CREATE POLICY hyperdrive_mastra_runtime_all ON mastra.%I
         FOR ALL
         TO hyperdrive_mastra_runtime
         USING (true)
         WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- ─── Fail-closed postflight ──────────────────────────────────────────────────

DO $$
DECLARE
  expected text[] := ARRAY[
    'mastra_mcp_clients',
    'mastra_mcp_client_versions',
    'mastra_mcp_servers',
    'mastra_mcp_server_versions',
    'mastra_skills',
    'mastra_skill_versions',
    'mastra_skill_blobs',
    'mastra_workspaces',
    'mastra_workspace_versions'
  ];
  expected_indexes text[] := ARRAY[
    'idx_mcp_client_versions_client_version',
    'idx_mcp_server_versions_server_version',
    'idx_skill_versions_skill_version',
    'idx_workspace_versions_workspace_version'
  ];
  -- column signatures: table|col|udt|nullable|has_now_default
  expected_cols text[] := ARRAY[
    'mastra_mcp_clients|id|text|NO|',
    'mastra_mcp_clients|status|text|NO|',
    'mastra_mcp_clients|activeVersionId|text|YES|',
    'mastra_mcp_clients|authorId|text|YES|',
    'mastra_mcp_clients|metadata|jsonb|YES|',
    'mastra_mcp_clients|createdAt|timestamp|NO|',
    'mastra_mcp_clients|updatedAt|timestamp|NO|',
    'mastra_mcp_clients|createdAtZ|timestamptz|YES|now',
    'mastra_mcp_clients|updatedAtZ|timestamptz|YES|now',
    'mastra_mcp_client_versions|id|text|NO|',
    'mastra_mcp_client_versions|mcpClientId|text|NO|',
    'mastra_mcp_client_versions|versionNumber|int4|NO|',
    'mastra_mcp_client_versions|name|text|NO|',
    'mastra_mcp_client_versions|description|text|YES|',
    'mastra_mcp_client_versions|servers|jsonb|NO|',
    'mastra_mcp_client_versions|changedFields|jsonb|YES|',
    'mastra_mcp_client_versions|changeMessage|text|YES|',
    'mastra_mcp_client_versions|createdAt|timestamp|NO|',
    'mastra_mcp_client_versions|createdAtZ|timestamptz|YES|now',
    'mastra_mcp_servers|id|text|NO|',
    'mastra_mcp_servers|status|text|NO|',
    'mastra_mcp_servers|activeVersionId|text|YES|',
    'mastra_mcp_servers|authorId|text|YES|',
    'mastra_mcp_servers|metadata|jsonb|YES|',
    'mastra_mcp_servers|createdAt|timestamp|NO|',
    'mastra_mcp_servers|updatedAt|timestamp|NO|',
    'mastra_mcp_servers|createdAtZ|timestamptz|YES|now',
    'mastra_mcp_servers|updatedAtZ|timestamptz|YES|now',
    'mastra_mcp_server_versions|id|text|NO|',
    'mastra_mcp_server_versions|mcpServerId|text|NO|',
    'mastra_mcp_server_versions|versionNumber|int4|NO|',
    'mastra_mcp_server_versions|name|text|NO|',
    'mastra_mcp_server_versions|version|text|NO|',
    'mastra_mcp_server_versions|description|text|YES|',
    'mastra_mcp_server_versions|instructions|text|YES|',
    'mastra_mcp_server_versions|repository|jsonb|YES|',
    'mastra_mcp_server_versions|releaseDate|text|YES|',
    'mastra_mcp_server_versions|isLatest|bool|YES|',
    'mastra_mcp_server_versions|packageCanonical|text|YES|',
    'mastra_mcp_server_versions|tools|jsonb|YES|',
    'mastra_mcp_server_versions|agents|jsonb|YES|',
    'mastra_mcp_server_versions|workflows|jsonb|YES|',
    'mastra_mcp_server_versions|changedFields|jsonb|YES|',
    'mastra_mcp_server_versions|changeMessage|text|YES|',
    'mastra_mcp_server_versions|createdAt|timestamp|NO|',
    'mastra_mcp_server_versions|createdAtZ|timestamptz|YES|now',
    'mastra_skills|id|text|NO|',
    'mastra_skills|status|text|NO|',
    'mastra_skills|activeVersionId|text|YES|',
    'mastra_skills|authorId|text|YES|',
    'mastra_skills|visibility|text|YES|',
    'mastra_skills|favoriteCount|int4|YES|',
    'mastra_skills|createdAt|timestamp|NO|',
    'mastra_skills|updatedAt|timestamp|NO|',
    'mastra_skills|createdAtZ|timestamptz|YES|now',
    'mastra_skills|updatedAtZ|timestamptz|YES|now',
    'mastra_skill_versions|id|text|NO|',
    'mastra_skill_versions|skillId|text|NO|',
    'mastra_skill_versions|versionNumber|int4|NO|',
    'mastra_skill_versions|name|text|NO|',
    'mastra_skill_versions|description|text|NO|',
    'mastra_skill_versions|instructions|text|NO|',
    'mastra_skill_versions|license|text|YES|',
    'mastra_skill_versions|compatibility|jsonb|YES|',
    'mastra_skill_versions|source|jsonb|YES|',
    'mastra_skill_versions|references|jsonb|YES|',
    'mastra_skill_versions|scripts|jsonb|YES|',
    'mastra_skill_versions|assets|jsonb|YES|',
    'mastra_skill_versions|files|jsonb|YES|',
    'mastra_skill_versions|metadata|jsonb|YES|',
    'mastra_skill_versions|tree|jsonb|YES|',
    'mastra_skill_versions|changedFields|jsonb|YES|',
    'mastra_skill_versions|changeMessage|text|YES|',
    'mastra_skill_versions|createdAt|timestamp|NO|',
    'mastra_skill_versions|createdAtZ|timestamptz|YES|now',
    'mastra_skill_blobs|hash|text|NO|',
    'mastra_skill_blobs|content|text|NO|',
    'mastra_skill_blobs|size|int4|NO|',
    'mastra_skill_blobs|mimeType|text|YES|',
    'mastra_skill_blobs|createdAt|timestamp|NO|',
    'mastra_skill_blobs|createdAtZ|timestamptz|YES|now',
    'mastra_workspaces|id|text|NO|',
    'mastra_workspaces|status|text|NO|',
    'mastra_workspaces|activeVersionId|text|YES|',
    'mastra_workspaces|authorId|text|YES|',
    'mastra_workspaces|metadata|jsonb|YES|',
    'mastra_workspaces|createdAt|timestamp|NO|',
    'mastra_workspaces|updatedAt|timestamp|NO|',
    'mastra_workspaces|createdAtZ|timestamptz|YES|now',
    'mastra_workspaces|updatedAtZ|timestamptz|YES|now',
    'mastra_workspace_versions|id|text|NO|',
    'mastra_workspace_versions|workspaceId|text|NO|',
    'mastra_workspace_versions|versionNumber|int4|NO|',
    'mastra_workspace_versions|name|text|NO|',
    'mastra_workspace_versions|description|text|YES|',
    'mastra_workspace_versions|filesystem|jsonb|YES|',
    'mastra_workspace_versions|sandbox|jsonb|YES|',
    'mastra_workspace_versions|mounts|jsonb|YES|',
    'mastra_workspace_versions|search|jsonb|YES|',
    'mastra_workspace_versions|skills|jsonb|YES|',
    'mastra_workspace_versions|tools|jsonb|YES|',
    'mastra_workspace_versions|autoSync|bool|YES|',
    'mastra_workspace_versions|operationTimeout|int4|YES|',
    'mastra_workspace_versions|changedFields|jsonb|YES|',
    'mastra_workspace_versions|changeMessage|text|YES|',
    'mastra_workspace_versions|createdAt|timestamp|NO|',
    'mastra_workspace_versions|createdAtZ|timestamptz|YES|now'
  ];
  t text;
  sig text;
  parts text[];
  n int;
  row_count bigint;
  has_rls boolean;
  has_policy boolean;
  has_grant boolean;
  bad_priv text;
  live_udt text;
  live_null text;
  live_default text;
  pk_ok boolean;
BEGIN
  -- Exactly nine target tables
  SELECT count(*) INTO n
  FROM pg_tables
  WHERE schemaname = 'mastra'
    AND tablename = ANY (expected);
  IF n <> 9 THEN
    RAISE EXCEPTION 'IPI-796 postflight: expected 9 tables, found %', n;
  END IF;

  FOREACH t IN ARRAY expected LOOP
    -- Zero rows immediately after creation
    EXECUTE format('SELECT count(*) FROM mastra.%I', t) INTO row_count;
    IF row_count <> 0 THEN
      RAISE EXCEPTION 'IPI-796 postflight: %.% has % rows (expected 0)', 'mastra', t, row_count;
    END IF;

    -- RLS enabled
    SELECT c.relrowsecurity INTO has_rls
    FROM pg_class c
    JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
    WHERE nsp.nspname = 'mastra' AND c.relname = t;
    IF NOT COALESCE(has_rls, false) THEN
      RAISE EXCEPTION 'IPI-796 postflight: RLS not enabled on mastra.%', t;
    END IF;

    -- Runtime policy present
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'mastra'
        AND tablename = t
        AND policyname = 'hyperdrive_mastra_runtime_all'
    ) INTO has_policy;
    IF NOT has_policy THEN
      RAISE EXCEPTION 'IPI-796 postflight: missing policy on mastra.%', t;
    END IF;

    -- Primary key present
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
      WHERE nsp.nspname = 'mastra'
        AND c.relname = t
        AND con.contype = 'p'
    ) INTO pk_ok;
    IF NOT pk_ok THEN
      RAISE EXCEPTION 'IPI-796 postflight: missing primary key on mastra.%', t;
    END IF;

    -- hyperdrive_mastra_runtime has DML
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.role_table_grants
      WHERE table_schema = 'mastra'
        AND table_name = t
        AND grantee = 'hyperdrive_mastra_runtime'
        AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
      GROUP BY table_name
      HAVING count(DISTINCT privilege_type) = 4
    ) INTO has_grant;
    IF NOT has_grant THEN
      RAISE EXCEPTION 'IPI-796 postflight: incomplete DML grants for hyperdrive_mastra_runtime on mastra.%', t;
    END IF;

    -- PostgREST / PUBLIC must have no privileges
    SELECT string_agg(DISTINCT grantee || ':' || privilege_type, ', ')
    INTO bad_priv
    FROM information_schema.role_table_grants
    WHERE table_schema = 'mastra'
      AND table_name = t
      AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC');
    IF bad_priv IS NOT NULL THEN
      RAISE EXCEPTION 'IPI-796 postflight: unexpected grants on mastra.%: %', t, bad_priv;
    END IF;
  END LOOP;

  -- Four unique version indexes
  SELECT count(*) INTO n
  FROM pg_indexes
  WHERE schemaname = 'mastra'
    AND indexname = ANY (expected_indexes);
  IF n <> 4 THEN
    RAISE EXCEPTION 'IPI-796 postflight: expected 4 unique version indexes, found %', n;
  END IF;

  FOREACH sig IN ARRAY expected_cols LOOP
    parts := string_to_array(sig, '|');
    SELECT c.udt_name, c.is_nullable, coalesce(c.column_default, '')
    INTO live_udt, live_null, live_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'mastra'
      AND c.table_name = parts[1]
      AND c.column_name = parts[2];

    IF live_udt IS NULL THEN
      RAISE EXCEPTION 'IPI-796 postflight: missing column %.%', parts[1], parts[2];
    END IF;
    IF live_udt <> parts[3] THEN
      RAISE EXCEPTION 'IPI-796 postflight: %.% udt % (expected %)',
        parts[1], parts[2], live_udt, parts[3];
    END IF;
    IF live_null <> parts[4] THEN
      RAISE EXCEPTION 'IPI-796 postflight: %.% nullability % (expected %)',
        parts[1], parts[2], live_null, parts[4];
    END IF;
    IF parts[5] = 'now' AND live_default NOT ILIKE '%now()%' THEN
      RAISE EXCEPTION 'IPI-796 postflight: %.% default % (expected now())',
        parts[1], parts[2], live_default;
    END IF;
  END LOOP;
END $$;
