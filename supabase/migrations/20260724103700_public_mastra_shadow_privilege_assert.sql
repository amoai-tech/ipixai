-- IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables
-- Phase A follow-up — fail-closed privilege postflight (forward-only).
--
-- 20260724102922 already applied on nvdlhrodvevgwdsneplk — do not rewrite it.
-- Review feedback: has_table_privilege list omitted MAINTAIN + WITH GRANT OPTION
-- variants. There is no PostgreSQL table privilege named CHECK (docs:
-- SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN).
--
-- Explicitly NOT using DROP OWNED BY anon|authenticated|service_role:
-- that drops *all* objects those roles own in the database (Supabase system
-- objects included). Live inventory 2026-07-24: every public.mastra_* relation
-- is owned by postgres (81 objects); deny roles own zero shadow objects.
-- Isolation is grants + RLS, not ownership transfer.

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
  deny_roles text[] := ARRAY['anon', 'authenticated', 'service_role'];
  r text;
  priv text;
  -- Full has_table_privilege vocabulary (PG17+ includes MAINTAIN) + grant options.
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
  owner_name text;
  present_count int;
BEGIN
  -- IPI-1162 · SB-MIG-003 fresh-replay adaptation: same reasoning as
  -- 20260724102922 — these 33 are Mastra's own non-migration auto-init
  -- tables, genuinely absent (not "missing/broken") on a fresh database.
  SELECT count(*) INTO present_count
  FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY (expected);

  IF present_count = 0 THEN
    RAISE NOTICE 'IPI-801 privilege assert: zero public.mastra_* shadow tables present — fresh replay, nothing to assert';
    RETURN;
  END IF;

  FOREACH t IN ARRAY expected LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION
        'IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables: missing public.%',
        t;
    END IF;

    -- Idempotent re-lock (safe if 20260724102922 already ran).
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
    FOREACH r IN ARRAY deny_roles LOOP
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', t, r);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Ownership must stay with a bypass role (postgres), never a PostgREST role.
    SELECT r.rolname
    INTO owner_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles r ON r.oid = c.relowner
    WHERE n.nspname = 'public'
      AND c.relname = t;

    IF owner_name IN ('anon', 'authenticated', 'service_role') THEN
      RAISE EXCEPTION
        'IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables: public.% owned by % (refuse DROP OWNED BY; fix ownership explicitly)',
        t, owner_name;
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
        'IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables: deny-role ACL on public.%: %',
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
        'IPI-801 · MASTRA-PG-011 — Retire Recreated public.mastra_* Shadow Tables: PUBLIC privileges on public.%: %',
        t, public_priv;
    END IF;
  END LOOP;
END $$;
