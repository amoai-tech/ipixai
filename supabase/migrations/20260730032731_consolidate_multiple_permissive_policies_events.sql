-- Consolidate events SELECT policies
DROP POLICY IF EXISTS "authenticated can view published events" ON public.events;
DROP POLICY IF EXISTS "organizers can view own events" ON public.events;

CREATE POLICY "events_select" ON public.events
  FOR SELECT
  TO authenticated
  USING (
    (status = 'published'::event_status) AND (is_public = true) OR
    auth.uid() = organizer_id
  );
