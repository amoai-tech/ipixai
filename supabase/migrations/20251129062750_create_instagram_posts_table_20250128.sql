-- ============================================================================
-- Migration: Create Instagram Posts Table
-- Purpose: Track published Instagram content and performance
-- Affected: public.instagram_posts table
-- Dependencies: public.instagram_connections
-- ============================================================================

-- Instagram posts: Published content and performance tracking
create table if not exists public.instagram_posts (
  id uuid default uuid_generate_v4() primary key,
  connection_id uuid references public.instagram_connections(id) on delete cascade not null,
  
  -- Instagram media info
  instagram_media_id text not null unique,
  media_type text not null, -- 'IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'
  permalink text,
  
  -- Content
  caption text,
  hashtags text[],
  location_name text,
  
  -- Linked assets (array of FashionOS asset IDs)
  asset_ids uuid[],
  
  -- Publishing status
  status text default 'published' not null, -- 'scheduled', 'published', 'failed', 'deleted'
  scheduled_at timestamptz,
  published_at timestamptz,
  
  -- Basic metrics (updated via webhook or API)
  like_count integer default 0,
  comment_count integer default 0,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
comment on table public.instagram_posts is 'Published Instagram posts and their performance';

-- Indexes for performance
create index if not exists idx_instagram_posts_connection on public.instagram_posts(connection_id);
create index if not exists idx_instagram_posts_media_id on public.instagram_posts(instagram_media_id);
create index if not exists idx_instagram_posts_status on public.instagram_posts(status);
create index if not exists idx_instagram_posts_scheduled on public.instagram_posts(scheduled_at) where status = 'scheduled';

-- Enable RLS
alter table public.instagram_posts enable row level security;
;
