-- ============================================================================
-- Migration: Create Shopify Shops Table
-- Purpose: Store Shopify OAuth connections
-- Affected: public.shopify_shops table
-- Dependencies: auth.users
-- ============================================================================

-- Shopify shops: OAuth connections for Shopify Admin API
create table if not exists public.shopify_shops (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- Shop info
  shop_domain text not null unique, -- e.g., "mystore.myshopify.com"
  shop_name text,
  
  -- OAuth tokens (should be encrypted at rest in application layer)
  access_token text not null, -- Long-lived token (doesn't expire unless revoked)
  scope text not null, -- Comma-separated scopes
  
  -- Status
  status text default 'active' not null, -- 'active', 'uninstalled', 'suspended'
  installed_at timestamptz default now() not null,
  uninstalled_at timestamptz,
  last_sync_at timestamptz,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  unique(user_id, shop_domain)
);

comment on table public.shopify_shops is 'Shopify App OAuth connections';

-- Indexes for performance
create index if not exists idx_shopify_shops_user_id on public.shopify_shops(user_id);
create index if not exists idx_shopify_shops_shop_domain on public.shopify_shops(shop_domain);
create index if not exists idx_shopify_shops_status on public.shopify_shops(status) where status = 'active';

-- Enable RLS
alter table public.shopify_shops enable row level security;

-- Drop existing policies if they exist
drop policy if exists "anon_select_shopify_shops" on public.shopify_shops;
drop policy if exists "authenticated_select_shopify_shops" on public.shopify_shops;
drop policy if exists "authenticated_insert_shopify_shops" on public.shopify_shops;
drop policy if exists "authenticated_update_shopify_shops" on public.shopify_shops;
drop policy if exists "authenticated_delete_shopify_shops" on public.shopify_shops;

-- RLS Policies: Users can only access their own shops
-- Anonymous users: No access
create policy "anon_select_shopify_shops"
  on public.shopify_shops for select
  to anon
  using (false);

-- Authenticated users can view their own shops
create policy "authenticated_select_shopify_shops"
  on public.shopify_shops for select
  to authenticated
  using (auth.uid() = user_id);

-- Authenticated users can insert their own shops
create policy "authenticated_insert_shopify_shops"
  on public.shopify_shops for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Authenticated users can update their own shops
create policy "authenticated_update_shopify_shops"
  on public.shopify_shops for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Authenticated users can delete their own shops
create policy "authenticated_delete_shopify_shops"
  on public.shopify_shops for delete
  to authenticated
  using (auth.uid() = user_id);
;
