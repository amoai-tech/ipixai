-- IPI-1093 · BRAND-INTEL-001 — DB write-boundary negative security tests.
--
-- Proves 20260911000000_ipi1093_brand_db_write_boundary.sql actually closes
-- the direct-write bypass, and that the approve/reject RPC contract it
-- leaves in place still behaves correctly end to end. Runs inside the
-- supabase-fresh-replay job, after the full migration replay (real
-- auth.users/organizations/org_members schema required).
--
-- Rollback: none — proof only, wrapped in begin/rollback.

begin;

do $$
declare
  org_a         uuid := gen_random_uuid();
  org_b         uuid := gen_random_uuid();
  org_a_owner   uuid := gen_random_uuid();
  org_a_editor  uuid := gen_random_uuid();
  org_a_viewer  uuid := gen_random_uuid();
  org_b_editor  uuid := gen_random_uuid();
  brand_a       uuid := gen_random_uuid();
  wf_run_1      text := 'wf-' || gen_random_uuid()::text;
  wf_run_2      text := 'wf-' || gen_random_uuid()::text;
  draft_1       jsonb;
  draft_2       jsonb;
  hash_1        text;
  hash_2        text;
  result        jsonb;
  row_count     int;
  brand_state   record;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (org_a_owner,  'authenticated', 'authenticated', 'ipi1093-wb-org-a-owner@ipix.test',  now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (org_a_editor, 'authenticated', 'authenticated', 'ipi1093-wb-org-a-editor@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (org_a_viewer, 'authenticated', 'authenticated', 'ipi1093-wb-org-a-viewer@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (org_b_editor, 'authenticated', 'authenticated', 'ipi1093-wb-org-b-editor@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.organizations (id, name, slug, type, owner_id, plan)
  values
    (org_a, 'IPI1093 WB Org A', 'ipi1093-wb-org-a', 'agency', org_a_owner, 'free'),
    (org_b, 'IPI1093 WB Org B', 'ipi1093-wb-org-b', 'agency', org_b_editor, 'free');

  -- organizations has an auto-owner trigger that already inserts the
  -- owner's org_members row; ON CONFLICT DO NOTHING covers both that and
  -- the case where it doesn't (repo behavior, not under test here).
  insert into public.org_members (org_id, user_id, role) values
    (org_a, org_a_owner,  'owner'),
    (org_a, org_a_editor, 'editor'),
    (org_a, org_a_viewer, 'viewer'),
    (org_b, org_b_editor, 'owner')
  on conflict (org_id, user_id) do nothing;

  draft_1 := jsonb_build_object(
    'schemaVersion', 2,
    'name', 'IPI1093 WB Brand',
    '_workflow_run_id', wf_run_1,
    '_draft_scores', jsonb_build_array(
      jsonb_build_object('score_type', 'visual_identity', 'score', 82, 'source', 'mastra_agent')
    )
  );

  insert into public.brands (id, user_id, org_id, name, ai_profile_draft)
  values (brand_a, org_a_owner, org_a, 'IPI1093 WB Brand', draft_1);

  insert into public.brand_crawls (brand_id, source_url, workflow_id)
  values (brand_a, 'https://ipi1093-wb.test', wf_run_1);

  select public.get_brand_draft_hash(brand_a) into hash_1;

  -- ==========================================================================
  -- 1-3. Direct writes are blocked at the GRANT layer, not just RLS, for
  --      every role — owner/editor/viewer alike, since the revoke applies to
  --      the whole `authenticated` role regardless of org membership.
  -- ==========================================================================

  -- (1) owner cannot directly set governed brands columns.
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_a_owner)::text);
  begin
    update public.brands set ai_profile = '{"hacked":true}'::jsonb where id = brand_a;
    reset role;
    raise exception 'IPI-1093 FAIL: org A owner must not be able to UPDATE brands.ai_profile directly';
  exception
    when insufficient_privilege then reset role;
  end;

  -- (2) editor cannot directly set approved_* columns either.
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_a_editor)::text);
  begin
    update public.brands
      set approved_profile_at = now(), approved_profile_version = 999, approved_draft_hash = 'forged'
      where id = brand_a;
    reset role;
    raise exception 'IPI-1093 FAIL: org A editor must not be able to UPDATE brands.approved_* directly';
  exception
    when insufficient_privilege then reset role;
  end;

  -- (2b) editor cannot directly insert/update brand_scores either.
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_a_editor)::text);
  begin
    insert into public.brand_scores (brand_id, score_type, score) values (brand_a, 'forged', 100);
    reset role;
    raise exception 'IPI-1093 FAIL: org A editor must not be able to INSERT brand_scores directly';
  exception
    when insufficient_privilege then reset role;
  end;

  -- (3) viewer is blocked the same way (defense-in-depth: this role never had
  --     write RLS either, but the grant now fails closed even before RLS).
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_a_viewer)::text);
  begin
    update public.brands set name = 'renamed by viewer' where id = brand_a;
    reset role;
    raise exception 'IPI-1093 FAIL: org A viewer must not be able to UPDATE brands at all';
  exception
    when insufficient_privilege then reset role;
  end;

  -- (3b) INSERT is a separate grant from UPDATE — an org member must not be
  --      able to fabricate "already approved" truth on a BRAND-NEW row by
  --      listing governed columns in the INSERT statement. Column-level
  --      INSERT privilege must reject any column outside
  --      (id, name, org_id, user_id, brand_url), not just narrow which rows
  --      are visible afterward.
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_a_owner)::text);
  begin
    insert into public.brands (id, user_id, org_id, name, ai_profile, approved_profile_at, approved_profile_version, approved_draft_hash)
    values (gen_random_uuid(), org_a_owner, org_a, 'Forged Approved Brand', '{"schemaVersion":2,"name":"forged"}'::jsonb, now(), 1, 'forged-hash');
    reset role;
    raise exception 'IPI-1093 FAIL: org A owner must not be able to INSERT a brand row with fabricated approved truth';
  exception
    when insufficient_privilege then reset role;
  end;

  -- (3c) the legitimate INSERT path (materialize_onboarding_session's own
  --      column list) must still work — this migration must narrow, not
  --      break, brand creation.
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_a_owner)::text);
  insert into public.brands (id, name, org_id, user_id, brand_url)
  values (gen_random_uuid(), 'Legit New Brand', org_a, org_a_owner, 'https://legit.test');
  reset role;

  -- ==========================================================================
  -- Cross-org and stale-hash calls must fail closed BEFORE any real approval.
  -- ==========================================================================

  -- (8) cross-org editor cannot approve org A's brand.
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_b_editor)::text);
  select public.approve_brand_intelligence_draft(brand_a, hash_1) into result;
  reset role;
  if result->>'code' is distinct from 'FORBIDDEN' then
    raise exception 'IPI-1093 FAIL: cross-org approve must return FORBIDDEN, got: %', result;
  end if;

  -- (7) stale/forged hash fails closed for the real org.
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_a_editor)::text);
  select public.approve_brand_intelligence_draft(brand_a, 'not-the-real-hash') into result;
  reset role;
  if result->>'code' is distinct from 'STALE_DRAFT' then
    raise exception 'IPI-1093 FAIL: wrong-hash approve must return STALE_DRAFT, got: %', result;
  end if;

  -- ==========================================================================
  -- (4)(5) The approval RPC itself remains the only path that can promote
  --        truth, and it does so completely and atomically.
  -- ==========================================================================

  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_a_editor)::text);
  select public.approve_brand_intelligence_draft(brand_a, hash_1) into result;
  reset role;
  if result->>'ok' is distinct from 'true' or result->>'code' is distinct from 'APPROVED' or result->>'profile_version' is distinct from '1' then
    raise exception 'IPI-1093 FAIL: valid editor approve must succeed as APPROVED v1, got: %', result;
  end if;

  select ai_profile, ai_profile_draft, approved_profile_at, approved_profile_version, approved_draft_hash
    into brand_state
    from public.brands where id = brand_a;
  if brand_state.ai_profile->>'name' is distinct from 'IPI1093 WB Brand'
     or brand_state.ai_profile ? '_draft_scores'
     or brand_state.ai_profile_draft is not null
     or brand_state.approved_profile_at is null
     or brand_state.approved_profile_version is distinct from 1
     or brand_state.approved_draft_hash is distinct from hash_1 then
    raise exception 'IPI-1093 FAIL: approved brand state does not match the exact reviewed draft: %', brand_state;
  end if;

  select count(*) into row_count from public.brand_scores
    where brand_id = brand_a and score_type = 'visual_identity' and score = 82;
  if row_count is distinct from 1 then
    raise exception 'IPI-1093 FAIL: expected exactly 1 matching brand_scores row after approval, got %', row_count;
  end if;

  select count(*) into row_count from public.brand_profile_approvals
    where brand_id = brand_a and draft_hash = hash_1 and decision = 'approved';
  if row_count is distinct from 1 then
    raise exception 'IPI-1093 FAIL: expected exactly 1 approval audit row for hash_1, got %', row_count;
  end if;

  -- ==========================================================================
  -- (6) Replay: the draft is cleared on success, so an operator double-click
  --     must not resurrect it or duplicate any side effect.
  -- ==========================================================================

  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_a_editor)::text);
  select public.approve_brand_intelligence_draft(brand_a, hash_1) into result;
  reset role;
  if result->>'ok' is distinct from 'false' or result->>'code' is distinct from 'NO_DRAFT' then
    raise exception 'IPI-1093 FAIL: replayed approve on a cleared draft must return NO_DRAFT, got: %', result;
  end if;

  select count(*) into row_count from public.brand_scores where brand_id = brand_a;
  if row_count is distinct from 1 then
    raise exception 'IPI-1093 FAIL: replay must not duplicate brand_scores rows, got %', row_count;
  end if;

  select count(*) into row_count from public.brand_profile_approvals where brand_id = brand_a;
  if row_count is distinct from 1 then
    raise exception 'IPI-1093 FAIL: replay must not duplicate the approval audit row, got %', row_count;
  end if;

  -- ==========================================================================
  -- (9) Reject must discard the new draft only, never touch prior approved
  --     truth.
  -- ==========================================================================

  draft_2 := jsonb_build_object(
    'schemaVersion', 2,
    'name', 'IPI1093 WB Brand v2',
    '_workflow_run_id', wf_run_2,
    '_draft_scores', jsonb_build_array(
      jsonb_build_object('score_type', 'visual_identity', 'score', 40, 'source', 'mastra_agent')
    )
  );

  insert into public.brand_crawls (brand_id, source_url, workflow_id)
  values (brand_a, 'https://ipi1093-wb.test', wf_run_2);

  -- Fixture write as table owner (mirrors the Mastra workflow's service-role
  -- write) — not a claim under test, the RPC boundary above already is.
  update public.brands set ai_profile_draft = draft_2 where id = brand_a;

  select public.get_brand_draft_hash(brand_a) into hash_2;

  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_a_editor)::text);
  select public.reject_brand_intelligence_draft(brand_a, hash_2) into result;
  reset role;
  if result->>'ok' is distinct from 'true' or result->>'code' is distinct from 'REJECTED' then
    raise exception 'IPI-1093 FAIL: valid editor reject must succeed as REJECTED, got: %', result;
  end if;

  select ai_profile, ai_profile_draft, approved_profile_at, approved_profile_version, approved_draft_hash
    into brand_state
    from public.brands where id = brand_a;
  if brand_state.ai_profile->>'name' is distinct from 'IPI1093 WB Brand'
     or brand_state.ai_profile_draft is not null
     or brand_state.approved_profile_version is distinct from 1
     or brand_state.approved_draft_hash is distinct from hash_1 then
    raise exception 'IPI-1093 FAIL: reject must preserve the prior approved profile/version/hash unchanged: %', brand_state;
  end if;

  select count(*) into row_count from public.brand_scores
    where brand_id = brand_a and score_type = 'visual_identity' and score = 82;
  if row_count is distinct from 1 then
    raise exception 'IPI-1093 FAIL: reject must not touch the previously approved brand_scores row, got %', row_count;
  end if;

  raise notice 'IPI-1093 brand DB write-boundary PASS';
end;
$$;

rollback;
