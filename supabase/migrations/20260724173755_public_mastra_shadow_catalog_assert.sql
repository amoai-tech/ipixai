-- IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables
-- Phase A follow-up — SSOT catalog fail-closed for unexpected public.mastra_* (forward-only).
--
-- Catalog drift gate lives ONLY here (not in already-applied 20260724102922).
-- 20260724102922 + 20260724103700 already applied on nvdlhrodvevgwdsneplk —
-- do not rewrite their live effect. Privilege assert (103700) covers the listed
-- 33 tables; this migration fails if any additional public.mastra_% table/view
-- appears outside that allowlist (Mastra auto-init can recreate new shadows).
--
-- Recurring CI check: supabase/tests/database/004_public_mastra_shadow_lockdown.sql
-- (allowlist + catalog extras). Lockdown itself is fail-closed (zero policies).

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
  catalog_count bigint;
BEGIN
  IF array_length(expected, 1) IS DISTINCT FROM 33 THEN
    RAISE EXCEPTION
      'IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables: expected array must list exactly 33 tables (got %)',
      coalesce(array_length(expected, 1), 0);
  END IF;

  SELECT count(*)
  INTO catalog_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND c.relname LIKE 'mastra\_%' ESCAPE '\';

  IF catalog_count IS DISTINCT FROM 33 THEN
    -- IPI-1162 · SB-MIG-003 fresh-replay adaptation: zero is the other
    -- legitimate state (Mastra's non-migration auto-init tables genuinely
    -- absent on a fresh database) — anything else stays a hard failure.
    IF catalog_count = 0 THEN
      RAISE NOTICE 'IPI-801 catalog assert: zero public.mastra_* relations — fresh replay, nothing to assert';
      RETURN;
    END IF;
    RAISE EXCEPTION
      'IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables: expected exactly 33 public.mastra_* relations (got %)',
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
      'IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables: unexpected public.mastra_* relation(s) not in allowlist: %',
      extras;
  END IF;
END $$;
