
-- Migration: Fix sponsorship_packages RLS for reference table
-- Purpose: sponsorship_packages is a REFERENCE table (package templates)
-- Current: Open INSERT/UPDATE/DELETE for all authenticated users
-- Fix: Make it read-only for regular users, admin-only for modifications
-- Note: Actual sponsor assignments are in event_sponsors (already secured)
-- Date: 2026-01-21

-- 1. Drop overly permissive modification policies
DROP POLICY IF EXISTS "authenticated can insert sponsorship packages" ON public.sponsorship_packages;
DROP POLICY IF EXISTS "authenticated can update sponsorship packages" ON public.sponsorship_packages;
DROP POLICY IF EXISTS "authenticated can delete sponsorship packages" ON public.sponsorship_packages;

-- 2. Keep read access open (reference data should be viewable)
-- "anon can view sponsorship packages" - KEEP
-- "authenticated can view sponsorship packages" - KEEP

-- 3. Create restricted modification policies
-- Only users with 'organizer' or 'admin' role can create new package templates
-- This prevents random users from polluting the package catalog

CREATE POLICY "organizers_can_insert_sponsorship_packages" 
ON public.sponsorship_packages 
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role IN ('organizer', 'admin')
  )
);

CREATE POLICY "organizers_can_update_sponsorship_packages" 
ON public.sponsorship_packages 
FOR UPDATE
TO authenticated
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

CREATE POLICY "admins_can_delete_sponsorship_packages" 
ON public.sponsorship_packages 
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role = 'admin'
  )
);

-- 4. Add documentation
COMMENT ON TABLE public.sponsorship_packages IS
'Reference table for sponsorship package templates. Read-only for regular users; organizers can create/update; admins can delete.';
;
