-- IPI-784 · MASTRA-PG-008 — Preserve existing Mastra data during public → mastra
-- schema cutover.
--
-- PR #601 (IPI-628) created 24 empty tables in the private "mastra" schema via
-- CREATE TABLE IF NOT EXISTS — a structural copy, not a data move. Live-verified
-- 2026-07-22: all 24 mastra.* tables have 0 rows, while their public.mastra_*
-- counterparts hold real accumulated data (workflow runs, chat threads/messages,
-- schedules). PR #604 (IPI-630) flips the app to schemaName:"mastra" but its own
-- description says it does NOT delete/move public.mastra_* — nothing else in the
-- chain does either. This migration is that missing step.
--
-- Mechanism: ALTER TABLE ... SET SCHEMA — the standard, official Postgres way to
-- move a table between schemas since Postgres 8.1 (postgresql.org/docs/current/
-- sql-alterschema.html). Catalog-only: no data copy regardless of row count, and
-- it carries existing rows/indexes/constraints/RLS policies with it automatically
-- since it's the same table object (same OID), just reassigned to a different
-- schema. NOT zero-downtime, though: per Postgres's own docs, an ACCESS EXCLUSIVE
-- lock is taken unless a subcommand explicitly documents a weaker one, and SET
-- SCHEMA has no such exception. lock_timeout below turns "blocks briefly" into
-- "fails loudly and safely" if anything is unexpectedly holding a lock.
--
-- *** CRITICAL: only 18 of the 24 original mastra-schema tables are moved here ***
-- Live column-diff (information_schema.columns, both schemas) found 6 tables
-- where the mastra-schema copy already has organizationId/projectId/candidateId/
-- candidateKey/toolMocks/toolMockReport/batchId/datasetId/datasetItemId/externalId
-- columns that public.mastra_* does NOT have at all: mastra_datasets,
-- mastra_dataset_items, mastra_experiments, mastra_experiment_results,
-- mastra_scorer_definitions, mastra_scorers. Moving public's simpler version over
-- these would silently DROP those columns. All 6 are confirmed 0 rows in public
-- (live-verified) — there is no data to lose by leaving them alone, so this
-- migration does not touch them at all; PR #601's richer, already-correct empty
-- copies stay exactly as they are. (mastra_ai_spans has the same organizationId
-- column on BOTH sides already — no divergence there, it IS moved below.)
--
-- *** CRITICAL TIMING CONSTRAINT ***
-- Apply this migration in the SAME deploy window as PR #604 (IPI-630)'s code
-- change — not standalone, not days earlier. Between this migration applying and
-- PR #604's code going live, the running app (still pointed at "public" schema
-- in that gap) would be writing to a schema whose tables just disappeared out
-- from under it. Coordinate the migration apply and the app deploy as one
-- release: pause Mastra-writing traffic (schedulers, background tasks, Next.js/
-- Mastra Studio dev pools) for the duration, run this migration, flip the app's
-- schemaName, resume traffic, then smoke-test.
--
-- Rollback: ALTER TABLE mastra.<x> SET SCHEMA public for the 18 tables moved
-- below reverses this cleanly (same table object, no data loss) — see
-- tasks/mastra/audit/ipi-784-rollback.sql for the ready-to-run reverse script.
--
-- Excludes the 9 tables IPI-628 already excluded from the mastra schema
-- (mastra_mcp_clients/_versions, mastra_mcp_servers/_versions, mastra_skills/
-- _blobs/_versions, mastra_workspaces/_versions) — those stay in public,
-- unused by iPix's production agents, per IPI-628's original rationale.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ============================================================================
-- IPI-1162 · SB-MIG-003 fresh-replay adaptation (added, original Steps 1-3
-- below untouched in content and behavior when the 18 public.mastra_* source
-- tables are present — i.e. production replays exactly as before).
--
-- public.mastra_* here is Mastra's own PostgresStore auto-init output
-- (CREATE TABLE IF NOT EXISTS on app boot), never a migration — so a fresh
-- database (new clone, CI, local reset) genuinely has zero of these 18
-- tables and nothing to preserve. The original pre-flight's own fail-closed
-- design (Step 1a) would otherwise abort a fresh replay for the wrong
-- reason: "source missing" reads identically whether data was lost or never
-- existed. This block tells the two apart before Step 1 runs, then leaves
-- Steps 1-3's actual logic as dynamic EXECUTE of the same statements,
-- unchanged, only made conditionally skippable:
--   * 18 of 18 present  -> run original pre-flight + drop + move, verbatim
--   * 0 of 18 present   -> fresh replay: verify mastra.* already has the
--                          correct IPI-628 destination tables, skip the move
--                          (nothing to move), fall through to Step 4 grants
--   * otherwise (1-17)  -> genuine partial/corrupt state, fail closed same
--                          as the original design intended
-- ============================================================================
DO $$
DECLARE
  moved_tables text[] := ARRAY[
    'mastra_agent_versions','mastra_agents','mastra_ai_spans','mastra_background_tasks',
    'mastra_channel_config','mastra_channel_installations','mastra_dataset_versions',
    'mastra_favorites','mastra_messages','mastra_observational_memory',
    'mastra_prompt_block_versions','mastra_prompt_blocks','mastra_resources',
    'mastra_schedule_triggers','mastra_schedules','mastra_scorer_definition_versions',
    'mastra_threads','mastra_workflow_snapshot'
  ];
  present_count int;
  destination_count int;
  r text;
  unexpected_count bigint;
