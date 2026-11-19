-- =============================================================================
-- migration: ipi1460_mastra_184_compat
-- purpose: add the two additive workflow-run journal tables required by the
--          target @mastra/pg 1.37.0 / @mastra/core 1.84.0 family.
-- affected: mastra.mastra_workflow_runs (new)
--           mastra.mastra_workflow_run_entries (new)
-- task: IPI-1460 · MASTRA-UPG-007
-- date: 2026-11-19
--
-- Source of truth (installed package, not website docs):
--   exportSchemas("mastra") from @mastra/pg 1.37.0, which serialises
--   TABLE_WORKFLOW_RUNS + TABLE_WORKFLOW_RUN_ENTRIES from @mastra/core 1.84.0
--   (WORKFLOW_RUN_JOURNAL_TABLE_CONFIGS) plus the workflow-domain default
--   indexes. The table columns, primary keys and five indexes match that
--   exporter output exactly. The createdAtZ/updatedAtZ trigger is the existing
--   iPix timestamp convention (mastra.trigger_set_timestamps), added here
--   because disableInit: true means the adapter never installs it at boot; the
--   exporter itself does not emit that trigger.
--
-- Additive-only:
--   * two new tables + their primary keys, indexes and timestamp trigger only
--   * no existing table, column, index, policy, grant or data is changed
--   * keep schemaName: "mastra" + disableInit: true; this migration is the DDL
--   * storageVersion / autoStorageVersion stay at their 1.82 values; these
--     journal tables are prerequisites, not a v2 storage opt-in
--   * no public.mastra_* shadow; no PostgREST (anon/authenticated/service_role)
--     grants
--   * RLS + the existing hyperdrive_mastra_runtime_all policy pattern so the
--     dedicated runtime role can use the tables
--
-- Rollback (manual, not applied here; safe while 1.82 code is still running
-- because 1.82 does not reference these tables):
--   DROP TABLE IF EXISTS mastra.mastra_workflow_run_entries;
--   DROP TABLE IF EXISTS mastra.mastra_workflow_runs;
-- =============================================================================

-- Fail-closed preflight: this is the expected iPix Mastra schema and the
-- timestamp trigger function this migration reuses already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'mastra'
  ) THEN
    RAISE EXCEPTION 'IPI-1460 preflight: mastra schema missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'mastra' AND p.proname = 'trigger_set_timestamps'
  ) THEN
    RAISE EXCEPTION 'IPI-1460 preflight: mastra.trigger_set_timestamps() missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'hyperdrive_mastra_runtime'
  ) THEN
    RAISE EXCEPTION 'IPI-1460 preflight: hyperdrive_mastra_runtime role missing';
  END IF;
END $$;

-- 1. Workflow-run journal header (exact installed PG 1.37 definition).
CREATE TABLE IF NOT EXISTS mastra.mastra_workflow_runs (
  "workflow_name" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "resourceId" TEXT,
  "threadId" TEXT,
  "status" TEXT NOT NULL,
  "header" JSONB NOT NULL,
  "lastSeq" INTEGER NOT NULL,
  "startStateSeq" INTEGER NOT NULL,
  "stateShared" BOOLEAN NOT NULL,
  "stateSeq" INTEGER NOT NULL,
  "statePatchCount" INTEGER NOT NULL,
  "statePatchBytes" INTEGER NOT NULL,
  "stateBytes" INTEGER,
  "runToken" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAtZ" TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY ("workflow_name", "run_id")
);

-- 2. Append-only workflow-run journal entries.
CREATE TABLE IF NOT EXISTS mastra.mastra_workflow_run_entries (
  "workflow_name" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "step_id" TEXT,
  "payload" JSONB,
  PRIMARY KEY ("workflow_name", "run_id", "seq")
);

