-- ============================================================================
-- Migration: Seed Organizations Table (Sample Data)
-- Purpose: Insert sample organization data for testing and development
-- Affected: public.organizations table
-- Dependencies: None (organizations table is independent)
-- ============================================================================

-- Sample organizations for testing
insert into public.organizations (name, slug, type, description, website_url, logo_url)
values (
  'Fashion Studio NYC',
  'fashion-studio-nyc',
  'studio',
  'Premium fashion photography studio in New York City specializing in e-commerce and editorial shoots.',
  'https://fashionstudio.nyc',
  'https://example.com/logos/fashion-studio-nyc.png'
)
on conflict (slug) do nothing;

insert into public.organizations (name, slug, type, description, website_url, logo_url)
values (
  'Elite Model Agency',
  'elite-model-agency',
  'agency',
  'International model agency representing top fashion models worldwide.',
  'https://elitemodels.com',
  'https://example.com/logos/elite-agency.png'
)
on conflict (slug) do nothing;

insert into public.organizations (name, slug, type, description, website_url, logo_url)
values (
  'Luxury Fashion Brand',
  'luxury-fashion-brand',
  'brand',
  'High-end fashion brand creating sustainable luxury clothing and accessories.',
  'https://luxurybrand.com',
  'https://example.com/logos/luxury-brand.png'
)
on conflict (slug) do nothing;
;
