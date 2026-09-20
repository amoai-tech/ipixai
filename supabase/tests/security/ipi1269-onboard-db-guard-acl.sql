-- IPI-1269 · ONBOARD-DB-GUARD-001 — regression proof that the onboarding
-- materialization boundary cannot be forged by a normal authenticated
-- client.
--
-- Audit correction (see the live Linear task): materialize_onboarding_session
-- is SECURITY INVOKER; the privileged flag is a transaction-local
-- set_config('app.onboarding_materializing','on', true) set only inside the
-- trusted RPC body; there is no public.set_config wrapper (confirmed via
-- live read-only pg_proc inspection: proname='set_config' exists only in
-- pg_catalog); and pg_catalog is not in supabase/config.toml's `[api]
-- schemas` (= ["public","graphql_public"]), so pg_catalog.set_config is not
-- reachable as a PostgREST RPC target even if a client tried to call it by
-- name. This file proves the resulting boundary holds end to end. Per the
-- issue's own stop condition: these tests passing means no new migration is
-- required.
--
-- Covers the task's verification matrix: owner draft write (Allow), stranger
-- read/update (Deny), direct materialized/org/brand forgery (Deny), user_id
-- spoofing on insert and update (Deny), the trusted RPC happy path (Allow),
-- same-key replay (same durable IDs, no duplicates), a direct-mutation
-- attempt on an already-materialized row (Deny — proves the outcome columns
-- stay locked once the RPC's one-shot privileged window has closed), and two
-- different users sharing the same idempotency-key TEXT (isolated results).
-- The 8th matrix row — concurrent duplicate materialization — needs two
-- genuinely overlapping sessions and lives in the companion
-- ipi1269-onboard-db-guard-concurrency.sh instead.
--
-- Rollback: none — proof only, wrapped in begin/rollback.

begin;

do $$
declare
  user_a       uuid := gen_random_uuid();  -- owner under test
  user_b       uuid := gen_random_uuid();  -- stranger
  user_c       uuid := gen_random_uuid();  -- shared-key isolation, left side
  user_d       uuid := gen_random_uuid();  -- shared-key isolation, right side
  user_fixture uuid := gen_random_uuid();  -- owns only the throwaway FK-target fixtures below, never asserted on
  key_a        text := 'ipi1269-key-a-' || gen_random_uuid()::text;
  shared_key   text := 'ipi1269-shared-key-' || gen_random_uuid()::text;
  fake_org     uuid := gen_random_uuid();  -- fixture FK target, not under test
  fake_brand   uuid := gen_random_uuid();  -- fixture FK target, not under test
  session_a    uuid;
  result_1     jsonb;
  result_2     jsonb;
  org_id_a     uuid;
  brand_id_a   uuid;
  org_id_c     uuid;
  brand_id_c   uuid;
  org_id_d     uuid;
  brand_id_d   uuid;
  v_row_count    int;
  sess_state   record;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (user_a, 'authenticated', 'authenticated', 'ipi1269-dbguard-owner@ipix.test',    now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (user_b, 'authenticated', 'authenticated', 'ipi1269-dbguard-stranger@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (user_c, 'authenticated', 'authenticated', 'ipi1269-dbguard-shared-c@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (user_d, 'authenticated', 'authenticated', 'ipi1269-dbguard-shared-d@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (user_fixture, 'authenticated', 'authenticated', 'ipi1269-dbguard-fixture@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

  -- Fixture FK targets for the forgery attempts below, written as table
  -- owner (RLS-bypassing) and owned by a neutral throwaway user — not the
  -- claim under test, only a valid uuid for the forged organization_id/
  -- brand_id columns to reference. Deliberately NOT owned by user_a so the
  -- later "exactly 1 organization owned by user_a" replay assertions are not
  -- polluted by this fixture.
  insert into public.organizations (id, name, slug, owner_id, type)
  values (fake_org, 'IPI1269 Fixture Org', 'ipi1269-fixture-org-' || left(fake_org::text, 8), user_fixture, 'brand');
  insert into public.brands (id, name, org_id, user_id, brand_url)
  values (fake_brand, 'IPI1269 Fixture Brand', fake_org, user_fixture, 'https://ipi1269-fixture.test');

  -- ==========================================================================
  -- Owner creates + saves their own draft — Allow.
  -- ==========================================================================
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', user_a)::text);
  insert into public.onboarding_sessions (user_id, idempotency_key) values (user_a, key_a);
  update public.onboarding_sessions
     set current_screen = 3, draft_answers = '{"brandName":"IPI1269 Draft"}'::jsonb
   where user_id = user_a and idempotency_key = key_a;
  reset role;

  select id into session_a from public.onboarding_sessions where user_id = user_a and idempotency_key = key_a;
  if session_a is null then
    raise exception 'IPI-1269 FAIL: owner draft insert+update did not persist';
  end if;

  select current_screen, draft_answers into sess_state from public.onboarding_sessions where id = session_a;
  if sess_state.current_screen is distinct from 3 or (sess_state.draft_answers->>'brandName') is distinct from 'IPI1269 Draft' then
    raise exception 'IPI-1269 FAIL: allowed draft-safe update did not apply: %', sess_state;
  end if;

  -- ==========================================================================
  -- Stranger cannot read or update another user's session — Deny (RLS
  -- filters rows to zero; no exception, since the row is simply not visible).
  -- ==========================================================================
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', user_b)::text);
  select count(*) into v_row_count from public.onboarding_sessions where id = session_a;
  if v_row_count <> 0 then
    raise exception 'IPI-1269 FAIL: stranger must not be able to SELECT another user''s onboarding_sessions row';
  end if;

  update public.onboarding_sessions set current_screen = 9 where id = session_a;
  get diagnostics v_row_count = ROW_COUNT;
  if v_row_count <> 0 then
    raise exception 'IPI-1269 FAIL: stranger must not be able to UPDATE another user''s onboarding_sessions row';
  end if;
  reset role;

  -- ==========================================================================
  -- Direct client cannot flip status to materialized — Deny.
  -- ==========================================================================
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', user_a)::text);
  begin
    update public.onboarding_sessions set status = 'materialized' where id = session_a;
    reset role;
    raise exception 'IPI-1269 FAIL: owner must not be able to directly set status=materialized';
  exception
    when insufficient_privilege then reset role;
  end;

  -- ==========================================================================
  -- Direct client cannot attach organization_id while still draft — Deny.
  -- ==========================================================================
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', user_a)::text);
  begin
    update public.onboarding_sessions set organization_id = fake_org where id = session_a;
    reset role;
    raise exception 'IPI-1269 FAIL: owner must not be able to directly attach organization_id while draft';
  exception
    when insufficient_privilege then reset role;
  end;

  -- ==========================================================================
  -- Direct client cannot attach brand_id while still draft — Deny.
  -- ==========================================================================
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', user_a)::text);
  begin
    update public.onboarding_sessions set brand_id = fake_brand where id = session_a;
    reset role;
    raise exception 'IPI-1269 FAIL: owner must not be able to directly attach brand_id while draft';
  exception
    when insufficient_privilege then reset role;
  end;

  -- ==========================================================================
  -- Stranger cannot spoof user_id on INSERT — Deny.
  -- ==========================================================================
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', user_b)::text);
  begin
    insert into public.onboarding_sessions (user_id, idempotency_key) values (user_a, 'ipi1269-spoofed-insert-key');
    reset role;
    raise exception 'IPI-1269 FAIL: user_b must not be able to INSERT a session claiming user_id=user_a';
  exception
    when insufficient_privilege then reset role;
  end;

  -- ==========================================================================
  -- Owner cannot repoint their own session's user_id to another user — Deny
  -- (with_check requires (select auth.uid()) = user_id on the RESULTING row).
  -- ==========================================================================
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', user_a)::text);
  begin
    update public.onboarding_sessions set user_id = user_b where id = session_a;
    reset role;
    raise exception 'IPI-1269 FAIL: owner must not be able to reassign user_id away from themselves';
  exception
    when insufficient_privilege then reset role;
  end;

  -- ==========================================================================
  -- Trusted RPC materializes — Allow. Owner's own draft becomes exactly one
  -- organization + one owner org_members row + one brand.
  -- ==========================================================================
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', user_a)::text);
  select public.materialize_onboarding_session(key_a, 'IPI1269 Guard Brand A', 'https://ipi1269-guard-a.test') into result_1;
  -- Test-harness leak guard, not a production behavior difference: this whole
  -- proof runs inside ONE transaction (begin ... rollback at file scope), so
  -- the RPC's transaction-local set_config('app.onboarding_materializing',
  -- 'on', true) would otherwise remain 'on' for every statement after this
  -- one in this same transaction. A real PostgREST request commits (or
  -- rolls back) its own transaction immediately after the RPC returns, which
  -- is what actually resets it in production — reproduce that boundary here
  -- explicitly so the later "unrelated field changed" negative test below is
  -- not silently invalidated by this file's own transaction shape.
  perform set_config('app.onboarding_materializing', '', true);
  reset role;

  if result_1->>'organization_id' is null or result_1->>'brand_id' is null then
    raise exception 'IPI-1269 FAIL: materialize RPC did not return organization_id/brand_id: %', result_1;
  end if;
  org_id_a   := (result_1->>'organization_id')::uuid;
  brand_id_a := (result_1->>'brand_id')::uuid;

  select status, current_screen, organization_id, brand_id into sess_state
    from public.onboarding_sessions where id = session_a;
  if sess_state.status is distinct from 'materialized'
     or sess_state.current_screen is distinct from 12
     or sess_state.organization_id is distinct from org_id_a
     or sess_state.brand_id is distinct from brand_id_a then
    raise exception 'IPI-1269 FAIL: onboarding_sessions row not correctly materialized: %', sess_state;
  end if;

  select count(*) into v_row_count from public.organizations where id = org_id_a and owner_id = user_a;
  if v_row_count <> 1 then
    raise exception 'IPI-1269 FAIL: expected exactly 1 organization owned by user_a, got %', v_row_count;
  end if;

  select count(*) into v_row_count from public.brands where id = brand_id_a and org_id = org_id_a and user_id = user_a;
  if v_row_count <> 1 then
    raise exception 'IPI-1269 FAIL: expected exactly 1 brand owned by user_a under org_id_a, got %', v_row_count;
  end if;

  select count(*) into v_row_count from public.org_members where org_id = org_id_a and user_id = user_a and role = 'owner';
  if v_row_count <> 1 then
    raise exception 'IPI-1269 FAIL: expected exactly 1 owner org_members row for user_a, got %', v_row_count;
  end if;

  -- ==========================================================================
  -- Same RPC replay — same durable IDs, no duplicate org/brand/member rows.
  -- ==========================================================================
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', user_a)::text);
  select public.materialize_onboarding_session(key_a, 'IPI1269 Guard Brand A', 'https://ipi1269-guard-a.test') into result_2;
  perform set_config('app.onboarding_materializing', '', true);
  reset role;

  if (result_2->>'organization_id')::uuid is distinct from org_id_a or (result_2->>'brand_id')::uuid is distinct from brand_id_a then
    raise exception 'IPI-1269 FAIL: replay must return the same durable organization_id/brand_id, got %', result_2;
  end if;

  select count(*) into v_row_count from public.organizations where owner_id = user_a;
  if v_row_count <> 1 then
    raise exception 'IPI-1269 FAIL: replay must not create a second organization, got %', v_row_count;
  end if;

  select count(*) into v_row_count from public.brands where user_id = user_a and org_id = org_id_a;
  if v_row_count <> 1 then
    raise exception 'IPI-1269 FAIL: replay must not create a second brand, got %', v_row_count;
  end if;

  select count(*) into v_row_count from public.org_members where org_id = org_id_a and user_id = user_a;
  if v_row_count <> 1 then
    raise exception 'IPI-1269 FAIL: replay must not duplicate the owner org_members row, got %', v_row_count;
  end if;

  -- ==========================================================================
  -- Unrelated field changed through the "privileged" path — Deny. Once
  -- materialized, the client still has no way to set the materializing GUC
  -- itself, so ANY direct mutation (not just the outcome columns) must keep
  -- failing, proving the privileged window really did close with the RPC
  -- call and cannot be re-entered from the client. A materialized row no
  -- longer satisfies the UPDATE policy's USING clause at all (status is no
  -- longer 'draft' and materializing is off), so this fails closed as a
  -- silent zero-row match rather than a WITH CHECK exception — same shape
  -- as the stranger-update case above, not the insufficient_privilege shape
  -- used for the still-draft forgery attempts.
  -- ==========================================================================
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', user_a)::text);
  update public.onboarding_sessions set draft_answers = '{"hacked":true}'::jsonb where id = session_a;
  get diagnostics v_row_count = ROW_COUNT;
  reset role;
  if v_row_count <> 0 then
    raise exception 'IPI-1269 FAIL: owner must not be able to mutate a materialized session directly, even an unrelated field';
  end if;

  select draft_answers into sess_state from public.onboarding_sessions where id = session_a;
  if (sess_state.draft_answers ? 'hacked') then
    raise exception 'IPI-1269 FAIL: materialized session draft_answers must remain unchanged: %', sess_state.draft_answers;
  end if;

  -- ==========================================================================
  -- Two different users sharing the same idempotency-key TEXT — isolated
  -- sessions and durable results (uniqueness is (user_id, idempotency_key),
  -- not idempotency_key alone).
  -- ==========================================================================
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', user_c)::text);
  insert into public.onboarding_sessions (user_id, idempotency_key) values (user_c, shared_key);
  select public.materialize_onboarding_session(shared_key, 'IPI1269 Guard Brand C', 'https://ipi1269-guard-c.test') into result_1;
  perform set_config('app.onboarding_materializing', '', true);
  reset role;

  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', user_d)::text);
  insert into public.onboarding_sessions (user_id, idempotency_key) values (user_d, shared_key);
  select public.materialize_onboarding_session(shared_key, 'IPI1269 Guard Brand D', 'https://ipi1269-guard-d.test') into result_2;
  perform set_config('app.onboarding_materializing', '', true);
  reset role;

  org_id_c   := (result_1->>'organization_id')::uuid;
  brand_id_c := (result_1->>'brand_id')::uuid;
  org_id_d   := (result_2->>'organization_id')::uuid;
  brand_id_d := (result_2->>'brand_id')::uuid;

  if org_id_c is null or brand_id_c is null or org_id_d is null or brand_id_d is null then
    raise exception 'IPI-1269 FAIL: shared-key-text materialize did not return durable IDs for both users';
  end if;
  if org_id_c = org_id_d or brand_id_c = brand_id_d then
    raise exception 'IPI-1269 FAIL: two users sharing the same idempotency-key TEXT must not collapse to the same org/brand (c=% d=%)', result_1, result_2;
  end if;

  select count(*) into v_row_count from public.organizations where id = org_id_c and owner_id = user_c;
  if v_row_count <> 1 then
    raise exception 'IPI-1269 FAIL: user_c must own exactly 1 organization, got %', v_row_count;
  end if;
  select count(*) into v_row_count from public.organizations where id = org_id_d and owner_id = user_d;
  if v_row_count <> 1 then
    raise exception 'IPI-1269 FAIL: user_d must own exactly 1 organization, got %', v_row_count;
  end if;

  -- user_c must not be able to see user_d's resulting session (or vice
  -- versa) even though they used the identical key text.
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', user_c)::text);
  select count(*) into v_row_count from public.onboarding_sessions where user_id = user_d;
  reset role;
  if v_row_count <> 0 then
    raise exception 'IPI-1269 FAIL: user_c must not be able to read user_d''s onboarding_sessions row despite sharing the same key text';
  end if;

  raise notice 'IPI-1269 onboard DB guard ACL PASS';
end;
$$;

rollback;
