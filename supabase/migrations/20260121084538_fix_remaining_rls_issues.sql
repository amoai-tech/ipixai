
-- Migration: Fix remaining RLS issues
-- Purpose: Secure model_agencies, organizations UPDATE/DELETE
-- Date: 2026-01-21

-- ============================================================
-- 1. Fix model_agencies (reference table for agencies)
-- ============================================================

DROP POLICY IF EXISTS "authenticated can insert model agencies" ON public.model_agencies;
DROP POLICY IF EXISTS "authenticated can update model agencies" ON public.model_agencies;
DROP POLICY IF EXISTS "authenticated can delete model agencies" ON public.model_agencies;

-- Only organizers/admins can manage model agencies
CREATE POLICY "organizers_can_insert_model_agencies" 
ON public.model_agencies FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role IN ('organizer', 'admin')
  )
);

CREATE POLICY "organizers_can_update_model_agencies" 
ON public.model_agencies FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role IN ('organizer', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role IN ('organizer', 'admin')
  )
);

CREATE POLICY "admins_can_delete_model_agencies" 
ON public.model_agencies FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role = 'admin'
  )
);

-- ============================================================
-- 2. Fix organizations UPDATE/DELETE
-- ============================================================

DROP POLICY IF EXISTS "authenticated can update organizations" ON public.organizations;
DROP POLICY IF EXISTS "authenticated can delete organizations" ON public.organizations;

-- Only admins can update organizations
CREATE POLICY "admins_can_update_organizations" 
ON public.organizations FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role = 'admin'
  )
);

-- Only admins can delete organizations
CREATE POLICY "admins_can_delete_organizations" 
ON public.organizations FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role = 'admin'
  )
);
;
