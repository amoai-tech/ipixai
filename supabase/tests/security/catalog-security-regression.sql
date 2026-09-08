-- Global Supabase catalog security regression gate.
-- Runs after fresh replay. It catches new deterministic security regressions without
-- requiring a hosted Advisor call or treating known baseline debt as a blanket failure.

do $$
declare
  bad text;
begin
  -- Exposed client-readable tables must have RLS. Grants and RLS are separate gates.
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by n.nspname, c.relname)
    into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p')
    and n.nspname in ('public', 'planner', 'shoot', 'talent')
    and not c.relrowsecurity
    and (has_table_privilege('anon', c.oid, 'select')
      or has_table_privilege('authenticated', c.oid, 'select'));
  if bad is not null then
    raise exception 'client-readable table(s) without RLS: %', bad;
  end if;

  -- RLS enabled with no policies can be valid deny-all, but not while client roles
  -- retain table privileges. This avoids blindly "fixing" intentional server-only tables.
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by n.nspname, c.relname)
    into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p')
    and n.nspname in ('public', 'planner', 'shoot', 'talent')
    and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
    and (has_table_privilege('anon', c.oid, 'select,insert,update,delete')
      or has_table_privilege('authenticated', c.oid, 'select,insert,update,delete'));
  if bad is not null then
    raise exception 'RLS deny-all table(s) still client-privileged: %', bad;
  end if;

  -- iPix requires explicit policy roles; PUBLIC-scoped policies are too easy to
  -- expose to anon accidentally and make role intent ambiguous.
  select string_agg(format('%I.%I:%s', schemaname, tablename, policyname), ', ' order by schemaname, tablename, policyname)
    into bad
  from pg_policies
  where schemaname in ('public', 'planner', 'shoot', 'talent')
    and roles = '{public}';
  if bad is not null then
    raise exception 'RLS policies scoped to PUBLIC instead of explicit roles: %', bad;
  end if;

  -- Any client-callable SECURITY DEFINER function must pin search_path. Whether
  -- EXECUTE itself is intended remains task-specific and is verified separately.
  select string_agg(format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)), ', ' order by n.nspname, p.proname)
    into bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.prosecdef
    and n.nspname in ('public', 'planner', 'shoot', 'talent')
    and (has_function_privilege('anon', p.oid, 'execute')
      or has_function_privilege('authenticated', p.oid, 'execute'))
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      where cfg like 'search_path=%'
    );
  if bad is not null then
    raise exception 'client-callable SECURITY DEFINER function(s) without pinned search_path: %', bad;
  end if;
end $$;

-- Views are SECURITY DEFINER by default. Fail on any new client-readable view that
-- does not use security_invoker, except the single reviewed legacy projection below.
do $$
declare
  bad text;
begin
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by n.nspname, c.relname)
    into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'v'
    and n.nspname in ('public', 'planner', 'shoot', 'talent')
    and (has_table_privilege('anon', c.oid, 'select')
      or has_table_privilege('authenticated', c.oid, 'select'))
    and not (coalesce(c.reloptions, '{}'::text[]) @> array['security_invoker=true'])
    and not (n.nspname = 'talent' and c.relname = 'talent_profiles_public');
  if bad is not null then
    raise exception 'new client-readable SECURITY DEFINER view(s): %', bad;
  end if;
end $$;
