
-- ============================================================================
-- Migration: Backfill Asset Links from Existing Tables
-- ============================================================================
-- Purpose: Copy data from shoot_assets and event_assets into asset_links
-- Status: NON-DESTRUCTIVE - Only adds new data, keeps old tables intact
-- Date: 2025-01-29
-- ============================================================================
-- 
-- IMPORTANT: This migration BACKFILLS data from old tables to new structure.
-- It does NOT delete or modify the original tables.
-- Original tables (shoot_assets, event_assets) remain unchanged.
-- ============================================================================

-- ============================================================================
-- STEP 1: Backfill from shoot_assets → asset_links
-- ============================================================================
-- For each shoot_asset, create:
--   1. An entry in assets table (if not already there)
--   2. An entry in asset_links table linking it to the shoot

-- First, ensure all shoot_assets have corresponding entries in assets
INSERT INTO public.assets (
  id,
  shoot_id,
  url,
  asset_type,
  mime_type,
  metadata,
  status,
  created_at,
  updated_at
)
SELECT 
  sa.id,
  sa.shoot_id,
  sa.url,
  CASE 
    WHEN sa.file_type LIKE '%video%' OR sa.file_type IN ('mp4', 'mov', 'avi') THEN 'video'::asset_type
    WHEN sa.file_type LIKE '%image%' OR sa.file_type IN ('jpg', 'jpeg', 'png', 'gif', 'webp') THEN 'image'::asset_type
    ELSE 'image'::asset_type -- Default to image
  END,
  sa.file_type AS mime_type,
  jsonb_build_object(
    'original_filename', sa.filename,
    'file_type', sa.file_type,
    'is_from_shoot_assets', true,
    'migrated_at', now()
  ) || COALESCE(sa.metadata, '{}'::jsonb) AS metadata,
  CASE 
    WHEN sa.is_final = true THEN 'final'
    ELSE 'draft'
  END,
  sa.uploaded_at,
  sa.uploaded_at
FROM public.shoot_assets sa
WHERE NOT EXISTS (
  SELECT 1 FROM public.assets a WHERE a.id = sa.id
)
ON CONFLICT (id) DO NOTHING;

-- Now create asset_links entries for shoot_assets
INSERT INTO public.asset_links (
  asset_id,
  entity_type,
  entity_id,
  role,
  metadata,
  created_at,
  updated_at
)
SELECT 
  sa.id AS asset_id,
  'shoot' AS entity_type,
  sa.shoot_id AS entity_id,
  CASE 
    WHEN sa.is_final = true THEN 'final'
    ELSE 'raw'
  END AS role,
  jsonb_build_object(
    'source_table', 'shoot_assets',
    'original_uploaded_at', sa.uploaded_at,
    'migrated_at', now()
  ) AS metadata,
  sa.uploaded_at AS created_at,
  sa.uploaded_at AS updated_at
FROM public.shoot_assets sa
WHERE NOT EXISTS (
  SELECT 1 FROM public.asset_links al 
  WHERE al.asset_id = sa.id 
    AND al.entity_type = 'shoot' 
    AND al.entity_id = sa.shoot_id
);

-- ============================================================================
-- STEP 2: Backfill from event_assets → asset_links
-- ============================================================================
-- For each event_asset, create:
--   1. An entry in assets table (if not already there)
--   2. An entry in asset_links table linking it to the event

-- First, ensure all event_assets have corresponding entries in assets
-- NOTE: shoot_id should already be nullable for events (if not, run migration to make it nullable first)
INSERT INTO public.assets (
  id,
  shoot_id, -- NULL for events
  url,
  asset_type,
  mime_type,
  metadata,
  status,
  created_at,
  updated_at
)
SELECT 
  ea.id,
  NULL AS shoot_id, -- Events don't have shoot_id
  ea.url,
  CASE ea.type
    WHEN 'image' THEN 'image'::asset_type
    WHEN 'video' THEN 'video'::asset_type
    WHEN 'document' THEN 'image'::asset_type -- assets table doesn't have 'document' type, use 'image'
    ELSE 'image'::asset_type
  END,
  COALESCE(ea.type, 'image/jpeg') AS mime_type,
  jsonb_build_object(
    'alt_text', ea.alt_text,
    'is_featured', COALESCE(ea.is_featured, false),
    'generation_prompt', ea.generation_prompt,
    'generation_status', ea.generation_status,
    'is_from_event_assets', true,
    'migrated_at', now()
  ) AS metadata,
  'final' AS status, -- Event assets are typically final
  COALESCE(ea.created_at, now()),
  COALESCE(ea.created_at, now())
FROM public.event_assets ea
WHERE NOT EXISTS (
  SELECT 1 FROM public.assets a WHERE a.id = ea.id
)
ON CONFLICT (id) DO NOTHING;

-- Now create asset_links entries for event_assets
INSERT INTO public.asset_links (
  asset_id,
  entity_type,
  entity_id,
  role,
  metadata,
  created_at,
  updated_at
)
SELECT 
  ea.id AS asset_id,
  'event' AS entity_type,
  ea.event_id AS entity_id,
  CASE 
    WHEN ea.is_featured = true THEN 'hero'
    ELSE 'gallery'
  END AS role,
  jsonb_build_object(
    'source_table', 'event_assets',
    'alt_text', ea.alt_text,
    'generation_prompt', ea.generation_prompt,
    'generation_status', ea.generation_status,
    'migrated_at', now()
  ) AS metadata,
  ea.created_at AS created_at,
  ea.created_at AS updated_at
FROM public.event_assets ea
WHERE NOT EXISTS (
  SELECT 1 FROM public.asset_links al 
  WHERE al.asset_id = ea.id 
    AND al.entity_type = 'event' 
    AND al.entity_id = ea.event_id
);

-- ============================================================================
-- STEP 3: Backfill existing assets that don't have links yet
-- ============================================================================
-- For assets that already exist but don't have asset_links entries,
-- create default links based on their shoot_id

INSERT INTO public.asset_links (
  asset_id,
  entity_type,
  entity_id,
  role,
  metadata,
  created_at,
  updated_at
)
SELECT 
  a.id AS asset_id,
  'shoot' AS entity_type,
  a.shoot_id AS entity_id,
  CASE a.status
    WHEN 'final' THEN 'final'
    ELSE 'raw'
  END AS role,
  jsonb_build_object(
    'source', 'existing_assets_table',
    'migrated_at', now()
  ) AS metadata,
  a.created_at,
  a.updated_at
FROM public.assets a
WHERE a.shoot_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.asset_links al 
    WHERE al.asset_id = a.id 
      AND al.entity_type = 'shoot' 
      AND al.entity_id = a.shoot_id
  );

COMMENT ON TABLE public.asset_links IS 'Backfilled from shoot_assets and event_assets. Original tables remain intact for reference.';
;
