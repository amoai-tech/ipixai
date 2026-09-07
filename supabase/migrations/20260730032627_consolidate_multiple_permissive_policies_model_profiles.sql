-- Consolidate model_profiles INSERT policies
-- "authenticated can insert model profiles" already covers the "models can insert own profile" case
DROP POLICY IF EXISTS "models can insert own profile" ON public.model_profiles;

-- Consolidate model_profiles SELECT policies
-- "authenticated can view model profiles" has qual: true (all authenticated users)
-- "models can view own profile" is redundant since the broader policy already allows access
DROP POLICY IF EXISTS "models can view own profile" ON public.model_profiles;
