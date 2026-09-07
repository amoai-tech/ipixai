-- Consolidate event_stakeholders SELECT policies
DROP POLICY IF EXISTS "authenticated can view published event stakeholders" ON public.event_stakeholders;
DROP POLICY IF EXISTS "organizers can view event stakeholders" ON public.event_stakeholders;
DROP POLICY IF EXISTS "stakeholders can view own assignments" ON public.event_stakeholders;

CREATE POLICY "event_stakeholders_select" ON public.event_stakeholders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_stakeholders.event_id) 
        AND (events.status = 'published'::event_status) 
        AND (events.is_public = true)
    ) OR
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_stakeholders.event_id) 
        AND (events.organizer_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1
      FROM stakeholders
      WHERE (stakeholders.id = event_stakeholders.stakeholder_id) 
        AND (stakeholders.profile_id = auth.uid())
    )
  );
