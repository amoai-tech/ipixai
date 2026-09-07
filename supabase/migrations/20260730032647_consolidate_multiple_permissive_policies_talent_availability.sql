-- Consolidate talent.talent_availability SELECT policies
DROP POLICY IF EXISTS "talent_availability_select_owner" ON talent.talent_availability;
DROP POLICY IF EXISTS "talent_availability_select_brand" ON talent.talent_availability;

CREATE POLICY "talent_availability_select" ON talent.talent_availability
  FOR SELECT
  TO authenticated
  USING (
    talent_profile_id IN (
      SELECT talent_profiles.id
      FROM talent.talent_profiles
      WHERE (talent_profiles.profile_id = ( SELECT auth.uid() AS uid)) 
        OR is_org_member(talent_profiles.agency_org_id)
    ) OR
    booking_id IN (
      SELECT bookings.id
      FROM talent.bookings
      WHERE is_org_member(bookings.brand_org_id)
    )
  );
