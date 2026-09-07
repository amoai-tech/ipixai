-- Consolidate event_assets SELECT policies for authenticated role
DROP POLICY IF EXISTS "authenticated can view featured event assets" ON public.event_assets;
DROP POLICY IF EXISTS "organizers can view event assets" ON public.event_assets;

CREATE POLICY "event_assets_select" ON public.event_assets
  FOR SELECT
  TO authenticated
  USING (
    (is_featured = true) AND 
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_assets.event_id) 
        AND (events.status = 'published'::event_status) 
        AND (events.is_public = true)
    ) OR
    EXISTS (
      SELECT 1
      FROM events
      WHERE (events.id = event_assets.event_id) 
        AND (events.organizer_id = auth.uid())
    )
  );