BEGIN
  SELECT count(*) INTO present_count
  FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY (moved_tables);

  IF present_count = 0 THEN
    -- Verify the full 18-table destination inventory, not just one table —
    -- a database with 1 of 18 mastra.* destinations (a damaged/partial
    -- IPI-628 apply) must fail closed here, not silently pass this guard
    -- and then have Step 4's grant loop process whatever subset exists.
    SELECT count(*) INTO destination_count
    FROM pg_tables WHERE schemaname = 'mastra' AND tablename = ANY (moved_tables);
    IF destination_count <> 18 THEN
      RAISE EXCEPTION
        'IPI-784 fresh-replay check failed: expected all 18 mastra.* destination tables, found % — IPI-628 (20260722093028) must apply cleanly first',
        destination_count;
    END IF;
    RAISE NOTICE 'IPI-784: zero public.mastra_* source tables present — fresh replay, nothing to cut over, skipping Steps 1-3';
  ELSIF present_count <> 18 THEN
    RAISE EXCEPTION
      'IPI-784 pre-flight failed: partial source set (% of 18 public.mastra_* tables present) — aborting, refusing to proceed with an incomplete source set',
      present_count;
  ELSE
    -- ------------------------------------------------------------------------
    -- Step 1 (original, unchanged logic): fail closed if a source table is
    -- missing (can't happen here, present_count=18 already confirms it) or if
    -- any mastra.* destination table unexpectedly has rows.
    -- ------------------------------------------------------------------------
    FOREACH r IN ARRAY moved_tables LOOP
      IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'mastra' AND tablename = r) THEN
        EXECUTE format('LOCK TABLE mastra.%I IN ACCESS EXCLUSIVE MODE', r);
        EXECUTE format('SELECT count(*) FROM mastra.%I', r) INTO unexpected_count;
        IF unexpected_count > 0 THEN
          RAISE EXCEPTION
            'IPI-784 pre-flight failed: mastra.% has % row(s), expected 0. '
            'Aborting — refusing to DROP a table that already has data. '
            'Investigate before re-running this migration.',
            r, unexpected_count;
        END IF;
      END IF;
    END LOOP;

    -- ------------------------------------------------------------------------
    -- Step 2 (original, unchanged logic): drop the empty mastra-schema
    -- placeholders created by IPI-628. RESTRICT — fail loudly rather than
    -- silently cascade.
    -- ------------------------------------------------------------------------
    FOREACH r IN ARRAY moved_tables LOOP
      EXECUTE format('DROP TABLE IF EXISTS mastra.%I RESTRICT', r);
    END LOOP;

    -- NOT dropped/moved (structural mismatch — see header): mastra_datasets,
    -- mastra_dataset_items, mastra_experiments, mastra_experiment_results,
    -- mastra_scorer_definitions, mastra_scorers. PR #601's empty copies for
    -- these 6 stay exactly as they are.

    -- ------------------------------------------------------------------------
    -- Step 3 (original, unchanged logic): move the real, data-bearing public
    -- tables into mastra. Catalog-only — carries rows/indexes/constraints/RLS.
    -- ------------------------------------------------------------------------
    FOREACH r IN ARRAY moved_tables LOOP
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA mastra', r);
    END LOOP;
  END IF;
