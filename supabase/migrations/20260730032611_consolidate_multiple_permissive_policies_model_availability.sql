-- Consolidate model_availability SELECT policies
DROP POLICY IF EXISTS "models can view own availability" ON public.model_availability;
DROP POLICY IF EXISTS "organizers can view model availability" ON public.model_availability;

CREATE POLICY "model_availability_select" ON public.model_availability
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM model_profiles
      WHERE (model_profiles.id = model_availability.model_profile_id) 
        AND (model_profiles.profile_id = auth.uid())
    ) OR
    (event_id IS NULL) OR
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = model_availability.event_id) 
        AND (events.organizer_id = auth.uid())
    )
  );
