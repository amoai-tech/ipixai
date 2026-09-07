-- IPI-875 · MASTRA-PG-013 — Re-revoke anon/authenticated SELECT on public.mastra_* shadows
--
-- After IPI-801 · MASTRA-PG-011 — Remove Leftover public.mastra_* Tables After Soak
-- (Phase A lockdown, migration 20260724102922 / PR #628 — Lock public.mastra_*
-- shadows from PostgREST), deny-role ACLs drifted:
-- anon + authenticated regained SELECT on all 33 public.mastra_* shadows.
-- pgTAP 004_public_mastra_shadow_lockdown.sql fails tests 103–135.
--
-- Idempotent re-lock only (no DROP — Phase B stays on
-- IPI-801 · MASTRA-PG-011 — Remove Leftover public.mastra_* Tables After Soak):
--   * REVOKE ALL from PUBLIC, anon, authenticated, service_role
--   * ENABLE RLS, drop any browser policies
--   * postflight: zero effective privileges for deny roles + PUBLIC
--     (has_table_privilege incl. MAINTAIN + aclexplode deny-role scan)
-- Does not touch mastra.* or app PostgresStore wiring.
--
-- Rollback: privilege-only, no data change. Prefer re-running this DO block
-- (idempotent). Intentional undo would re-GRANT SELECT on public.mastra_* to
-- anon/authenticated — avoid; that reopens Data API read. Root-cause of
-- re-drift is tracked separately as IPI-876 · MASTRA-PG-014 — Stop
-- public.mastra_* grant re-drift after lockdown.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

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
  t text;
  pol record;
  deny_roles text[] := ARRAY['anon', 'authenticated', 'service_role'];
  r text;
  priv text;
  -- Full has_table_privilege vocabulary (PG17+ includes MAINTAIN) + grant options.
  -- Mirrors 20260724103700_public_mastra_shadow_privilege_assert.sql.
  check_privs text[] := ARRAY[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN',
    'SELECT WITH GRANT OPTION',
    'INSERT WITH GRANT OPTION',
    'UPDATE WITH GRANT OPTION',
    'DELETE WITH GRANT OPTION',
    'TRUNCATE WITH GRANT OPTION',
    'REFERENCES WITH GRANT OPTION',
    'TRIGGER WITH GRANT OPTION',
    'MAINTAIN WITH GRANT OPTION'
  ];
  bad text;
  public_priv text;
  deny_acl text;
  policy_count bigint;
  rowsecurity boolean;
  present_count int;
BEGIN
  IF array_length(expected, 1) IS DISTINCT FROM 33 THEN
    RAISE EXCEPTION
      'IPI-875 · MASTRA-PG-013: expected array must list exactly 33 tables (got %)',
      coalesce(array_length(expected, 1), 0);
  END IF;

  -- IPI-1162 · SB-MIG-003 fresh-replay adaptation: same reasoning as
  -- 20260724102922 — these 33 are Mastra's own non-migration auto-init
  -- tables, genuinely absent on a fresh database (nothing drifted to
  -- re-revoke because nothing exists yet).
  SELECT count(*) INTO present_count
  FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY (expected);

  IF present_count = 0 THEN
    RAISE NOTICE 'IPI-875: zero public.mastra_* shadow tables present — fresh replay, nothing to re-revoke';
    RETURN;
  END IF;

  FOREACH t IN ARRAY expected LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION
        'IPI-875 · MASTRA-PG-013: missing public.% (refusing partial re-revoke)',
        t;
    END IF;

    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
    FOREACH r IN ARRAY deny_roles LOOP
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', t, r);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

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

  FOREACH t IN ARRAY expected LOOP
    SELECT c.relrowsecurity
    INTO rowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = t;

    IF NOT coalesce(rowsecurity, false) THEN
      RAISE EXCEPTION
        'IPI-875 · MASTRA-PG-013: RLS not enabled on public.%',
        t;
    END IF;

    SELECT count(*)
    INTO policy_count
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = t;

    IF policy_count <> 0 THEN
      RAISE EXCEPTION
        'IPI-875 · MASTRA-PG-013: public.% still has % policies',
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
        'IPI-875 · MASTRA-PG-013: unexpected grants on public.%: %',
        t, bad;
    END IF;

    -- ACL-level fail-closed: any privilege_type / is_grantable for deny roles.
    SELECT string_agg(
             format('%s:%s%s', gr.rolname, acl.privilege_type,
                    CASE WHEN acl.is_grantable THEN '(grantable)' ELSE '' END),
             ', ' ORDER BY gr.rolname, acl.privilege_type
           )
    INTO deny_acl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) AS acl
    JOIN pg_roles gr ON gr.oid = acl.grantee
    WHERE n.nspname = 'public'
      AND c.relname = t
      AND c.relacl IS NOT NULL
      AND gr.rolname = ANY (deny_roles);

    IF deny_acl IS NOT NULL THEN
      RAISE EXCEPTION
        'IPI-875 · MASTRA-PG-013: deny-role ACL on public.%: %',
        t, deny_acl;
    END IF;

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
        'IPI-875 · MASTRA-PG-013: PUBLIC privileges on public.%: %',
        t, public_priv;
    END IF;
  END LOOP;
END $$;

RESET lock_timeout;
RESET statement_timeout;
