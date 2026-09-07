-- ============================================================================
-- Migration: Create Triggers for Assets and Variants Tables (Retry)
-- Purpose: Automatic updated_at timestamp management
-- Affected: public.assets, public.asset_variants tables
-- Dependencies: Tables must exist, update_updated_at_column function
-- ============================================================================

-- Apply updated_at trigger to assets table
drop trigger if exists update_assets_updated_at on public.assets;
create trigger update_assets_updated_at
  before update on public.assets
  for each row
  execute function public.update_updated_at_column();

-- Apply updated_at trigger to asset_variants table
drop trigger if exists update_asset_variants_updated_at on public.asset_variants;
create trigger update_asset_variants_updated_at
  before update on public.asset_variants
  for each row
  execute function public.update_updated_at_column();

-- Apply updated_at trigger to instagram_connections table
drop trigger if exists update_instagram_connections_updated_at on public.instagram_connections;
create trigger update_instagram_connections_updated_at
  before update on public.instagram_connections
  for each row
  execute function public.update_updated_at_column();

-- Apply updated_at trigger to instagram_posts table
drop trigger if exists update_instagram_posts_updated_at on public.instagram_posts;
create trigger update_instagram_posts_updated_at
  before update on public.instagram_posts
  for each row
  execute function public.update_updated_at_column();

-- Apply updated_at trigger to facebook_connections table
drop trigger if exists update_facebook_connections_updated_at on public.facebook_connections;
create trigger update_facebook_connections_updated_at
  before update on public.facebook_connections
  for each row
  execute function public.update_updated_at_column();

-- Apply updated_at trigger to facebook_posts table
drop trigger if exists update_facebook_posts_updated_at on public.facebook_posts;
create trigger update_facebook_posts_updated_at
  before update on public.facebook_posts
  for each row
  execute function public.update_updated_at_column();
;
