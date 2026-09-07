-- Phase 2: High Priority Fix #1
-- Fix overly permissive RLS policies on fashion_show_designer_profiles table

begin;

-- Drop existing overly permissive policies
drop policy if exists "authenticated can view designer profiles" on public.fashion_show_designer_profiles;
drop policy if exists "authenticated can insert designer profiles" on public.fashion_show_designer_profiles;
drop policy if exists "authenticated can update designer profiles" on public.fashion_show_designer_profiles;
drop policy if exists "authenticated can delete designer profiles" on public.fashion_show_designer_profiles;

-- SELECT: Users can view profiles they own or profiles associated with their events
create policy "authenticated can view designer profiles"
on public.fashion_show_designer_profiles
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.event_designers ed
    join public.events e on e.id = ed.event_id
    where ed.designer_id = fashion_show_designer_profiles.id
      and e.organizer_id = (select auth.uid())
  )
);

-- INSERT: Users can create profiles with themselves as owner
create policy "authenticated can insert designer profiles"
on public.fashion_show_designer_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- UPDATE: Only profile owners or event organizers can update
create policy "authenticated can update designer profiles"
on public.fashion_show_designer_profiles
for update
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.event_designers ed
    join public.events e on e.id = ed.event_id
    where ed.designer_id = fashion_show_designer_profiles.id
      and e.organizer_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.event_designers ed
    join public.events e on e.id = ed.event_id
    where ed.designer_id = fashion_show_designer_profiles.id
      and e.organizer_id = (select auth.uid())
  )
);

-- DELETE: Only profile owners can delete (prevent deletion of profiles used in events)
create policy "authenticated can delete designer profiles"
on public.fashion_show_designer_profiles
for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and not exists (
    select 1
    from public.event_designers ed
    where ed.designer_id = fashion_show_designer_profiles.id
  )
);

commit;;
