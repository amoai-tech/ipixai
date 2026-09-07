-- Consolidate event_rehearsals SELECT policies for authenticated role
DROP POLICY IF EXISTS "public_select_event_rehearsals" ON public.event_rehearsals;
DROP POLICY IF EXISTS "organizers_select_event_rehearsals" ON public.event_rehearsals;

CREATE POLICY "event_rehearsals_select" ON public.event_rehearsals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_rehearsals.event_id) 
        AND (events.status = 'published'::event_status)
    ) OR
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_rehearsals.event_id) 
        AND (events.organizer_id = auth.uid())
    )
  );
