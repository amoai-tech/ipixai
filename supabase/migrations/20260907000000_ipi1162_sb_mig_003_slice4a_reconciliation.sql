-- IPI-1162 · SB-MIG-003 — Slice 4A: deterministic parity/security fixes.
-- Covers 4 of the 7 verified material differences from the fresh-replay
-- diff. Every item was individually verified (character-preserving fetch +
-- per-line comment strip, not pattern-matching) against live production
-- before being decided. No historical migration is edited or rewritten.
--
-- Deliberately NOT in this migration (see Slice 4 discussion in
-- supabase/docs/audit/ipi-1162-migration-recovery.md):
--   - block_brand_org_change: local's recovered version already fixes a
--     NULL-unsafety + wrong-id bug present in production's live version.
--     Local wins; production needs a separate, later hardening migration.
--   - brand_scores_select_via_brand: production scopes this policy to
--     PUBLIC (includes anon); local scopes it to authenticated only.
--     is_org_member() always evaluates false for an anonymous caller, so
--     this is functionally dead code either way, but authenticated-only is
--     the correct, least-privilege scoping. Local wins; production needs
--     hardening later.
--   - trigger_set_timestamps: confirmed dead on both sides (zero triggers
--     reference public.trigger_set_timestamps() anywhere; the only live
--     trigger using this name, mastra_ai_spans_timestamps, calls the
--     separate mastra.trigger_set_timestamps() instead). Not recreated.
--   - The 4 anon-role "demo mode" INSERT policies (events, event_phases,
--     event_schedules, ticket_tiers) + the sentinel-organizer_id escape
--     hatch on "organizers can insert events": real, coherent production
--     feature, confirmed live, but broadens anonymous write access across
--     4 tables — an explicit product/security decision, not a database-
--     history recovery detail. Held for a separate migration pending that
--     decision.

-- 1. set_updated_at: drop the unnecessary SECURITY DEFINER (matches
-- production's already-hardened state — the function only stamps
-- NEW.updated_at, nothing requiring elevated rights).
alter function public.set_updated_at() security invoker;

-- 2. handle_new_user: production's richer profile-reconciliation contract
-- (writes auth_provider/provider_user_id/onboarding_status, fuller upsert
-- reconciliation) — production has evolved past what any migration
-- captured; brings the recovered chain's final state in line with the real,
-- currently-desired auth/profile contract.
--
-- Two more gaps found by PR review, same root cause (real production
-- objects never captured by any migration), fixed here:
--   a. public.profiles never gained auth_provider/provider_user_id/
--      onboarding_status anywhere in the 320-file chain — only this
--      function referenced them. Verified live against production's real
--      column list/defaults before adding.
--   b. No migration anywhere creates the on_auth_user_created trigger on
--      auth.users that actually invokes handle_new_user() — the function
--      existed in history, but nothing wired it up. Without it, no fresh
--      signup ever gets a profiles row. Verified live against production's
--      real pg_get_triggerdef before adding, verbatim.
alter table public.profiles
  add column if not exists auth_provider text,
  add column if not exists provider_user_id text,
  add column if not exists onboarding_status text not null default 'pending';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
insert into public.profiles (
  id,
  email,
  full_name,
  avatar_url,
  auth_provider,
  provider_user_id,
  onboarding_status
)
values (
  new.id,
  coalesce(new.email, new.raw_user_meta_data->>'email'),
  coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
  coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
  coalesce(new.raw_app_meta_data->>'provider', 'email'),
  coalesce(new.raw_user_meta_data->>'sub', new.raw_user_meta_data->>'provider_id'),
  'pending'
)
on conflict (id) do update
set email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    auth_provider = coalesce(excluded.auth_provider, profiles.auth_provider),
    provider_user_id = coalesce(excluded.provider_user_id, profiles.provider_user_id),
    updated_at = now()
where profiles.email is distinct from excluded.email
   or profiles.full_name is distinct from excluded.full_name
   or profiles.avatar_url is distinct from excluded.avatar_url
   or profiles.auth_provider is distinct from excluded.auth_provider
   or profiles.provider_user_id is distinct from excluded.provider_user_id;
