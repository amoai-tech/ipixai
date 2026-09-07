-- ============================================================================
-- Migration: Create Amazon Connections Table
-- Purpose: Store Amazon SP-API OAuth connections
-- Affected: public.amazon_connections table
-- Dependencies: auth.users
-- ============================================================================

-- Amazon connections: OAuth connections for Amazon Selling Partner API
create table if not exists public.amazon_connections (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- Amazon seller info
  seller_id text not null unique,
  marketplace_ids text[] not null,
  
  -- OAuth tokens (should be encrypted at rest in application layer)
  refresh_token text not null, -- Long-lived refresh token
  access_token text, -- Short-lived access token (refreshed automatically)
  token_expires_at timestamptz,
  
  -- Status
  status text default 'connected' not null,
  last_sync_at timestamptz,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  unique(user_id)
);

comment on table public.amazon_connections is 'Amazon SP-API OAuth connections';

-- Indexes for performance
create index if not exists idx_amazon_connections_user_id on public.amazon_connections(user_id);
create index if not exists idx_amazon_connections_seller_id on public.amazon_connections(seller_id);
create index if not exists idx_amazon_connections_status on public.amazon_connections(status) where status = 'connected';

-- Enable RLS
alter table public.amazon_connections enable row level security;

-- Drop existing policies if they exist
drop policy if exists "anon_select_amazon_connections" on public.amazon_connections;
drop policy if exists "authenticated_select_amazon_connections" on public.amazon_connections;
drop policy if exists "authenticated_insert_amazon_connections" on public.amazon_connections;
drop policy if exists "authenticated_update_amazon_connections" on public.amazon_connections;
drop policy if exists "authenticated_delete_amazon_connections" on public.amazon_connections;

-- RLS Policies: Users can only access their own connections
-- Anonymous users: No access
create policy "anon_select_amazon_connections"
  on public.amazon_connections for select
  to anon
  using (false);

-- Authenticated users can view their own connections
create policy "authenticated_select_amazon_connections"
  on public.amazon_connections for select
  to authenticated
  using (auth.uid() = user_id);

-- Authenticated users can insert their own connections
create policy "authenticated_insert_amazon_connections"
  on public.amazon_connections for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Authenticated users can update their own connections
create policy "authenticated_update_amazon_connections"
  on public.amazon_connections for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Authenticated users can delete their own connections
create policy "authenticated_delete_amazon_connections"
  on public.amazon_connections for delete
  to authenticated
  using (auth.uid() = user_id);
;
