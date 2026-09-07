-- ============================================================================
-- Migration: cloudinary_assets brand_id alignment + value guards
-- Issue:     IPI-257 · PR #158 follow-up (074b)
-- Purpose:   Enforce denormalized brand_id matches parent assets.brand_id on
--            authenticated insert/update; add moderation/dna CHECK guards.
-- Depends:   20260630052200_cloudinary_assets_extend_and_brand_rls.sql
-- Safety:    Idempotent policy/constraint drops. Table has 0 rows today.
-- ============================================================================

comment on column public.cloudinary_assets.brand_id is
  'Denormalized brand (convenience/index). Must be null or match assets.brand_id; enforced on insert/update RLS.';

-- Value guards (defensive; cheap on an empty/small table)
alter table public.cloudinary_assets
  drop constraint if exists cloudinary_assets_moderation_status_check;
alter table public.cloudinary_assets
  add constraint cloudinary_assets_moderation_status_check
  check (moderation_status in ('pending', 'approved', 'rejected', 'skipped'));

alter table public.cloudinary_assets
  drop constraint if exists cloudinary_assets_dna_status_check;
alter table public.cloudinary_assets
  add constraint cloudinary_assets_dna_status_check
  check (dna_status is null or dna_status in ('approved', 'review', 'blocked'));

-- RLS: require denormalized brand_id to match parent asset (or be null)
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
        and (
          cloudinary_assets.brand_id is null
          or cloudinary_assets.brand_id = a.brand_id
        )
    )
  );

-- ============================================================================
-- ROLLBACK (manual — run as a separate down migration if needed)
-- ----------------------------------------------------------------------------
-- drop policy if exists "ca_insert_via_brand" on public.cloudinary_assets;
-- create policy "ca_insert_via_brand"
--   on public.cloudinary_assets for insert to authenticated
--   with check (
--     exists (
--       select 1 from public.assets a
--       join public.brands b on b.id = a.brand_id
--       where a.id = cloudinary_assets.asset_id
--         and b.user_id = (select auth.uid())
--     )
--   );
-- drop policy if exists "ca_update_via_brand" on public.cloudinary_assets;
-- create policy "ca_update_via_brand"
--   on public.cloudinary_assets for update to authenticated
--   using (
--     exists (
--       select 1 from public.assets a
--       join public.brands b on b.id = a.brand_id
--       where a.id = cloudinary_assets.asset_id
--         and b.user_id = (select auth.uid())
--     )
--   )
--   with check (
--     exists (
--       select 1 from public.assets a
--       join public.brands b on b.id = a.brand_id
--       where a.id = cloudinary_assets.asset_id
--         and b.user_id = (select auth.uid())
--     )
--   );
-- alter table public.cloudinary_assets
--   drop constraint if exists cloudinary_assets_moderation_status_check,
--   drop constraint if exists cloudinary_assets_dna_status_check;
-- ============================================================================
