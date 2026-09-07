-- IPI-629 · MASTRA-SUPABASE-003 — Mastra runtime grants and RLS security.
--
-- Grants minimal DML + enables RLS with a role-scoped policy for
-- hyperdrive_mastra_runtime on the 24 tables IPI-628 · MASTRA-SUPABASE-002 —
-- Version-Pinned Mastra Schema Migration created in the private "mastra"
-- schema. Denies anon/authenticated entirely.
--
-- Per IPI-616 · CF-DB-001 — Mastra Storage and Schema ADR's ADR
-- (tasks/mastra/ipi-616-storage-schema-adr.md, Decision 4):
-- hyperdrive_mastra_runtime carries no Supabase JWT, so auth.uid() is
-- unavailable to it. The policy below scopes by ROLE membership only — it
-- answers "can this role touch the table at all" (yes, because it's the one
-- and only Mastra runtime role), not "which iPix organization owns this row."
-- That second question is enforced at the application layer via
-- resourceId/threadId, verified separately by IPI-621 · CF-DB-007 — Tenant
-- Authorization and RLS Tests. Seven tables in this schema (mastra_ai_spans,
-- mastra_scorers, mastra_scorer_definitions, mastra_datasets,
-- mastra_dataset_items, mastra_experiments, mastra_experiment_results) do
-- carry an organizationId column already — see the DRIFT WARNING below for
-- why the blanket policy is still correct today despite that.
--
-- Follows the same table-discovery pattern as the prior public.mastra_*
-- hardening (supabase/migrations/20260628173206_mastra_rls_hardening.sql,
-- IPI-227 · FIX — Mastra public.mastra_* RLS Hardening) — loop over live
-- tables rather than a hardcoded list, so this migration doesn't silently
-- skip a table if the schema drifts.
--
-- Does not touch the existing public.mastra_* tables or their pre-existing
-- partial grants (found live during the IPI-616 audit) — that's a separate
-- cutover concern once the app is fully wired to the new schema (IPI-630 ·
-- MASTRA-SUPABASE-004 — PostgresStore Initialization Control).
--
-- Ordering dependency: this migration assumes the "mastra" schema and the
-- hyperdrive_mastra_runtime role already exist. The schema comes from
-- IPI-628 (supabase/migrations/20260722093028_mastra_schema_pinned_1_12_0.sql)
-- — that migration must apply first. The role is NOT created by any
-- migration in this repo; it was provisioned directly against the database
-- by IPI-617 · CF-DB-003 — Create Least-Privilege Mastra Hyperdrive Role
-- (predates this chain) and is already live. Applying this file alone
-- against a database that has never run IPI-628's migration will fail at
-- the GRANT USAGE line below with "schema mastra does not exist".
--
-- DRIFT WARNING for future maintainers: the CREATE POLICY below intentionally
-- grants hyperdrive_mastra_runtime unrestricted USING(true)/WITH CHECK(true)
-- access. This is intentional for now, not an oversight: hyperdrive_mastra_
-- runtime is a single trusted service role with no PostgREST exposure, and
-- Mastra doesn't currently populate organizationId on writes (grep
-- app/src/mastra/ — zero matches). But the column already exists on 7 tables
-- today (mastra_ai_spans and 6 others, listed above) — this is not a
-- hypothetical future risk. A future runtime role, a second consumer of
-- this schema, or any PostgREST exposure path must NOT inherit this blanket
-- policy without revisiting it first — re-check this policy loop before
-- widening access beyond hyperdrive_mastra_runtime.

GRANT USAGE ON SCHEMA mastra TO hyperdrive_mastra_runtime;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'mastra'
      AND tablename LIKE 'mastra\_%'
    ORDER BY tablename
  LOOP
    -- Deny PostgREST roles outright — belt-and-suspenders alongside the
    -- schema not being in config.toml's exposed `schemas` list.
    EXECUTE format('REVOKE ALL ON TABLE mastra.%I FROM anon', r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE mastra.%I FROM authenticated', r.tablename);

    -- Minimal DML for the Mastra runtime role — no DDL, no ownership.
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE mastra.%I TO hyperdrive_mastra_runtime',
      r.tablename
    );

    EXECUTE format('ALTER TABLE mastra.%I ENABLE ROW LEVEL SECURITY', r.tablename);

    -- Idempotent: recovery / mid-flight re-run must not fail on "policy already exists".
    -- Matches repo pattern (DROP POLICY IF EXISTS before CREATE POLICY).
    EXECUTE format(
      'DROP POLICY IF EXISTS hyperdrive_mastra_runtime_all ON mastra.%I',
      r.tablename
    );
    EXECUTE format(
      'CREATE POLICY hyperdrive_mastra_runtime_all ON mastra.%I
         FOR ALL
         TO hyperdrive_mastra_runtime
         USING (true)
         WITH CHECK (true)',
      r.tablename
    );
  END LOOP;
END $$;
