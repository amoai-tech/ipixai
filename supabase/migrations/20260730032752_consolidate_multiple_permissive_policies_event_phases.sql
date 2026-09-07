-- Consolidate event_phases INSERT policies
DROP POLICY IF EXISTS "organizers can insert event phases" ON public.event_phases;
DROP POLICY IF EXISTS "system can insert event phases for demo events" ON public.event_phases;

CREATE POLICY "event_phases_insert" ON public.event_phases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_phases.event_id) 
        AND (events.organizer_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_phases.event_id) 
        AND (events.organizer_id = '00000000-0000-0000-0000-000000000000'::uuid)
    )
  );
