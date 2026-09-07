-- IPI-1074 · PLANS-001 — executable read-contract proof for the two read RPCs.
-- Runner: .github/workflows/ci.yml job plans-001-read-contract-acl
-- (after plans-001-read-contract-seed + 20260907120000_plans_001_read_contract migration).
-- Always rolls back. Asserts: EXECUTE ACL, org + role gating, enumeration-safe
-- not_found, cursor scoping (foreign/stale → safe page 1), literal search
-- escaping, and pagination with no duplicates/omissions.

begin;

do $$
declare
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();   -- org A member, viewer on inst_a
  user_a2 uuid := gen_random_uuid();  -- org A member, NO planner assignment
  user_a3 uuid := gen_random_uuid();  -- org A member, manager on inst_a
  user_b uuid := gen_random_uuid();   -- org B member
  wf_a uuid := gen_random_uuid();
  wf_b uuid := gen_random_uuid();
  phase_a uuid := gen_random_uuid();
  inst_a uuid := gen_random_uuid();
  inst_a2 uuid := gen_random_uuid();  -- same created_at as inst_a (ordering test)
  inst_b uuid := gen_random_uuid();
  inst_pct uuid := gen_random_uuid(); -- name contains literal % _ \
  inst_pct2 uuid := gen_random_uuid(); -- '100X cotton_shoot' — proves % is literal
  task_a uuid := gen_random_uuid();
  task_b uuid := gen_random_uuid();
  same_ts timestamptz := now();
  v_json json;
  v_rows jsonb;
  v_next_cursor uuid;
  v_has_more boolean;
  v_assignments jsonb;
  v_public_exec boolean;
  v_page1 jsonb;
  v_page1_cursor uuid;
  v_page2 jsonb;
  v_page2_cursor uuid;
  v_count int;
