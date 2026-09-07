-- ============================================================================
-- Migration: Create RLS Policies for Asset Variants Table (Retry)
-- Purpose: Row-level security policies for asset_variants table
-- Affected: public.asset_variants table
-- Dependencies: public.asset_variants table must exist
-- ============================================================================

-- RLS Policies: Users can view variants of their own assets
-- Anonymous users: No access (variants are linked to user assets)
create policy "anon_select_asset_variants"
  on public.asset_variants for select
  to anon
  using (false);

-- Authenticated users can view variants of assets from their shoots
create policy "authenticated_select_asset_variants"
  on public.asset_variants for select
  to authenticated
  using (
    exists (
      select 1 from public.assets
      where assets.id = asset_variants.asset_id
      and assets.shoot_id in (
        select id from public.shoots
        where designer_id = (select auth.uid())
      )
    )
  );

-- Authenticated users can create variants for their own assets
create policy "authenticated_insert_asset_variants"
  on public.asset_variants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.assets
      where assets.id = asset_variants.asset_id
      and assets.shoot_id in (
        select id from public.shoots
        where designer_id = (select auth.uid())
      )
    )
  );

-- Authenticated users can update variants of their own assets
create policy "authenticated_update_asset_variants"
  on public.asset_variants for update
  to authenticated
  using (
    exists (
      select 1 from public.assets
      where assets.id = asset_variants.asset_id
      and assets.shoot_id in (
        select id from public.shoots
        where designer_id = (select auth.uid())
      )
    )
  )
  with check (
    exists (
      select 1 from public.assets
      where assets.id = asset_variants.asset_id
      and assets.shoot_id in (
        select id from public.shoots
        where designer_id = (select auth.uid())
      )
    )
  );

-- Authenticated users can delete variants of their own assets
create policy "authenticated_delete_asset_variants"
  on public.asset_variants for delete
  to authenticated
  using (
    exists (
      select 1 from public.assets
      where assets.id = asset_variants.asset_id
      and assets.shoot_id in (
        select id from public.shoots
        where designer_id = (select auth.uid())
      )
    )
  );
;
