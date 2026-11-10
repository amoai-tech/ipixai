-- =============================================================================
-- migration: ipi1385_mastra_1_82_run_fencing
-- purpose: add the two additive run-fencing tables required by the target
--          @mastra/pg 1.35.0 / @mastra/core 1.82.0 family.
-- affected: mastra.mastra_workflow_run_owners (new)
--           mastra.mastra_memory_run_fences (new)
-- task: IPI-1385 · MASTRA-UPG-006
-- date: 2026-11-10
--
-- Source of truth (installed package, not website docs):
--   exportSchemas("mastra") from @mastra/pg 1.35.0
--   TABLE_WORKFLOW_RUN_OWNERS + TABLE_MEMORY_RUN_FENCES in @mastra/core 1.82.0
--
-- Additive-only:
--   * new tables only; no existing table, column, index, policy, grant or data
--   * keep schemaName: "mastra" + disableInit: true; this migration is DDL
--   * no public.mastra_* shadow; no PostgREST grants
--   * RLS + the existing hyperdrive_mastra_runtime_all policy pattern so the
--     dedicated runtime role can use the tables
--
-- Rollback (manual, not applied here):
--   DROP TABLE IF EXISTS mastra.mastra_memory_run_fences;
--   DROP TABLE IF EXISTS mastra.mastra_workflow_run_owners;
-- =============================================================================

-- Fail-closed preflight: this is the expected iPix Mastra schema.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'mastra'
  ) THEN
    RAISE EXCEPTION 'IPI-1385 preflight: mastra schema missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'mastra' AND table_name = 'mastra_threads'
  ) THEN
    RAISE EXCEPTION 'IPI-1385 preflight: mastra.mastra_threads missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'hyperdrive_mastra_runtime'
  ) THEN
    RAISE EXCEPTION 'IPI-1385 preflight: hyperdrive_mastra_runtime role missing';
  END IF;
END $$;

-- 1. Workflow run ownership / fencing.
CREATE TABLE IF NOT EXISTS mastra.mastra_workflow_run_owners (
  "runId" TEXT PRIMARY KEY NOT NULL,
  "generation" BIGINT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "leaseExpiresAt" BIGINT,
  "updatedAt" BIGINT NOT NULL
);

-- 2. Memory write fences for a workflow run.
CREATE TABLE IF NOT EXISTS mastra.mastra_memory_run_fences (
  "runId" TEXT PRIMARY KEY NOT NULL,
  "generation" BIGINT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "retiredAt" BIGINT
);

-- Match the existing private-runtime table posture: no PostgREST access,
-- RLS enabled, and only the dedicated runtime role gets DML.
ALTER TABLE mastra.mastra_workflow_run_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastra.mastra_memory_run_fences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hyperdrive_mastra_runtime_all ON mastra.mastra_workflow_run_owners;
CREATE POLICY hyperdrive_mastra_runtime_all ON mastra.mastra_workflow_run_owners
  FOR ALL TO hyperdrive_mastra_runtime USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS hyperdrive_mastra_runtime_all ON mastra.mastra_memory_run_fences;
CREATE POLICY hyperdrive_mastra_runtime_all ON mastra.mastra_memory_run_fences
  FOR ALL TO hyperdrive_mastra_runtime USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE mastra.mastra_workflow_run_owners TO hyperdrive_mastra_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE mastra.mastra_memory_run_fences TO hyperdrive_mastra_runtime;

-- Fail-closed postflight: exact columns, RLS, runtime policy/grant, no public
-- shadow, and no PostgREST grants.
DO $$
DECLARE
  missing text;
  rls_ok boolean;
  policy_count int;
  grant_count int;
  public_shadow int;
  postgrest_grant int;
BEGIN
  SELECT string_agg(t || '.' || c, ', ')
    INTO missing
  FROM (VALUES
    ('mastra_workflow_run_owners', 'runId'),
    ('mastra_workflow_run_owners', 'generation'),
    ('mastra_workflow_run_owners', 'ownerId'),
    ('mastra_workflow_run_owners', 'leaseExpiresAt'),
    ('mastra_workflow_run_owners', 'updatedAt'),
    ('mastra_memory_run_fences', 'runId'),
    ('mastra_memory_run_fences', 'generation'),
    ('mastra_memory_run_fences', 'ownerId'),
    ('mastra_memory_run_fences', 'retiredAt')
  ) AS required(t, c)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns col
    WHERE col.table_schema = 'mastra'
      AND col.table_name = required.t
      AND col.column_name = required.c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'IPI-1385 postflight: missing required columns: %', missing;
  END IF;

  SELECT bool_and(c.relrowsecurity)
    INTO rls_ok
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'mastra'
    AND c.relname IN ('mastra_workflow_run_owners', 'mastra_memory_run_fences');
  IF NOT COALESCE(rls_ok, false) THEN
    RAISE EXCEPTION 'IPI-1385 postflight: RLS not enabled on run-fencing tables';
  END IF;

  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'mastra'
    AND tablename IN ('mastra_workflow_run_owners', 'mastra_memory_run_fences')
    AND policyname = 'hyperdrive_mastra_runtime_all'
    AND 'hyperdrive_mastra_runtime' = ANY(roles);
  IF policy_count <> 2 THEN
    RAISE EXCEPTION 'IPI-1385 postflight: runtime policy missing on run-fencing tables';
  END IF;

  SELECT count(*) INTO grant_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'mastra'
    AND table_name IN ('mastra_workflow_run_owners', 'mastra_memory_run_fences')
    AND grantee = 'hyperdrive_mastra_runtime'
    AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE');
  IF grant_count <> 8 THEN
    RAISE EXCEPTION 'IPI-1385 postflight: expected 8 runtime DML grants, found %', grant_count;
  END IF;

  SELECT count(*) INTO public_shadow
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('mastra_workflow_run_owners', 'mastra_memory_run_fences');
  IF public_shadow <> 0 THEN
    RAISE EXCEPTION 'IPI-1385 postflight: public.mastra_* shadow must not exist';
  END IF;

  SELECT count(*) INTO postgrest_grant
  FROM information_schema.role_table_grants
  WHERE table_schema = 'mastra'
    AND table_name IN ('mastra_workflow_run_owners', 'mastra_memory_run_fences')
    AND grantee IN ('anon', 'authenticated', 'service_role');
  IF postgrest_grant <> 0 THEN
    RAISE EXCEPTION 'IPI-1385 postflight: PostgREST role gained grants on run-fencing tables';
  END IF;
END $$;
