-- ============================================================================
-- Migration: Create Shoot Booking Triggers - FIXED
-- Purpose: Implement automatic updated_at timestamp management for Service Booking tables
-- Affected: public.shoots, public.shoot_items, public.shoot_assets, public.shoot_payments
-- Dependencies: handle_updated_at() function
-- Note: This aligns with the Service Booking System spec (Version 1.0)
-- ============================================================================

-- Create handle_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.handle_updated_at() IS 'Automatically updates the updated_at timestamp on row update';

-- Apply updated_at trigger to shoots table
DROP TRIGGER IF EXISTS update_shoots_updated_at_service_booking ON public.shoots;
CREATE TRIGGER update_shoots_updated_at_service_booking
  BEFORE UPDATE ON public.shoots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Note: shoot_items, shoot_assets, and shoot_payments don't have updated_at columns
-- per user spec, so no triggers needed for those tables.
;
