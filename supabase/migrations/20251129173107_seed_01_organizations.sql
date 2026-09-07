-- Seed: Organizations (01)
-- Remove safety check for live execution

INSERT INTO organizations (id, name, slug, type, description, website_url, logo_url, created_at, updated_at)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'Medellín Fashion Studio',
    'demo-medellin-studio',
    'studio',
    'Premier fashion photography and video production studio in Medellín, Colombia. Specializing in e-commerce, lookbooks, and brand campaigns.',
    'https://medellinfashionstudio.com',
    'https://storage.googleapis.com/demo-assets/logos/medellin-studio.png',
    NOW(),
    NOW()
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Fashion Collective Agency',
    'demo-fashion-agency',
    'agency',
    'Full-service fashion agency representing models, designers, and photographers. Based in New York with global reach.',
    'https://fashioncollective.com',
    'https://storage.googleapis.com/demo-assets/logos/fashion-agency.png',
    NOW(),
    NOW()
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Artisan Fashion House',
    'demo-artisan-house',
    'brand',
    'Luxury sustainable fashion brand. Handcrafted pieces with ethical production. Available in select boutiques worldwide.',
    'https://artisanfashion.com',
    'https://storage.googleapis.com/demo-assets/logos/artisan-house.png',
    NOW(),
    NOW()
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'Bogotá Creative Studio',
    'demo-bogota-studio',
    'studio',
    'Creative studio offering photography, videography, and creative direction services for fashion brands.',
    'https://bogotacreative.com',
    NULL,
    NOW(),
    NOW()
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  website_url = EXCLUDED.website_url,
  logo_url = EXCLUDED.logo_url,
  updated_at = NOW();
;
