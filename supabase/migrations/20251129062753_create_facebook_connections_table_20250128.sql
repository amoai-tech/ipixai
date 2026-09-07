-- ============================================================================
-- Migration: Create Facebook Connections Table
-- Purpose: Store Facebook OAuth connections
-- Affected: public.facebook_connections table
-- Dependencies: auth.users
-- ============================================================================

-- Facebook connections: OAuth connections for Facebook Graph API
create table if not exists public.facebook_connections (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- Facebook account info
  facebook_page_id text not null unique,
  facebook_page_name text,
  
  -- OAuth tokens (should be encrypted at rest in application layer)
  access_token text not null,
  token_expires_at timestamptz,
  
  -- Status
  status text default 'connected' not null,
  last_sync_at timestamptz,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  unique(user_id, facebook_page_id)
);
comment on table public.facebook_connections is 'Facebook Graph API OAuth connections';

-- Indexes for performance
create index if not exists idx_facebook_connections_user_id on public.facebook_connections(user_id);
create index if not exists idx_facebook_connections_page_id on public.facebook_connections(facebook_page_id);
create index if not exists idx_facebook_connections_status on public.facebook_connections(status) where status = 'connected';

-- Enable RLS
alter table public.facebook_connections enable row level security;
;
