-- Consolidate events SELECT policies for anon role
DROP POLICY IF EXISTS "anon can view own demo events" ON public.events;
DROP POLICY IF EXISTS "anon can view published events" ON public.events;

CREATE POLICY "events_select_anon" ON public.events
  FOR SELECT
  TO anon
  USING (
    (status = 'published'::event_status) AND (is_public = true) OR
    organizer_id = '00000000-0000-0000-0000-000000000000'::uuid
  );
