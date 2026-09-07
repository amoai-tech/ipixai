-- Consolidate event_schedules SELECT policies
DROP POLICY IF EXISTS "authenticated can view published event schedules" ON public.event_schedules;
DROP POLICY IF EXISTS "organizers can view event schedules" ON public.event_schedules;

CREATE POLICY "event_schedules_select" ON public.event_schedules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_schedules.event_id) 
        AND (events.status = 'published'::event_status) 
        AND (events.is_public = true)
    ) OR
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_schedules.event_id) 
        AND (events.organizer_id = auth.uid())
    )
  );

-- Consolidate event_sponsors SELECT policies
DROP POLICY IF EXISTS "authenticated can view published event sponsors" ON public.event_sponsors;
DROP POLICY IF EXISTS "organizers can view event sponsors" ON public.event_sponsors;

CREATE POLICY "event_sponsors_select" ON public.event_sponsors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_sponsors.event_id) 
        AND (events.status = 'published'::event_status) 
        AND (events.is_public = true)
    ) OR
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_sponsors.event_id) 
        AND (events.organizer_id = auth.uid())
    )
  );
