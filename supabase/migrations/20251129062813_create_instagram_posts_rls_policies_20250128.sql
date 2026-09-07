-- ============================================================================
-- Migration: Create RLS Policies for Instagram Posts Table
-- Purpose: Row-level security policies for instagram_posts table
-- Affected: public.instagram_posts table
-- Dependencies: public.instagram_posts table must exist
-- ============================================================================

-- RLS Policies: Users can view posts from their own connections
-- Anonymous users: No access
create policy "anon_select_instagram_posts"
  on public.instagram_posts for select
  to anon
  using (false);

-- Authenticated users can view posts from their own connections
create policy "authenticated_select_instagram_posts"
  on public.instagram_posts for select
  to authenticated
  using (
    exists (
      select 1 from public.instagram_connections
      where instagram_connections.id = instagram_posts.connection_id
      and instagram_connections.user_id = (select auth.uid())
    )
  );

-- Authenticated users can create posts for their own connections
create policy "authenticated_insert_instagram_posts"
  on public.instagram_posts for insert
  to authenticated
  with check (
    exists (
      select 1 from public.instagram_connections
      where instagram_connections.id = instagram_posts.connection_id
      and instagram_connections.user_id = (select auth.uid())
    )
  );

-- Authenticated users can update posts from their own connections
create policy "authenticated_update_instagram_posts"
  on public.instagram_posts for update
  to authenticated
  using (
    exists (
      select 1 from public.instagram_connections
      where instagram_connections.id = instagram_posts.connection_id
      and instagram_connections.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.instagram_connections
      where instagram_connections.id = instagram_posts.connection_id
      and instagram_connections.user_id = (select auth.uid())
    )
  );
;
