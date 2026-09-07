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
  fn_def       text;
  fn_oid       oid;
  fn_secdef    boolean;
  fn_config    text[];
begin
  -- 0) catalog-level check on the exact installed zero-argument function:
  --    the wrong-id defect (new.id instead of old.id) is behaviorally
  --    unreachable given the FK on campaigns.brand_id (no ON UPDATE
  --    CASCADE -- see the migration's own comment), so none of the
  --    behavioral cases below can distinguish old.id from new.id. Without
  --    this, a future edit could silently reintroduce `new.id` and every
  --    behavioral case would still pass. Assert directly on source instead.
  --
  --    Also assert the security contract (SECURITY DEFINER + search_path
  --    = public) directly on pg_proc, not just the SQL text: a future
  --    edit could drop either while still passing the old.id/new.id text
  --    checks, silently changing the function's execution privileges or
  --    reintroducing a search_path injection surface.
  fn_oid := to_regprocedure('public.block_brand_org_change()');
  if fn_oid is null then
    raise exception 'IPI-1167 FAIL: public.block_brand_org_change() not found';
  end if;
  select pg_get_functiondef(fn_oid) into fn_def;
  if fn_def !~* 'brand_id\s*=\s*old\.id' then
    raise exception 'IPI-1167 FAIL: installed function does not reference old.id in the campaign lookup (wrong-id regression)';
  end if;
  if fn_def ~* 'brand_id\s*=\s*new\.id' then
    raise exception 'IPI-1167 FAIL: installed function references new.id in the campaign lookup (wrong-id regression reintroduced)';
  end if;
  select prosecdef, proconfig into fn_secdef, fn_config from pg_proc where oid = fn_oid;
  if not fn_secdef then
    raise exception 'IPI-1167 FAIL: installed function is no longer SECURITY DEFINER';
  end if;
  if fn_config is null or not (fn_config @> array['search_path=public']) then
    raise exception 'IPI-1167 FAIL: installed function no longer has search_path=public set (found: %)', fn_config;
  end if;

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
