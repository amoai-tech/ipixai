-- IPI-1083 · SHOOT-SAVE-001 — behavioral save-once/tenant regression.
begin;

do $$
declare
  editor_a uuid := '10000000-0000-4000-8000-000000000001';
  viewer_a uuid := '10000000-0000-4000-8000-000000000002';
  editor_b uuid := '10000000-0000-4000-8000-000000000003';
  org_a uuid := '10000000-0000-4000-8000-00000000000a';
  org_b uuid := '10000000-0000-4000-8000-00000000000b';
  brand_a uuid := '10000000-0000-4000-8000-00000000000c';
  ref_id uuid;
  plan jsonb;
  staged jsonb;
  v_approval_id uuid;
  approval_hash text;
  rejected_id uuid;
  rejected_hash text;
  superseded_id uuid;
  superseded_hash text;
  malformed_id uuid;
  malformed_hash text;
  decision jsonb;
  saved jsonb;
  v_shoot_id uuid;
  before_count bigint;
  after_count bigint;
  detail jsonb;
  foreign_read_denied boolean := false;
begin
  if to_regprocedure('public.save_approved_shoot(uuid)') is null then
    raise exception 'IPI-1083: save_approved_shoot(uuid) missing';
  end if;
  if has_function_privilege('anon', 'public.save_approved_shoot(uuid)', 'execute')
     or has_function_privilege('service_role', 'public.save_approved_shoot(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_approved_shoot(uuid)', 'execute') then
    raise exception 'IPI-1083: save RPC grants are wrong';
  end if;

  select id into ref_id from shoot.shot_type_references order by id limit 1;
  if ref_id is null then raise exception 'IPI-1083: trusted reference seed missing'; end if;

  insert into auth.users (id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    (editor_a,'authenticated','authenticated','ipi1083-a@ipix.test',now(),'{"provider":"email"}','{}',now(),now()),
    (viewer_a,'authenticated','authenticated','ipi1083-viewer@ipix.test',now(),'{"provider":"email"}','{}',now(),now()),
    (editor_b,'authenticated','authenticated','ipi1083-b@ipix.test',now(),'{"provider":"email"}','{}',now(),now());
  insert into public.organizations (id,name,slug,type,owner_id) values
    (org_a,'IPI1083 A','ipi1083-a','brand_owner',editor_a),
    (org_b,'IPI1083 B','ipi1083-b','brand_owner',editor_b);
  insert into public.org_members (org_id,user_id,role) values
    (org_a,editor_a,'owner'),(org_a,viewer_a,'viewer'),(org_b,editor_b,'owner')
  on conflict (org_id,user_id) do update set role=excluded.role;
  insert into public.brands (id,user_id,name,org_id) values (brand_a,editor_a,'IPI1083 Brand',org_a);

  plan := jsonb_build_object(
    'channels', jsonb_build_array('shopify'),
    'productRefs', jsonb_build_array(jsonb_build_object('provider','shopify','providerProductId','gid://shopify/Product/123','providerVariantId','gid://shopify/ProductVariant/456','title','Black Dress')),
    'shootName', jsonb_build_object('status','confirmed','value','SS26 Black Dress','source','operator'),
    'brief', jsonb_build_object('status','confirmed','value','Clean PDP launch','source','operator'),
    'location', jsonb_build_object('status','confirmed','value','Studio A','source','operator'),
    'schedule', jsonb_build_object('status','confirmed','value',jsonb_build_object('startDate','2026-10-01','endDate','2026-10-02'),'source','operator'),
    'shootTypeResult', jsonb_build_object('status','ok','shootType','ecommerce_pdp'),
    'budgetResult', jsonb_build_object('status','ok','total',2500,'currency','USD'),
    'deliverablesResult', jsonb_build_object('status','ok','deliverables',jsonb_build_array(jsonb_build_object('channel','shopify','format','1:1 JPG','quantity',2))),
    'shotListResult', jsonb_build_object('status','ok','shots',jsonb_build_array(jsonb_build_object('shotNumber',1,'description','Front product','angle','front','lighting','softbox','referenceId',ref_id::text,'deliverableIds',jsonb_build_array('d-0')))),
    'referencesUsed', jsonb_build_array(jsonb_build_object('id',ref_id::text,'angle','front')),
    'status','complete'
  );

  perform set_config('role','service_role',true);
  staged := public.stage_shoot_plan_revision(brand_a,'ipi1083-run',plan,editor_a,'ipi1083-thread',null);
  v_approval_id := (staged->>'approvalId')::uuid;
  approval_hash := staged->>'planHash';
  if v_approval_id is null then raise exception 'IPI-1083: staging failed: %', staged; end if;

  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',format('{"sub":"%s"}',editor_a),true);
  decision := public.decide_shoot_plan_revision(v_approval_id,1,approval_hash,'approved','ipi1083-approve',null);
  if (decision->>'ok')::boolean is not true then raise exception 'IPI-1083: approval failed: %', decision; end if;

  select count(*) into before_count from shoot.shoots where approval_id = v_approval_id;
  saved := public.save_approved_shoot(v_approval_id);
  if (saved->>'ok')::boolean is not true or (saved->>'replayed')::boolean is not false then
    raise exception 'IPI-1083: first save failed: %', saved;
  end if;
  v_shoot_id := (saved->>'shootId')::uuid;
  if v_shoot_id is null then raise exception 'IPI-1083: save returned no shootId'; end if;

  if not exists (
    select 1 from shoot.shoots s
    where s.id=v_shoot_id and s.brand_id=brand_a and s.created_by=editor_a
      and s.name='SS26 Black Dress' and s.approval_id=v_approval_id
      and s.approval_revision=1 and s.approval_plan_hash=approval_hash
      and s.approved_plan=plan and s.planned_shoot_type='ecommerce_pdp'
  ) then raise exception 'IPI-1083: parent/provenance mapping wrong'; end if;
  if (select count(*) from shoot.shoot_deliverables where shoot_id=v_shoot_id) <> 1 then
    raise exception 'IPI-1083: deliverables not persisted';
  end if;
  if not exists (select 1 from shoot.shot_list where shoot_id=v_shoot_id and reference_id=ref_id and angle='front' and lighting='softbox') then
    raise exception 'IPI-1083: shot reference provenance not persisted';
  end if;
  if not exists (
    select 1 from shoot.shot_deliverable_links l
    join shoot.shot_list sl on sl.id=l.shot_id
    join shoot.shoot_deliverables d on d.id=l.deliverable_id
    where sl.shoot_id=v_shoot_id and d.shoot_id=v_shoot_id
  ) then raise exception 'IPI-1083: shot-to-deliverable coverage link not persisted'; end if;

  -- Canonical read-after-save: the existing detail RPC must expose the same
  -- approval snapshot and trusted reference identity to the authorized org.
  detail := public.get_shoot_detail(v_shoot_id)::jsonb;
  if detail #>> '{shoot,approval_id}' is distinct from v_approval_id::text
     or (detail #>> '{shoot,approval_revision}')::int <> 1
     or detail #>> '{shoot,approval_plan_hash}' is distinct from approval_hash
     or detail #> '{shoot,approved_plan}' is distinct from plan
     or detail #>> '{shots,0,reference_id}' is distinct from ref_id::text then
    raise exception 'IPI-1083: canonical read-after-save lost approval/reference provenance: %', detail;
  end if;

  saved := public.save_approved_shoot(v_approval_id);
  if (saved->>'replayed')::boolean is not true or (saved->>'shootId')::uuid <> v_shoot_id then
    raise exception 'IPI-1083: replay did not return same shoot: %', saved;
  end if;
  select count(*) into after_count from shoot.shoots where approval_id = v_approval_id;
  if after_count <> 1 then raise exception 'IPI-1083: duplicate shoot created'; end if;

  -- Rejected approval: zero writes.
  perform set_config('role','service_role',true);
  staged := public.stage_shoot_plan_revision(brand_a,'ipi1083-rejected',plan,editor_a,'ipi1083-thread-rejected',null);
  rejected_id := (staged->>'approvalId')::uuid;
  rejected_hash := staged->>'planHash';
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',format('{"sub":"%s"}',editor_a),true);
  decision := public.decide_shoot_plan_revision(rejected_id,1,rejected_hash,'rejected','ipi1083-reject',null);
  saved := public.save_approved_shoot(rejected_id);
  if saved->>'code' is distinct from 'NOT_APPROVED' then raise exception 'IPI-1083: rejected approval must not save: %', saved; end if;
  if exists (select 1 from shoot.shoots where approval_id=rejected_id) then raise exception 'IPI-1083: rejected approval wrote a shoot'; end if;

  -- Previously approved revision becomes unsaveable after a newer revision is staged.
  perform set_config('role','service_role',true);
  staged := public.stage_shoot_plan_revision(brand_a,'ipi1083-superseded',plan,editor_a,'ipi1083-thread-superseded',null);
  superseded_id := (staged->>'approvalId')::uuid;
  superseded_hash := staged->>'planHash';
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',format('{"sub":"%s"}',editor_a),true);
  decision := public.decide_shoot_plan_revision(superseded_id,1,superseded_hash,'approved','ipi1083-superseded-approve',null);
  perform set_config('role','service_role',true);
  staged := public.stage_shoot_plan_revision(brand_a,'ipi1083-superseded',plan || '{"risks":["revision 2"]}'::jsonb,editor_a,'ipi1083-thread-superseded',null);
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',format('{"sub":"%s"}',editor_a),true);
  saved := public.save_approved_shoot(superseded_id);
  if saved->>'code' is distinct from 'SUPERSEDED_REVISION' then raise exception 'IPI-1083: superseded approval must not save: %', saved; end if;
  if exists (select 1 from shoot.shoots where approval_id=superseded_id) then raise exception 'IPI-1083: superseded approval wrote a shoot'; end if;

  -- Malformed approved child: typed INVALID_PLAN and transaction rolls back.
  perform set_config('role','service_role',true);
  staged := public.stage_shoot_plan_revision(
    brand_a,
    'ipi1083-malformed',
    jsonb_set(plan, '{shotListResult,shots,0}', (plan #> '{shotListResult,shots,0}') - 'description'),
    editor_a,
    'ipi1083-thread-malformed',
    null
  );
  malformed_id := (staged->>'approvalId')::uuid;
  malformed_hash := staged->>'planHash';
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',format('{"sub":"%s"}',editor_a),true);
  decision := public.decide_shoot_plan_revision(malformed_id,1,malformed_hash,'approved','ipi1083-malformed-approve',null);
  saved := public.save_approved_shoot(malformed_id);
  if saved->>'code' is distinct from 'INVALID_PLAN' then raise exception 'IPI-1083: malformed approved child must return INVALID_PLAN: %', saved; end if;
  if exists (select 1 from shoot.shoots where approval_id=malformed_id) then raise exception 'IPI-1083: malformed child left partial parent write'; end if;

  perform set_config('request.jwt.claims',format('{"sub":"%s"}',viewer_a),true);
  saved := public.save_approved_shoot(v_approval_id);
  if saved->>'code' is distinct from 'FORBIDDEN' then raise exception 'IPI-1083: viewer must be denied: %', saved; end if;
  perform set_config('request.jwt.claims',format('{"sub":"%s"}',editor_b),true);
  saved := public.save_approved_shoot(v_approval_id);
  if saved->>'code' is distinct from 'FORBIDDEN' then raise exception 'IPI-1083: Org B must be denied: %', saved; end if;

  begin
    detail := public.get_shoot_detail(v_shoot_id)::jsonb;
  exception when no_data_found then
    foreign_read_denied := true;
  end;
  if not foreign_read_denied then
    raise exception 'IPI-1083: Org B must not reopen Org A shoot';
  end if;

  perform set_config('request.jwt.claims','{}',true);
  saved := public.save_approved_shoot(v_approval_id);
  if saved->>'code' is distinct from 'UNAUTHENTICATED' then raise exception 'IPI-1083: unauthenticated must be denied: %', saved; end if;
end
$$;

rollback;
