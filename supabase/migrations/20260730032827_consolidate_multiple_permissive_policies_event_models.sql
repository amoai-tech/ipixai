-- Consolidate event_models SELECT policies
DROP POLICY IF EXISTS "authenticated can view published event models" ON public.event_models;
DROP POLICY IF EXISTS "models can view own casting" ON public.event_models;
DROP POLICY IF EXISTS "organizers can view event models" ON public.event_models;

CREATE POLICY "event_models_select" ON public.event_models
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_models.event_id) 
        AND (events.status = 'published'::event_status) 
        AND (events.is_public = true)
    ) OR
    EXISTS (
      SELECT 1
      FROM model_profiles
      WHERE (model_profiles.id = event_models.model_profile_id) 
        AND (model_profiles.profile_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_models.event_id) 
        AND (events.organizer_id = auth.uid())
    )
  );
