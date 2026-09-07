-- ============================================================================
-- Migration: Create RLS Policies for Facebook Connections Table
-- Purpose: Row-level security policies for facebook_connections table
-- Affected: public.facebook_connections table
-- Dependencies: public.facebook_connections table must exist
-- ============================================================================

-- RLS Policies: Users can only access their own connections
-- Anonymous users: No access
create policy "anon_select_facebook_connections"
  on public.facebook_connections for select
  to anon
  using (false);

-- Authenticated users can view their own connections
create policy "authenticated_select_facebook_connections"
  on public.facebook_connections for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Authenticated users can insert their own connections
create policy "authenticated_insert_facebook_connections"
  on public.facebook_connections for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Authenticated users can update their own connections
create policy "authenticated_update_facebook_connections"
  on public.facebook_connections for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Authenticated users can delete their own connections
create policy "authenticated_delete_facebook_connections"
  on public.facebook_connections for delete
  to authenticated
  using ((select auth.uid()) = user_id);
;
