-- ============================================================================
-- Migration: Extend Assets Table
-- Purpose: Add media compliance and platform tracking columns to existing assets table
-- Affected: public.assets table (alter table)
-- Dependencies: public.assets, public.media_size_specs
-- Note: This migration adds new columns to existing table - no data loss
-- ============================================================================

-- Add media size compliance and platform tracking
alter table public.assets 
  add column if not exists media_size_spec_id uuid references public.media_size_specs(id) on delete set null,
  add column if not exists size_compliance jsonb default '{}'::jsonb,
  add column if not exists cloudinary_public_id text,
  add column if not exists shopify_exported boolean default false,
  add column if not exists amazon_exported boolean default false,
  add column if not exists instagram_published boolean default false,
  add column if not exists facebook_published boolean default false;

-- Indexes for new columns
create index if not exists idx_assets_size_spec on public.assets(media_size_spec_id) where media_size_spec_id is not null;
create index if not exists idx_assets_cloudinary_id on public.assets(cloudinary_public_id) where cloudinary_public_id is not null;

-- Comments for new columns
comment on column public.assets.media_size_spec_id is 'Reference to media size specification for this asset';
comment on column public.assets.size_compliance is 'Size compliance check results: { "compliant": true, "warnings": [], "suggestions": [] }';
comment on column public.assets.cloudinary_public_id is 'Cloudinary public_id for this asset';
comment on column public.assets.shopify_exported is 'Whether this asset has been exported to Shopify';
comment on column public.assets.amazon_exported is 'Whether this asset has been exported to Amazon';
comment on column public.assets.instagram_published is 'Whether this asset has been published to Instagram';
comment on column public.assets.facebook_published is 'Whether this asset has been published to Facebook';
;
