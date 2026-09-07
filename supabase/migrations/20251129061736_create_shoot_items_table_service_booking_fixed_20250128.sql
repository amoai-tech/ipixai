-- ============================================================================
-- Migration: Create Shoot Items Table (Service Booking System) - FIXED
-- Purpose: The shot list for individual items within a shoot booking
-- Affected: public.shoot_items table
-- Dependencies: public.shoots
-- Note: This aligns with the Service Booking System spec (Version 1.0)
-- ============================================================================

-- Shoot Items: The Shot List (User Spec)
CREATE TABLE IF NOT EXISTS public.shoot_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  shoot_id uuid REFERENCES public.shoots(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  instructions text,
  reference_image_url text,
  status text DEFAULT 'pending', -- 'shot', 'pending'
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraints
  CONSTRAINT shoot_items_name_check CHECK (char_length(name) > 0)
);

COMMENT ON TABLE public.shoot_items IS 'Individual items or garments to be shot within a booking.';
COMMENT ON COLUMN public.shoot_items.shoot_id IS 'Foreign key to the shoots table.';
COMMENT ON COLUMN public.shoot_items.name IS 'Name or description of the item.';
COMMENT ON COLUMN public.shoot_items.instructions IS 'Specific instructions for shooting this item.';
COMMENT ON COLUMN public.shoot_items.reference_image_url IS 'URL to a reference image for the item.';
COMMENT ON COLUMN public.shoot_items.status IS 'Status of the item in the production workflow.';

-- Indexes for performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_shoot_items_shoot_id ON public.shoot_items(shoot_id);
CREATE INDEX IF NOT EXISTS idx_shoot_items_status ON public.shoot_items(status);

-- Enable RLS (idempotent)
ALTER TABLE public.shoot_items ENABLE ROW LEVEL SECURITY;
;