return new;
exception when others then
  raise warning 'handle_new_user failed: %', sqlerrm;
  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. create_default_event_phases: restore SECURITY DEFINER (the trigger's
-- inserts into event_phases genuinely need it — event_phases' own RLS
-- requires events.organizer_id = auth.uid(), which a plain SECURITY INVOKER
-- trigger could not itself satisfy on the caller's behalf), but HARDENED
-- rather than copied from production literally:
--   - search_path locked to pg_catalog, public (production uses a bare
--     'public', weaker than necessary for a SECURITY DEFINER function)
--   - all mutable objects schema-qualified (public.event_phases, not the
--     bare event_phases production's version uses)
--   - the app.bypass_rls set_config call is NOT reproduced: verified live
--     that zero RLS policies or functions anywhere read that setting — it
--     is inert. SECURITY DEFINER + the postgres owner is the actual and
--     only mechanism bypassing RLS here.
-- EXECUTE grants already match production (postgres, service_role only —
-- confirmed live, no PUBLIC execute) and are left untouched.
create or replace function public.create_default_event_phases()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
DECLARE
  phase_names text[] := array[
    'Concept & Vision', 'Budget & Funding', 'Collection Development', 'Casting & Fittings',
    'Venue Selection', 'Production Design', 'Sponsor Acquisition', 'Marketing & PR',
    'Technical Setup', 'Rehearsals', 'Final Preparations', 'Showtime Execution',
    'Post-Event Content', 'ROI & Review'
  ];
  phase_keys text[] := array[
    'concept', 'budget', 'collection', 'casting', 'venue', 'production_design',
    'sponsors', 'marketing', 'technical', 'rehearsals', 'final_prep', 'showtime',
    'post_content', 'roi'
  ];
  i integer;
BEGIN
  FOR i IN 1..14 LOOP
    INSERT INTO public.event_phases (event_id, phase_name, phase_key, order_index)
    VALUES (NEW.id, phase_names[i], phase_keys[i], i - 1);
  END LOOP;
  RETURN NEW;
END;
$function$;

-- 4. transition_booking: restore the 4 missing early-return response fields
-- (a real API-response gap). Reproduced VERBATIM from production's live
-- pg_get_functiondef (not reconstructed from memory) after an earlier draft
-- of this migration was caught fabricating a simplified state machine that
-- silently dropped the auth.uid() null check, the cancellation_reason and
-- rate_quoted requirements, and 8 of the 10 valid status transitions
-- (approved/declined and most reschedule paths). search_path already
-- includes pg_catalog on production — nothing to harden here.
create or replace function public.transition_booking(p_booking_id uuid, p_expected_version integer, p_to_status text DEFAULT NULL::text, p_rate_quoted numeric DEFAULT NULL::numeric, p_date_start date DEFAULT NULL::date, p_date_end date DEFAULT NULL::date, p_cancellation_reason text DEFAULT NULL::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'talent', 'shoot'
as $function$
declare
  v_booking talent.bookings%rowtype;
  v_from_status text;
  v_is_brand boolean;
  v_is_talent boolean;
  v_is_agency boolean;
  v_allowed boolean;
  v_date_only boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_booking_id is null then
    raise exception 'booking_id is required';
  end if;

  if p_expected_version is null then
    raise exception 'expected_version is required';
  end if;

  select * into v_booking
  from talent.bookings
  where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'booking not found';
  end if;

  v_from_status := v_booking.status;

  v_is_brand := public.is_org_member(v_booking.brand_org_id);

  select exists (
    select 1
    from talent.talent_profiles tp
    where tp.id = v_booking.talent_profile_id
      and tp.profile_id = auth.uid()
  ) into v_is_talent;

  select exists (
    select 1
    from talent.talent_profiles tp
    where tp.id = v_booking.talent_profile_id
      and tp.agency_org_id is not null
      and public.is_org_member(tp.agency_org_id)
  ) into v_is_agency;

  if not (v_is_brand or v_is_talent or v_is_agency) then
    raise exception 'not authorized for this booking';
  end if;

  if v_booking.version is distinct from p_expected_version then
    raise exception 'stale_booking';
  end if;

  v_date_only := p_to_status is null;

  if v_date_only then
    if v_from_status not in ('requested', 'quoted') then
      raise exception 'invalid_transition';
    end if;

    if p_date_start is null or p_date_end is null then
      raise exception 'date_start and date_end are required for reschedule';
    end if;

    if p_date_start > p_date_end then
      raise exception 'invalid date range: start date must be on or before end date';
    end if;

    update talent.bookings
    set
      date_start = p_date_start,
      date_end = p_date_end,
      version = version + 1
    where id = p_booking_id
      and version = p_expected_version
    returning * into v_booking;

    if v_booking.id is null then
      raise exception 'stale_booking';
    end if;

    return jsonb_build_object(
      'booking_id', v_booking.id,
      'status', v_booking.status,
      'version', v_booking.version,
      'from_status', v_from_status,
      'to_status', v_booking.status,
      'date_start', v_booking.date_start,
      'date_end', v_booking.date_end,
      'rate_quoted', v_booking.rate_quoted,
      'approved_by', v_booking.approved_by,
      'cancelled_by', v_booking.cancelled_by,
      'cancellation_reason', v_booking.cancellation_reason
    );
  end if;

  if p_to_status in ('confirmed', 'expired') then
    raise exception 'invalid_transition';
  end if;

  if v_from_status in ('declined', 'expired', 'cancelled') then
    raise exception 'invalid_transition';
  end if;

  if p_to_status = 'cancelled' then
    if p_cancellation_reason is null or btrim(p_cancellation_reason) = '' then
      raise exception 'cancellation_reason_required';
    end if;
  end if;

  if v_from_status = 'requested' and p_to_status = 'quoted' then
    v_allowed := v_is_talent or v_is_agency;
    if p_rate_quoted is null or p_rate_quoted < 0 then
      raise exception 'rate_quoted is required for quoted transition';
    end if;
  elsif v_from_status = 'requested' and p_to_status = 'approved' then
    v_allowed := v_is_brand;
  elsif v_from_status = 'requested' and p_to_status = 'declined' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  elsif v_from_status = 'requested' and p_to_status = 'cancelled' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  elsif v_from_status = 'quoted' and p_to_status = 'approved' then
    v_allowed := v_is_brand;
  elsif v_from_status = 'quoted' and p_to_status = 'declined' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  elsif v_from_status = 'quoted' and p_to_status = 'cancelled' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  elsif v_from_status = 'quoted' and p_to_status = 'requested' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  elsif v_from_status = 'approved' and p_to_status = 'cancelled' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  elsif v_from_status = 'confirmed' and p_to_status = 'cancelled' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  else
    v_allowed := false;
  end if;

  if not coalesce(v_allowed, false) then
    raise exception 'invalid_transition';
  end if;

  if p_date_start is not null or p_date_end is not null then
    if p_date_start is null or p_date_end is null then
      raise exception 'date_start and date_end must both be provided when rescheduling';
    end if;
    if p_date_start > p_date_end then
      raise exception 'invalid date range: start date must be on or before end date';
    end if;
  end if;

  update talent.bookings
  set
    status = p_to_status,
    version = version + 1,
    rate_quoted = case
      when p_to_status = 'quoted' then p_rate_quoted
      else rate_quoted
    end,
    date_start = coalesce(p_date_start, date_start),
    date_end = coalesce(p_date_end, date_end),
    approved_by = case
      when p_to_status = 'approved' then auth.uid()
      else approved_by
    end,
    cancelled_by = case
      when p_to_status = 'cancelled' then auth.uid()
      else cancelled_by
    end,
    cancellation_reason = case
      when p_to_status = 'cancelled' then p_cancellation_reason
      else cancellation_reason
    end
  where id = p_booking_id
    and version = p_expected_version
  returning * into v_booking;

  if v_booking.id is null then
    raise exception 'stale_booking';
  end if;

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'status', v_booking.status,
    'version', v_booking.version,
    'from_status', v_from_status,
    'to_status', v_booking.status,
    'date_start', v_booking.date_start,
    'date_end', v_booking.date_end,
    'rate_quoted', v_booking.rate_quoted,
    'approved_by', v_booking.approved_by,
    'cancelled_by', v_booking.cancelled_by,
    'cancellation_reason', v_booking.cancellation_reason
  );
end;
$function$;
