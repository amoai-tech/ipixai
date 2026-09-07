-- IPI-796 · MASTRA-PG-010 — Create the 9 Missing mastra.* Tables via Migration
-- follow-up — effective privilege postflight
--
-- 20260724092825 already applied on nvdlhrodvevgwdsneplk — do not rewrite it.
-- CodeRabbit: role_table_grants omits PUBLIC and can miss enabled-role edge cases.
-- This forward migration re-asserts the same 9-table grant contract using
-- has_table_privilege() for named roles + aclexplode(relacl) for PUBLIC (grantee 0).
-- Fail-closed; no DDL shape changes.

DO $$
DECLARE
  expected text[] := ARRAY[
    'mastra_mcp_clients',
    'mastra_mcp_client_versions',
    'mastra_mcp_servers',
    'mastra_mcp_server_versions',
    'mastra_skills',
    'mastra_skill_versions',
    'mastra_skill_blobs',
    'mastra_workspaces',
    'mastra_workspace_versions'
  ];
  t text;
  r text;
  priv text;
  need_privs text[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  deny_roles text[] := ARRAY['anon', 'authenticated', 'service_role'];
  bad text;
  public_priv text;
BEGIN
  FOREACH t IN ARRAY expected LOOP
    IF to_regclass(format('mastra.%I', t)) IS NULL THEN
      RAISE EXCEPTION
        'IPI-796 · MASTRA-PG-010 — Create the 9 Missing mastra.* Tables via Migration: effective-priv missing mastra.%',
        t;
    END IF;

    -- hyperdrive_mastra_runtime must retain full DML
    FOREACH priv IN ARRAY need_privs LOOP
      IF NOT has_table_privilege(
        'hyperdrive_mastra_runtime',
        format('mastra.%I', t),
        priv
      ) THEN
        RAISE EXCEPTION
          'IPI-796 · MASTRA-PG-010 — Create the 9 Missing mastra.* Tables via Migration: hyperdrive_mastra_runtime missing % on mastra.%',
          priv, t;
      END IF;
    END LOOP;

    -- PostgREST roles must have zero effective table privileges
    bad := NULL;
    FOREACH r IN ARRAY deny_roles LOOP
      FOREACH priv IN ARRAY need_privs || ARRAY['TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
        IF has_table_privilege(r, format('mastra.%I', t), priv) THEN
          bad := coalesce(bad || ', ', '') || r || ':' || priv;
        END IF;
      END LOOP;
    END LOOP;
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION
        'IPI-796 · MASTRA-PG-010 — Create the 9 Missing mastra.* Tables via Migration: unexpected grants on mastra.%: %',
        t, bad;
    END IF;

    -- PUBLIC (acl grantee 0) must not appear on relacl
    SELECT string_agg(acl.privilege_type, ', ' ORDER BY acl.privilege_type)
    INTO public_priv
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) AS acl
    WHERE n.nspname = 'mastra'
      AND c.relname = t
      AND acl.grantee = 0;

    IF public_priv IS NOT NULL THEN
      RAISE EXCEPTION
        'IPI-796 · MASTRA-PG-010 — Create the 9 Missing mastra.* Tables via Migration: PUBLIC privileges on mastra.%: %',
        t, public_priv;
    END IF;
  END LOOP;
END $$;
