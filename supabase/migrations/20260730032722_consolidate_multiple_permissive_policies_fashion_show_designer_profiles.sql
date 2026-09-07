-- Consolidate fashion_show_designer_profiles policies
-- For DELETE: keep the more restrictive policy (authenticated_delete_fashion_show_designer_profiles)
DROP POLICY IF EXISTS "authenticated can delete designer profiles" ON public.fashion_show_designer_profiles;

-- For INSERT: keep the more permissive policy (authenticated_insert_fashion_show_designer_profiles)
DROP POLICY IF EXISTS "authenticated can insert designer profiles" ON public.fashion_show_designer_profiles;

-- For SELECT: keep the more restrictive policy (authenticated can view designer profiles)
DROP POLICY IF EXISTS "authenticated_select_fashion_show_designer_profiles" ON public.fashion_show_designer_profiles;

-- For UPDATE: keep the more permissive policy (authenticated_update_fashion_show_designer_profiles)
DROP POLICY IF EXISTS "authenticated can update designer profiles" ON public.fashion_show_designer_profiles;
