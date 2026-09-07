-- IPI-307 · MODEL-P1 — Model Booking MVP: core schema (talent profiles, agency rosters,
-- availability, shortlists, bookings).
--
-- Isolation: new tables live in a dedicated `talent` schema so they never collide
-- with the legacy public.model_profiles / public.model_agencies / public.event_models
-- (2025-01-25 FashionOS event-casting system — a different domain, wide-open RLS,
-- not integrated with the current organizations/org_members ownership model). Not
-- reused. Same isolation rationale as `shoot` schema (20260622120000).
--
-- Ownership: profile owner (profile_id = auth.uid()) for independent models, or
-- agency org membership (public.is_org_member / is_org_editor_or_above) for
-- agency-managed talent — both paths supported per notes-1.md's resolution.
--
-- Rollback: purely additive and namespaced — `drop schema talent cascade;`.

create schema if not exists talent;
grant usage on schema talent to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- talent_profiles
-- ---------------------------------------------------------------------------
create table talent.talent_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references auth.users(id) on delete set null,
  agency_org_id uuid references public.organizations(id) on delete cascade,
  display_name text not null,
  bio text,
  measurements jsonb not null default '{}'::jsonb,
  rates jsonb not null default '{}'::jsonb,
  languages text[] not null default '{}'::text[],
  travel_ready boolean not null default false,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified')),
  ai_tags jsonb not null default '{}'::jsonb,
  ai_embedding vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint talent_profile_exactly_one_owner
    check (num_nonnulls(profile_id, agency_org_id) = 1)
);
create index idx_talent_profiles_profile_id on talent.talent_profiles(profile_id) where profile_id is not null;
create index idx_talent_profiles_agency_org_id on talent.talent_profiles(agency_org_id) where agency_org_id is not null;

create trigger trg_talent_profiles_updated_at
  before update on talent.talent_profiles
  for each row execute function public.handle_updated_at();

alter table talent.talent_profiles enable row level security;

create policy talent_profiles_select_owner on talent.talent_profiles
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_org_member(agency_org_id)
  );

create policy talent_profiles_insert_owner on talent.talent_profiles
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    or public.is_org_editor_or_above(agency_org_id)
  );

create policy talent_profiles_update_owner on talent.talent_profiles
  for update to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_org_editor_or_above(agency_org_id)
  )
  with check (
    profile_id = (select auth.uid())
    or public.is_org_editor_or_above(agency_org_id)
  );

create policy talent_profiles_delete_owner on talent.talent_profiles
  for delete to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_org_owner(agency_org_id)
  );

-- Marketplace-safe read view — no rates/embedding/verification internals exposed.
-- Not security_invoker: runs with the view owner's privileges, bypassing the
-- owner-only RLS above by design (same shape as the existing read-only
-- `products` snapshot pattern) so any authenticated brand can browse talent.
create view talent.talent_profiles_public
  with (security_invoker = false) as
select
  id,
  display_name,
  bio,
  measurements,
  languages,
  travel_ready,
  verification_status,
  ai_tags,
  (agency_org_id is not null) as is_agency_represented,
  created_at
from talent.talent_profiles;

grant select on talent.talent_profiles_public to authenticated;

-- ---------------------------------------------------------------------------
-- talent_profile_sources — AI-field provenance (URL-Context onboarding)
-- ---------------------------------------------------------------------------
create table talent.talent_profile_sources (
  id uuid primary key default gen_random_uuid(),
  talent_profile_id uuid not null references talent.talent_profiles(id) on delete cascade,
  field_name text not null,
  source_url text not null,
  confidence numeric(5,2) not null check (confidence >= 0 and confidence <= 100),
  extracted_at timestamptz not null default now()
);
create index idx_talent_profile_sources_profile_id on talent.talent_profile_sources(talent_profile_id);

alter table talent.talent_profile_sources enable row level security;

-- Provenance metadata — owner-only, never brand-visible.
create policy talent_profile_sources_select_owner on talent.talent_profile_sources
  for select to authenticated
  using (
    talent_profile_id in (
      select id from talent.talent_profiles
      where profile_id = (select auth.uid())
         or public.is_org_member(agency_org_id)
    )
  );

