-- IPI-1167 · SB-FIX-011 — regression for block_brand_org_change()'s
-- NULL-unsafety + wrong-id fix.
-- Runner: .github/workflows/ci.yml (seed minimal mock schema + buggy body
-- -> apply the real fix migration -> run this). Mirrors the
-- seed/apply/regress structure of supabase/tests/security/ipi1147-sb-sec-010.sql.

begin;

do $$
declare
  brand_free   uuid := gen_random_uuid(); -- no campaigns reference it
  brand_bound  uuid := gen_random_uuid(); -- a campaign references it
  brand_null   uuid := gen_random_uuid(); -- starts with NULL org_id, has a campaign
  org_1        uuid := gen_random_uuid();
  org_2        uuid := gen_random_uuid();
  blocked      boolean;
begin
  insert into public.brands (id, org_id) values
    (brand_free,  org_1),
    (brand_bound, org_1),
    (brand_null,  null);

  insert into public.campaigns (id, brand_id) values
    (gen_random_uuid(), brand_bound),
    (gen_random_uuid(), brand_null);

  -- 1) org_id unchanged -> allowed. Trigger fires (UPDATE OF org_id lists
  --    it) but IS DISTINCT FROM is false, so no exception.
  update public.brands set org_id = org_1 where id = brand_bound;

  -- 2) org_id legitimately changed, no campaigns reference this brand -> allowed.
  update public.brands set org_id = org_2 where id = brand_free;

  -- 3) baseline correctness: org_id changed on a brand WITH a referencing
  --    campaign -> must block.
  blocked := false;
  begin
    update public.brands set org_id = org_2 where id = brand_bound;
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'IPI-1167 FAIL: org_id change on a brand with a referencing campaign was NOT blocked (baseline)';
  end if;

  -- 4) NULL -> non-null org_id on a brand WITH a referencing campaign ->
  --    must block. This is the exact NULL-unsafety defect: production's
  --    buggy `!=` evaluates to NULL (falsy) here and lets it through.
  blocked := false;
  begin
    update public.brands set org_id = org_2 where id = brand_null;
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'IPI-1167 FAIL: NULL -> non-null org_id change on a brand with a referencing campaign was NOT blocked (NULL-unsafety regression)';
  end if;

  -- 5) non-null -> NULL org_id on a brand WITH a referencing campaign ->
  --    must also block (the other NULL-unsafety direction). brand_bound
  --    still has org_id = org_1 and its campaign from setup.
  blocked := false;
  begin
    update public.brands set org_id = null where id = brand_bound;
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'IPI-1167 FAIL: non-null -> NULL org_id change on a brand with a referencing campaign was NOT blocked (NULL-unsafety regression)';
  end if;

  raise notice 'IPI-1167 block_brand_org_change regression PASS';
end;
$$;

rollback;
