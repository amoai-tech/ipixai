-- IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables
-- Phase A (lockdown, not drop): fail-closed PostgREST exposure on shadow tables.
--
-- Context: after mastra.* cutover (IPI-792) + platform tables (IPI-796), production
-- writes only to the private mastra schema. Recreated public.mastra_* shadows still
-- carried full grants to anon / authenticated / service_role; many also had RLS off
-- (Dashboard "UNRESTRICTED"). IPI-227's earlier hardening did not stick for tables
-- recreated later by Mastra auto-init.
--
-- This migration:
--   * REVOKE ALL from PUBLIC, anon, authenticated, service_role
--   * ENABLE ROW LEVEL SECURITY
--   * creates NO policies (default-deny for non-bypass roles)
--   * does NOT DROP tables or mutate rows (rollback = restore grants / disable RLS)
--   * does NOT touch mastra.* or unrelated public tables
--
-- Phase B (DROP + supabase gen types) stays blocked until soak + backup/PITR.

DO $$
DECLARE
  -- Explicit inventory from live project nvdlhrodvevgwdsneplk (2026-07-24) — 33 tables.
  -- Fail if any listed table is missing; do not LIKE-loop (avoids unrelated public tables).
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
  t text;
  pol record;
  deny_roles text[] := ARRAY['anon', 'authenticated', 'service_role'];
  r text;
  priv text;
  check_privs text[] := ARRAY[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ];
  bad text;
  public_priv text;
  policy_count bigint;
  rowsecurity boolean;
  present_count int;
BEGIN
  IF array_length(expected, 1) IS DISTINCT FROM 33 THEN
    RAISE EXCEPTION
      'IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables: expected array must list exactly 33 tables (got %)',
      coalesce(array_length(expected, 1), 0);
  END IF;

  -- IPI-1162 · SB-MIG-003 fresh-replay adaptation: these 33 are Mastra's own
  -- non-migration auto-init tables (see 20260722150000's header). A fresh
  -- database genuinely has zero of them — that is not the "partial lock"
  -- failure this migration exists to catch.
  SELECT count(*) INTO present_count
  FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY (expected);

  IF present_count = 0 THEN
    RAISE NOTICE 'IPI-801: zero public.mastra_* shadow tables present — fresh replay, nothing to lock down';
    RETURN;
  END IF;

  FOREACH t IN ARRAY expected LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION
        'IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables: missing public.% (refusing partial lock)',
        t;
    END IF;

    -- Preserve rows: metadata/grants only.
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
    FOREACH r IN ARRAY deny_roles LOOP
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', t, r);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- No browser-facing policies — drop any that drifted onto shadows.
    FOR pol IN
      SELECT p.policyname AS policyname
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = t
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        pol.policyname,
        t
      );
    END LOOP;
  END LOOP;

  -- Fail-closed postflight: RLS on, zero policies, zero effective access for deny roles + PUBLIC.
  FOREACH t IN ARRAY expected LOOP
    SELECT c.relrowsecurity
    INTO rowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = t;

    IF NOT coalesce(rowsecurity, false) THEN
      RAISE EXCEPTION
        'IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables: RLS not enabled on public.%',
        t;
    END IF;

    SELECT count(*)
    INTO policy_count
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = t;

    IF policy_count <> 0 THEN
      RAISE EXCEPTION
        'IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables: public.% still has % policies',
        t, policy_count;
    END IF;

    bad := NULL;
    FOREACH r IN ARRAY deny_roles LOOP
      FOREACH priv IN ARRAY check_privs LOOP
        IF has_table_privilege(r, format('public.%I', t), priv) THEN
          bad := coalesce(bad || ', ', '') || r || ':' || priv;
        END IF;
      END LOOP;
    END LOOP;

    IF bad IS NOT NULL THEN
      RAISE EXCEPTION
        'IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables: unexpected grants on public.%: %',
        t, bad;
    END IF;

    -- Match IPI-796 privilege assert: only explode stored relacl (NULL = owner-only).
    SELECT string_agg(acl.privilege_type, ', ' ORDER BY acl.privilege_type)
    INTO public_priv
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) AS acl
    WHERE n.nspname = 'public'
      AND c.relname = t
      AND c.relacl IS NOT NULL
      AND acl.grantee = 0;

    IF public_priv IS NOT NULL THEN
      RAISE EXCEPTION
        'IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables: PUBLIC privileges on public.%: %',
        t, public_priv;
    END IF;
  END LOOP;
END $$;
