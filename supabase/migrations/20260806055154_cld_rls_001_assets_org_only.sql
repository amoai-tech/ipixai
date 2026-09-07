-- CLD-RLS-001 / IPI-956: assets RLS org-only, close legacy shoot-designer backdoor
-- Live verification (Phase 1): brands.org_id NOT NULL, brands.user_id NOT NULL,
-- 16 NULL-brand assets lawful (IPI-767).
-- Minimal predicate: is_org_member(b.org_id) only
-- Dead branches removed: b.org_id IS NULL (schema confirms NOT NULL), b.user_id (org-only model).
-- Legacy shoots.designer_id backdoor removed entirely.
-- No DELETE policy added (default deny via RLS).

begin;

drop policy if exists "assets_select" on public.assets;
drop policy if exists "assets_insert" on public.assets;
drop policy if exists "assets_update" on public.assets;

create policy "assets_select" on public.assets
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.brands b
      where b.id = assets.brand_id
        and public.is_org_member(b.org_id)
    )
  );

create policy "assets_insert" on public.assets
  as permissive
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.brands b
      where b.id = assets.brand_id
        and public.is_org_member(b.org_id)
    )
  );

create policy "assets_update" on public.assets
  as permissive
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.brands b
      where b.id = assets.brand_id
        and public.is_org_member(b.org_id)
    )
  )
  with check (
    exists (
      select 1
      from public.brands b
      where b.id = assets.brand_id
        and public.is_org_member(b.org_id)
    )
  );

-- ROLLBACK (exact legacy predicates from 20260730032841_consolidate_multiple_permissive_policies_assets.sql):
-- drop policy "assets_select" on public.assets;
-- drop policy "assets_insert" on public.assets;
-- drop policy "assets_update" on public.assets;
-- create policy "assets_select" on public.assets
--   for select to authenticated
--   using (
--     exists (
--       select 1 from brands b
--       where b.id = assets.brand_id
--         and (((b.org_id is null) and (b.user_id = (select auth.uid())))
--           or ((b.org_id is not null) and is_org_member(b.org_id)))
--     ) or
--     exists (
--       select 1 from shoots
--       where shoots.id = assets.shoot_id
--         and shoots.designer_id = (select auth.uid())
--     )
--   );
-- create policy "assets_insert" on public.assets
--   for insert to authenticated
--   with check (
--     exists (
--       select 1 from brands b
--       where b.id = assets.brand_id
--         and (((b.org_id is null) and (b.user_id = (select auth.uid())))
--           or ((b.org_id is not null) and is_org_member(b.org_id)))
--     ) or
--     exists (
--       select 1 from shoots
--       where shoots.id = assets.shoot_id
--         and shoots.designer_id = (select auth.uid())
--     )
--   );
-- create policy "assets_update" on public.assets
--   for update to authenticated
--   using (
--     exists (
--       select 1 from brands b
--       where b.id = assets.brand_id
--         and (((b.org_id is null) and (b.user_id = (select auth.uid())))
--           or ((b.org_id is not null) and is_org_member(b.org_id)))
--     ) or
--     exists (
--       select 1 from shoots
--       where shoots.id = assets.shoot_id
--         and shoots.designer_id = (select auth.uid())
--     )
--   )
--   with check (
--     exists (
--       select 1 from brands b
--       where b.id = assets.brand_id
--         and (((b.org_id is null) and (b.user_id = (select auth.uid())))
--           or ((b.org_id is not null) and is_org_member(b.org_id)))
--     ) or
--     exists (
--       select 1 from shoots
--       where shoots.id = assets.shoot_id
--         and shoots.designer_id = (select auth.uid())
--     )
--   );

commit;