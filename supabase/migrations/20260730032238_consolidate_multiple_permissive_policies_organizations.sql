-- Consolidate multiple permissive policies on organizations table
-- Combine SELECT policies with OR conditions
-- Combine UPDATE policies with OR conditions

-- Drop old SELECT policies
DROP POLICY IF EXISTS "orgs_select_member" ON public.organizations;
DROP POLICY IF EXISTS "orgs_select_owner" ON public.organizations;

-- Create consolidated SELECT policy
CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT
  TO authenticated
  USING (is_org_member(id) OR (( SELECT auth.uid() AS uid) = owner_id));

-- Drop old UPDATE policies
DROP POLICY IF EXISTS "admins_can_update_organizations" ON public.organizations;
DROP POLICY IF EXISTS "orgs_update_owner" ON public.organizations;

-- Create consolidated UPDATE policy
CREATE POLICY "organizations_update" ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    is_org_owner(id) OR 
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE (profiles.id = ( SELECT auth.uid() AS uid)) 
        AND (profiles.role = 'admin'::user_role)
    )
  )
  WITH CHECK (
    is_org_owner(id) OR 
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE (profiles.id = ( SELECT auth.uid() AS uid)) 
        AND (profiles.role = 'admin'::user_role)
    )
  );
