-- Consolidate call_times SELECT policies
DROP POLICY IF EXISTS "stakeholders can view own call times" ON public.call_times;
DROP POLICY IF EXISTS "models can view own call times" ON public.call_times;
DROP POLICY IF EXISTS "organizers can view call times" ON public.call_times;

CREATE POLICY "call_times_select" ON public.call_times
  FOR SELECT
  TO authenticated
  USING (
    (model_profile_id IS NOT NULL) AND 
    EXISTS (
      SELECT 1
      FROM model_profiles
      WHERE (model_profiles.id = call_times.model_profile_id) 
        AND (model_profiles.profile_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = call_times.event_id) 
        AND (events.organizer_id = auth.uid())
    ) OR
    (stakeholder_id IS NOT NULL) AND
    EXISTS (
      SELECT 1
      FROM stakeholders
      WHERE (stakeholders.id = call_times.stakeholder_id) 
        AND (stakeholders.profile_id = auth.uid())
    )
  );
