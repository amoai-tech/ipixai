-- ============================================================================
-- Migration: Persist Cloudinary provider asset_id
-- Issue:     IPI-641 · CLD-ID-001
-- Purpose:   Add nullable cloudinary_asset_id (immutable Cloudinary provider ID).
--            Do NOT confuse with cloudinary_assets.asset_id (FK → assets.id).
--            Reuse existing `version` as latest observed provider version — no
--            cloudinary_version column.
-- Affected:  public.cloudinary_assets
-- Safety:    Additive. Nullable first; partial unique for populated rows.
-- Rollback:  drop index + column (see bottom comment).
-- ============================================================================

alter table public.cloudinary_assets
  add column if not exists cloudinary_asset_id text;

comment on column public.cloudinary_assets.cloudinary_asset_id is
  'Cloudinary immutable provider asset_id (hex). Distinct from asset_id FK to public.assets.id. Nullable until backfill / first webhook.';

comment on column public.cloudinary_assets.version is
  'Latest observed Cloudinary provider version from upload/overwrite notifications.';

-- Uniqueness scoped to this Cloudinary product environment (one cloud per DB).
create unique index if not exists cloudinary_assets_cloudinary_asset_id_uidx
  on public.cloudinary_assets (cloudinary_asset_id)
  where cloudinary_asset_id is not null;

-- Rollback (manual):
-- drop index if exists public.cloudinary_assets_cloudinary_asset_id_uidx;
-- alter table public.cloudinary_assets drop column if exists cloudinary_asset_id;