create policy talent_profile_sources_insert_owner on talent.talent_profile_sources
  for insert to authenticated
  with check (
    talent_profile_id in (
      select id from talent.talent_profiles
      where profile_id = (select auth.uid())
         or public.is_org_editor_or_above(agency_org_id)
    )
  );

-- ---------------------------------------------------------------------------
-- agency_talent — roster join
--
-- Not redundant with talent_profiles.agency_org_id: that column establishes
-- OWNERSHIP (which agency manages this profile, used by RLS above). This
-- table stores the RELATIONSHIP's own data (commission, active/inactive
-- roster status, notes) that doesn't belong on the profile row itself.
-- ---------------------------------------------------------------------------
create table talent.agency_talent (
  agency_org_id uuid not null references public.organizations(id) on delete cascade,
  talent_profile_id uuid not null references talent.talent_profiles(id) on delete cascade,
  commission_pct numeric(5,2) check (commission_pct >= 0 and commission_pct <= 100),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  primary key (agency_org_id, talent_profile_id)
);

alter table talent.agency_talent enable row level security;

create policy agency_talent_select_member on talent.agency_talent
  for select to authenticated
  using (public.is_org_member(agency_org_id));

create policy agency_talent_insert_editor on talent.agency_talent
  for insert to authenticated
  with check (public.is_org_editor_or_above(agency_org_id));

create policy agency_talent_update_editor on talent.agency_talent
  for update to authenticated
  using (public.is_org_editor_or_above(agency_org_id))
  with check (public.is_org_editor_or_above(agency_org_id));

create policy agency_talent_delete_owner on talent.agency_talent
  for delete to authenticated
  using (public.is_org_owner(agency_org_id));

-- ---------------------------------------------------------------------------
-- talent_availability
-- ---------------------------------------------------------------------------
create table talent.talent_availability (
  id uuid primary key default gen_random_uuid(),
  talent_profile_id uuid not null references talent.talent_profiles(id) on delete cascade,
  -- Links a tentative/booked row to the booking that caused it, so the
  -- status-change trigger (confirm_booking_rpc migration) can precisely
  -- release/update the right row on cancel/decline/reschedule — matching by
  -- date range alone is ambiguous once a reschedule changes the dates.
  -- Null for manually-set available/blocked rows (no booking behind those).
  -- FK added below (after talent.bookings exists later in this file) to
  -- avoid a forward reference.
  booking_id uuid,
  date_range daterange not null,
  status text not null check (status in ('available', 'blocked', 'tentative', 'booked')),
  created_at timestamptz not null default now()
  -- No overlap constraint here by design: tentative/booked rows are derived
  -- side effects of booking status changes and a transitional overlap with an
  -- older row is expected, not an error. The actual double-booking guarantee
  -- lives on talent.bookings' own EXCLUDE constraint below, not here.
);
create index idx_talent_availability_profile_id on talent.talent_availability(talent_profile_id);
-- Unique (not just indexed): one derived row per booking, and it's the
-- ON CONFLICT target the status-change trigger upserts against
-- (confirm_booking_rpc migration).
create unique index idx_talent_availability_booking_id on talent.talent_availability(booking_id) where booking_id is not null;

alter table talent.talent_availability enable row level security;

-- Owner full access. Brands with a live booking against this talent get a
-- narrow read — not blanket read of a talent's whole calendar.
create policy talent_availability_select_owner on talent.talent_availability
  for select to authenticated
  using (
    talent_profile_id in (
      select id from talent.talent_profiles
      where profile_id = (select auth.uid())
         or public.is_org_member(agency_org_id)
    )
  );

-- Client (authenticated) writes are restricted to available/blocked only —
-- tentative/booked are exclusively written by the SECURITY DEFINER trigger
-- (bypasses RLS), never by a direct client insert/update.
create policy talent_availability_insert_owner on talent.talent_availability
  for insert to authenticated
  with check (
    status in ('available', 'blocked')
    and talent_profile_id in (
      select id from talent.talent_profiles
      where profile_id = (select auth.uid())
         or public.is_org_editor_or_above(agency_org_id)
    )
  );

