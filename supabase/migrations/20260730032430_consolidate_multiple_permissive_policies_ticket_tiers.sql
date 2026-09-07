-- Consolidate ticket_tiers SELECT policies
DROP POLICY IF EXISTS "authenticated can view published ticket tiers" ON public.ticket_tiers;
DROP POLICY IF EXISTS "organizers can view ticket tiers" ON public.ticket_tiers;

-- Create consolidated SELECT policy
CREATE POLICY "ticket_tiers_select" ON public.ticket_tiers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = ticket_tiers.event_id
        AND events.status = 'published'::event_status
        AND events.is_public = true
    ) OR
    EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = ticket_tiers.event_id
        AND events.organizer_id = auth.uid()
    )
  );
