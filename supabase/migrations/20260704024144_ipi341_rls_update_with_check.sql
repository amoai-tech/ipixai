drop policy if exists bookings_update_party on talent.bookings;

create policy bookings_update_party on talent.bookings
  for update to authenticated
  using (false)
  with check (false);
