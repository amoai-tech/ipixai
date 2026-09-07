-- Consolidate multiple permissive SELECT policies on payments table
-- Combine "users can view own payments" and "organizers can view event payments"

DROP POLICY IF EXISTS "users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "organizers can view event payments" ON public.payments;

-- Create consolidated SELECT policy
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view own payments
    auth.uid() = payer_id OR
    -- Organizers can view event payments
    EXISTS (
      SELECT 1
      FROM (registrations
        JOIN events ON ((events.id = registrations.event_id)))
      WHERE (registrations.id = payments.registration_id)
        AND (events.organizer_id = auth.uid())
    )
  );
