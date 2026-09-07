-- ============================================================================
-- Migration: Org-member RLS for assets writes + cloudinary_assets (all cmds)
-- Issue:     IPI-276 · SUPA-ORG-RLS
-- Purpose:   assets SELECT is already org-aware (IPI-499 / 20260710203324).
--            INSERT/UPDATE on assets and all ca_* policies on cloudinary_assets
--            still require brands.user_id = auth.uid(), locking out org members.
--            Align with brands_select_org / brands_update_org pattern:
--              (org_id is null AND user_id = auth.uid())
--              OR (org_id is not null AND is_org_member(org_id))
-- Out of scope: legacy shoot-scoped authenticated_*_assets policies (IPI-524).
-- Safety:    Idempotent policy drops/creates. Service-role webhook bypasses RLS.
-- ============================================================================

-- Shared brand authorization predicate (mirrors assets_select_via_brand):
--   (b.org_id is null and b.user_id = (select auth.uid()))
--   or (b.org_id is not null and public.is_org_member(b.org_id))

-- 1. assets INSERT / UPDATE -------------------------------------------------

drop policy if exists "assets_insert_via_brand" on public.assets;
create policy "assets_insert_via_brand"
  on public.assets for insert to authenticated
  with check (
    exists (
      select 1 from public.brands b
      where b.id = assets.brand_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
    )
  );

drop policy if exists "assets_update_via_brand" on public.assets;
create policy "assets_update_via_brand"
  on public.assets for update to authenticated
  using (
    exists (
      select 1 from public.brands b
      where b.id = assets.brand_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.brands b
      where b.id = assets.brand_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
    )
  );

-- 2. cloudinary_assets — SELECT / INSERT / UPDATE / DELETE ------------------
-- Preserve brand_id null-or-match-parent guard from 20260630143000.

drop policy if exists "ca_select_via_brand" on public.cloudinary_assets;
create policy "ca_select_via_brand"
  on public.cloudinary_assets for select to authenticated
  using (
    exists (
      select 1
      from public.assets a
      join public.brands b on b.id = a.brand_id
      where a.id = cloudinary_assets.asset_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
    )
  );

drop policy if exists "ca_insert_via_brand" on public.cloudinary_assets;
create policy "ca_insert_via_brand"
  on public.cloudinary_assets for insert to authenticated
  with check (
    exists (
      select 1
      from public.assets a
      join public.brands b on b.id = a.brand_id
      where a.id = cloudinary_assets.asset_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
        and (
          cloudinary_assets.brand_id is null
          or cloudinary_assets.brand_id = a.brand_id
        )
    )
  );

drop policy if exists "ca_update_via_brand" on public.cloudinary_assets;
create policy "ca_update_via_brand"
  on public.cloudinary_assets for update to authenticated
  using (
    exists (
      select 1
      from public.assets a
      join public.brands b on b.id = a.brand_id
      where a.id = cloudinary_assets.asset_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
    )
  )
  with check (
    exists (
      select 1
      from public.assets a
      join public.brands b on b.id = a.brand_id
      where a.id = cloudinary_assets.asset_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
        and (
          cloudinary_assets.brand_id is null
          or cloudinary_assets.brand_id = a.brand_id
        )
    )
  );

drop policy if exists "ca_delete_via_brand" on public.cloudinary_assets;
create policy "ca_delete_via_brand"
  on public.cloudinary_assets for delete to authenticated
  using (
    exists (
      select 1
      from public.assets a
      join public.brands b on b.id = a.brand_id
      where a.id = cloudinary_assets.asset_id
        and (
          (b.org_id is null and b.user_id = (select auth.uid()))
          or (b.org_id is not null and public.is_org_member(b.org_id))
        )
    )
  );

comment on policy "assets_insert_via_brand" on public.assets is
  'IPI-276 — brand owner (legacy null org) or org member may insert.';
comment on policy "assets_update_via_brand" on public.assets is
  'IPI-276 — brand owner (legacy null org) or org member may update.';
comment on policy "ca_select_via_brand" on public.cloudinary_assets is
  'IPI-276 — org-aware select via assets→brands (mirrors assets_select_via_brand).';