create policy talent_availability_update_owner on talent.talent_availability
  for update to authenticated
  using (
    talent_profile_id in (
      select id from talent.talent_profiles
      where profile_id = (select auth.uid())
         or public.is_org_editor_or_above(agency_org_id)
    )
  )
  with check (
    status in ('available', 'blocked')
    and talent_profile_id in (
      select id from talent.talent_profiles
      where profile_id = (select auth.uid())
         or public.is_org_editor_or_above(agency_org_id)
    )
  );

create policy talent_availability_delete_owner on talent.talent_availability
  for delete to authenticated
  using (
    talent_profile_id in (
      select id from talent.talent_profiles
      where profile_id = (select auth.uid())
         or public.is_org_editor_or_above(agency_org_id)
    )
  );

-- ---------------------------------------------------------------------------
-- talent_shortlists / talent_shortlist_items — minimal list, not a board (MVP)
-- ---------------------------------------------------------------------------
create table talent.talent_shortlists (
  id uuid primary key default gen_random_uuid(),
  owner_org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'Shortlist',
  created_at timestamptz not null default now()
);
create index idx_talent_shortlists_owner_org_id on talent.talent_shortlists(owner_org_id);

create table talent.talent_shortlist_items (
  shortlist_id uuid not null references talent.talent_shortlists(id) on delete cascade,
  talent_profile_id uuid not null references talent.talent_profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (shortlist_id, talent_profile_id)
);

alter table talent.talent_shortlists enable row level security;
alter table talent.talent_shortlist_items enable row level security;

create policy talent_shortlists_select_member on talent.talent_shortlists
  for select to authenticated
  using (public.is_org_member(owner_org_id));

create policy talent_shortlists_insert_member on talent.talent_shortlists
  for insert to authenticated
  with check (public.is_org_member(owner_org_id));

create policy talent_shortlists_update_member on talent.talent_shortlists
  for update to authenticated
  using (public.is_org_member(owner_org_id))
  with check (public.is_org_member(owner_org_id));

create policy talent_shortlists_delete_member on talent.talent_shortlists
  for delete to authenticated
  using (public.is_org_member(owner_org_id));

create policy talent_shortlist_items_select_member on talent.talent_shortlist_items
  for select to authenticated
  using (
    shortlist_id in (select id from talent.talent_shortlists where public.is_org_member(owner_org_id))
  );

create policy talent_shortlist_items_insert_member on talent.talent_shortlist_items
  for insert to authenticated
  with check (
    shortlist_id in (select id from talent.talent_shortlists where public.is_org_member(owner_org_id))
  );

create policy talent_shortlist_items_delete_member on talent.talent_shortlist_items
  for delete to authenticated
  using (
    shortlist_id in (select id from talent.talent_shortlists where public.is_org_member(owner_org_id))
  );

-- ---------------------------------------------------------------------------
-- bookings — full lifecycle state machine
-- ---------------------------------------------------------------------------
create extension if not exists btree_gist;

