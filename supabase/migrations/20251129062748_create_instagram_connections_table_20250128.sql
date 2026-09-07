-- ============================================================================
-- Migration: Create Instagram Connections Table
-- Purpose: Store Instagram OAuth connections and access tokens
-- Affected: public.instagram_connections table
-- Dependencies: auth.users
-- ============================================================================

-- Instagram connections: OAuth connections for Instagram API
create table if not exists public.instagram_connections (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- Instagram account info
  instagram_account_id text not null unique,
  instagram_username text,
  
  -- OAuth tokens (should be encrypted at rest in application layer)
  access_token text not null,
  token_expires_at timestamptz,
  
  -- Facebook Page connection (required for Business accounts)
  facebook_page_id text,
  facebook_page_access_token text, -- Should be encrypted at rest
  
  -- Status
  status text default 'connected' not null, -- 'connected', 'disconnected', 'error'
  last_sync_at timestamptz,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  unique(user_id, instagram_account_id)
);
comment on table public.instagram_connections is 'Instagram API OAuth connections';

-- Indexes for performance
create index if not exists idx_instagram_connections_user_id on public.instagram_connections(user_id);
create index if not exists idx_instagram_connections_status on public.instagram_connections(status) where status = 'connected';
create index if not exists idx_instagram_connections_account_id on public.instagram_connections(instagram_account_id);

-- Enable RLS
alter table public.instagram_connections enable row level security;
;
