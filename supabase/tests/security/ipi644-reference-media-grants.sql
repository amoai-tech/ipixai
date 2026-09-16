-- IPI-644 · SHOOT-DATA-002C — Visual Shot-Type Reference Browser security regression.
-- Runner: .github/workflows/ci.yml job supabase-fresh-replay
--         (psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1
--          -f supabase/tests/security/ipi644-reference-media-grants.sql)
--
-- Observable cases (the same markers are asserted statically in
-- tests/ipi644-shot-reference-media.test.ts so a missing suite fails fast):
--   * global reference media must not be client-readable
--   * anon must not read or write the reference view
--   * authenticated may only SELECT the reference view
--   * provider identity/version must not be exposed through the catalog view
--   * reference_key must be immutable
--   * reference_key must reject blank or non-canonical keys
--   * reference media functions must stay SECURITY DEFINER
--   * anon must not EXECUTE the reference media functions
--   * authenticated must not EXECUTE the reference media resolver
--   * an approved mapping must fail closed when its exact identity is incomplete
--   * only human-approved mappings may be recorded
--   * service_role owns the reference media recorder

do $$
declare
  missing text[] := '{}';
  media regclass := to_regclass('shoot.shot_type_reference_media');
  view_rel regclass := to_regclass('public.shot_type_references_view');

  function_media text := 'public.get_shot_reference_media(uuid)';
  function_has_preview text := 'public.shot_type_reference_has_preview(uuid)';
  function_record text := 'public.record_shot_reference_media(uuid, text, text, bigint, text, text, uuid)';
  function_record_legacy text := 'public.record_shot_reference_media(uuid, text, text, bigint, text, text, text, uuid)';

  policy_count int;
  hidden_columns text[];
