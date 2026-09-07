-- ============================================================================
-- Migration: Create Shoot Booking RLS Policies - FIXED
-- Purpose: Implement Row Level Security for Service Booking System tables
-- Affected: public.profiles, public.shoots, public.shoot_items, public.shoot_assets, public.shoot_payments
-- Dependencies: auth.users, existing tables
-- Note: This aligns with the Service Booking System spec (Version 1.0)
-- ============================================================================

-- Enable RLS on all tables (if not already enabled) - idempotent
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoot_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoot_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoot_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES (Service Booking Specific)
-- ============================================================================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "authenticated_update_own_profile_service_booking" ON public.profiles;

-- Clients can update their own profile (if not already covered)
CREATE POLICY "authenticated_update_own_profile_service_booking"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- SHOOTS POLICIES (Service Booking Specific)
-- ============================================================================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "clients_select_own_shoots" ON public.shoots;
DROP POLICY IF EXISTS "clients_insert_shoots" ON public.shoots;
DROP POLICY IF EXISTS "clients_update_own_draft_shoots" ON public.shoots;

-- Clients view own shoots
CREATE POLICY "clients_select_own_shoots"
  ON public.shoots FOR SELECT
  TO authenticated
  USING (auth.uid() = designer_id);

-- Clients create shoots
CREATE POLICY "clients_insert_shoots"
  ON public.shoots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = designer_id);

-- Clients update own draft shoots
CREATE POLICY "clients_update_own_draft_shoots"
  ON public.shoots FOR UPDATE
  TO authenticated
  USING (auth.uid() = designer_id AND status = 'draft')
  WITH CHECK (auth.uid() = designer_id AND status = 'draft');

-- ============================================================================
-- SHOOT ITEMS POLICIES (Service Booking Specific)
-- ============================================================================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "clients_select_shoot_items" ON public.shoot_items;
DROP POLICY IF EXISTS "clients_insert_shoot_items" ON public.shoot_items;
DROP POLICY IF EXISTS "clients_update_shoot_items" ON public.shoot_items;

-- Clients view shoot items for their own shoots
CREATE POLICY "clients_select_shoot_items"
  ON public.shoot_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoots
      WHERE shoots.id = shoot_items.shoot_id
        AND shoots.designer_id = auth.uid()
    )
  );

-- Clients insert shoot items for their own shoots
CREATE POLICY "clients_insert_shoot_items"
  ON public.shoot_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shoots
      WHERE shoots.id = shoot_items.shoot_id
        AND shoots.designer_id = auth.uid()
    )
  );

-- Clients update shoot items for their own shoots (if shoot is in draft/requested)
CREATE POLICY "clients_update_shoot_items"
  ON public.shoot_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoots
      WHERE shoots.id = shoot_items.shoot_id
        AND shoots.designer_id = auth.uid()
        AND shoots.status IN ('draft', 'requested')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shoots
      WHERE shoots.id = shoot_items.shoot_id
        AND shoots.designer_id = auth.uid()
        AND shoots.status IN ('draft', 'requested')
    )
  );

-- ============================================================================
-- SHOOT ASSETS POLICIES (Service Booking Specific)
-- ============================================================================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "clients_select_own_shoot_assets" ON public.shoot_assets;

-- Clients view their own assets
CREATE POLICY "clients_select_own_shoot_assets"
  ON public.shoot_assets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoots
      WHERE shoots.id = shoot_assets.shoot_id
        AND shoots.designer_id = auth.uid()
    )
  );

-- ============================================================================
-- PAYMENTS POLICIES (Service Booking Specific)
-- ============================================================================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "users_select_own_payments_service_booking" ON public.shoot_payments;
DROP POLICY IF EXISTS "users_insert_own_payments_service_booking" ON public.shoot_payments;

-- Users view their own payments
CREATE POLICY "users_select_own_payments_service_booking"
  ON public.shoot_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users insert payments for their own shoots
CREATE POLICY "users_insert_own_payments_service_booking"
  ON public.shoot_payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
;
