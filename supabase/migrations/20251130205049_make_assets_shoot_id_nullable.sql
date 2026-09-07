
-- ============================================================================
-- Migration: Make assets.shoot_id Nullable
-- ============================================================================
-- Purpose: Allow assets to exist without a shoot_id (for events, products, etc.)
-- Status: NON-DESTRUCTIVE - Only changes column constraint, no data loss
-- Date: 2025-01-29
-- Order: This must run BEFORE backfill migration (00003)
-- ============================================================================

-- ============================================================================
-- STEP 1: Make shoot_id Nullable
-- ============================================================================
-- This allows assets to be linked to events or other entities without a shoot

ALTER TABLE public.assets 
  ALTER COLUMN shoot_id DROP NOT NULL;

-- ============================================================================
-- STEP 2: Add Comment
-- ============================================================================

COMMENT ON COLUMN public.assets.shoot_id IS 'Nullable: NULL for event/product assets, UUID for shoot assets. Use asset_links table for flexible entity relationships.';
;
