-- Consolidate duplicate UPDATE policies on profiles table
-- Both policies are identical: (auth.uid() = id)
-- Drop one, keep the other

DROP POLICY IF EXISTS "authenticated_update_own_profile_service_booking" ON public.profiles;

-- Keep authenticated_users_can_update_own_profile (same logic)
