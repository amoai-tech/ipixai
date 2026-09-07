-- ============================================================================
-- Migration: Create Media Size Specs Table
-- Purpose: Store platform-specific image size specifications for validation
-- Affected: public.media_size_specs table
-- Dependencies: None (platform is text, not enum)
-- ============================================================================

-- Media size specifications for social platforms and e-commerce
create table if not exists public.media_size_specs (
  id uuid default uuid_generate_v4() primary key,
  
  -- Platform identification
  platform text not null, -- 'instagram', 'facebook', 'amazon', 'shopify'
  use_case text not null, -- 'feed_square', 'stories', 'reels', 'product_main'
  
  -- Size specifications
  recommended_width integer not null,
  recommended_height integer not null,
  aspect_ratio text, -- '1:1', '4:5', '9:16', etc.
  
  -- Metadata
  display_name text not null,
  notes text,
  
  -- Status
  is_active boolean default true not null,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  -- Constraints
  constraint media_size_specs_platform_use_case_unique unique (platform, use_case),
  constraint media_size_specs_dimensions_check check (
    recommended_width > 0 and recommended_height > 0
  )
);

comment on table public.media_size_specs is 'Social media and e-commerce platform image size specifications';

-- Indexes for performance (idempotent)
create index if not exists idx_media_size_specs_platform on public.media_size_specs(platform);
create index if not exists idx_media_size_specs_active on public.media_size_specs(is_active) where is_active = true;

-- Enable RLS (idempotent)
alter table public.media_size_specs enable row level security;

-- RLS Policies: Public read access for active size specs (reference data)
-- Drop existing policies if they exist (idempotent)
drop policy if exists "anon_select_active_media_size_specs" on public.media_size_specs;
drop policy if exists "authenticated_select_active_media_size_specs" on public.media_size_specs;

-- Anonymous users can view active size specs
create policy "anon_select_active_media_size_specs"
  on public.media_size_specs for select
  to anon
  using (is_active = true);

-- Authenticated users can view active size specs
create policy "authenticated_select_active_media_size_specs"
  on public.media_size_specs for select
  to authenticated
  using (is_active = true);
;
