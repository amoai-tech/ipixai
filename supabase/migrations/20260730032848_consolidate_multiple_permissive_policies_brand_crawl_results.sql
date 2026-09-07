-- Consolidate brand_crawl_results SELECT policies
-- Both policies are identical, drop one
DROP POLICY IF EXISTS "crawl_results_select_org_member" ON public.brand_crawl_results;

-- Keep brand_crawl_results_select_org_member
