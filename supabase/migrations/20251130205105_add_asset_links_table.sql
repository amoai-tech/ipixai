
-- ============================================================================
-- Migration: Add Asset Links Table for Unified Asset Management
-- ============================================================================
-- Purpose: Create flexible linking table to replace separate shoot_assets/event_assets
-- Status: NON-DESTRUCTIVE - Only adds new structure, no deletions
-- Date: 2025-01-29
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Asset Role Enum (Optional, Better Type Safety)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE asset_role AS ENUM (
    'reference',
    'raw',
    'final',
    'hero',
    'gallery',
    'thumbnail',
    'promo',
    'bts',
    'moodboard'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 2: Create Asset Links Table
-- ============================================================================
-- This table allows flexible linking of assets to any entity (shoot, event, product, post)
-- Replaces the need for separate shoot_assets/event_assets tables in the future

CREATE TABLE IF NOT EXISTS public.asset_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('shoot', 'event', 'product', 'post')),
  entity_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'gallery',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT asset_links_pkey PRIMARY KEY (id),
  CONSTRAINT asset_links_asset_id_fkey FOREIGN KEY (asset_id) 
    REFERENCES public.assets(id) ON DELETE CASCADE,
  
  -- Ensure one asset can have one role per entity
  CONSTRAINT asset_links_unique_entity_role UNIQUE (asset_id, entity_type, entity_id, role)
) TABLESPACE pg_default;

-- ============================================================================
-- STEP 3: Create Indexes for Performance
-- ============================================================================

-- Main lookup: Get all assets for an entity
CREATE INDEX IF NOT EXISTS idx_asset_links_entity 
  ON public.asset_links(entity_type, entity_id) 
  TABLESPACE pg_default;

-- Get assets by role for an entity
CREATE INDEX IF NOT EXISTS idx_asset_links_entity_role 
  ON public.asset_links(entity_type, entity_id, role) 
  TABLESPACE pg_default;

-- Reverse lookup: Get all entities for an asset
CREATE INDEX IF NOT EXISTS idx_asset_links_asset 
  ON public.asset_links(asset_id) 
  TABLESPACE pg_default;

-- ============================================================================
-- STEP 4: Add Updated At Trigger
-- ============================================================================

CREATE TRIGGER update_asset_links_updated_at
  BEFORE UPDATE ON public.asset_links
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- STEP 5: Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.asset_links ENABLE ROW LEVEL SECURITY;

-- Basic policy: Users can read their own assets
-- (You may want to adjust this based on your RLS requirements)
CREATE POLICY "Users can view asset links for their own entities"
  ON public.asset_links
  FOR SELECT
  USING (true); -- Adjust this policy based on your security requirements

-- ============================================================================
-- COMMENT: Documentation
-- ============================================================================

COMMENT ON TABLE public.asset_links IS 'Flexible linking table connecting assets to any entity (shoot, event, product, post) with role-based classification. This replaces the need for separate shoot_assets/event_assets tables in the unified asset model.';
COMMENT ON COLUMN public.asset_links.entity_type IS 'Type of entity this asset is linked to: shoot, event, product, or post';
COMMENT ON COLUMN public.asset_links.entity_id IS 'UUID of the linked entity';
COMMENT ON COLUMN public.asset_links.role IS 'Role/context of this asset: reference, raw, final, hero, gallery, thumbnail, promo, bts, moodboard';
;
