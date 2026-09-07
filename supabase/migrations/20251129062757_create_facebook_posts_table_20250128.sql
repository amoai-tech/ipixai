-- ============================================================================
-- Migration: Create Facebook Posts Table
-- Purpose: Track published Facebook content and performance
-- Affected: public.facebook_posts table
-- Dependencies: public.facebook_connections
-- ============================================================================

-- Facebook posts: Published content and performance tracking
create table if not exists public.facebook_posts (
  id uuid default uuid_generate_v4() primary key,
  connection_id uuid references public.facebook_connections(id) on delete cascade not null,
  
  -- Facebook post info
  facebook_post_id text not null unique,
  post_type text, -- 'photo', 'video', 'link', 'status'
  permalink text,
  
  -- Content
  message text,
  link text,
  
  -- Linked assets (array of FashionOS asset IDs)
  asset_ids uuid[],
  
  -- Publishing status
  status text default 'published' not null,
  published_at timestamptz,
  
  -- Basic metrics
  like_count integer default 0,
  comment_count integer default 0,
  share_count integer default 0,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
comment on table public.facebook_posts is 'Published Facebook posts and their performance';

-- Indexes for performance
create index if not exists idx_facebook_posts_connection on public.facebook_posts(connection_id);
create index if not exists idx_facebook_posts_post_id on public.facebook_posts(facebook_post_id);
create index if not exists idx_facebook_posts_status on public.facebook_posts(status);

-- Enable RLS
alter table public.facebook_posts enable row level security;
;
