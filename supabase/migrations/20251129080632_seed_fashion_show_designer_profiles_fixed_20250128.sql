-- ============================================================================
-- Migration: Seed Fashion Show Designer Profiles (Sample Data) - Fixed
-- Purpose: Insert sample fashion show designer profile data
-- Affected: public.fashion_show_designer_profiles table
-- Dependencies: public.fashion_brands (optional)
-- ============================================================================

-- Note: This seed file uses existing fashion_brand IDs from the database
-- If fashion_brands don't exist, brand_id will be NULL (which is allowed)

-- Sample fashion show designer profiles
insert into public.fashion_show_designer_profiles (
  full_name,
  brand_id,
  role,
  bio
)
values (
  'Isabella Chen',
  (SELECT id FROM public.fashion_brands WHERE name = 'Luxe Couture' LIMIT 1),
  'head_designer',
  'Award-winning designer specializing in haute couture and evening wear. Known for intricate beadwork and sustainable luxury fabrics.'
)
on conflict do nothing;

insert into public.fashion_show_designer_profiles (
  full_name,
  brand_id,
  role,
  bio
)
values (
  'Marcus Rodriguez',
  (SELECT id FROM public.fashion_brands WHERE name = 'Urban Streetwear' LIMIT 1),
  'head_designer',
  'Contemporary streetwear designer blending urban culture with sustainable fashion. Focus on unisex designs and bold graphics.'
)
on conflict do nothing;

insert into public.fashion_show_designer_profiles (
  full_name,
  brand_id,
  role,
  bio
)
values (
  'Sophie Laurent',
  (SELECT id FROM public.fashion_brands WHERE name = 'Eco Chic' LIMIT 1),
  'head_designer',
  'Sustainable fashion pioneer creating elegant designs from recycled and organic materials. Advocate for ethical fashion.'
)
on conflict do nothing;
;
