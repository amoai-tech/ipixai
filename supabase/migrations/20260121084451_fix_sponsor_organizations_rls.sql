
-- Migration: Fix sponsor_organizations RLS
-- Purpose: sponsor_organizations is a reference table for sponsor companies
-- Current: Open INSERT/UPDATE for all authenticated users
-- Fix: Restrict to organizers/admins only
-- Date: 2026-01-21

-- 1. Drop overly permissive modification policies
DROP POLICY IF EXISTS "authenticated can insert sponsor organizations" ON public.sponsor_organizations;
DROP POLICY IF EXISTS "authenticated can update sponsor organizations" ON public.sponsor_organizations;
DROP POLICY IF EXISTS "authenticated can delete sponsor organizations" ON public.sponsor_organizations;

-- 2. Create restricted modification policies
CREATE POLICY "organizers_can_insert_sponsor_organizations" 
ON public.sponsor_organizations 
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role IN ('organizer', 'admin')
  )
);

CREATE POLICY "organizers_can_update_sponsor_organizations" 
ON public.sponsor_organizations 
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

CREATE POLICY "admins_can_delete_sponsor_organizations" 
ON public.sponsor_organizations 
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role = 'admin'
  )
);
;
