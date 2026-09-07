-- ============================================================================
-- Migration: Create Assets Table
-- Purpose: Media assets (images, videos) delivered from completed shoots
-- Affected: public.assets table
-- Dependencies: public.shoots, asset_type enum
-- ============================================================================

-- Assets: Final deliverables from shoots
create table if not exists public.assets (
  id uuid default uuid_generate_v4() primary key,
  shoot_id uuid references public.shoots(id) on delete cascade not null,
  url text not null,
  asset_type asset_type not null,
  thumbnail_url text,
  file_size bigint,
  mime_type text,
  width integer,
  height integer,
  status text default 'final' not null,
  tags text[] default '{}',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  -- Constraints
  constraint assets_url_check check (char_length(url) > 0)
);
comment on table public.assets is 'Media assets (images, videos) delivered from completed shoots';

-- Enable RLS
alter table public.assets enable row level security;

-- Indexes for performance
create index if not exists idx_assets_shoot on public.assets(shoot_id);
create index if not exists idx_assets_type on public.assets(asset_type);
create index if not exists idx_assets_status on public.assets(status);
create index if not exists idx_assets_tags on public.assets using gin(tags);
;
