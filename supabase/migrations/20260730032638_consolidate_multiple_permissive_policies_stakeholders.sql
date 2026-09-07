-- Consolidate stakeholders INSERT policies
-- "authenticated can insert stakeholders" already covers the "stakeholders can insert own profile" case
DROP POLICY IF EXISTS "stakeholders can insert own profile" ON public.stakeholders;

-- Consolidate stakeholders SELECT policies
-- "authenticated can view stakeholders" has qual: true (all authenticated users)
-- "stakeholders can view own profile" is redundant
DROP POLICY IF EXISTS "stakeholders can view own profile" ON public.stakeholders;
