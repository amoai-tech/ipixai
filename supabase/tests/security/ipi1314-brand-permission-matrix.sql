-- IPI-1314 · Role/tenant verification for public.brands (full schema).
-- Run on disposable fresh replay only. Every fixture rolls back.
begin;

do $brand_roles$
declare
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  owner_a uuid := gen_random_uuid();
  editor_a uuid := gen_random_uuid();
  viewer_a uuid := gen_random_uuid();
  owner_b uuid := gen_random_uuid();
  brand_a uuid := gen_random_uuid();
  brand_editor uuid := gen_random_uuid();
  brand_b uuid := gen_random_uuid();
  n integer;
  denied boolean;
  saved_role uuid;
  actual_name text;
begin
  -- Use normal auth signup triggers, organization ownership, and memberships.
  insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    (owner_a,'authenticated','authenticated','ipi1314-owner-'||left(owner_a::text,8)||'@example.invalid',now(),'{"provider":"email"}','{}',now(),now()),
    (editor_a,'authenticated','authenticated','ipi1314-editor-'||left(editor_a::text,8)||'@example.invalid',now(),'{"provider":"email"}','{}',now(),now()),
    (viewer_a,'authenticated','authenticated','ipi1314-viewer-'||left(viewer_a::text,8)||'@example.invalid',now(),'{"provider":"email"}','{}',now(),now()),
    (owner_b,'authenticated','authenticated','ipi1314-other-'||left(owner_b::text,8)||'@example.invalid',now(),'{"provider":"email"}','{}',now(),now());
  insert into public.organizations(id,name,slug,type,owner_id,plan)
  values
    (org_a,'IPI-1314 Org A','ipi1314-a-'||left(org_a::text,8),'agency',owner_a,'free'),
    (org_b,'IPI-1314 Org B','ipi1314-b-'||left(org_b::text,8),'agency',owner_b,'free');
  insert into public.org_members(org_id,user_id,role)
  values
    (org_a,owner_a,'owner'),(org_a,editor_a,'editor'),
    (org_a,viewer_a,'viewer'),(org_b,owner_b,'owner')
  on conflict(org_id,user_id) do nothing;

  -- Owner can create a Brand with their own user_id.
  execute format('set local role authenticated; set local request.jwt.claims = %L',
    json_build_object('sub',owner_a)::text);
  insert into public.brands(id,name,org_id,user_id,brand_url)
    values(brand_a,'Owner Brand',org_a,owner_a,'https://example.invalid/owner');
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then raise exception 'IPI-1314 owner Brand INSERT failed'; end if;

  -- Editor can also create a Brand, but only for themselves and their org.
  execute format('set local role authenticated; set local request.jwt.claims = %L',
    json_build_object('sub',editor_a)::text);
  insert into public.brands(id,name,org_id,user_id,brand_url)
    values(brand_editor,'Editor Brand',org_a,editor_a,'https://example.invalid/editor');
  get diagnostics n = row_count;
  execute 'reset role';
  if n <> 1 then raise exception 'IPI-1314 editor Brand INSERT failed'; end if;

  -- Viewer cannot create a Brand, even for themselves.
  execute format('set local role authenticated; set local request.jwt.claims = %L',
    json_build_object('sub',viewer_a)::text);
  denied:=false;
  begin
    insert into public.brands(id,name,org_id,user_id)
      values(gen_random_uuid(),'Viewer Forgery',org_a,viewer_a);
  exception when insufficient_privilege then denied:=true;
  end;
  execute 'reset role';
  if not denied then raise exception 'IPI-1314 viewer was able to create a Brand'; end if;

  -- Editor cannot assign a different user as Brand creator.
  execute format('set local role authenticated; set local request.jwt.claims = %L',
    json_build_object('sub',editor_a)::text);
  denied:=false;
  begin
    insert into public.brands(id,name,org_id,user_id)
      values(gen_random_uuid(),'Owner Spoof',org_a,owner_a);
  exception when insufficient_privilege then denied:=true;
  end;
  execute 'reset role';
  if not denied then raise exception 'IPI-1314 editor forged another Brand creator'; end if;

  -- Authenticated owner from Org B must not create a Brand in Org A.
  execute format('set local role authenticated; set local request.jwt.claims = %L',
    json_build_object('sub',owner_b)::text);
  denied:=false;
  begin
    insert into public.brands(id,name,org_id,user_id)
      values(gen_random_uuid(),'Cross Org Insert',org_a,owner_b);
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'IPI-1314 cross-org Brand INSERT succeeded'; end if;
  insert into public.brands(id,name,org_id,user_id)
    values(brand_b,'Other Org Brand',org_b,owner_b);
  execute 'reset role';

  -- Editor can edit only ordinary fields; not approval-owned Brand DNA.
  execute format('set local role authenticated; set local request.jwt.claims = %L',
    json_build_object('sub',editor_a)::text);
  update public.brands set brand_url='https://example.invalid/updated'
    where id=brand_a;
  get diagnostics n=row_count;
  if n <> 1 then raise exception 'IPI-1314 editor ordinary Brand UPDATE failed'; end if;
  denied:=false;
  begin
    update public.brands set ai_profile='{"forged":true}'::jsonb where id=brand_a;
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'IPI-1314 editor could bypass approved Brand DNA'; end if;
  denied:=false;
  begin
    update public.brands set org_id=org_b where id=brand_a;
  exception when insufficient_privilege then denied:=true;
  end;
  execute 'reset role';
  if not denied then raise exception 'IPI-1314 editor could reparent Brand'; end if;

  -- Editors cannot delete Brands: destructive actions remain owner-only.
  execute format('set local role authenticated; set local request.jwt.claims = %L',
    json_build_object('sub',editor_a)::text);
  delete from public.brands where id=brand_editor;
  get diagnostics n=row_count;
  execute 'reset role';
  if n<>0 then raise exception 'IPI-1314 editor deleted Brand'; end if;

  -- Signed-out callers cannot create Brands.
  execute 'set local role anon';
  denied:=false;
  begin
    insert into public.brands(id,name,org_id,user_id)
      values(gen_random_uuid(),'Anonymous Brand',org_a,viewer_a);
  exception when insufficient_privilege then denied:=true;
  end;
  execute 'reset role';
  if not denied then raise exception 'IPI-1314 anon created Brand'; end if;

  -- Viewer reads an existing Brand, but cannot update or delete it.
  execute format('set local role authenticated; set local request.jwt.claims = %L',
    json_build_object('sub',viewer_a)::text);
  select name into actual_name from public.brands where id=brand_a;
  if actual_name is distinct from 'Owner Brand' then
    raise exception 'IPI-1314 viewer cannot read same-org Brand';
  end if;
  update public.brands set name='Viewer Edit' where id=brand_a;
  get diagnostics n=row_count;
  if n <> 0 then raise exception 'IPI-1314 viewer edited Brand'; end if;
  delete from public.brands where id=brand_a;
  get diagnostics n=row_count;
  execute 'reset role';
  if n <> 0 then raise exception 'IPI-1314 viewer deleted Brand'; end if;

  -- Org B cannot see/edit/delete Org A records.
  execute format('set local role authenticated; set local request.jwt.claims = %L',
    json_build_object('sub',owner_b)::text);
  select name into actual_name from public.brands where id=brand_a;
  if actual_name is not null then raise exception 'IPI-1314 Org B read Org A Brand'; end if;
  update public.brands set name='Cross-org edit' where id=brand_a;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'IPI-1314 Org B edited Org A Brand'; end if;
  delete from public.brands where id=brand_a;
  get diagnostics n=row_count;
  execute 'reset role';
  if n<>0 then raise exception 'IPI-1314 Org B deleted Org A Brand'; end if;

  -- Owners can rename their Brand and perform owner-only deletion.
  execute format('set local role authenticated; set local request.jwt.claims = %L',
    json_build_object('sub',owner_a)::text);
  update public.brands set name='Owner Renamed' where id=brand_a;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'IPI-1314 owner cannot rename Brand'; end if;
  delete from public.brands where id=brand_editor;
  get diagnostics n=row_count;
  execute 'reset role';
  if n<>1 then raise exception 'IPI-1314 org owner cannot delete Brand'; end if;

  -- Even owner/editor can never directly write approval-controlled columns.
  if has_column_privilege('authenticated','public.brands','approved_profile_at','UPDATE')
     or has_column_privilege('authenticated','public.brands','ai_profile_draft','UPDATE')
     or has_column_privilege('authenticated','public.brands','org_id','UPDATE')
     or has_column_privilege('authenticated','public.brands','user_id','UPDATE') then
     raise exception 'IPI-1314 grant accidentally reopened approval/tenancy bypass';
  end if;

  raise notice 'IPI-1314 owner/editor/viewer and Org A/B full-schema security matrix PASS';
end
$brand_roles$;

rollback;
