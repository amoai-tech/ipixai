
-- Migration: Fix organizations INSERT RLS
-- Purpose: Restrict INSERT to admins only (organizations are high-level entities)
-- Current: Open INSERT for all authenticated users
-- Date: 2026-01-21

-- 1. Drop overly permissive INSERT policy  
DROP POLICY IF EXISTS "authenticated can insert organizations" ON public.organizations;

-- 2. Create restricted INSERT policy (admins only for org creation)
CREATE POLICY "admins_can_insert_organizations" 
ON public.organizations 
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role = 'admin'
  )
);
;
