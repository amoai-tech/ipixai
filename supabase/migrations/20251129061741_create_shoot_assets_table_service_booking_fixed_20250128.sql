-- ============================================================================
-- Migration: Create Shoot Assets Table (Service Booking System) - FIXED
-- Purpose: Deliverables (images/videos) from a shoot booking
-- Affected: public.shoot_assets table
-- Dependencies: public.shoots
-- Note: This aligns with the Service Booking System spec (Version 1.0)
-- ============================================================================

-- Shoot Assets: Deliverables (User Spec)
CREATE TABLE IF NOT EXISTS public.shoot_assets (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  shoot_id uuid REFERENCES public.shoots(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  filename text,
  file_type text, -- 'jpg', 'mp4'
  metadata jsonb, -- { width, height, size }
  is_final boolean DEFAULT false,
  uploaded_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraints
  CONSTRAINT shoot_assets_url_check CHECK (char_length(url) > 0)
);

COMMENT ON TABLE public.shoot_assets IS 'Final media assets (images, videos) delivered from a shoot.';
COMMENT ON COLUMN public.shoot_assets.shoot_id IS 'Foreign key to the shoots table.';
COMMENT ON COLUMN public.shoot_assets.url IS 'URL of the asset in storage.';
COMMENT ON COLUMN public.shoot_assets.filename IS 'Original filename of the asset.';
COMMENT ON COLUMN public.shoot_assets.file_type IS 'Type of the file, e.g., jpg, mp4.';
COMMENT ON COLUMN public.shoot_assets.metadata IS 'JSONB field for storing asset metadata like dimensions, size.';
COMMENT ON COLUMN public.shoot_assets.is_final IS 'Indicates if this is a final, approved asset.';

-- Indexes for performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_shoot_assets_shoot_id ON public.shoot_assets(shoot_id);
CREATE INDEX IF NOT EXISTS idx_shoot_assets_is_final ON public.shoot_assets(is_final) WHERE is_final = true;

-- Enable RLS (idempotent)
ALTER TABLE public.shoot_assets ENABLE ROW LEVEL SECURITY;
;
