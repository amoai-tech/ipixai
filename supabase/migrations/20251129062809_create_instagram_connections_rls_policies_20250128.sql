-- ============================================================================
-- Migration: Create RLS Policies for Instagram Connections Table
-- Purpose: Row-level security policies for instagram_connections table
-- Affected: public.instagram_connections table
-- Dependencies: public.instagram_connections table must exist
-- ============================================================================

-- RLS Policies: Users can only access their own connections
-- Anonymous users: No access
create policy "anon_select_instagram_connections"
  on public.instagram_connections for select
  to anon
  using (false);

-- Authenticated users can view their own connections
create policy "authenticated_select_instagram_connections"
  on public.instagram_connections for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Authenticated users can insert their own connections
create policy "authenticated_insert_instagram_connections"
  on public.instagram_connections for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Authenticated users can update their own connections
create policy "authenticated_update_instagram_connections"
  on public.instagram_connections for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Authenticated users can delete their own connections
create policy "authenticated_delete_instagram_connections"
  on public.instagram_connections for delete
  to authenticated
  using ((select auth.uid()) = user_id);
;
