-- ============================================================================
-- Migration: Seed Fashion Show Designer Profiles Table (Sample Data)
-- Purpose: Insert sample designer profile data for fashion show planning
-- Affected: public.fashion_show_designer_profiles table
-- Dependencies: public.fashion_brands (brand_id foreign key), auth.users (optional user_id)
-- Note: This seed data requires fashion_brands to exist first
-- ============================================================================

-- Sample fashion show designer profiles for testing
-- Note: These require fashion_brands records to exist
-- Replace brand_id with actual fashion_brands.id values from your database
-- user_id is optional and can be null

-- Example seed data (commented out - requires fashion_brands)
-- Uncomment and adjust brand_id based on your fashion_brands table

/*
-- Sample Head Designer Profile
insert into public.fashion_show_designer_profiles (
  brand_id,
  user_id,
  full_name,
  role,
  bio
)
values (
  (select id from public.fashion_brands limit 1), -- Replace with actual brand_id
  null, -- Optional: link to auth.users.id if designer has app access
  'Maria Rodriguez',
  'head_designer',
  'Award-winning fashion designer with 15 years of experience in haute couture. Specializes in sustainable luxury and avant-garde designs.'
)
on conflict do nothing;

-- Sample Associate Designer Profile
insert into public.fashion_show_designer_profiles (
  brand_id,
  user_id,
  full_name,
  role,
  bio
)
values (
  (select id from public.fashion_brands limit 1 offset 1), -- Replace with actual brand_id
  null,
  'James Chen',
  'associate_designer',
  'Emerging designer focused on streetwear and contemporary fashion. Known for innovative fabric combinations and bold color palettes.'
)
on conflict do nothing;

-- Sample Creative Director Profile
insert into public.fashion_show_designer_profiles (
  brand_id,
  user_id,
  full_name,
  role,
  bio
)
values (
  (select id from public.fashion_brands limit 1 offset 2), -- Replace with actual brand_id
  null,
  'Sophie Laurent',
  'creative_director',
  'Creative director with expertise in runway shows and fashion presentations. Leads design teams for major fashion weeks.'
)
on conflict do nothing;
*/

-- Note: Fashion show designer profiles are typically created when designers are added to events.
-- This seed file is provided as a template for development/testing scenarios.
;
