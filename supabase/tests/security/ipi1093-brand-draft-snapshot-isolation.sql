-- IPI-1093 · BRAND-INTEL-001 — get_brand_draft_snapshot org isolation.
--
-- get_brand_draft_snapshot (20260909173135) is `language sql ... set
-- search_path = ''` with no `security definer` — it runs SECURITY INVOKER,
-- so RLS on public.brands (brands_select_org) governs it like any ordinary
-- authenticated read. This proves that isn't just a reading of the
-- function's definition: a real Org B member gets no snapshot for an Org A
-- brand's in-review draft, while the real Org A member gets the exact
-- draft + hash. Runs inside the supabase-fresh-replay job, after the full
-- migration replay (real auth.users/organizations schema required).
--
-- Rollback: none — read-only proof, wrapped in begin/rollback.

begin;

do $$
declare
  org_a       uuid := gen_random_uuid();
  org_b       uuid := gen_random_uuid();
  org_a_owner uuid := gen_random_uuid();
  org_b_owner uuid := gen_random_uuid();
  brand_a     uuid := gen_random_uuid();
  draft       jsonb := '{"schemaVersion":2,"name":"IPI1093 Isolation Brand"}'::jsonb;
  snapshot    jsonb;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (org_a_owner, 'authenticated', 'authenticated', 'ipi1093-org-a-owner@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (org_b_owner, 'authenticated', 'authenticated', 'ipi1093-org-b-owner@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.organizations (id, name, slug, type, owner_id, plan)
  values
    (org_a, 'IPI1093 Org A', 'ipi1093-org-a', 'agency', org_a_owner, 'free'),
    (org_b, 'IPI1093 Org B', 'ipi1093-org-b', 'agency', org_b_owner, 'free');

  -- organizations has an auto-owner trigger that already inserts the
  -- owner's org_members row; ON CONFLICT DO NOTHING covers both that and
  -- the case where it doesn't (repo behavior, not under test here).
  insert into public.org_members (org_id, user_id, role) values
    (org_a, org_a_owner, 'owner'),
    (org_b, org_b_owner, 'owner')
  on conflict (org_id, user_id) do nothing;

  insert into public.brands (id, user_id, org_id, name, ai_profile_draft)
  values (brand_a, org_a_owner, org_a, 'IPI1093 Isolation Brand', draft);

  -- Org A owner: reads the real snapshot (draft + hash both present).
  perform set_config('request.jwt.claim.sub', org_a_owner::text, true);
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_a_owner)::text);
  select public.get_brand_draft_snapshot(brand_a) into snapshot;
  reset role;
  if snapshot is null or snapshot->>'draft' is null or snapshot->>'hash' is null then
    raise exception 'IPI-1093 FAIL: org A owner must read brand A''s own draft snapshot, got: %', snapshot;
  end if;

  -- Org B owner: a real member of a real, different org — RLS on
  -- public.brands hides the row entirely, so the RPC's `from public.brands
  -- where id = ...` matches nothing and returns NULL, not an error.
  perform set_config('request.jwt.claim.sub', org_b_owner::text, true);
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_b_owner)::text);
  select public.get_brand_draft_snapshot(brand_a) into snapshot;
  reset role;
  if snapshot is not null then
    raise exception 'IPI-1093 FAIL: org B owner must not read org A''s draft snapshot, got: %', snapshot;
  end if;

  -- anon: no rows either (revoke all ... from public, anon on the function
  -- itself already blocks this at the grant level, not just RLS).
  execute 'set local role anon';
  begin
    perform public.get_brand_draft_snapshot(brand_a);
    reset role;
    raise exception 'IPI-1093 FAIL: anon must not have EXECUTE on get_brand_draft_snapshot';
  exception
    when insufficient_privilege then
      reset role;
  end;

  raise notice 'IPI-1093 get_brand_draft_snapshot org isolation PASS';
end;
$$;

rollback;