END $$;

-- ============================================================================
-- Step 4: Re-apply PR #602 (IPI-629)'s grant/RLS/policy treatment to the moved
-- tables ONLY, PLUS explicitly strip the legacy public-schema grants
-- (service_role, PUBLIC) that rode along with the move. This loop's
-- anon/authenticated/grant/RLS/policy logic is copied from supabase/
-- migrations/20260722094055_mastra_runtime_grants_and_rls.sql, but scoped to
-- the same explicit 18-table array used in step 1's pre-flight — NOT a broad
-- `LIKE 'mastra\_%'` scan. The 6 structurally-divergent tables excluded above
-- (mastra_datasets, mastra_dataset_items, mastra_experiments,
-- mastra_experiment_results, mastra_scorer_definitions, mastra_scorers)
-- already exist in the mastra schema and already got PR #602's grant/RLS
-- treatment when that migration applied — this step must not touch them
-- again, so it can't silently override a future, deliberately different
-- access decision on those 6 without anyone noticing.
--
-- The moved tables already have RLS enabled (carried over from public.mastra_*
-- per IPI-227's earlier hardening) — ENABLE ROW LEVEL SECURITY is a safe no-op.
-- CREATE POLICY is a clean create: the original public tables never had a
-- hyperdrive_mastra_runtime-scoped policy, so there's no naming collision.
-- ============================================================================
GRANT USAGE ON SCHEMA mastra TO hyperdrive_mastra_runtime;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'mastra'
      AND tablename = ANY (ARRAY[
        'mastra_agent_versions','mastra_agents','mastra_ai_spans','mastra_background_tasks',
        'mastra_channel_config','mastra_channel_installations','mastra_dataset_versions',
        'mastra_favorites','mastra_messages','mastra_observational_memory',
        'mastra_prompt_block_versions','mastra_prompt_blocks','mastra_resources',
        'mastra_schedule_triggers','mastra_schedules','mastra_scorer_definition_versions',
        'mastra_threads','mastra_workflow_snapshot'
      ])
    ORDER BY tablename
  LOOP
    -- Strip every non-owner grant this table may carry (legacy public grants,
    -- including service_role — confirmed live on the moved tables today — and
    -- PUBLIC), then re-grant only what the mastra schema's design intends.
    EXECUTE format('REVOKE ALL ON TABLE mastra.%I FROM anon', r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE mastra.%I FROM authenticated', r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE mastra.%I FROM service_role', r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE mastra.%I FROM PUBLIC', r.tablename);

    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE mastra.%I TO hyperdrive_mastra_runtime',
      r.tablename
    );

    EXECUTE format('ALTER TABLE mastra.%I ENABLE ROW LEVEL SECURITY', r.tablename);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'mastra' AND tablename = r.tablename
        AND policyname = 'hyperdrive_mastra_runtime_all'
    ) THEN
      EXECUTE format(
        'CREATE POLICY hyperdrive_mastra_runtime_all ON mastra.%I
           FOR ALL
           TO hyperdrive_mastra_runtime
           USING (true)
           WITH CHECK (true)',
        r.tablename
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
