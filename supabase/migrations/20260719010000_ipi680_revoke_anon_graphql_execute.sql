-- IPI-680 · SB-SEC-002 — Approach A attempt (anon EXECUTE revoke)
-- IPI-728 · SB-MIG-002 — existence-guarded REVOKE (fresh-project safe)
--
-- Applied on remote before discovering postgres cannot revoke
-- supabase_admin-owned GraphQL ACLs (REVOKE is a silent no-op warning).
-- Follow-up migration drops pg_graphql instead.
--
-- Fresh Supabase projects may lack graphql.* / graphql_public.* routines.
-- Unguarded REVOKE aborts the chain before the drop-extension migration runs.
-- Linked remotes that already applied this version do not re-run it.
--
-- Visibility: when extension pg_graphql is installed, expected graphql.*
-- routines must resolve (malformed/outdated signatures fail loud). When the
-- extension is absent, missing routines are skipped with NOTICE.

do $ipi728_revoke$
declare
  v_has_pg_graphql boolean;
  v_sig text;
  v_reg regprocedure;
  v_expected text[] := array[
    'graphql_public.graphql(text, text, jsonb, jsonb)',
    'graphql.resolve(text, jsonb, text, jsonb)',
    'graphql._internal_resolve(text, jsonb, text, jsonb)'
  ];
begin
  select exists (
    select 1 from pg_extension where extname = 'pg_graphql'
  ) into v_has_pg_graphql;

  foreach v_sig in array v_expected
  loop
    v_reg := to_regprocedure(v_sig);

    if v_reg is null then
      -- When the extension is present, every listed signature must resolve.
      -- (Includes graphql_public.* — do not narrow to graphql.% only.)
      if v_has_pg_graphql then
        raise exception
          'IPI-728: pg_graphql is installed but % did not resolve — check signature',
          v_sig;
      end if;
      raise notice 'IPI-728: skip revoke (routine absent): %', v_sig;
      continue;
    end if;

    execute format('revoke execute on function %s from anon', v_sig);
    raise notice 'IPI-728: revoked anon execute on %', v_sig;
  end loop;
end;
$ipi728_revoke$;
