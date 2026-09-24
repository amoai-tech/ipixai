-- IPI-1311 · AUTH-ORG-SINGLE-001 — regression proof that public.org_members
-- enforces at most one membership per user, and that a user who already has
-- a membership can never end up owning a second, partial organization.
--
-- Covers the task's Step 2 checkpoints: a duplicate org_members insert must
-- be rejected by the database (never silently accepted), an existing single
-- membership must remain untouched by a rejected attempt, and the
-- auto_add_org_owner() trigger must fail the WHOLE organizations insert
-- atomically (no orphaned/partial organization with zero members) rather
-- than silently swallowing the conflict the way the pre-IPI-1311
-- `on conflict do nothing` (no target) used to.
--
-- Rollback: none — proof only, wrapped in begin/rollback.

begin;

do $$
declare
  user_a     uuid := gen_random_uuid();  -- already has exactly one membership
  user_b     uuid := gen_random_uuid();  -- zero-org control, for the normal auto-add path
  org_a      uuid;
  org_second uuid;
  v_row_count int;
  v_rejected  boolean;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (user_a, 'authenticated', 'authenticated', 'ipi1311-single-membership-a@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (user_b, 'authenticated', 'authenticated', 'ipi1311-single-membership-b@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

  -- ==========================================================================
  -- Normal path: creating an org for a zero-org user auto-adds exactly one
  -- owner membership (organizations_auto_add_owner still works for the
  -- ordinary, non-conflicting case after the trigger fix).
  -- ==========================================================================
  org_a := gen_random_uuid();
  insert into public.organizations (id, name, slug, owner_id, type)
  values (org_a, 'IPI1311 Org A', 'ipi1311-org-a-' || left(org_a::text, 8), user_a, 'brand');

  select count(*) into v_row_count from public.org_members where org_id = org_a and user_id = user_a and role = 'owner';
  if v_row_count <> 1 then
    raise exception 'IPI-1311 FAIL: expected exactly 1 auto-added owner membership for user_a, got %', v_row_count;
  end if;

  -- ==========================================================================
  -- Direct duplicate insert for an already-member user — Deny at the
  -- database level. The existing membership must remain exactly 1 row.
  -- ==========================================================================
  v_rejected := false;
  begin
    insert into public.org_members (org_id, user_id, role) values (gen_random_uuid(), user_a, 'viewer');
  exception when unique_violation then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'IPI-1311 FAIL: a second org_members row for user_a was not rejected';
  end if;

  select count(*) into v_row_count from public.org_members where user_id = user_a;
  if v_row_count <> 1 then
    raise exception 'IPI-1311 FAIL: user_a membership count changed after the rejected direct insert, got %', v_row_count;
  end if;

  -- ==========================================================================
  -- organizations_auto_add_owner atomic-failure proof: creating a SECOND
  -- organization owned by user_a (who already has one membership) must fail
  -- the whole INSERT — no orphaned organizations row, no silently-skipped
  -- membership. Before the IPI-1311 trigger fix, the untargeted
  -- `on conflict do nothing` would have swallowed this violation and left
  -- org_second committed with zero org_members rows.
  -- ==========================================================================
  org_second := gen_random_uuid();
  v_rejected := false;
  begin
    insert into public.organizations (id, name, slug, owner_id, type)
    values (org_second, 'IPI1311 Org Second', 'ipi1311-org-second-' || left(org_second::text, 8), user_a, 'brand');
  exception when unique_violation then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'IPI-1311 FAIL: creating a second organization for an already-member user was not rejected';
  end if;

  select count(*) into v_row_count from public.organizations where id = org_second;
  if v_row_count <> 0 then
    raise exception 'IPI-1311 FAIL: the rejected second organization must not exist (no orphaned/partial org), got % row(s)', v_row_count;
  end if;

  select count(*) into v_row_count from public.org_members where user_id = user_a;
  if v_row_count <> 1 then
    raise exception 'IPI-1311 FAIL: user_a membership count changed after the rejected second-org attempt, got %', v_row_count;
  end if;

  -- ==========================================================================
  -- Control: a genuinely zero-org user can still get their normal first
  -- owner membership — the invariant only blocks a SECOND row, never the
  -- first.
  -- ==========================================================================
  select count(*) into v_row_count from public.org_members where user_id = user_b;
  if v_row_count <> 0 then
    raise exception 'IPI-1311 FAIL: user_b fixture must start with zero memberships, got %', v_row_count;
  end if;

  insert into public.organizations (id, name, slug, owner_id, type)
  values (gen_random_uuid(), 'IPI1311 Org B', 'ipi1311-org-b-' || left(gen_random_uuid()::text, 8), user_b, 'brand');

  select count(*) into v_row_count from public.org_members where user_id = user_b and role = 'owner';
  if v_row_count <> 1 then
    raise exception 'IPI-1311 FAIL: expected exactly 1 owner membership for a genuinely zero-org user_b, got %', v_row_count;
  end if;

  raise notice 'IPI-1311 org_members single-membership invariant PASS';
end;
$$;

rollback;
