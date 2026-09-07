-- ============================================================================
-- Migration: Extend cloudinary_assets + re-scope RLS to brand owner
-- Issue:     IPI-257 · DESIGN-074 (074b) — Cloudinary Media Pipeline
-- Purpose:   Add pipeline columns and replace the stale shoot-scoped RLS
--            (which breaks now that assets.shoot_id is nullable) with
--            brand-owner scoping via assets.brand_id -> brands.user_id.
-- Affected:  public.cloudinary_assets
-- Depends:   public.assets (brand_id), public.brands (user_id)
-- Safety:    Additive + idempotent. cloudinary_assets has 0 rows today.
-- Rollback:  see 20260630052200_*_down at bottom (commented) / docs IPI-257 §1d.
-- ============================================================================

-- 1. Columns ----------------------------------------------------------------
alter table public.cloudinary_assets
  add column if not exists brand_id          uuid references public.brands(id) on delete set null,
  add column if not exists delivery_type     text not null default 'authenticated',   -- upload | authenticated | private
  add column if not exists version           bigint,
  add column if not exists format            text,
  add column if not exists bytes             bigint,
  add column if not exists duration          numeric,
  add column if not exists status            text not null default 'processing',       -- processing | ready | archived
  add column if not exists approval          text not null default 'pending',          -- pending | approved | rejected
  add column if not exists moderation_status text not null default 'pending',          -- pending | approved | rejected | skipped
  add column if not exists dna_status        text,
  add column if not exists dna_score         numeric,
  add column if not exists metadata          jsonb not null default '{}'::jsonb,
  add column if not exists created_by        uuid references auth.users(id) on delete set null;

comment on column public.cloudinary_assets.brand_id is
  'Denormalized brand owner (convenience/index). RLS authority is the asset->brand join below.';
comment on column public.cloudinary_assets.delivery_type is
  'Cloudinary delivery type. authenticated until approval=approved, then upload (public).';

-- Value guards (defensive; cheap on an empty/small table)
alter table public.cloudinary_assets
  drop constraint if exists cloudinary_assets_delivery_type_check;
alter table public.cloudinary_assets
  add constraint cloudinary_assets_delivery_type_check
  check (delivery_type in ('upload', 'authenticated', 'private'));

alter table public.cloudinary_assets
  drop constraint if exists cloudinary_assets_status_check;
alter table public.cloudinary_assets
  add constraint cloudinary_assets_status_check
  check (status in ('processing', 'ready', 'archived'));

alter table public.cloudinary_assets
  drop constraint if exists cloudinary_assets_approval_check;
alter table public.cloudinary_assets
  add constraint cloudinary_assets_approval_check
  check (approval in ('pending', 'approved', 'rejected'));

-- 2. Indexes ----------------------------------------------------------------
create index if not exists idx_cloudinary_assets_brand
  on public.cloudinary_assets(brand_id) where brand_id is not null;
create index if not exists idx_cloudinary_assets_approval
  on public.cloudinary_assets(approval);
create index if not exists idx_cloudinary_assets_status
  on public.cloudinary_assets(status);

-- 3. RLS: replace stale shoot-scoped policies with brand-owner scoping ------
-- RLS is already enabled on this table. anon stays deny-all (keep existing
-- "anon_select_cloudinary_assets" using(false)). Authority = asset -> brand owner,
-- which works whether or not the denormalized brand_id is populated, and
-- regardless of assets.shoot_id being null.
drop policy if exists "authenticated_select_cloudinary_assets" on public.cloudinary_assets;
drop policy if exists "authenticated_insert_cloudinary_assets" on public.cloudinary_assets;
drop policy if exists "authenticated_update_cloudinary_assets" on public.cloudinary_assets;
drop policy if exists "authenticated_delete_cloudinary_assets" on public.cloudinary_assets;

drop policy if exists "ca_select_via_brand" on public.cloudinary_assets;
create policy "ca_select_via_brand"
  on public.cloudinary_assets for select to authenticated
  using (
    exists (
      select 1
      from public.assets a
      join public.brands b on b.id = a.brand_id
      where a.id = cloudinary_assets.asset_id
        and b.user_id = (select auth.uid())
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
        and b.user_id = (select auth.uid())
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
        and b.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.assets a
      join public.brands b on b.id = a.brand_id
      where a.id = cloudinary_assets.asset_id
        and b.user_id = (select auth.uid())
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
        and b.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- ROLLBACK (manual — run as a separate down migration if needed)
-- ----------------------------------------------------------------------------
-- drop policy if exists "ca_select_via_brand" on public.cloudinary_assets;
-- drop policy if exists "ca_insert_via_brand" on public.cloudinary_assets;
-- drop policy if exists "ca_update_via_brand" on public.cloudinary_assets;
-- drop policy if exists "ca_delete_via_brand" on public.cloudinary_assets;
-- alter table public.cloudinary_assets
--   drop constraint if exists cloudinary_assets_delivery_type_check,
--   drop constraint if exists cloudinary_assets_status_check,
--   drop constraint if exists cloudinary_assets_approval_check,
--   drop column if exists brand_id,        drop column if exists delivery_type,
--   drop column if exists version,         drop column if exists format,
--   drop column if exists bytes,           drop column if exists duration,
--   drop column if exists status,          drop column if exists approval,
--   drop column if exists moderation_status, drop column if exists dna_status,
--   drop column if exists dna_score,       drop column if exists metadata,
--   drop column if exists created_by;
-- NOTE: do not drop the table (pre-existed). Old shoot-scoped policies were
-- broken (nullable shoot_id) and are intentionally not restored.
-- ============================================================================
