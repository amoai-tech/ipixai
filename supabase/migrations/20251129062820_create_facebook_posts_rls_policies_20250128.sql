-- ============================================================================
-- Migration: Create RLS Policies for Facebook Posts Table
-- Purpose: Row-level security policies for facebook_posts table
-- Affected: public.facebook_posts table
-- Dependencies: public.facebook_posts table must exist
-- ============================================================================

-- RLS Policies: Users can view posts from their own connections
-- Anonymous users: No access
create policy "anon_select_facebook_posts"
  on public.facebook_posts for select
  to anon
  using (false);

-- Authenticated users can view posts from their own connections
create policy "authenticated_select_facebook_posts"
  on public.facebook_posts for select
  to authenticated
  using (
    exists (
      select 1 from public.facebook_connections
      where facebook_connections.id = facebook_posts.connection_id
      and facebook_connections.user_id = (select auth.uid())
    )
  );

-- Authenticated users can create posts for their own connections
create policy "authenticated_insert_facebook_posts"
  on public.facebook_posts for insert
  to authenticated
  with check (
    exists (
      select 1 from public.facebook_connections
      where facebook_connections.id = facebook_posts.connection_id
      and facebook_connections.user_id = (select auth.uid())
    )
  );

-- Authenticated users can update posts from their own connections
create policy "authenticated_update_facebook_posts"
  on public.facebook_posts for update
  to authenticated
  using (
    exists (
      select 1 from public.facebook_connections
      where facebook_connections.id = facebook_posts.connection_id
      and facebook_connections.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.facebook_connections
      where facebook_connections.id = facebook_posts.connection_id
      and facebook_connections.user_id = (select auth.uid())
    )
  );
;
