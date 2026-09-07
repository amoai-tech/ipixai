-- =============================================================================
-- migration: ipi1008_mastra_workflow_definitions
-- purpose: create mastra.mastra_workflow_definitions so mastra dev / Studio
--          startWorkers → #loadDynamicWorkflows → WorkflowDefinitionsPG.list
--          no longer 42P01s. Operator CopilotKit does not use this table
--          (Shoot Wizard is code-registered).
-- affected: mastra.mastra_workflow_definitions (new)
-- task: IPI-1008 · MASTRA-UPG-003
-- date: 2026-08-22
--
-- Source of truth (installed, not website docs):
--   @mastra/pg@1.20.0 WorkflowDefinitionsPG.getExportDDL('mastra')
--   @mastra/core@1.59.0 TABLE_SCHEMAS['mastra_workflow_definitions']
--   Default index: WorkflowDefinitionsPG.getDefaultIndexDefinitions()
--     → mastra_idx_workflow_definitions_status on ("status")
--
-- createdAtZ / updatedAtZ are companions emitted by getExportDDL, matching
-- IPI-628 / IPI-796. No FKs. No timestamp triggers (adapter writes timestamps).
--
-- Security: same private-schema contract as IPI-629 / IPI-796 —
-- revoke PostgREST roles, DML only to hyperdrive_mastra_runtime,
-- ENABLE RLS + hyperdrive_mastra_runtime_all USING true / WITH CHECK true.
--
-- Keep disableInit: true. This migration is the only DDL path.
-- Do not create public.mastra_*.
--
-- Rollback (manual, not applied here):
--   DROP POLICY IF EXISTS hyperdrive_mastra_runtime_all ON mastra.mastra_workflow_definitions;
--   DROP INDEX IF EXISTS mastra.mastra_idx_workflow_definitions_status;
--   DROP TABLE IF EXISTS mastra.mastra_workflow_definitions;
-- =============================================================================

CREATE TABLE IF NOT EXISTS "mastra"."mastra_workflow_definitions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "description" TEXT,
  "metadata" JSONB,
  "inputSchema" JSONB NOT NULL,
  "outputSchema" JSONB NOT NULL,
  "stateSchema" JSONB,
  "requestContextSchema" JSONB,
  "graph" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "authorId" TEXT,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mastra_idx_workflow_definitions_status
  ON mastra.mastra_workflow_definitions ("status");

COMMENT ON TABLE mastra.mastra_workflow_definitions IS
  'Mastra Studio / dynamic workflow definitions. IPI-1008. Not used by code-registered Shoot Wizard.';

REVOKE ALL ON TABLE mastra.mastra_workflow_definitions FROM PUBLIC;
REVOKE ALL ON TABLE mastra.mastra_workflow_definitions FROM anon;
REVOKE ALL ON TABLE mastra.mastra_workflow_definitions FROM authenticated;
REVOKE ALL ON TABLE mastra.mastra_workflow_definitions FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE mastra.mastra_workflow_definitions
  TO hyperdrive_mastra_runtime;

ALTER TABLE mastra.mastra_workflow_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hyperdrive_mastra_runtime_all ON mastra.mastra_workflow_definitions;
CREATE POLICY hyperdrive_mastra_runtime_all ON mastra.mastra_workflow_definitions
  FOR ALL
  TO hyperdrive_mastra_runtime
  USING (true)
  WITH CHECK (true);

-- Fail-closed postflight
DO $$
DECLARE
  n int;
  has_rls boolean;
  has_policy boolean;
  pk_ok boolean;
  idx_ok boolean;
  public_shadow int;
  dml_ok int;
  postgrest_grant int;
BEGIN
  SELECT count(*) INTO n
  FROM information_schema.tables
  WHERE table_schema = 'mastra' AND table_name = 'mastra_workflow_definitions';
  IF n <> 1 THEN
    RAISE EXCEPTION 'IPI-1008 postflight: mastra.mastra_workflow_definitions missing';
  END IF;

  SELECT count(*) INTO public_shadow
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'mastra_workflow_definitions';
  IF public_shadow <> 0 THEN
    RAISE EXCEPTION 'IPI-1008 postflight: public.mastra_workflow_definitions must not exist';
  END IF;

  SELECT c.relrowsecurity INTO has_rls
  FROM pg_class c
  JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
  WHERE nsp.nspname = 'mastra' AND c.relname = 'mastra_workflow_definitions';
  IF NOT COALESCE(has_rls, false) THEN
    RAISE EXCEPTION 'IPI-1008 postflight: RLS not enabled';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'mastra'
      AND tablename = 'mastra_workflow_definitions'
      AND policyname = 'hyperdrive_mastra_runtime_all'
  ) INTO has_policy;
  IF NOT has_policy THEN
    RAISE EXCEPTION 'IPI-1008 postflight: missing hyperdrive_mastra_runtime_all';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
    WHERE nsp.nspname = 'mastra'
      AND c.relname = 'mastra_workflow_definitions'
      AND con.contype = 'p'
  ) INTO pk_ok;
  IF NOT pk_ok THEN
    RAISE EXCEPTION 'IPI-1008 postflight: missing primary key';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'mastra'
      AND tablename = 'mastra_workflow_definitions'
      AND indexname = 'mastra_idx_workflow_definitions_status'
  ) INTO idx_ok;
  IF NOT idx_ok THEN
    RAISE EXCEPTION 'IPI-1008 postflight: missing mastra_idx_workflow_definitions_status';
  END IF;

  SELECT count(*) INTO dml_ok
  FROM information_schema.role_table_grants
  WHERE table_schema = 'mastra'
    AND table_name = 'mastra_workflow_definitions'
    AND grantee = 'hyperdrive_mastra_runtime'
    AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE');
  IF dml_ok < 4 THEN
    RAISE EXCEPTION 'IPI-1008 postflight: incomplete hyperdrive_mastra_runtime DML grants';
  END IF;

  SELECT count(*) INTO postgrest_grant
  FROM information_schema.role_table_grants
  WHERE table_schema = 'mastra'
    AND table_name = 'mastra_workflow_definitions'
    AND grantee IN ('anon', 'authenticated', 'service_role');
  IF postgrest_grant <> 0 THEN
    RAISE EXCEPTION 'IPI-1008 postflight: PostgREST role has grants on mastra_workflow_definitions';
  END IF;
END $$;
