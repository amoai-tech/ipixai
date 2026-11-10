-- IPI-1433 · Stop users from promoting their own public.profiles.role.
-- Run only against an isolated migration-replayed database; fixtures roll back.
-- Proves grants plus RLS as an authenticated PostgREST database role.
begin;

do $test$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  affected integer;
  denied boolean;
  actual_role public.user_role;
begin
  -- DB authorization must deny client writes to privileged roles even when
  -- the caller owns the row and the UPDATE/INSERT RLS policy allows that row.
  if has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
    or has_column_privilege('authenticated', 'public.profiles', 'role', 'INSERT') then
    raise exception 'IPI-1433: authenticated can write profiles.role';
  end if;
  if has_column_privilege('anon', 'public.profiles', 'role', 'UPDATE')
    or has_column_privilege('anon', 'public.profiles', 'role', 'INSERT') then
    raise exception 'IPI-1433: anon can write profiles.role';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'email', 'INSERT') then
    raise exception 'IPI-1433: normal profile edits/sign-up lost privileges';
  end if;
  if not has_column_privilege('service_role', 'public.profiles', 'role', 'UPDATE') then
    raise exception 'IPI-1433: trusted server role cannot manage privileged roles';
  end if;

  -- Signed-up users get a designer profile from the existing auth trigger.
  insert into auth.users
    (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (user_a, 'authenticated', 'authenticated',
     'ipi1433-a-' || left(user_a::text,8) || '@example.invalid', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (user_b, 'authenticated', 'authenticated',
     'ipi1433-b-' || left(user_b::text,8) || '@example.invalid', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

  select role into actual_role from public.profiles where id = user_a;
  if actual_role is distinct from 'designer'::public.user_role then
    raise exception 'IPI-1433: auth signup must create a designer profile';
  end if;

  -- Force the second fixture through the client INSERT path (not the
  -- privileged auth trigger), without ever creating a live user or record.
  delete from public.profiles where id = user_b;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  update public.profiles set full_name = 'Allowed profile change'
  where id = user_a;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'IPI-1433: own nonprivileged profile UPDATE should work';
  end if;

  denied := false;
  begin
    update public.profiles set role = 'admin' where id = user_a;
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'IPI-1433: normal user could set their own role to admin';
  end if;

  denied := false;
  begin
    update public.profiles set role = 'organizer' where id = user_a;
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'IPI-1433: normal user could set their own role to organizer';
  end if;

  -- RLS may allow the own-row INSERT, but column privileges must reject
  -- any client-supplied elevated role. Default designer INSERT still works.
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  denied := false;
  begin
    insert into public.profiles (id, email, role)
    values (user_b, 'ipi1433-client@example.invalid', 'admin');
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'IPI-1433: signed-in INSERT could choose admin role';
  end if;

  insert into public.profiles (id, email, full_name)
  values (user_b, 'ipi1433-client@example.invalid', 'Client signup');
  select role into actual_role from public.profiles where id = user_b;
  if actual_role is distinct from 'designer'::public.user_role then
    raise exception 'IPI-1433: ordinary client INSERT must default to designer';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  -- A trusted server/database actor must still be able to assign a role,
  -- and a legitimate admin must still edit nonprivileged profile fields.
  update public.profiles set role = 'admin' where id = user_a;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  update public.profiles set full_name = 'Admin profile change'
  where id = user_a;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'IPI-1433: server-assigned admin lost normal profile editing';
  end if;
  execute 'reset role';

  raise notice 'IPI-1433 profile role / signup / admin / client ACL PASS';
end
$test$;

rollback;
