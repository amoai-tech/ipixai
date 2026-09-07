-- ============================================================================
-- Migration: Create RLS Policies for Assets Table
-- Purpose: Row-level security policies for assets table
-- Affected: public.assets table
-- Dependencies: public.assets table must exist
-- ============================================================================

-- Users can view assets for shoots they have access to
-- Anonymous users: No access
create policy "anon_select_assets"
  on public.assets for select
  to anon
  using (false);

-- Authenticated users can view assets for shoots they have access to
create policy "authenticated_select_assets"
  on public.assets for select
  to authenticated
  using (
    exists (
      select 1 from public.shoots
      where shoots.id = assets.shoot_id
        and shoots.designer_id = (select auth.uid())
    )
  );

-- Authenticated users can insert assets for their shoots
create policy "authenticated_insert_assets"
  on public.assets for insert
  to authenticated
  with check (
    exists (
      select 1 from public.shoots
      where shoots.id = assets.shoot_id
        and shoots.designer_id = (select auth.uid())
    )
  );

-- Authenticated users can update assets for their shoots
create policy "authenticated_update_assets"
  on public.assets for update
  to authenticated
  using (
    exists (
      select 1 from public.shoots
      where shoots.id = assets.shoot_id
        and shoots.designer_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.shoots
      where shoots.id = assets.shoot_id
        and shoots.designer_id = (select auth.uid())
    )
  );
;
