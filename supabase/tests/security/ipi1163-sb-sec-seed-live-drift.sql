-- IPI-1163 · SB-SEC — seed step: recreate production's exact live-only
-- anon demo-event policies AND grants (never in git per IPI-1162's Case B
-- decision) on top of a fresh migration replay, so the CI job can prove
-- the retirement migration actually closes real anon write access, not
-- just that the final state happens to be correct. This runs on a
-- database where 20260907040000's grant revoke has ALREADY applied (it's
-- part of the same fresh replay), so the GRANTs must be restored here
-- too, not just the policies, to accurately simulate production's real
-- current live state.
--
-- events.organizer_id has an FK to auth.users(id) -- confirmed read-only
-- that NO auth.users row with the sentinel id exists on production either,
-- so this feature could never have actually inserted a row there even if
-- something tried. Seeded here anyway so this test exercises the RLS
-- policy layer specifically, in isolation from that (already-present,
-- independent) FK protection.
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ipi1163-sentinel@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

grant insert, update, delete, truncate, references, trigger
  on public.events, public.event_phases, public.event_schedules, public.ticket_tiers, public.brand_scores
  to anon;

create policy "anon can insert demo events" on public.events
  for insert to anon
  with check (organizer_id = '00000000-0000-0000-0000-000000000000'::uuid);

create policy "anon can insert demo event phases" on public.event_phases
  for insert to anon
  with check (exists (select 1 from public.events where events.id = event_phases.event_id and events.organizer_id = '00000000-0000-0000-0000-000000000000'::uuid));

create policy "anon can insert demo event schedules" on public.event_schedules
  for insert to anon
  with check (exists (select 1 from public.events where events.id = event_schedules.event_id and events.organizer_id = '00000000-0000-0000-0000-000000000000'::uuid));

create policy "anon can insert demo ticket tiers" on public.ticket_tiers
  for insert to anon
  with check (exists (select 1 from public.events where events.id = ticket_tiers.event_id and events.organizer_id = '00000000-0000-0000-0000-000000000000'::uuid));

alter policy "organizers can insert events" on public.events
  with check (auth.uid() = organizer_id or organizer_id = '00000000-0000-0000-0000-000000000000'::uuid);

alter policy "event_phases_insert" on public.event_phases
  with check (
    exists (select 1 from events where events.id = event_phases.event_id and events.organizer_id = auth.uid())
    or exists (select 1 from events where events.id = event_phases.event_id and events.organizer_id = '00000000-0000-0000-0000-000000000000'::uuid)
  );
