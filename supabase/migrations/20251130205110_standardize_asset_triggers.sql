
-- ============================================================================
-- Migration: Standardize Updated At Triggers for Asset Tables
-- ============================================================================
-- Purpose: Make all asset tables use the same updated_at trigger function
-- Status: NON-DESTRUCTIVE - Only changes trigger functions, no data loss
-- Date: 2025-01-29
-- ============================================================================

-- ============================================================================
-- STEP 1: Verify handle_updated_at() Function Exists
-- ============================================================================
-- This function should already exist from Supabase defaults
-- If it doesn't, we'll create a simple version

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Standardize assets Table Trigger
-- ============================================================================
-- assets currently uses update_updated_at_column(), switch to handle_updated_at()

-- Drop old trigger if it exists
DROP TRIGGER IF EXISTS update_assets_updated_at ON public.assets;

-- Create new trigger with standard function
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- VERIFICATION: All asset tables now use handle_updated_at()
-- ============================================================================
-- After this migration, all asset tables should use handle_updated_at():
-- - assets ✅ (just changed)
-- - asset_variants ✅ (already uses handle_updated_at)
-- - cloudinary_assets ✅ (already uses handle_updated_at)
-- - asset_links ✅ (already uses handle_updated_at)

COMMENT ON TRIGGER update_assets_updated_at ON public.assets IS 'Standardized updated_at trigger using handle_updated_at() function. All asset tables now use the same trigger pattern.';
;