create table talent.bookings (
  id uuid primary key default gen_random_uuid(),
  brand_org_id uuid not null references public.organizations(id) on delete cascade,
  talent_profile_id uuid not null references talent.talent_profiles(id) on delete restrict,
  shoot_id uuid references shoot.shoots(id) on delete set null,
  status text not null default 'requested'
    check (status in ('requested', 'quoted', 'approved', 'confirmed', 'declined', 'expired', 'cancelled')),
  date_start date not null,
  date_end date not null,
  rate_quoted numeric(10,2),
  message text,
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  expires_at timestamptz not null default (now() + interval '72 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_date_order check (date_end >= date_start),
  -- The double-booking safety net: a second CONFIRMED booking for the same
  -- talent with an overlapping date range is rejected by Postgres itself,
  -- not an app-level check (which would race under concurrent approvals).
  constraint bookings_no_overlap_when_confirmed
    exclude using gist (
      talent_profile_id with =,
      daterange(date_start, date_end, '[]') with &&
    )
    where (status = 'confirmed')
);
create index idx_bookings_brand_org_id on talent.bookings(brand_org_id);
create index idx_bookings_talent_profile_id on talent.bookings(talent_profile_id);
create index idx_bookings_status on talent.bookings(status);
create index idx_bookings_expires_at on talent.bookings(expires_at) where status = 'requested';
create index idx_bookings_shoot_id on talent.bookings(shoot_id) where shoot_id is not null;

-- Deferred FK from talent_availability (declared earlier in this file, before
-- talent.bookings existed) — added now that the referenced table exists.
alter table talent.talent_availability
  add constraint talent_availability_booking_id_fkey
  foreign key (booking_id) references talent.bookings(id) on delete cascade;

alter table talent.bookings enable row level security;

create policy bookings_select_party on talent.bookings
  for select to authenticated
  using (
    public.is_org_member(brand_org_id)
    or talent_profile_id in (
      select id from talent.talent_profiles
      where profile_id = (select auth.uid())
         or public.is_org_member(agency_org_id)
    )
  );

create policy bookings_insert_brand on talent.bookings
  for insert to authenticated
  with check (
    public.is_org_member(brand_org_id)
    and status = 'requested'
    -- Defense in depth: RLS enforces attribution, not just the API route
    -- (this repo's own principle — "database is source of truth").
    and requested_by = (select auth.uid())
  );

-- Both parties can update (quote, counter, decline, reschedule, cancel) but
-- NEITHER can set status='confirmed' directly — that's the confirm_booking()
-- RPC's job only (SECURITY DEFINER, bypasses RLS). This is the actual
-- enforcement of "only the approve route can confirm a booking".
create policy bookings_update_party on talent.bookings
  for update to authenticated
  using (
    public.is_org_member(brand_org_id)
    or talent_profile_id in (
      select id from talent.talent_profiles
      where profile_id = (select auth.uid())
         or public.is_org_editor_or_above(agency_org_id)
    )
  )
  with check (
    status is distinct from 'confirmed'
    and (
      public.is_org_member(brand_org_id)
      or talent_profile_id in (
        select id from talent.talent_profiles
        where profile_id = (select auth.uid())
           or public.is_org_editor_or_above(agency_org_id)
      )
    )
  );

create trigger trg_bookings_updated_at
  before update on talent.bookings
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- booking_status_history — append-only audit trail (also carries messages)
-- ---------------------------------------------------------------------------
create table talent.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references talent.bookings(id) on delete cascade,
  event_type text not null default 'status_change'
    check (event_type in ('status_change', 'message', 'system_expired')),
  from_status text,
  to_status text,
  actor_id uuid references auth.users(id) on delete set null,
  message text,
  created_at timestamptz not null default now()
);
create index idx_booking_status_history_booking_id on talent.booking_status_history(booking_id);

alter table talent.booking_status_history enable row level security;

create policy booking_status_history_select_party on talent.booking_status_history
  for select to authenticated
  using (
    booking_id in (
      select id from talent.bookings
      where public.is_org_member(brand_org_id)
         or talent_profile_id in (
           select id from talent.talent_profiles
           where profile_id = (select auth.uid())
              or public.is_org_member(agency_org_id)
         )
    )
  );

-- Message entries (the Booking Wizard's optional note) are the one direct
-- client insert allowed here — status_change/system_expired entries are
-- written only by the trigger/RPC below (see confirm_booking_rpc migration).
create policy booking_status_history_insert_message on talent.booking_status_history
  for insert to authenticated
  with check (
    event_type = 'message'
    and booking_id in (
      select id from talent.bookings
      where public.is_org_member(brand_org_id)
         or talent_profile_id in (
           select id from talent.talent_profiles
           where profile_id = (select auth.uid())
              or public.is_org_editor_or_above(agency_org_id)
         )
    )
  );

-- delete included: talent_profiles/agency_talent/talent_availability/
-- talent_shortlists/talent_shortlist_items all have DELETE RLS policies above —
-- without this grant those policies are unreachable (Postgres checks the
-- table-level GRANT before RLS is ever consulted).
grant select, insert, update, delete on all tables in schema talent to authenticated;
grant all on all tables in schema talent to service_role;
grant select on talent.talent_profiles_public to authenticated, anon;
alter default privileges in schema talent grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema talent grant all on tables to service_role;
