-- ============================================================================
-- Migration: Seed Media Size Specifications (MVP)
-- Purpose: Populate media_size_specs table with core platform specifications
-- Affected: public.media_size_specs table (data insertion)
-- Dependencies: public.media_size_specs table must exist
-- ============================================================================

-- Instagram: Core formats only
insert into public.media_size_specs (platform, use_case, recommended_width, recommended_height, aspect_ratio, display_name, notes) values
  ('instagram', 'feed_square', 1080, 1080, '1:1', 'Instagram Feed (Square)', 'Most common format, works well for product shots')
  on conflict (platform, use_case) do nothing;

insert into public.media_size_specs (platform, use_case, recommended_width, recommended_height, aspect_ratio, display_name, notes) values
  ('instagram', 'stories', 1080, 1920, '9:16', 'Instagram Stories', 'Full-screen vertical stories, avoid text in top/bottom 100px')
  on conflict (platform, use_case) do nothing;

insert into public.media_size_specs (platform, use_case, recommended_width, recommended_height, aspect_ratio, display_name, notes) values
  ('instagram', 'reels', 1080, 1920, '9:16', 'Instagram Reels', 'Vertical video content, same dimensions as Stories')
  on conflict (platform, use_case) do nothing;

-- Facebook: Core formats only
insert into public.media_size_specs (platform, use_case, recommended_width, recommended_height, aspect_ratio, display_name, notes) values
  ('facebook', 'feed_square', 1080, 1080, '1:1', 'Facebook Feed (Square)', 'Square posts in feed, works well for product images')
  on conflict (platform, use_case) do nothing;

insert into public.media_size_specs (platform, use_case, recommended_width, recommended_height, aspect_ratio, display_name, notes) values
  ('facebook', 'stories', 1080, 1920, '9:16', 'Facebook Stories', 'Full-screen vertical stories, same as Instagram Stories')
  on conflict (platform, use_case) do nothing;

-- Amazon: Product images only
insert into public.media_size_specs (platform, use_case, recommended_width, recommended_height, aspect_ratio, display_name, notes) values
  ('amazon', 'product_main', 1600, 1600, '1:1', 'Amazon Main Product Image', 'Pure white background (RGB 255,255,255), product fills 85%')
  on conflict (platform, use_case) do nothing;

-- Shopify: Product images only
insert into public.media_size_specs (platform, use_case, recommended_width, recommended_height, aspect_ratio, display_name, notes) values
  ('shopify', 'product_main', 2048, 2048, '1:1', 'Shopify Main Product Image', 'Square format recommended, high resolution for zoom')
  on conflict (platform, use_case) do nothing;
;
