-- IPI-1119 · MEDIA-APPROVAL-001 — exact-version approval/rejection regression.
-- Runner: .github/workflows/ci.yml job supabase-fresh-replay (full migration
-- chain replay, including 20260915000000_ipi1119_media_approval.sql).
--
-- Covers:
--   approve/reject exact version; alreadysame-decision replay; opposite decision
--   finalized; stale version no-write; request_id replay; request_id conflict;
--   strictly-newer overwrite resets approval to pending; equal-version
--   rename/retry preserves approval; cross-org + viewer + anon denial;
--   get_shoot_detail exposes immutable provider id/version/approval;
--   function ACL (authenticated only).

begin;

do $$
declare
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  brand_a uuid := gen_random_uuid();
  brand_b uuid := gen_random_uuid();
  user_owner uuid := gen_random_uuid();
  user_viewer uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  shoot_a uuid := gen_random_uuid();
  asset_a uuid := gen_random_uuid();
  provider_a text := 'ipi1119-provider-a';
  r jsonb;
  detail json;
  approval_text text;
  version_num bigint;
  provider_seen text;
  actor_seen uuid;
  decision_count int;
begin
  if to_regprocedure('public.decide_asset_version(uuid,text,bigint,text,text,text)') is null then
    raise exception 'decide_asset_version missing — apply IPI-1119 migration first';
  end if;

  -- Fixtures -----------------------------------------------------------------
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (user_owner, 'authenticated', 'authenticated', 'ipi1119-owner@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (user_viewer, 'authenticated', 'authenticated', 'ipi1119-viewer@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (user_b, 'authenticated', 'authenticated', 'ipi1119-orgb@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.organizations (id, name, slug, type, owner_id, plan) values
    (org_a, 'Org A', 'ipi1119-org-a', 'brand', user_owner, 'free'),
    (org_b, 'Org B', 'ipi1119-org-b', 'brand', user_b, 'free');

  insert into public.org_members (org_id, user_id, role) values
    (org_a, user_owner, 'owner'),
    (org_a, user_viewer, 'viewer'),
    (org_b, user_b, 'owner')
    on conflict (org_id, user_id) do nothing;

  insert into public.brands (id, org_id, user_id, name) values
    (brand_a, org_a, user_owner, 'Brand A'),
    (brand_b, org_b, user_b, 'Brand B');

  insert into shoot.shoots (id, brand_id, name, type, status)
  values (shoot_a, brand_a, 'Shoot A', 'editorial_campaign', 'planning');

  -- First-seen trusted upload v5 creates asset + mirror + pending approval.
  r := public.apply_cloudinary_asset_event(jsonb_build_object(
    'kind', 'upload',
    'cloudinary_asset_id', provider_a,
    'version', 5,
    'public_id', 'ipix/ipi1119/a',
    'secure_url', 'https://res.example/ipi1119-a',
    'resource_type', 'image',
    'delivery_type', 'authenticated',
    'request_id', 'ipi1119-req-first',
    'asset_id', asset_a,
    'brand_id', brand_a,
    'org_id', org_a,
    'v2_shoot_id', shoot_a,
    'schema_version', '1',
    'format', 'jpg'
  ));
  if r->>'outcome' is distinct from 'applied' then
    raise exception 'first-seen upload expected applied, got %', r;
  end if;

  select approval into strict approval_text
  from public.cloudinary_assets where cloudinary_asset_id = provider_a;
  if approval_text is distinct from 'pending' then
    raise exception 'first-seen approval expected pending, got %', approval_text;
  end if;

  ---------------------------------------------------------------------------
  -- Authorization: anon / viewer / cross-org all fail closed
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', '', true);
  r := public.decide_asset_version(asset_a, provider_a, 5, 'approved', null, 'ipi1119-req-anon');
  if r->>'code' is distinct from 'UNAUTHENTICATED' then
    raise exception 'anon expected UNAUTHENTICATED, got %', r;
  end if;

  perform set_config('request.jwt.claim.sub', user_viewer::text, true);
  r := public.decide_asset_version(asset_a, provider_a, 5, 'approved', null, 'ipi1119-req-viewer');
  if r->>'code' is distinct from 'FORBIDDEN' then
    raise exception 'viewer expected FORBIDDEN, got %', r;
  end if;

  perform set_config('request.jwt.claim.sub', user_b::text, true);
  r := public.decide_asset_version(asset_a, provider_a, 5, 'approved', null, 'ipi1119-req-orgb');
  if r->>'code' is distinct from 'FORBIDDEN' then
    raise exception 'cross-org expected FORBIDDEN, got %', r;
  end if;

  select count(*) into decision_count
  from public.asset_events where asset_id = asset_a and kind in ('approved','rejected');
  if decision_count <> 0 then
    raise exception 'denied attempts must not write decisions, found %', decision_count;
  end if;

  ---------------------------------------------------------------------------
  -- Owner approves the exact version
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', user_owner::text, true);
  r := public.decide_asset_version(asset_a, provider_a, 5, 'approved', 'looks on brand', 'ipi1119-req-approve');
  if (r->>'ok')::boolean is not true or r->>'code' is distinct from 'APPROVED' then
    raise exception 'owner approve expected APPROVED, got %', r;
  end if;

  select approval into strict approval_text
  from public.cloudinary_assets where cloudinary_asset_id = provider_a;
  if approval_text is distinct from 'approved' then
    raise exception 'convenience approval expected approved, got %', approval_text;
  end if;

  select actor_id, version into strict actor_seen, version_num
  from public.asset_events
  where asset_id = asset_a and kind = 'approved';
  if actor_seen is distinct from user_owner then
    raise exception 'approved event actor expected owner, got %', actor_seen;
  end if;
  if version_num <> 5 then
    raise exception 'approved event version expected 5, got %', version_num;
  end if;

  ---------------------------------------------------------------------------
  -- Idempotency: same request_id replay and same-decision retry
  ---------------------------------------------------------------------------
  r := public.decide_asset_version(asset_a, provider_a, 5, 'approved', 'looks on brand', 'ipi1119-req-approve');
  if (r->>'ok')::boolean is not true or r->>'code' is distinct from 'ALREADY_APPROVED' then
    raise exception 'same request replay expected ALREADY_APPROVED, got %', r;
  end if;

  r := public.decide_asset_version(asset_a, provider_a, 5, 'approved', null, 'ipi1119-req-approve-2');
  if (r->>'ok')::boolean is not true or r->>'code' is distinct from 'ALREADY_APPROVED' then
    raise exception 'same-decision retry expected ALREADY_APPROVED, got %', r;
  end if;

  select count(*) into decision_count
  from public.asset_events where asset_id = asset_a and kind in ('approved','rejected');
  if decision_count <> 1 then
    raise exception 'idempotent replays must keep one durable decision, found %', decision_count;
  end if;

  ---------------------------------------------------------------------------
  -- Opposite decision for the same exact version is refused
  ---------------------------------------------------------------------------
  r := public.decide_asset_version(asset_a, provider_a, 5, 'rejected', 'changed my mind', 'ipi1119-req-reject');
  if (r->>'ok')::boolean is not false or r->>'code' is distinct from 'DECISION_FINALIZED' then
    raise exception 'opposite decision expected DECISION_FINALIZED, got %', r;
  end if;

  select approval into strict approval_text
  from public.cloudinary_assets where cloudinary_asset_id = provider_a;
  if approval_text is distinct from 'approved' then
    raise exception 'finalized refusal must not change approval, got %', approval_text;
  end if;

  ---------------------------------------------------------------------------
  -- Stale expected version performs no write
  ---------------------------------------------------------------------------
  r := public.decide_asset_version(asset_a, provider_a, 4, 'rejected', null, 'ipi1119-req-stale');
  if (r->>'ok')::boolean is not false or r->>'code' is distinct from 'STALE_VERSION' then
    raise exception 'stale expected version expected STALE_VERSION, got %', r;
  end if;

  select count(*) into decision_count
  from public.asset_events where asset_id = asset_a and kind in ('approved','rejected');
  if decision_count <> 1 then
    raise exception 'stale attempt must not write, found % decisions', decision_count;
  end if;

  ---------------------------------------------------------------------------
  -- Strictly newer overwrite (v6) resets convenience approval to pending
  ---------------------------------------------------------------------------
  r := public.apply_cloudinary_asset_event(jsonb_build_object(
    'kind', 'overwrite',
    'cloudinary_asset_id', provider_a,
    'version', 6,
    'public_id', 'ipix/ipi1119/a',
    'secure_url', 'https://res.example/ipi1119-a-v6',
    'request_id', 'ipi1119-req-overwrite-v6'
  ));
  if r->>'outcome' is distinct from 'applied' then
    raise exception 'overwrite v6 expected applied, got %', r;
  end if;

  select approval, version into strict approval_text, version_num
  from public.cloudinary_assets where cloudinary_asset_id = provider_a;
  if version_num <> 6 then
    raise exception 'overwrite should advance version to 6, got %', version_num;
  end if;
  if approval_text is distinct from 'pending' then
    raise exception 'approved N + overwrite N+1 must reset to pending, got %', approval_text;
  end if;

  -- decision on the now-stale v5 is refused
  r := public.decide_asset_version(asset_a, provider_a, 5, 'approved', null, 'ipi1119-req-old5');
  if r->>'code' is distinct from 'STALE_VERSION' then
    raise exception 'decision on replaced version expected STALE_VERSION, got %', r;
  end if;

  ---------------------------------------------------------------------------
  -- Same-version rename/retry preserves approval
  ---------------------------------------------------------------------------
  -- Approve v6, then an equal-version rename must NOT clear it.
  r := public.decide_asset_version(asset_a, provider_a, 6, 'approved', null, 'ipi1119-req-approve-v6');
  if r->>'code' is distinct from 'APPROVED' then
    raise exception 'approve v6 expected APPROVED, got %', r;
  end if;

  r := public.apply_cloudinary_asset_event(jsonb_build_object(
    'kind', 'rename',
    'cloudinary_asset_id', provider_a,
    'version', 6,
    'public_id', 'ipix/ipi1119/a-renamed',
    'secure_url', 'https://res.example/ipi1119-a-renamed',
    'request_id', 'ipi1119-req-rename-v6'
  ));
  if (r->>'outcome') not in ('noop_equal_version', 'noop_duplicate') then
    raise exception 'equal-version rename expected noop, got %', r;
  end if;

  select approval into strict approval_text
  from public.cloudinary_assets where cloudinary_asset_id = provider_a;
  if approval_text is distinct from 'approved' then
    raise exception 'same-version rename must preserve approval, got %', approval_text;
  end if;

  ---------------------------------------------------------------------------
  -- Rejected N + overwrite N+1 -> pending; then rejected + equal-version preserved
  ---------------------------------------------------------------------------
  r := public.apply_cloudinary_asset_event(jsonb_build_object(
    'kind', 'overwrite',
    'cloudinary_asset_id', provider_a,
    'version', 7,
    'public_id', 'ipix/ipi1119/a-renamed',
    'secure_url', 'https://res.example/ipi1119-a-v7',
    'request_id', 'ipi1119-req-overwrite-v7'
  ));
  if r->>'outcome' is distinct from 'applied' then
    raise exception 'overwrite v7 expected applied, got %', r;
  end if;

  r := public.decide_asset_version(asset_a, provider_a, 7, 'rejected', 'off brand', 'ipi1119-req-reject-v7');
  if r->>'code' is distinct from 'REJECTED' then
    raise exception 'reject v7 expected REJECTED, got %', r;
  end if;

  r := public.apply_cloudinary_asset_event(jsonb_build_object(
    'kind', 'rename',
    'cloudinary_asset_id', provider_a,
    'version', 7,
    'public_id', 'ipix/ipi1119/a-renamed-2',
    'secure_url', 'https://res.example/ipi1119-a-renamed-2',
    'request_id', 'ipi1119-req-rename-v7'
  ));
  select approval into strict approval_text
  from public.cloudinary_assets where cloudinary_asset_id = provider_a;
  if approval_text is distinct from 'rejected' then
    raise exception 'same-version retry must preserve rejected, got %', approval_text;
  end if;

  -- newer version again wipes the rejected decision
  r := public.apply_cloudinary_asset_event(jsonb_build_object(
    'kind', 'overwrite',
    'cloudinary_asset_id', provider_a,
    'version', 8,
    'public_id', 'ipix/ipi1119/a-renamed-2',
    'secure_url', 'https://res.example/ipi1119-a-v8',
    'request_id', 'ipi1119-req-overwrite-v8'
  ));
  select approval into strict approval_text
  from public.cloudinary_assets where cloudinary_asset_id = provider_a;
  if approval_text is distinct from 'pending' then
    raise exception 'rejected N + overwrite N+1 must reset to pending, got %', approval_text;
  end if;

  ---------------------------------------------------------------------------
  -- Read contract exposes immutable provider id + exact version + approval
  ---------------------------------------------------------------------------
  select public.get_shoot_detail(shoot_a) into detail;
  select elem->>'cloudinary_asset_id', (elem->>'version')::bigint, elem->>'approval'
    into provider_seen, version_num, approval_text
  from jsonb_array_elements(detail::jsonb->'assets') elem
  where elem->>'id' = asset_a::text;
  if provider_seen is distinct from provider_a then
    raise exception 'get_shoot_detail must expose cloudinary_asset_id, got %', provider_seen;
  end if;
  if version_num <> 8 then
    raise exception 'get_shoot_detail must expose exact version 8, got %', version_num;
  end if;
  if approval_text is distinct from 'pending' then
    raise exception 'get_shoot_detail must expose approval pending, got %', approval_text;
  end if;

  ---------------------------------------------------------------------------
  -- Function ACL: authenticated may call; anon/service_role may not
  ---------------------------------------------------------------------------
  if not has_function_privilege('authenticated', 'public.decide_asset_version(uuid,text,bigint,text,text,text)', 'execute') then
    raise exception 'authenticated must be able to execute decide_asset_version';
  end if;
  if has_function_privilege('anon', 'public.decide_asset_version(uuid,text,bigint,text,text,text)', 'execute') then
    raise exception 'anon must not execute decide_asset_version';
  end if;
  if has_function_privilege('service_role', 'public.decide_asset_version(uuid,text,bigint,text,text,text)', 'execute') then
    raise exception 'service_role must not execute decide_asset_version (human approval is authenticated-only)';
  end if;

  raise notice 'IPI-1119 media approval exact-version tests PASSED';
end
$$;

rollback;
