-- IPI-1118 · SHOOT-ASSETS-001 — Canonical V2 asset read path tests.
-- Runner: .github/workflows/ci.yml job supabase-fresh-replay
-- (after full migration chain replay including IPI-1122 + this migration).

begin;

do $$
declare
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  brand_a uuid := gen_random_uuid();
  brand_b uuid := gen_random_uuid();
  user_a_owner uuid := gen_random_uuid();
  user_a_member uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  shoot_a uuid := gen_random_uuid();
  shoot_b uuid := gen_random_uuid();
  asset_a1 uuid := gen_random_uuid();
  asset_a2 uuid := gen_random_uuid();
  asset_b1 uuid := gen_random_uuid();
  asset_legacy uuid := gen_random_uuid();
  ca_a1 uuid := gen_random_uuid();
  ca_a2 uuid := gen_random_uuid();
  ca_b1 uuid := gen_random_uuid();
  ca_legacy uuid := gen_random_uuid();
  rpc_result json;
  asset_count int;
  asset_ids uuid[];
begin
  -- Require the migration under test
  if to_regprocedure('public.get_shoot_detail(uuid)') is null then
    raise exception 'get_shoot_detail missing — apply IPI-1118 migration first';
  end if;

  -- Setup: create auth users first (required for organizations.owner_id FK)
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (user_a_owner, 'authenticated', 'authenticated', 'ipi1118-owner@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (user_a_member, 'authenticated', 'authenticated', 'ipi1118-member@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (user_b, 'authenticated', 'authenticated', 'ipi1118-orgb@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

  -- Setup: two orgs, two brands, two shoots
  insert into public.organizations (id, name, slug, type, owner_id, plan) values
    (org_a, 'Org A', 'org-a', 'brand', user_a_owner, 'free'),
    (org_b, 'Org B', 'org-b', 'brand', user_b, 'free');
  -- organizations has an auto-owner trigger that already inserts the
  -- owner's org_members row; ON CONFLICT DO NOTHING covers both that
  -- and the case where it doesn't (repo behavior, not under test here).
  insert into public.org_members (org_id, user_id, role) values
    (org_a, user_a_owner, 'owner'),
    (org_a, user_a_member, 'viewer'),
    (org_b, user_b, 'owner')
    on conflict (org_id, user_id) do nothing;
  insert into public.brands (id, org_id, user_id, name) values
    (brand_a, org_a, user_a_owner, 'Brand A'),
    (brand_b, org_b, user_b, 'Brand B');
  insert into shoot.shoots (id, brand_id, name, type, status)
  values
    (shoot_a, brand_a, 'Shoot A', 'editorial_campaign', 'planning'),
    (shoot_b, brand_b, 'Shoot B', 'editorial_campaign', 'planning');

  -- Canonical V2 assets linked via v2_shoot_id
  insert into public.assets (id, brand_id, v2_shoot_id, url, asset_type, status, dna_score, cloudinary_public_id, width, height, created_at)
  values
    (asset_a1, brand_a, shoot_a, 'https://cld.example.com/a1.jpg', 'image', 'ready', 85, 'cld_a1', 4000, 3000, now() - interval '1 day'),
    (asset_a2, brand_a, shoot_a, 'https://cld.example.com/a2.jpg', 'image', 'draft', 72, 'cld_a2', 2000, 1500, now()),
    (asset_b1, brand_b, shoot_b, 'https://cld.example.com/b1.jpg', 'image', 'ready', 90, 'cld_b1', 5000, 4000, now() - interval '2 days');

  -- Legacy asset with only shoot_id (not v2_shoot_id) — must NOT appear in V2 read
  insert into public.assets (id, brand_id, url, asset_type, status, dna_score, cloudinary_public_id, width, height, created_at)
  values
    (asset_legacy, brand_a, 'https://cld.example.com/legacy.jpg', 'image', 'ready', 60, 'cld_legacy', 1000, 1000, now() - interval '3 days');

  -- Cloudinary mirrors for canonical assets
  insert into public.cloudinary_assets (id, asset_id, public_id, secure_url, resource_type, delivery_type, version, format, width, height, status, approval, moderation_status)
  values
    (ca_a1, asset_a1, 'cld_a1', 'https://cld.example.com/a1.jpg', 'image', 'authenticated', 1, 'jpg', 4000, 3000, 'ready', 'pending', 'pending'),
    (ca_a2, asset_a2, 'cld_a2', 'https://cld.example.com/a2.jpg', 'image', 'authenticated', 1, 'jpg', 2000, 1500, 'ready', 'pending', 'pending'),
    (ca_b1, asset_b1, 'cld_b1', 'https://cld.example.com/b1.jpg', 'image', 'authenticated', 1, 'jpg', 5000, 4000, 'ready', 'pending', 'pending');

  -- Cloudinary mirror for legacy asset (should not be joined since asset not selected)
  insert into public.cloudinary_assets (id, asset_id, public_id, secure_url, resource_type, delivery_type, version, format, width, height, status, approval, moderation_status)
  values
    (ca_legacy, asset_legacy, 'cld_legacy', 'https://cld.example.com/legacy.jpg', 'image', 'authenticated', 1, 'jpg', 1000, 1000, 'ready', 'pending', 'pending');

  -- Org A owner: Shoot A assets → should return 2 canonical assets (asset_a1, asset_a2)
  perform set_config('request.jwt.claim.sub', user_a_owner::text, true);
  select public.get_shoot_detail(shoot_a) into rpc_result;

  select jsonb_array_length(rpc_result::jsonb->'assets') into asset_count;
  if asset_count <> 2 then
    raise exception 'Shoot A should have 2 canonical assets for owner, got %', asset_count;
  end if;

  select array_agg(elem->>'id') into asset_ids
  from jsonb_array_elements(rpc_result::jsonb->'assets') elem;
  if asset_ids @> array[asset_legacy] then
    raise exception 'Legacy asset (shoot_id only) must not appear in V2 read';
  end if;
  if not (asset_ids @> array[asset_a1, asset_a2]) then
    raise exception 'Shoot A missing canonical assets for owner: %', asset_ids;
  end if;

  -- Org A member (non-owner): Shoot A assets → should also succeed (same org)
  perform set_config('request.jwt.claim.sub', user_a_member::text, true);
  select public.get_shoot_detail(shoot_a) into rpc_result;

  select jsonb_array_length(rpc_result::jsonb->'assets') into asset_count;
  if asset_count <> 2 then
    raise exception 'Shoot A should have 2 canonical assets for org member, got %', asset_count;
  end if;

  select array_agg(elem->>'id') into asset_ids
  from jsonb_array_elements(rpc_result::jsonb->'assets') elem;
  if not (asset_ids @> array[asset_a1, asset_a2]) then
    raise exception 'Shoot A missing canonical assets for org member: %', asset_ids;
  end if;

  -- Org B owner: Shoot B assets → should return 1 canonical asset (asset_b1)
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  select public.get_shoot_detail(shoot_b) into rpc_result;

  select jsonb_array_length(rpc_result::jsonb->'assets') into asset_count;
  if asset_count <> 1 then
    raise exception 'Shoot B should have 1 canonical asset, got %', asset_count;
  end if;

  select array_agg(elem->>'id') into asset_ids
  from jsonb_array_elements(rpc_result::jsonb->'assets') elem;
  if not (asset_ids @> array[asset_b1]) then
    raise exception 'Shoot B missing canonical asset: %', asset_ids;
  end if;

  -- Org B caller cannot read Shoot A (foreign org)
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  begin
    select public.get_shoot_detail(shoot_a) into rpc_result;
    raise exception 'Org B caller must be denied Shoot A (got result)';
  exception when sqlstate 'P0002' then
    -- Expected: not_found
  end;

  -- Unsigned caller fails closed
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    select public.get_shoot_detail(shoot_a) into rpc_result;
    raise exception 'Unsigned caller must fail closed (got result)';
  exception when sqlstate '42501' then
    -- Expected: unauthorized
  end;

  -- Wrong-brand link rejected by existing guard (assets_v2_shoot_brand_guard)
  -- Attempt to insert an asset with mismatched brand/shoot
  begin
    insert into public.assets (id, brand_id, v2_shoot_id, url, asset_type, status)
    values (gen_random_uuid(), brand_b, shoot_a, 'https://cld.example.com/wrong.jpg', 'image', 'ready');
    raise exception 'Wrong-brand asset/shoot link must be rejected by assets_v2_shoot_brand_guard';
  exception when sqlstate '23514' then
    -- Expected: check constraint violation
  end;

  -- Reverse guard: changing shoot.shoots.brand_id must not orphan linked assets
  begin
    update shoot.shoots set brand_id = brand_b where id = shoot_a;
    raise exception 'Shoot brand change must be blocked by shoot_v2_assets_brand_guard';
  exception when sqlstate '23514' then
    -- Expected: check constraint violation
  end;

  -- FK exists
  if not exists (
    select 1 from pg_constraint
    where conname = 'assets_v2_shoot_id_fkey'
      and conrelid = 'public.assets'::regclass
  ) then
    raise exception 'assets_v2_shoot_id_fkey missing';
  end if;

  -- Index exists
  if not exists (
    select 1 from pg_indexes
    where indexname = 'assets_v2_shoot_id_idx'
      and tablename = 'assets'
  ) then
    raise exception 'assets_v2_shoot_id_idx missing';
  end if;

  -- Triggers exist
  if not exists (
    select 1 from pg_trigger
    where tgname = 'assets_v2_shoot_brand_guard'
      and tgrelid = 'public.assets'::regclass
  ) then
    raise exception 'assets_v2_shoot_brand_guard trigger missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'shoot_v2_assets_brand_guard'
      and tgrelid = 'shoot.shoots'::regclass
  ) then
    raise exception 'shoot_v2_assets_brand_guard trigger missing';
  end if;

  raise notice 'IPI-1118 canonical read path tests PASSED';
end
$$;

rollback;