begin
  if media is null then
    raise exception 'IPI-644: shoot.shot_type_reference_media is missing';
  end if;
  if view_rel is null then
    raise exception 'IPI-644: public.shot_type_references_view is missing';
  end if;

  -- ---- global reference media must not be client-readable -------------------
  if not (select relrowsecurity from pg_class where oid = media) then
    raise exception 'IPI-644: shot_type_reference_media must have RLS enabled';
  end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'shoot' and tablename = 'shot_type_reference_media';
  if policy_count <> 0 then
    raise exception 'IPI-644: shot_type_reference_media must have NO policies (deny-all server-only), found %', policy_count;
  end if;

  if has_table_privilege('anon', media, 'select')
     or has_table_privilege('anon', media, 'insert')
     or has_table_privilege('anon', media, 'update')
     or has_table_privilege('anon', media, 'delete')
     or has_table_privilege('anon', media, 'truncate')
     or has_table_privilege('anon', media, 'references')
     or has_table_privilege('anon', media, 'trigger') then
    raise exception 'IPI-644: anon must have no privileges on shot_type_reference_media';
  end if;

  if has_table_privilege('authenticated', media, 'select')
     or has_table_privilege('authenticated', media, 'insert')
     or has_table_privilege('authenticated', media, 'update')
     or has_table_privilege('authenticated', media, 'delete')
     or has_table_privilege('authenticated', media, 'truncate')
     or has_table_privilege('authenticated', media, 'references')
     or has_table_privilege('authenticated', media, 'trigger') then
    raise exception 'IPI-644: authenticated must have no direct privileges on shot_type_reference_media';
  end if;

  -- ---- reference_key is a stored, non-null, unique logical identity ---------
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'shoot'
      and table_name = 'shot_type_references'
      and column_name = 'reference_key'
      and is_nullable = 'NO'
  ) then
    null;
  else
    raise exception 'IPI-644: shoot.shot_type_references.reference_key must exist and be NOT NULL';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('shoot.shot_type_references')
      and contype = 'u'
      and conname = 'shot_type_references_reference_key_key'
  ) then
    raise exception 'IPI-644: reference_key must have a unique constraint';
  end if;

  -- The one-time backfill guard is not enough: a permanent, VALIDATED CHECK must
  -- reject blank/whitespace-only/non-canonical keys on every future insert or
  -- update. Assert the actual validated definition (not just the name), so a
  -- same-named CHECK (true) or a NOT VALID constraint cannot pass this suite.
  if not exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('shoot.shot_type_references')
      and contype = 'c'
      and conname = 'shot_type_references_reference_key_format'
      and convalidated
      and pg_get_constraintdef(oid) = 'CHECK ((reference_key ~ ''^[a-z0-9_]+$''::text))'
  ) then
    raise exception 'IPI-644: reference_key must reject blank or non-canonical keys (missing/mismatched format CHECK)';
  end if;

  if exists (select 1 from shoot.shot_type_references where reference_key is null)
     or (select count(distinct reference_key) from shoot.shot_type_references)
        <> (select count(*) from shoot.shot_type_references) then
    raise exception 'IPI-644: reference_key values must be non-null and unique';
  end if;

  -- Stored rows must satisfy the canonical invariant too, not merely be unique.
  if exists (
    select 1 from shoot.shot_type_references where reference_key !~ '^[a-z0-9_]+$'
  ) then
    raise exception 'IPI-644: stored reference_key values must match the canonical snake_case invariant';
  end if;

  -- ---- reference_key must be immutable --------------------------------------
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'shoot'
      and c.relname = 'shot_type_references'
      and t.tgname = 'shot_type_references_lock_reference_key'
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  ) then
    raise exception 'IPI-644: reference_key must be immutable (missing enabled lock trigger)';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'shoot'
      and p.proname = 'shot_type_references_lock_reference_key'
      and p.prosrc like '%reference_key is immutable%'
  ) then
    raise exception 'IPI-644: reference_key must be immutable (lock function has no guard)';
  end if;

  -- ---- exact-version invariants are enforced by CHECKs ----------------------
  if not exists (
    select 1 from pg_constraint
    where conrelid = media and contype = 'c' and conname = 'shot_type_reference_media_version_positive'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = media and contype = 'c' and conname = 'shot_type_reference_media_resource_type_image'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = media and contype = 'c' and conname = 'shot_type_reference_media_delivery_type_authenticated'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = media and contype = 'c' and conname = 'shot_type_reference_media_rights_approved'
  ) then
    raise exception 'IPI-644: shot_type_reference_media is missing one of its exact-mapping CHECK constraints';
  end if;

  -- ---- removed rights-evidence contract must stay removed -----------------
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'shoot'
      and table_name = 'shot_type_reference_media'
      and column_name = 'rights_evidence'
  ) then
    raise exception 'IPI-644: rights_evidence must remain removed from shot_type_reference_media';
  end if;

  if to_regprocedure(function_record_legacy) is not null then
    raise exception 'IPI-644: obsolete 8-argument record_shot_reference_media must not exist';
  end if;

  -- ---- canonical approver identity ----------------------------------------
  if not exists (
    select 1 from pg_constraint
    where conrelid = media and contype = 'f'
      and confrelid = to_regclass('auth.users')
  ) then
    raise exception 'IPI-644: approved_by must reference auth.users so only known approvers can be recorded';
  end if;

  -- ---- provider identity/version must not leak through the catalog view -----
  select array_agg(column_name) into hidden_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'shot_type_references_view'
    and column_name in (
      'public_id', 'version', 'cloudinary_asset_id', 'format',
      'resource_type', 'delivery_type', 'provenance_source', 'rights_status',
      'approved_by', 'approved_at'
    );
  if hidden_columns is not null then
    raise exception 'IPI-644: catalog view must not expose provider identity columns, found %', hidden_columns;
  end if;

  -- ---- anon must not read or write the reference view -----------------------
  if has_table_privilege('anon', view_rel, 'select')
     or has_table_privilege('anon', view_rel, 'insert')
     or has_table_privilege('anon', view_rel, 'update')
     or has_table_privilege('anon', view_rel, 'delete') then
    raise exception 'IPI-644: anon must have no privileges on shot_type_references_view';
  end if;

  -- ---- authenticated may only SELECT the reference view ---------------------
  if not has_table_privilege('authenticated', view_rel, 'select') then
    raise exception 'IPI-644: authenticated must have SELECT on shot_type_references_view';
  end if;
  if has_table_privilege('authenticated', view_rel, 'insert')
     or has_table_privilege('authenticated', view_rel, 'update')
     or has_table_privilege('authenticated', view_rel, 'delete') then
    raise exception 'IPI-644: authenticated must not have DML on shot_type_references_view';
  end if;

  -- ---- service_role reads the catalog (CLI), never writes it ----------------
  if not has_table_privilege('service_role', view_rel, 'select') then
    raise exception 'IPI-644: service_role must SELECT shot_type_references_view (candidate CLI)';
  end if;
  if has_table_privilege('service_role', view_rel, 'insert')
     or has_table_privilege('service_role', view_rel, 'update')
     or has_table_privilege('service_role', view_rel, 'delete') then
    raise exception 'IPI-644: service_role must not have DML on shot_type_references_view';
  end if;

  -- ---- security_invoker must be retained ------------------------------------
  if not exists (
    select 1 from pg_class
    where oid = view_rel
      and coalesce(array_to_string(reloptions, ','), '') like '%security_invoker=true%'
  ) then
    raise exception 'IPI-644: shot_type_references_view must keep security_invoker=true';
  end if;

  -- ---- exact mapping resolved only through role-gated functions -------------
  if to_regprocedure(function_media) is null then
    raise exception 'IPI-644: public.get_shot_reference_media(uuid) is missing';
  end if;
  if to_regprocedure(function_has_preview) is null then
    raise exception 'IPI-644: public.shot_type_reference_has_preview(uuid) is missing';
  end if;

  if has_function_privilege('anon', function_media, 'execute')
     or has_function_privilege('anon', function_has_preview, 'execute') then
    raise exception 'IPI-644: anon must not EXECUTE the reference media functions';
  end if;
  if has_function_privilege('authenticated', function_media, 'execute') then
    raise exception 'IPI-644: authenticated must not EXECUTE the reference media resolver';
  end if;
  if not has_function_privilege('authenticated', function_has_preview, 'execute') then
    raise exception 'IPI-644: authenticated must EXECUTE the boolean preview-availability function';
  end if;
  if not has_function_privilege('service_role', function_media, 'execute') then
    raise exception 'IPI-644: service_role must EXECUTE the reference media resolver';
  end if;

  -- ---- only human-approved mappings may be recorded, by service_role --------
  if to_regprocedure(function_record) is null then
    raise exception 'IPI-644: public.record_shot_reference_media(...) is missing';
  end if;
  if has_function_privilege('anon', function_record, 'execute')
     or has_function_privilege('authenticated', function_record, 'execute') then
    raise exception 'IPI-644: only service_role may EXECUTE the reference media recorder';
  end if;
  if not has_function_privilege('service_role', function_record, 'execute') then
    raise exception 'IPI-644: service_role must EXECUTE the reference media recorder';
  end if;

  -- The recorder must require an approver and hardcode the exact-mapping
  -- invariants, so no caller can write an unapproved or mismatched mapping.
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'record_shot_reference_media'
      and p.prosrc like '%p_approved_by is null%'
      and p.prosrc like '%auth.users%'
      and p.prosrc like '%approved_for_reference%'
      and p.prosrc like '%''authenticated''%'
      and p.prosrc like '%''image''%'
  ) then
    raise exception 'IPI-644: recorder must require a human approver and hardcode the exact-mapping invariants';
  end if;

  -- SECURITY DEFINER is load-bearing: if any of these loses the attribute the
  -- caller is checked directly against the deny-all media table and reference
  -- reads break (or, worse, a future owner forgets why it was needed). Require
  -- the attribute explicitly instead of only checking search_path on functions
  -- that already happen to be SECURITY DEFINER.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_shot_reference_media', 'shot_type_reference_has_preview', 'record_shot_reference_media')
      and not p.prosecdef
  ) then
    raise exception 'IPI-644: reference media functions must stay SECURITY DEFINER';
  end if;

  -- SECURITY DEFINER functions must pin the EXACT empty search_path (catalog
  -- rule). Requiring only "some search_path" would let a hostile
  -- `search_path=attacker_schema, pg_catalog` pass this suite.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_shot_reference_media', 'shot_type_reference_has_preview', 'record_shot_reference_media')
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg = 'search_path=""'
      )
  ) then
    raise exception 'IPI-644: reference media SECURITY DEFINER functions must pin the exact empty search_path';
  end if;
end
$$;
