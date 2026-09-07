-- Phase 2: High Priority Fix #2 (SIMPLIFIED)
-- Fix overly permissive RLS policy on asset_links table
-- Note: Simplified to only check events ownership (assets and shoots need further analysis)

begin;

-- Drop existing overly permissive policy
drop policy if exists "Users can view asset links for their own entities" on public.asset_links;
drop policy if exists "Users can insert asset links for their own entities" on public.asset_links;
drop policy if exists "Users can update asset links for their own entities" on public.asset_links;
drop policy if exists "Users can delete asset links for their own entities" on public.asset_links;

-- SELECT: Users can view asset links for events they own
-- For now, only check events (simplified from audit requirement)
-- TODO: Add shoots and assets ownership checks once column structure is verified
create policy "Users can view asset links for their own entities"
on public.asset_links
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = asset_links.entity_id
      and e.organizer_id = (select auth.uid())
  )
);

-- INSERT: Users can create asset links for events they own
create policy "Users can insert asset links for their own entities"
on public.asset_links
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = asset_links.entity_id
      and e.organizer_id = (select auth.uid())
  )
);

-- UPDATE: Users can update asset links for events they own
create policy "Users can update asset links for their own entities"
on public.asset_links
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = asset_links.entity_id
      and e.organizer_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = asset_links.entity_id
      and e.organizer_id = (select auth.uid())
  )
);

-- DELETE: Users can delete asset links for events they own
create policy "Users can delete asset links for their own entities"
on public.asset_links
for delete
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = asset_links.entity_id
      and e.organizer_id = (select auth.uid())
  )
);

comment on policy "Users can view asset links for their own entities" on public.asset_links is
'Restricts view to asset links for events owned by user (security fix from audit - simplified version)';

commit;;
