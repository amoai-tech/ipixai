-- Consolidate event_designers SELECT policies
DROP POLICY IF EXISTS "authenticated can view published event designers" ON public.event_designers;
DROP POLICY IF EXISTS "organizers can view event designers" ON public.event_designers;

CREATE POLICY "event_designers_select" ON public.event_designers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_designers.event_id) 
        AND (events.status = 'published'::event_status) 
        AND (events.is_public = true)
    ) OR
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_designers.event_id) 
        AND (events.organizer_id = auth.uid())
    )
  );
