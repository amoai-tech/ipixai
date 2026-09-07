
-- Migration: Fix fashion_brands INSERT RLS
-- Purpose: Restrict INSERT to organizers/admins
-- Current: Open INSERT for all authenticated users
-- Date: 2026-01-21

-- 1. Drop overly permissive INSERT policy  
DROP POLICY IF EXISTS "authenticated can insert fashion brands" ON public.fashion_brands;

-- 2. Create restricted INSERT policy
CREATE POLICY "organizers_can_insert_fashion_brands" 
ON public.fashion_brands 
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role IN ('organizer', 'designer', 'admin')
  )
);
;
