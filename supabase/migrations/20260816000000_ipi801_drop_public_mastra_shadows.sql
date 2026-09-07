-- IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables
-- Phase B — DROP the 33 verified public.mastra_* shadow tables (forward-only).
--
-- ⛔ GATES — do NOT push this migration to the remote until ALL are green:
--   1. IPI-1011 soak: public.mastra_threads=16 / public.mastra_messages=35 /
--      public.mastra_workflow_snapshot=8 still flat on Day 1 (2026-08-17) and
--      Day 3 (2026-08-19) — zero new writes into public.* since the fail-closed
--      change shipped (PR #949). If any count moved, stop and investigate.
--   2. Recovery gate — Supabase Free plan: PITR is a paid feature and is NOT
--      available on nvdlhrodvevgwdsneplk (pitr_enabled=false). Required:
--        a. fresh manual logical backup taken immediately BEFORE this
--           migration is pushed, stored OUTSIDE Supabase:
--             pg_dump "$DATABASE_URL" -t 'public.mastra_*' \
--               --no-owner --no-privileges -Fc \
--               -f /path/outside/supabase/ipi801-shadow-backup.dump
--        b. backup verified readable: pg_restore -l <dumpfile> (exit 0)
--        c. restore runbook documented (see Rollback below)
--        d. explicit team sign-off on IPI-801 that this backup is the
--           rollback mechanism
--      (If the project is ever upgraded to a paid plan, PITR enabled also
--      satisfies this gate.)
--
-- Behavior: fail-closed, single guarded transaction. Refuses to run unless the
-- public.mastra_% catalog matches the verified 33-name allowlist exactly (same
-- list as 20260724173755), every allowlisted name is a plain base table, the
-- private mastra.* schema (threads/messages/workflow_snapshot) exists, and
-- soak row counts still match Day-0 (threads=16, messages=35,
-- workflow_snapshot=8; the other 30 shadows have zero rows). Counts are taken
-- under SHARE locks (bounded by lock_timeout=5s) so a writer cannot sneak in
-- before DROP. catalog_count = 0 is a TRUE no-op (fresh replay / already
-- dropped) — the DROP loop lives INSIDE this same guarded block, so the
-- zero-catalog RETURN cannot reach any destructive statement. Mastra
-- auto-init created these tables, not an earlier migration.
-- Drops ONLY the 33 allowlisted names — no LIKE loop, no CASCADE (a dependent
-- object aborts the migration instead of silently cascading). The private
-- mastra.* schema and all Mastra packages are untouched.
--
-- pgTAP 004 stays the Phase A lockdown (33 shadows exist) until this
-- migration is applied to the database CI actually tests (QA on PRs).
-- Do not invert 004 in this PR — that would fail supabase-verify-rls
-- without applying the DROP to QA.
--
-- Rollback (Free plan): restore the shadow tables from the manual backup.
-- NOTE: pg_restore -t does NOT support wildcards or schema-qualified names
-- (pg_dump -t does) — restore the FULL archive; it already contains only the
-- 33 shadow tables because the backup was taken with pg_dump -t 'public.mastra_*':
--   pg_restore -d "$DATABASE_URL" --no-owner --no-privileges \
--     /path/outside/supabase/ipi801-shadow-backup.dump
-- The 16/35/8 shadow rows are the only data destroyed.
--
-- Post-apply steps (separate, human-run, AFTER this migration is pushed
-- to the DB CI tests — QA first, then prod):
--   1. npm run supabase:types   (regenerate app/src/types/supabase.ts)
--   2. Invert pgTAP 004 to anti-recreation in a follow-up PR
--   3. npm run supabase:verify-rls

DO $$
DECLARE
  expected text[] := ARRAY[
    'mastra_agent_versions',
    'mastra_agents',
    'mastra_ai_spans',
    'mastra_background_tasks',
    'mastra_channel_config',
    'mastra_channel_installations',
    'mastra_dataset_items',
    'mastra_dataset_versions',
    'mastra_datasets',
    'mastra_experiment_results',
    'mastra_experiments',
    'mastra_favorites',
    'mastra_mcp_client_versions',
    'mastra_mcp_clients',
    'mastra_mcp_server_versions',
    'mastra_mcp_servers',
    'mastra_messages',
    'mastra_observational_memory',
    'mastra_prompt_block_versions',
    'mastra_prompt_blocks',
    'mastra_resources',
    'mastra_schedule_triggers',
    'mastra_schedules',
    'mastra_scorer_definition_versions',
    'mastra_scorer_definitions',
    'mastra_scorers',
    'mastra_skill_blobs',
    'mastra_skill_versions',
    'mastra_skills',
    'mastra_threads',
    'mastra_workflow_snapshot',
    'mastra_workspace_versions',
    'mastra_workspaces'
  ];
  extras text;
  non_plain text;
  catalog_count bigint;
  soak_name text;
  soak_n bigint;
  soak_dirty text;
  remaining bigint;
BEGIN
  IF array_length(expected, 1) IS DISTINCT FROM 33 THEN
    RAISE EXCEPTION
      'IPI-801 · Phase B: expected array must list exactly 33 tables (got %)',
      coalesce(array_length(expected, 1), 0);
  END IF;

  -- Sanity: the private mastra.* schema must exist before we drop public twins.
  IF to_regclass('mastra.mastra_threads') IS NULL
     OR to_regclass('mastra.mastra_messages') IS NULL
     OR to_regclass('mastra.mastra_workflow_snapshot') IS NULL THEN
    RAISE EXCEPTION
      'IPI-801 · Phase B: private mastra.mastra_threads/messages/workflow_snapshot missing — aborting';
  END IF;

  SELECT count(*)
  INTO catalog_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND c.relname LIKE 'mastra\_%' ESCAPE '\';

  IF catalog_count IS DISTINCT FROM 33 THEN
    -- Already clean (fresh DB built by replaying migrations, or re-applied):
    -- true no-op — the DROP loop below is inside this same guarded block, so
    -- this RETURN cannot reach any destructive statement. Any other count is
    -- drift and must abort.
    IF catalog_count = 0 THEN
      RAISE NOTICE 'IPI-801 · Phase B: zero public.mastra_* relations — nothing to drop';
      RETURN;
    END IF;
    RAISE EXCEPTION
      'IPI-801 · Phase B: expected exactly 33 public.mastra_* relations (got %) — refuse partial drop',
      catalog_count;
  END IF;

  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
  INTO extras
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND c.relname LIKE 'mastra\_%' ESCAPE '\'
    AND NOT (c.relname = ANY (expected));

  IF extras IS NOT NULL THEN
    RAISE EXCEPTION
      'IPI-801 · Phase B: unexpected public.mastra_* relation(s) not in allowlist: %',
      extras;
  END IF;

  -- Every allowlisted name must be a plain base table; a view/partition/foreign
  -- table would be schema drift and DROP TABLE cannot touch views anyway.
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
  INTO non_plain
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (expected)
    AND c.relkind IS DISTINCT FROM 'r';

  IF non_plain IS NOT NULL THEN
    RAISE EXCEPTION
      'IPI-801 · Phase B: allowlisted names are not plain base tables: %',
      non_plain;
  END IF;

  -- Soak row-count gate. SHARE blocks INSERT/UPDATE/DELETE; the lock is held
  -- until this migration transaction commits (Supabase default: one file =
  -- one transaction), so DROP below cannot race a new writer.
  -- Official Postgres SET LOCAL lock_timeout — same 5s as the IPI-784 cutover.
  SET LOCAL lock_timeout = '5s';

  LOCK TABLE
    public.mastra_agent_versions,
    public.mastra_agents,
    public.mastra_ai_spans,
    public.mastra_background_tasks,
    public.mastra_channel_config,
    public.mastra_channel_installations,
    public.mastra_dataset_items,
    public.mastra_dataset_versions,
    public.mastra_datasets,
    public.mastra_experiment_results,
    public.mastra_experiments,
    public.mastra_favorites,
    public.mastra_mcp_client_versions,
    public.mastra_mcp_clients,
    public.mastra_mcp_server_versions,
    public.mastra_mcp_servers,
    public.mastra_messages,
    public.mastra_observational_memory,
    public.mastra_prompt_block_versions,
    public.mastra_prompt_blocks,
    public.mastra_resources,
    public.mastra_schedule_triggers,
    public.mastra_schedules,
    public.mastra_scorer_definition_versions,
    public.mastra_scorer_definitions,
    public.mastra_scorers,
    public.mastra_skill_blobs,
    public.mastra_skill_versions,
    public.mastra_skills,
    public.mastra_threads,
    public.mastra_workflow_snapshot,
    public.mastra_workspace_versions,
    public.mastra_workspaces
    IN SHARE MODE;

  SELECT count(*) INTO soak_n FROM public.mastra_threads;
  IF soak_n IS DISTINCT FROM 16 THEN
    RAISE EXCEPTION
      'IPI-801 · Phase B: public.mastra_threads has % rows (soak expects 16) — aborting',
      soak_n;
  END IF;

  SELECT count(*) INTO soak_n FROM public.mastra_messages;
  IF soak_n IS DISTINCT FROM 35 THEN
    RAISE EXCEPTION
      'IPI-801 · Phase B: public.mastra_messages has % rows (soak expects 35) — aborting',
      soak_n;
  END IF;

  SELECT count(*) INTO soak_n FROM public.mastra_workflow_snapshot;
  IF soak_n IS DISTINCT FROM 8 THEN
    RAISE EXCEPTION
      'IPI-801 · Phase B: public.mastra_workflow_snapshot has % rows (soak expects 8) — aborting',
      soak_n;
  END IF;

  soak_dirty := NULL;
  FOREACH soak_name IN ARRAY expected LOOP
    IF soak_name IN (
      'mastra_threads',
      'mastra_messages',
      'mastra_workflow_snapshot'
    ) THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I', soak_name) INTO soak_n;
    IF soak_n IS DISTINCT FROM 0 THEN
      soak_dirty := concat_ws(', ', soak_dirty, format('%s=%s', soak_name, soak_n));
    END IF;
  END LOOP;

  IF soak_dirty IS NOT NULL THEN
    RAISE EXCEPTION
      'IPI-801 · Phase B: other public.mastra_* shadows are not empty: % — aborting',
      soak_dirty;
  END IF;

  -- DROP the exact 33 allowlisted tables INSIDE the guarded flow — no LIKE
  -- loop, no CASCADE (a dependent object aborts the transaction instead of
  -- silently cascading). The zero-catalog RETURN above cannot reach here.
  FOREACH soak_name IN ARRAY expected LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I', soak_name);
  END LOOP;

  -- Postflight: zero public.mastra_% relations remain; private mastra.* intact.
  SELECT count(*)
  INTO remaining
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND c.relname LIKE 'mastra\_%' ESCAPE '\';

  IF remaining <> 0 THEN
    RAISE EXCEPTION
      'IPI-801 · Phase B postflight: % public.mastra_* relations remain',
      remaining;
  END IF;

  IF to_regclass('mastra.mastra_threads') IS NULL
     OR to_regclass('mastra.mastra_messages') IS NULL
     OR to_regclass('mastra.mastra_workflow_snapshot') IS NULL THEN
    RAISE EXCEPTION
      'IPI-801 · Phase B postflight: private mastra.* tables missing after drop';
  END IF;
END $$;