-- 3. Keep the timestamptz mirrors truthful for every writer, including DML
--    that predates the adapter's explicit mirrors. Reuse the hardened
--    mastra.trigger_set_timestamps() function created with the pinned schema.
DROP TRIGGER IF EXISTS mastra_workflow_runs_timestamps ON mastra.mastra_workflow_runs;
CREATE TRIGGER mastra_workflow_runs_timestamps
  BEFORE INSERT OR UPDATE ON mastra.mastra_workflow_runs
  FOR EACH ROW
  EXECUTE FUNCTION mastra.trigger_set_timestamps();

-- 4. The five reviewed indexes from the installed exporter.
CREATE INDEX IF NOT EXISTS "mastra_mastra_workflow_runs_name_createdat_idx"
  ON mastra.mastra_workflow_runs ("workflow_name", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "mastra_mastra_workflow_runs_name_status_createdat_idx"
  ON mastra.mastra_workflow_runs ("workflow_name", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "mastra_mastra_workflow_runs_threadid_idx"
  ON mastra.mastra_workflow_runs ("threadId");
CREATE INDEX IF NOT EXISTS "mastra_mastra_workflow_run_entries_step_idx"
  ON mastra.mastra_workflow_run_entries ("workflow_name", "run_id", "kind", "step_id", "seq");
CREATE INDEX IF NOT EXISTS "mastra_mastra_workflow_run_entries_state_base_idx"
  ON mastra.mastra_workflow_run_entries ((payload ->> 'workflowName'), (payload ->> 'runId'))
  WHERE kind = 'state-base';

-- 5. Match the existing private-runtime table posture: no PostgREST access,
--    RLS enabled, and only the dedicated runtime role gets DML.
ALTER TABLE mastra.mastra_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastra.mastra_workflow_run_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hyperdrive_mastra_runtime_all ON mastra.mastra_workflow_runs;
CREATE POLICY hyperdrive_mastra_runtime_all ON mastra.mastra_workflow_runs
  FOR ALL TO hyperdrive_mastra_runtime USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS hyperdrive_mastra_runtime_all ON mastra.mastra_workflow_run_entries;
CREATE POLICY hyperdrive_mastra_runtime_all ON mastra.mastra_workflow_run_entries
  FOR ALL TO hyperdrive_mastra_runtime USING (true) WITH CHECK (true);

-- Deny everyone else explicitly: a platform/PUBLIC default ACL must never
-- leave inherited table privileges outside the runtime-only posture.
REVOKE ALL ON TABLE mastra.mastra_workflow_runs FROM PUBLIC;
REVOKE ALL ON TABLE mastra.mastra_workflow_run_entries FROM PUBLIC;
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE mastra.mastra_workflow_runs FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON TABLE mastra.mastra_workflow_run_entries FROM %I', role_name);
    END IF;
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE mastra.mastra_workflow_runs TO hyperdrive_mastra_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE mastra.mastra_workflow_run_entries TO hyperdrive_mastra_runtime;

-- Fail-closed postflight: exact columns, primary keys, indexes, timestamp
-- trigger, RLS, runtime policy/grant, no public shadow, and no PostgREST grants.
DO $$
DECLARE
  missing text;
  rls_ok boolean;
  policy_count int;
  grant_count int;
  index_count int;
  trigger_count int;
  public_shadow int;
  postgrest_grant int;
  public_grant int;
  pk_columns text[];
BEGIN
  SELECT string_agg(t || '.' || c, ', ')
    INTO missing
  FROM (VALUES
    ('mastra_workflow_runs', 'workflow_name'),
    ('mastra_workflow_runs', 'run_id'),
    ('mastra_workflow_runs', 'resourceId'),
    ('mastra_workflow_runs', 'threadId'),
    ('mastra_workflow_runs', 'status'),
    ('mastra_workflow_runs', 'header'),
    ('mastra_workflow_runs', 'lastSeq'),
    ('mastra_workflow_runs', 'startStateSeq'),
    ('mastra_workflow_runs', 'stateShared'),
    ('mastra_workflow_runs', 'stateSeq'),
    ('mastra_workflow_runs', 'statePatchCount'),
    ('mastra_workflow_runs', 'statePatchBytes'),
    ('mastra_workflow_runs', 'stateBytes'),
    ('mastra_workflow_runs', 'runToken'),
    ('mastra_workflow_runs', 'createdAt'),
    ('mastra_workflow_runs', 'updatedAt'),
    ('mastra_workflow_runs', 'createdAtZ'),
    ('mastra_workflow_runs', 'updatedAtZ'),
    ('mastra_workflow_run_entries', 'workflow_name'),
    ('mastra_workflow_run_entries', 'run_id'),
    ('mastra_workflow_run_entries', 'seq'),
    ('mastra_workflow_run_entries', 'kind'),
    ('mastra_workflow_run_entries', 'step_id'),
    ('mastra_workflow_run_entries', 'payload')
  ) AS required(t, c)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns col
    WHERE col.table_schema = 'mastra'
      AND col.table_name = required.t
      AND col.column_name = required.c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'IPI-1460 postflight: missing required columns: %', missing;
  END IF;

  -- CREATE TABLE IF NOT EXISTS is a no-op on a same-named table, so a table
  -- with the right column names but wrong types/nullability must fail here
  -- instead of surfacing later as an adapter upsert/resume failure.
  SELECT string_agg(t || '.' || c, ', ')
    INTO missing
  FROM (VALUES
    ('mastra_workflow_runs', 'workflow_name', 'text', 'NO'),
    ('mastra_workflow_runs', 'run_id', 'text', 'NO'),
    ('mastra_workflow_runs', 'resourceId', 'text', 'YES'),
    ('mastra_workflow_runs', 'threadId', 'text', 'YES'),
    ('mastra_workflow_runs', 'status', 'text', 'NO'),
    ('mastra_workflow_runs', 'header', 'jsonb', 'NO'),
    ('mastra_workflow_runs', 'lastSeq', 'integer', 'NO'),
    ('mastra_workflow_runs', 'startStateSeq', 'integer', 'NO'),
    ('mastra_workflow_runs', 'stateShared', 'boolean', 'NO'),
    ('mastra_workflow_runs', 'stateSeq', 'integer', 'NO'),
    ('mastra_workflow_runs', 'statePatchCount', 'integer', 'NO'),
    ('mastra_workflow_runs', 'statePatchBytes', 'integer', 'NO'),
    ('mastra_workflow_runs', 'stateBytes', 'integer', 'YES'),
    ('mastra_workflow_runs', 'runToken', 'text', 'NO'),
    ('mastra_workflow_runs', 'createdAt', 'timestamp without time zone', 'NO'),
    ('mastra_workflow_runs', 'updatedAt', 'timestamp without time zone', 'NO'),
    ('mastra_workflow_runs', 'createdAtZ', 'timestamp with time zone', 'YES'),
    ('mastra_workflow_runs', 'updatedAtZ', 'timestamp with time zone', 'YES'),
    ('mastra_workflow_run_entries', 'workflow_name', 'text', 'NO'),
    ('mastra_workflow_run_entries', 'run_id', 'text', 'NO'),
    ('mastra_workflow_run_entries', 'seq', 'integer', 'NO'),
    ('mastra_workflow_run_entries', 'kind', 'text', 'NO'),
    ('mastra_workflow_run_entries', 'step_id', 'text', 'YES'),
    ('mastra_workflow_run_entries', 'payload', 'jsonb', 'YES')
  ) AS expected(t, c, data_type, is_nullable)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns col
    WHERE col.table_schema = 'mastra'
      AND col.table_name = expected.t
      AND col.column_name = expected.c
      AND col.data_type = expected.data_type
      AND col.is_nullable = expected.is_nullable
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'IPI-1460 postflight: column type/nullability mismatch: %', missing;
  END IF;

  SELECT array_agg(a.attname::text ORDER BY k.ord)
    INTO pk_columns
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
  WHERE n.nspname = 'mastra' AND c.relname = 'mastra_workflow_runs'
    AND con.contype = 'p';
  IF pk_columns IS DISTINCT FROM ARRAY['workflow_name', 'run_id']::text[] THEN
    RAISE EXCEPTION 'IPI-1460 postflight: unexpected mastra_workflow_runs primary key: %', pk_columns;
  END IF;

  SELECT array_agg(a.attname::text ORDER BY k.ord)
    INTO pk_columns
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
  WHERE n.nspname = 'mastra' AND c.relname = 'mastra_workflow_run_entries'
    AND con.contype = 'p';
  IF pk_columns IS DISTINCT FROM ARRAY['workflow_name', 'run_id', 'seq']::text[] THEN
    RAISE EXCEPTION 'IPI-1460 postflight: unexpected mastra_workflow_run_entries primary key: %', pk_columns;
  END IF;

  SELECT count(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'mastra'
    AND indexname IN (
      'mastra_mastra_workflow_runs_name_createdat_idx',
      'mastra_mastra_workflow_runs_name_status_createdat_idx',
      'mastra_mastra_workflow_runs_threadid_idx',
      'mastra_mastra_workflow_run_entries_step_idx',
      'mastra_mastra_workflow_run_entries_state_base_idx'
    );
  IF index_count <> 5 THEN
    RAISE EXCEPTION 'IPI-1460 postflight: expected 5 reviewed indexes, found %', index_count;
  END IF;

  SELECT count(*) INTO trigger_count
  FROM pg_trigger tg
  JOIN pg_class c ON c.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'mastra'
    AND c.relname = 'mastra_workflow_runs'
    AND tg.tgname = 'mastra_workflow_runs_timestamps'
    AND NOT tg.tgisinternal;
  IF trigger_count <> 1 THEN
    RAISE EXCEPTION 'IPI-1460 postflight: timestamp trigger missing on mastra_workflow_runs';
  END IF;

  SELECT bool_and(c.relrowsecurity)
    INTO rls_ok
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'mastra'
    AND c.relname IN ('mastra_workflow_runs', 'mastra_workflow_run_entries');
  IF NOT COALESCE(rls_ok, false) THEN
    RAISE EXCEPTION 'IPI-1460 postflight: RLS not enabled on run journal tables';
  END IF;

  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'mastra'
    AND tablename IN ('mastra_workflow_runs', 'mastra_workflow_run_entries')
    AND policyname = 'hyperdrive_mastra_runtime_all'
    AND 'hyperdrive_mastra_runtime' = ANY(roles);
  IF policy_count <> 2 THEN
    RAISE EXCEPTION 'IPI-1460 postflight: runtime policy missing on run journal tables';
  END IF;

  SELECT count(*) INTO grant_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'mastra'
    AND table_name IN ('mastra_workflow_runs', 'mastra_workflow_run_entries')
    AND grantee = 'hyperdrive_mastra_runtime'
    AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE');
  IF grant_count <> 8 THEN
    RAISE EXCEPTION 'IPI-1460 postflight: expected 8 runtime DML grants, found %', grant_count;
  END IF;

  SELECT count(*) INTO public_shadow
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('mastra_workflow_runs', 'mastra_workflow_run_entries');
  IF public_shadow <> 0 THEN
    RAISE EXCEPTION 'IPI-1460 postflight: public.mastra_* shadow must not exist';
  END IF;

  SELECT count(*) INTO postgrest_grant
  FROM information_schema.role_table_grants
  WHERE table_schema = 'mastra'
    AND table_name IN ('mastra_workflow_runs', 'mastra_workflow_run_entries')
    AND grantee IN ('anon', 'authenticated', 'service_role');
  IF postgrest_grant <> 0 THEN
    RAISE EXCEPTION 'IPI-1460 postflight: PostgREST role gained grants on run journal tables';
  END IF;

  SELECT count(*) INTO public_grant
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
  WHERE n.nspname = 'mastra'
    AND c.relname IN ('mastra_workflow_runs', 'mastra_workflow_run_entries')
    AND a.grantee = 0;
  IF public_grant <> 0 THEN
    RAISE EXCEPTION 'IPI-1460 postflight: PUBLIC retains % table privilege(s) on run journal tables', public_grant;
  END IF;
END $$;
