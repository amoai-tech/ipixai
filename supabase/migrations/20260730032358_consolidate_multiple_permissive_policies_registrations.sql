-- Consolidate multiple permissive SELECT policies on registrations table
-- Combine "users can view own registrations" and "organizers can view event registrations"

DROP POLICY IF EXISTS "users can view own registrations" ON public.registrations;
DROP POLICY IF EXISTS "organizers can view event registrations" ON public.registrations;

-- Create consolidated SELECT policy
CREATE POLICY "registrations_select" ON public.registrations
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view own registrations
    auth.uid() = profile_id OR
    -- Organizers can view event registrations
    EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = registrations.event_id
        AND events.organizer_id = auth.uid()
    )
  );
