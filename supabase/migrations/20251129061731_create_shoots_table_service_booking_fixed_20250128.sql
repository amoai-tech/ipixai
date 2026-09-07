-- ============================================================================
-- Migration: Create Shoots Table (Service Booking System) - FIXED
-- Purpose: Main booking record for shoot booking system per user specification
-- Affected: public.shoots table
-- Dependencies: public.profiles, service_type, shoot_status_v2, retouching_level enums
-- Note: This aligns with the Service Booking System spec (Version 1.0)
-- ============================================================================

-- Enums referenced below were created on remote outside this migration chain.
DO $$ BEGIN
  CREATE TYPE public.service_type AS ENUM ('photography', 'video', 'hybrid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.shoot_status_v2 AS ENUM (
    'draft', 'requested', 'confirmed', 'production',
    'post_production', 'review', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.retouching_level AS ENUM ('basic', 'high_end');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Shoots: Main Booking Record (User Spec)
CREATE TABLE IF NOT EXISTS public.shoots (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  designer_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT, -- Nullable for guest checkout initially
  
  -- Scope Configuration (User Spec)
  shoot_type service_type NOT NULL,
  fashion_category text NOT NULL, -- 'ecomm', 'lookbook'
  style_type text NOT NULL,       -- 'ghost', 'on-model'
  product_size text DEFAULT 'standard',
  
  -- Volume & Quality (User Spec)
  looks_count integer NOT NULL DEFAULT 10,
  retouching_level retouching_level DEFAULT 'basic',
  
  -- Logistics (User Spec)
  fulfillment_type text CHECK (fulfillment_type IN ('virtual', 'location')),
  scheduled_date date,
  scheduled_time time,
  
  -- Financials (User Spec)
  currency text DEFAULT 'USD',
  estimated_quote decimal(10, 2) NOT NULL,
  deposit_amount decimal(10, 2),
  deposit_paid boolean DEFAULT false,
  
  -- Briefing Data (Flexible JSONB) (User Spec)
  -- Structure: { "brief": "...", "references": [], "contact": {...} }
  brief_data jsonb DEFAULT '{}'::jsonb,
  
  -- System (User Spec)
  status shoot_status_v2 DEFAULT 'draft',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraints
  CONSTRAINT shoots_looks_count_check CHECK (looks_count > 0),
  CONSTRAINT shoots_estimated_quote_check CHECK (estimated_quote > 0)
);

COMMENT ON TABLE public.shoots IS 'Main booking record for photography and video services.';
COMMENT ON COLUMN public.shoots.designer_id IS 'Foreign key to profiles table, nullable for guest checkout.';
COMMENT ON COLUMN public.shoots.shoot_type IS 'Type of service: photography, video, or hybrid.';
COMMENT ON COLUMN public.shoots.fashion_category IS 'Category of fashion shoot, e.g., ecomm, lookbook.';
COMMENT ON COLUMN public.shoots.style_type IS 'Style of shoot, e.g., ghost, on-model.';
COMMENT ON COLUMN public.shoots.product_size IS 'Size of product, e.g., standard, oversized.';
COMMENT ON COLUMN public.shoots.looks_count IS 'Number of looks/products to be shot.';
COMMENT ON COLUMN public.shoots.retouching_level IS 'Level of retouching requested.';
COMMENT ON COLUMN public.shoots.fulfillment_type IS 'How the shoot is fulfilled: virtual or location.';
COMMENT ON COLUMN public.shoots.scheduled_date IS 'Scheduled date of the shoot.';
COMMENT ON COLUMN public.shoots.scheduled_time IS 'Scheduled time of the shoot.';
COMMENT ON COLUMN public.shoots.currency IS 'Currency for financial transactions.';
COMMENT ON COLUMN public.shoots.estimated_quote IS 'Estimated quote for the shoot.';
COMMENT ON COLUMN public.shoots.deposit_amount IS 'Amount of deposit required.';
COMMENT ON COLUMN public.shoots.deposit_paid IS 'Whether the deposit has been paid.';
COMMENT ON COLUMN public.shoots.brief_data IS 'JSONB field for flexible briefing data.';
COMMENT ON COLUMN public.shoots.status IS 'Current status of the shoot booking.';

-- Indexes for performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_shoots_designer_id ON public.shoots(designer_id);
CREATE INDEX IF NOT EXISTS idx_shoots_status ON public.shoots(status);
CREATE INDEX IF NOT EXISTS idx_shoots_created_at ON public.shoots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shoots_scheduled_date ON public.shoots(scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shoots_designer_status ON public.shoots(designer_id, status);

-- Enable RLS (idempotent)
ALTER TABLE public.shoots ENABLE ROW LEVEL SECURITY;
;
