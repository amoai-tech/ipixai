-- Consolidate assets INSERT policies
DROP POLICY IF EXISTS "assets_insert_via_brand" ON public.assets;
DROP POLICY IF EXISTS "authenticated_insert_assets" ON public.assets;

CREATE POLICY "assets_insert" ON public.assets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM brands b
      WHERE (b.id = assets.brand_id) 
        AND (((b.org_id IS NULL) AND (b.user_id = ( SELECT auth.uid() AS uid))) 
          OR ((b.org_id IS NOT NULL) AND is_org_member(b.org_id)))
    ) OR
    EXISTS (
      SELECT 1
      FROM shoots
      WHERE (shoots.id = assets.shoot_id) 
        AND (shoots.designer_id = ( SELECT auth.uid() AS uid))
    )
  );

-- Consolidate assets SELECT policies
DROP POLICY IF EXISTS "assets_select_via_brand" ON public.assets;
DROP POLICY IF EXISTS "authenticated_select_assets" ON public.assets;

CREATE POLICY "assets_select" ON public.assets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM brands b
      WHERE (b.id = assets.brand_id) 
        AND (((b.org_id IS NULL) AND (b.user_id = ( SELECT auth.uid() AS uid))) 
          OR ((b.org_id IS NOT NULL) AND is_org_member(b.org_id)))
    ) OR
    EXISTS (
      SELECT 1
      FROM shoots
      WHERE (shoots.id = assets.shoot_id) 
        AND (shoots.designer_id = ( SELECT auth.uid() AS uid))
    )
  );

-- Consolidate assets UPDATE policies
DROP POLICY IF EXISTS "assets_update_via_brand" ON public.assets;
DROP POLICY IF EXISTS "authenticated_update_assets" ON public.assets;

CREATE POLICY "assets_update" ON public.assets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM brands b
      WHERE (b.id = assets.brand_id) 
        AND (((b.org_id IS NULL) AND (b.user_id = ( SELECT auth.uid() AS uid))) 
          OR ((b.org_id IS NOT NULL) AND is_org_member(b.org_id)))
    ) OR
    EXISTS (
      SELECT 1
      FROM shoots
      WHERE (shoots.id = assets.shoot_id) 
        AND (shoots.designer_id = ( SELECT auth.uid() AS uid))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM brands b
      WHERE (b.id = assets.brand_id) 
        AND (((b.org_id IS NULL) AND (b.user_id = ( SELECT auth.uid() AS uid))) 
          OR ((b.org_id IS NOT NULL) AND is_org_member(b.org_id)))
    ) OR
    EXISTS (
      SELECT 1
      FROM shoots
      WHERE (shoots.id = assets.shoot_id) 
        AND (shoots.designer_id = ( SELECT auth.uid() AS uid))
    )
  );
