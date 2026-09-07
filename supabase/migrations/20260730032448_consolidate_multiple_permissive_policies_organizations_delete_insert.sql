-- Consolidate organizations DELETE policies
DROP POLICY IF EXISTS "admins_can_delete_organizations" ON public.organizations;
DROP POLICY IF EXISTS "orgs_delete_owner" ON public.organizations;

CREATE POLICY "organizations_delete" ON public.organizations
  FOR DELETE
  TO authenticated
  USING (
    ( SELECT auth.uid() AS uid) = owner_id OR
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE (profiles.id = ( SELECT auth.uid() AS uid)) 
        AND (profiles.role = 'admin'::user_role)
    )
  );

-- Consolidate organizations INSERT policies
DROP POLICY IF EXISTS "admins_can_insert_organizations" ON public.organizations;
DROP POLICY IF EXISTS "orgs_insert_owner" ON public.organizations;

CREATE POLICY "organizations_insert" ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ( SELECT auth.uid() AS uid) = owner_id OR
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE (profiles.id = ( SELECT auth.uid() AS uid)) 
        AND (profiles.role = 'admin'::user_role)
    )
  );
