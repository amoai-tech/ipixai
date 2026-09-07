-- IPI-585 · SCR-24 — public RPC bridge for talent onboarding writes.
--
-- `talent` is not in supabase/config.toml exposed Data API schemas, so
-- browser/PostgREST `.from("talent_profiles")` cannot insert. Same pattern as
-- public.create_booking_request / public.check_talent_availability:
-- a narrow SECURITY DEFINER surface, not exposing the schema.
--
-- Also adds get_own_talent_profile() for the /app/talent index lookup, and a
-- unique self-profile index so Finish cannot create duplicate marketplace rows.
--
-- Rollback:
--   drop function if exists public.create_talent_profile_with_sources(text, text, text, text, text, numeric, text[], text, uuid, jsonb);
--   drop function if exists public.get_own_talent_profile();
--   drop index if exists talent.talent_profiles_one_self_profile;

create unique index if not exists talent_profiles_one_self_profile
  on talent.talent_profiles (profile_id)
  where profile_id is not null;

create or replace function public.get_own_talent_profile()
returns jsonb
language plpgsql
security definer
set search_path = public, talent
as $func$
declare
  v_row jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select to_jsonb(t)
    into v_row
  from talent.talent_profiles_public t
  join talent.talent_profiles p on p.id = t.id
  where p.profile_id = auth.uid()
  limit 1;

  return v_row;
end;
$func$;

revoke all on function public.get_own_talent_profile() from public, anon;
grant execute on function public.get_own_talent_profile() to authenticated;

create or replace function public.create_talent_profile_with_sources(
  p_display_name text,
  p_bio text default null,
  p_handle text default null,
  p_niche text default null,
  p_location text default null,
  p_half_day numeric default null,
  p_languages text[] default '{}'::text[],
  p_source_url text default null,
  p_agency_org_id uuid default null,
  p_sources jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, talent
as $func$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_profile_id uuid;
  v_agency_org_id uuid;
  v_source jsonb;
  v_field_name text;
  v_confidence numeric;
  v_sources_inserted integer := 0;
  v_source_count integer;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'display_name is required';
  end if;

  if p_source_url is null or btrim(p_source_url) = '' then
    raise exception 'source_url is required';
  end if;

  if p_sources is null or jsonb_typeof(p_sources) is distinct from 'array' then
    raise exception 'sources must be a JSON array';
  end if;

  select jsonb_array_length(p_sources) into v_source_count;
  if v_source_count is null or v_source_count < 1 then
    raise exception 'at least one provenance source is required';
  end if;

  select role into v_role
  from public.profiles
  where id = v_uid;

  if p_agency_org_id is not null then
    if not public.is_org_editor_or_above(p_agency_org_id) then
      raise exception 'not an editor of this organization';
    end if;
    v_agency_org_id := p_agency_org_id;
    v_profile_id := null;
  else
    if v_role is distinct from 'model'
       and not exists (
         select 1
         from public.org_members m
         where m.user_id = v_uid
           and m.role in ('owner', 'editor')
       )
    then
      raise exception 'talent or agency role required';
    end if;
    v_profile_id := v_uid;
    v_agency_org_id := null;
  end if;

  insert into talent.talent_profiles (
    profile_id,
    agency_org_id,
    display_name,
    bio,
    measurements,
    rates,
    languages,
    travel_ready,
    verification_status,
    ai_tags
  )
  values (
    v_profile_id,
    v_agency_org_id,
    btrim(p_display_name),
    nullif(btrim(coalesce(p_bio, '')), ''),
    '{}'::jsonb,
    case
      when p_half_day is null then '{}'::jsonb
      else jsonb_build_object('half_day', p_half_day)
    end,
    coalesce(p_languages, '{}'::text[]),
    false,
    'pending',
    jsonb_strip_nulls(
      jsonb_build_object(
        'handle', nullif(btrim(coalesce(p_handle, '')), ''),
        'niche', nullif(btrim(coalesce(p_niche, '')), ''),
        'location', nullif(btrim(coalesce(p_location, '')), '')
      )
    )
  )
  returning id into v_profile_id;

  for v_source in select * from jsonb_array_elements(p_sources)
  loop
    v_field_name := nullif(btrim(coalesce(v_source->>'field_name', v_source->>'key', '')), '');
    begin
      v_confidence := (v_source->>'confidence')::numeric;
    exception
      when others then
        raise exception 'invalid source confidence';
    end;

    if v_field_name is null then
      raise exception 'source field_name is required';
    end if;

    if v_confidence is null or v_confidence < 0 or v_confidence > 100 then
      raise exception 'source confidence must be between 0 and 100';
    end if;

    insert into talent.talent_profile_sources (
      talent_profile_id,
      field_name,
      source_url,
      confidence
    )
    values (
      v_profile_id,
      v_field_name,
      btrim(p_source_url),
      v_confidence
    );

    v_sources_inserted := v_sources_inserted + 1;
  end loop;

  if v_sources_inserted <> v_source_count then
    raise exception 'failed to insert all provenance rows';
  end if;

  return jsonb_build_object(
    'id', v_profile_id,
    'display_name', btrim(p_display_name),
    'bio', nullif(btrim(coalesce(p_bio, '')), ''),
    'verification_status', 'pending',
    'sources_inserted', v_sources_inserted
  );
exception
  when unique_violation then
    raise exception 'talent profile already exists';
end;
$func$;

revoke all on function public.create_talent_profile_with_sources(text, text, text, text, text, numeric, text[], text, uuid, jsonb)
  from public, anon;
grant execute on function public.create_talent_profile_with_sources(text, text, text, text, text, numeric, text[], text, uuid, jsonb)
  to authenticated;