begin
  -- ── ACL: anon / PUBLIC cannot EXECUTE; authenticated can. ──────────────
  if has_function_privilege('anon', 'public.planner_list_instances(uuid,text,text,text,boolean,int,uuid)', 'execute') then
    raise exception 'anon must not EXECUTE planner_list_instances';
  end if;
  if has_function_privilege('anon', 'public.planner_get_instance_detail(uuid)', 'execute') then
    raise exception 'anon must not EXECUTE planner_get_instance_detail';
  end if;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) e
    where n.nspname = 'public'
      and p.proname = 'planner_list_instances'
      and pg_get_function_identity_arguments(p.oid) = 'uuid, text, text, text, boolean, integer, uuid'
      and e.privilege_type = 'EXECUTE'
      and e.grantee = 0
  ) into v_public_exec;
  if v_public_exec then
    raise exception 'PUBLIC must not EXECUTE planner_list_instances';
  end if;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) e
    where n.nspname = 'public'
      and p.proname = 'planner_get_instance_detail'
      and pg_get_function_identity_arguments(p.oid) = 'uuid'
      and e.privilege_type = 'EXECUTE'
      and e.grantee = 0
  ) into v_public_exec;
  if v_public_exec then
    raise exception 'PUBLIC must not EXECUTE planner_get_instance_detail';
  end if;

  if not has_function_privilege('authenticated', 'public.planner_list_instances(uuid,text,text,text,boolean,int,uuid)', 'execute') then
    raise exception 'authenticated must EXECUTE planner_list_instances';
  end if;
  if not has_function_privilege('authenticated', 'public.planner_get_instance_detail(uuid)', 'execute') then
    raise exception 'authenticated must EXECUTE planner_get_instance_detail';
  end if;

  -- ── Seed two orgs, three users, workflows, instances, tasks. ───────────
  insert into public.orgs (id) values (org_a), (org_b);
  insert into public.org_members (org_id, user_id) values
    (org_a, user_a),
    (org_a, user_a2),
    (org_a, user_a3),
    (org_b, user_b);

  insert into planner.workflows (id, org_id, name, category) values
    (wf_a, org_a, 'Editorial', 'shoot'),
    (wf_b, org_b, 'Campaign', 'campaign');

  insert into planner.phases (id, workflow_id, slug, name, order_index) values
    (phase_a, wf_a, 'prep', 'Prep', 1);

  insert into planner.instances (id, org_id, workflow_id, entity_type, entity_id, name, status, created_at) values
    (inst_a,  org_a, wf_a, 'shoot',    gen_random_uuid(), 'Org A shoot',      'active', same_ts),
    (inst_a2, org_a, wf_a, 'shoot',    gen_random_uuid(), 'Org A shoot two',  'active', same_ts),
    (inst_b,  org_b, wf_b, 'campaign', gen_random_uuid(), 'Org B campaign',   'active', now()),
    (inst_pct,org_a, wf_a, 'shoot',    gen_random_uuid(), '100% cotton_shoot\v2', 'draft', now()),
    (inst_pct2,org_a, wf_a, 'shoot',    gen_random_uuid(), '100X cotton_shoot',    'draft', now());

  insert into planner.tasks (id, instance_id, phase_id, title, status, sort_order) values
    (task_a, inst_a, phase_a, 'Task A', 'todo', 1),
    (task_b, inst_a, phase_a, 'Task B', 'done', 2);

  insert into planner.assignments (instance_id, user_id, role) values
    (inst_a,   user_a,  'viewer'),
    (inst_a2,  user_a,  'viewer'),
    (inst_pct, user_a,  'viewer'),
    (inst_pct2,user_a,  'viewer'),
    (inst_a,   user_a3, 'manager');

  execute 'set local role authenticated';

  -- ── S0: unsigned caller (no JWT sub) fails closed on both RPCs. ────────
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    select public.planner_list_instances(org_a, null, null, null, false, 20, null) into v_json;
    raise exception 'S0: unsigned caller list must raise 42501';
  exception
    when sqlstate '42501' then
      null;
  end;
  begin
    select public.planner_get_instance_detail(inst_a) into v_json;
    raise exception 'S0: unsigned caller detail must raise 42501';
  exception
    when sqlstate '42501' then
      null;
  end;

  -- ── S1: assigned Org A viewer sees Org A plan. ─────────────────────────
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  select public.planner_list_instances(org_a, null, null, null, false, 20, null) into v_json;
  v_rows := (v_json::jsonb -> 'rows');
  if jsonb_array_length(v_rows) <> 4 then
    raise exception 'S1: org A viewer must see 4 org A plans, got %', jsonb_array_length(v_rows);
  end if;
  if not exists (select 1 from jsonb_array_elements(v_rows) r where r->>'id' = inst_a::text) then
    raise exception 'S1: org A viewer must see inst_a in list';
  end if;
  if exists (select 1 from jsonb_array_elements(v_rows) r where r->>'id' = inst_b::text) then
    raise exception 'S1: org A viewer must NOT see org B inst_b';
  end if;

  -- ── S2: same-org member with no Planner assignment → empty list, P0002. ─
  perform set_config('request.jwt.claim.sub', user_a2::text, true);
  select public.planner_list_instances(org_a, null, null, null, false, 20, null) into v_json;
  v_rows := (v_json::jsonb -> 'rows');
  if jsonb_array_length(v_rows) <> 0 then
    raise exception 'S2: unassigned org A member must get empty list, got %', jsonb_array_length(v_rows);
  end if;
  begin
    select public.planner_get_instance_detail(inst_a) into v_json;
    raise exception 'S2: unassigned member detail must raise P0002';
  exception
    when sqlstate 'P0002' then
      null;
  end;

  -- ── S3: foreign-org user → no exposure; detail is enumeration-safe. ────
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  begin
    select public.planner_list_instances(org_a, null, null, null, false, 20, null) into v_json;
    raise exception 'S3: foreign user list on org A must raise 42501';
  exception
    when sqlstate '42501' then
      null;
  end;
  begin
    select public.planner_get_instance_detail(inst_a) into v_json;
    raise exception 'S3: foreign user detail must raise P0002 (enumeration-safe)';
  exception
    when sqlstate 'P0002' then
      null;
  end;

  -- ── S5: foreign cursor → safe page 1, no existence/order leak. ─────────
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  select public.planner_list_instances(org_a, null, null, null, false, 20, inst_b) into v_json;
  v_rows := (v_json::jsonb -> 'rows');
  if jsonb_array_length(v_rows) <> 4 then
    raise exception 'S5: foreign cursor must fall back to full page 1, got % rows', jsonb_array_length(v_rows);
  end if;

  -- ── S6: stale/deleted cursor → safe page 1. ────────────────────────────
  select public.planner_list_instances(org_a, null, null, null, false, 20, gen_random_uuid()) into v_json;
  v_rows := (v_json::jsonb -> 'rows');
  if jsonb_array_length(v_rows) <> 4 then
    raise exception 'S6: stale cursor must fall back to full page 1, got % rows', jsonb_array_length(v_rows);
  end if;

  -- ── S7: equal created_at → created_at DESC, id ASC; no dup/omission. ───
  -- Scope to status='active' so only inst_a/inst_a2 (same created_at) are in
  -- the page set; inst_pct (draft) is excluded from this pagination probe.
  select public.planner_list_instances(org_a, null, null, 'active', false, 1, null) into v_json;
  v_page1 := (v_json::jsonb -> 'rows');
  v_page1_cursor := (v_json::jsonb ->> 'nextCursor')::uuid;
  v_has_more := (v_json::jsonb ->> 'hasMore')::boolean;
  if jsonb_array_length(v_page1) <> 1 or not v_has_more then
    raise exception 'S7: page 1 must return 1 row with hasMore=true';
  end if;
  select public.planner_list_instances(org_a, null, null, 'active', false, 1, v_page1_cursor) into v_json;
  v_page2 := (v_json::jsonb -> 'rows');
  v_page2_cursor := (v_json::jsonb ->> 'nextCursor')::uuid;
  v_has_more := (v_json::jsonb ->> 'hasMore')::boolean;
  if jsonb_array_length(v_page2) <> 1 or v_has_more then
    raise exception 'S7: page 2 must return 1 row with hasMore=false';
  end if;
  if (v_page1 -> 0 ->> 'id') = (v_page2 -> 0 ->> 'id') then
    raise exception 'S7: duplicate row across pages';
  end if;
  if (v_page1 -> 0 ->> 'id') <> least(inst_a::text, inst_a2::text)
     or (v_page2 -> 0 ->> 'id') <> greatest(inst_a::text, inst_a2::text) then
    raise exception 'S7: equal-created_at rows must order by id ASC across pages';
  end if;
  if v_page2_cursor is not null then
    raise exception 'S7: final page must have null nextCursor';
  end if;

  -- ── S8: viewer detail → assignments = []. ──────────────────────────────
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  select public.planner_get_instance_detail(inst_a) into v_json;
  v_assignments := v_json::jsonb -> 'assignments';
  if jsonb_array_length(v_assignments) <> 0 then
    raise exception 'S8: viewer must get empty assignments, got %', jsonb_array_length(v_assignments);
  end if;
  if (v_json::jsonb -> 'instance' ->> 'id') <> inst_a::text then
    raise exception 'S8: viewer detail must return inst_a';
  end if;
  if jsonb_array_length(v_json::jsonb -> 'tasks') <> 2 then
    raise exception 'S8: viewer detail must include both tasks';
  end if;

  -- ── S9: manager detail → assignments visible. ──────────────────────────
  perform set_config('request.jwt.claim.sub', user_a3::text, true);
  select public.planner_get_instance_detail(inst_a) into v_json;
  v_assignments := v_json::jsonb -> 'assignments';
  if jsonb_array_length(v_assignments) <> 2 then
    raise exception 'S9: manager must see both assignments, got %', jsonb_array_length(v_assignments);
  end if;

  -- ── S10: literal % _ \ search matches only the literal string. ─────────
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  -- '%' is literal: '100%' must match only inst_pct, NOT inst_pct2 ('100X …').
  select public.planner_list_instances(org_a, '100%', null, null, false, 20, null) into v_json;
  v_rows := (v_json::jsonb -> 'rows');
  if jsonb_array_length(v_rows) <> 1 or (v_rows -> 0 ->> 'id') <> inst_pct::text then
    raise exception 'S10: literal %% search must match only inst_pct, got %', jsonb_array_length(v_rows);
  end if;
  -- '_' is literal: both inst_pct and inst_pct2 contain 'cotton_shoot'.
  select public.planner_list_instances(org_a, 'cotton_shoot', null, null, false, 20, null) into v_json;
  v_rows := (v_json::jsonb -> 'rows');
  if jsonb_array_length(v_rows) <> 2 then
    raise exception 'S10: literal _ search must match both cotton_shoot plans, got %', jsonb_array_length(v_rows);
  end if;
  select public.planner_list_instances(org_a, 'cottonXshoot', null, null, false, 20, null) into v_json;
  v_rows := (v_json::jsonb -> 'rows');
  if jsonb_array_length(v_rows) <> 0 then
    raise exception 'S10: _ must not act as a wildcard (cottonXshoot must match nothing)';
  end if;
  select public.planner_list_instances(org_a, 'shoot\v2', null, null, false, 20, null) into v_json;
  v_rows := (v_json::jsonb -> 'rows');
  if jsonb_array_length(v_rows) <> 1 or (v_rows -> 0 ->> 'id') <> inst_pct::text then
    raise exception 'S10: literal backslash search must match only inst_pct';
  end if;

  execute 'reset role';
end
$$;

rollback;