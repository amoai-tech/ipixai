-- ============================================================================
-- Migration: Create Asset Variants Table (Retry)
-- Purpose: Store platform-optimized variants of original assets
-- Affected: public.asset_variants table
-- Dependencies: public.assets, public.media_size_specs
-- ============================================================================

-- Asset variants: Platform-optimized versions of original assets
create table if not exists public.asset_variants (
  id uuid default uuid_generate_v4() primary key,
  asset_id uuid references public.assets(id) on delete cascade not null,
  media_size_spec_id uuid references public.media_size_specs(id) on delete set null,
  
  -- Variant details
  url text not null, -- Cloudinary URL or Supabase Storage URL
  width integer not null,
  height integer not null,
  file_size bigint, -- in bytes
  format text not null, -- 'jpg', 'png', 'webp', 'mp4'
  quality integer, -- Compression quality (1-100)
  
  -- Cloudinary metadata
  cloudinary_public_id text,
  
  -- Status
  is_primary boolean default false,
  status text default 'ready' not null, -- 'processing', 'ready', 'failed'
  
  -- Metadata
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  -- Constraints
  constraint asset_variants_url_check check (char_length(url) > 0),
  constraint asset_variants_dimensions_check check (width > 0 and height > 0)
);
comment on table public.asset_variants is 'Platform-optimized variants of assets';

-- Indexes for performance
create index if not exists idx_asset_variants_asset on public.asset_variants(asset_id);
create index if not exists idx_asset_variants_spec on public.asset_variants(media_size_spec_id) where media_size_spec_id is not null;

-- Enable RLS
alter table public.asset_variants enable row level security;
;
